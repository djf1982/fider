package linear

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/dbx"
	"github.com/getfider/fider/app/pkg/env"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/log"
	"github.com/getfider/fider/app/services/linear/linearsync"
)

// The Scoutworks voter-group lookup takes at most this many emails a call.
const voterLookupBatch = 100

// The backfill waits this long between posts, to stay well inside the
// Scoutworks lookup's rate limit (120 a minute) and Linear's.
const backfillPause = time.Second

const customerUpsertMutation = `
mutation CustomerUpsert($input: CustomerUpsertInput!) {
  customerUpsert(input: $input) { success }
}`

const customerNeedCreateMutation = `
mutation CustomerNeedCreate($input: CustomerNeedCreateInput!) {
  customerNeedCreate(input: $input) { success need { id } }
}`

const customerNeedDeleteMutation = `
mutation CustomerNeedDelete($id: String!) {
  customerNeedDelete(id: $id) { success }
}`

const issueStateQuery = `
query IssueState($id: String!) {
  issue(id: $id) { state { id } }
}`

const issueUpdateStateMutation = `
mutation IssueUpdateState($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) { success }
}`

// enabledIntegration returns the tenant's Linear integration, or nil when it
// is missing or turned off.
func enabledIntegration(ctx context.Context) (*entity.LinearIntegration, error) {
	q := &query.GetLinearIntegration{}
	if err := bus.Dispatch(ctx, q); err != nil {
		if errors.Cause(err) == app.ErrNotFound {
			return nil, nil
		}
		return nil, errors.Wrap(err, "load linear integration")
	}
	if q.Result == nil || !q.Result.IsEnabled {
		return nil, nil
	}
	return q.Result, nil
}

// linearIssueFor returns the post's Linear issue, or nil when it has none.
func linearIssueFor(ctx context.Context, postID int) (*entity.PostLinearIssue, error) {
	q := &query.GetLinearIssueForPost{PostID: postID}
	if err := bus.Dispatch(ctx, q); err != nil {
		if errors.Cause(err) == app.ErrNotFound {
			return nil, nil
		}
		return nil, errors.Wrap(err, "load linear issue for post")
	}
	if q.Result == nil || q.Result.LinearIssueID == "" {
		return nil, nil
	}
	return q.Result, nil
}

func syncPostVotesToLinear(ctx context.Context, c *cmd.SyncPostVotesToLinear) error {
	integration, err := enabledIntegration(ctx)
	if err != nil || integration == nil {
		return err
	}
	issue, err := linearIssueFor(ctx, c.PostID)
	if err != nil || issue == nil {
		return err
	}
	return syncVotes(ctx, integration, issue, map[string]bool{})
}

// syncVotes makes the issue's customer needs match the post's upvotes.
//
// A worker task runs in one transaction, and a returned error rolls it back.
// A rollback would forget needs that Linear already holds, and the next run
// would create them again. So a failed Linear call is logged and skipped, and
// only a database error is returned.
func syncVotes(ctx context.Context, integration *entity.LinearIntegration, issue *entity.PostLinearIssue, upserted map[string]bool) error {
	votes := &query.ListPostVotes{PostID: issue.PostID, IncludeEmail: true}
	stored := &query.ListLinearCustomerNeeds{PostID: issue.PostID}
	if err := bus.Dispatch(ctx, votes, stored); err != nil {
		return errors.Wrap(err, "load votes and customer needs")
	}

	plan := linearsync.PlanNeeds(linearsync.Upvoters(votes.Result), toStoredNeeds(stored.Result), time.Now())
	apiKey := integration.APIKey

	for _, n := range plan.Reclaim {
		if err := bus.Dispatch(ctx, &cmd.DeleteLinearCustomerNeed{PostID: issue.PostID, UserID: n.UserID}); err != nil {
			return err
		}
	}

	for _, n := range plan.Delete {
		if err := deleteCustomerNeed(ctx, apiKey, n.NeedID); err != nil {
			logSyncFailure(ctx, "delete a customer need", issue, err)
			continue
		}
		if err := bus.Dispatch(ctx, &cmd.DeleteLinearCustomerNeed{PostID: issue.PostID, UserID: n.UserID, LinearNeedID: n.NeedID}); err != nil {
			return err
		}
	}

	if len(plan.Create) == 0 {
		return nil
	}

	groups, err := lookupVoterGroups(ctx, plan.Create)
	if err != nil {
		// Never count these votes under the catch-all customer because the
		// lookup failed: the next vote or backfill tries again.
		logSyncFailure(ctx, "look up voter groups", issue, err)
		return nil
	}

	for _, v := range plan.Create {
		claim := &cmd.ClaimLinearCustomerNeed{PostID: issue.PostID, UserID: v.UserID}
		if err := bus.Dispatch(ctx, claim); err != nil {
			return err
		}
		if !claim.Result {
			continue
		}

		customer := linearsync.CustomerFor(groups[strings.ToLower(v.Email)])
		needID, err := createCustomerNeed(ctx, apiKey, issue.LinearIssueID, customer, v, upserted)
		if err != nil {
			logSyncFailure(ctx, "create a customer need", issue, err)
			if err := bus.Dispatch(ctx, &cmd.DeleteLinearCustomerNeed{PostID: issue.PostID, UserID: v.UserID}); err != nil {
				return err
			}
			continue
		}
		if err := bus.Dispatch(ctx, &cmd.SetLinearCustomerNeedID{PostID: issue.PostID, UserID: v.UserID, LinearNeedID: needID}); err != nil {
			return err
		}
	}
	return nil
}

func toStoredNeeds(rows []*entity.PostLinearCustomerNeed) []linearsync.StoredNeed {
	needs := make([]linearsync.StoredNeed, 0, len(rows))
	for _, r := range rows {
		needs = append(needs, linearsync.StoredNeed{UserID: r.UserID, NeedID: r.LinearNeedID, ClaimedAt: r.CreatedAt})
	}
	return needs
}

func logSyncFailure(ctx context.Context, action string, issue *entity.PostLinearIssue, err error) {
	log.Warnf(ctx, "Linear vote sync could not @{Action} for issue @{Issue}: @{Error}", dto.Props{
		"Action": action,
		"Issue":  issue.LinearIssueIdentifier,
		"Error":  err.Error(),
	})
}

// createCustomerNeed makes sure the customer exists, then adds the need.
// upserted remembers the customers this run already wrote.
func createCustomerNeed(ctx context.Context, apiKey, issueID string, customer linearsync.Customer, voter linearsync.Voter, upserted map[string]bool) (string, error) {
	if !upserted[customer.ExternalID] {
		input := map[string]interface{}{"externalId": customer.ExternalID, "name": customer.Name}
		if customer.Size > 0 {
			input["size"] = customer.Size
		}
		out := &struct {
			CustomerUpsert struct {
				Success bool `json:"success"`
			} `json:"customerUpsert"`
		}{}
		if err := doGraphQL(ctx, apiKey, graphqlRequest{Query: customerUpsertMutation, Variables: map[string]interface{}{"input": input}}, out); err != nil {
			return "", err
		}
		if !out.CustomerUpsert.Success {
			return "", errors.New("linear customerUpsert returned success=false")
		}
		upserted[customer.ExternalID] = true
	}

	name := voter.Name
	if name == "" {
		name = "A Fider user"
	}
	out := &struct {
		CustomerNeedCreate struct {
			Success bool `json:"success"`
			Need    struct {
				ID string `json:"id"`
			} `json:"need"`
		} `json:"customerNeedCreate"`
	}{}
	err := doGraphQL(ctx, apiKey, graphqlRequest{
		Query: customerNeedCreateMutation,
		Variables: map[string]interface{}{"input": map[string]interface{}{
			"issueId":            issueID,
			"customerExternalId": customer.ExternalID,
			"body":               fmt.Sprintf("%s voted for this on Fider.", name),
		}},
	}, out)
	if err != nil {
		return "", err
	}
	if !out.CustomerNeedCreate.Success || out.CustomerNeedCreate.Need.ID == "" {
		return "", errors.New("linear customerNeedCreate returned no need")
	}
	return out.CustomerNeedCreate.Need.ID, nil
}

// deleteCustomerNeed removes a need. A need someone already deleted in
// Linear counts as deleted, or its row would block every later run.
func deleteCustomerNeed(ctx context.Context, apiKey, needID string) error {
	out := &struct {
		CustomerNeedDelete struct {
			Success bool `json:"success"`
		} `json:"customerNeedDelete"`
	}{}
	err := doGraphQL(ctx, apiKey, graphqlRequest{Query: customerNeedDeleteMutation, Variables: map[string]interface{}{"id": needID}}, out)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			return nil
		}
		return err
	}
	if !out.CustomerNeedDelete.Success {
		return errors.New("linear customerNeedDelete returned success=false")
	}
	return nil
}

type voterGroupsResponse struct {
	Voters []struct {
		Email string                 `json:"email"`
		Group *linearsync.VoterGroup `json:"group"`
	} `json:"voters"`
}

// lookupVoterGroups asks Scoutworks which group each voter belongs to, keyed
// by lower-case email. With the lookup unset, it returns an empty map, so
// every voter counts under the catch-all customer.
func lookupVoterGroups(ctx context.Context, voters []linearsync.Voter) (map[string]*linearsync.VoterGroup, error) {
	groups := map[string]*linearsync.VoterGroup{}
	lookup := env.Config.ScoutworksVoterLookup
	if lookup.URL == "" || lookup.Token == "" {
		return groups, nil
	}

	seen := map[string]bool{}
	emails := []string{}
	for _, v := range voters {
		email := strings.ToLower(strings.TrimSpace(v.Email))
		if email != "" && !seen[email] {
			seen[email] = true
			emails = append(emails, email)
		}
	}

	for _, batch := range linearsync.Chunk(emails, voterLookupBatch) {
		body, err := json.Marshal(map[string]interface{}{"emails": batch})
		if err != nil {
			return nil, errors.Wrap(err, "marshal voter lookup request")
		}
		req := &cmd.HTTPRequest{
			URL:    lookup.URL,
			Method: "POST",
			Body:   bytes.NewReader(body),
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Bearer " + lookup.Token,
			},
		}
		if err := bus.Dispatch(ctx, req); err != nil {
			return nil, errors.Wrap(err, "voter lookup request failed")
		}
		if req.ResponseStatusCode != 200 {
			return nil, errors.New("voter lookup returned %d", req.ResponseStatusCode)
		}
		resp := &voterGroupsResponse{}
		if err := json.Unmarshal(req.ResponseBody, resp); err != nil {
			return nil, errors.Wrap(err, "decode voter lookup response")
		}
		for _, v := range resp.Voters {
			if v.Group != nil {
				groups[strings.ToLower(v.Email)] = v.Group
			}
		}
	}
	return groups, nil
}

func syncPostStatusToLinear(ctx context.Context, c *cmd.SyncPostStatusToLinear) error {
	integration, err := enabledIntegration(ctx)
	if err != nil || integration == nil {
		return err
	}
	issue, err := linearIssueFor(ctx, c.PostID)
	if err != nil || issue == nil {
		return err
	}
	post := &query.GetPostByID{PostID: c.PostID}
	if err := bus.Dispatch(ctx, post); err != nil {
		return errors.Wrap(err, "load post")
	}

	status := post.Result.Status.Name()
	target := linearsync.TargetState(status, integration.DeclinedStateID, integration.DuplicateStateID)
	if target == "" {
		return nil
	}

	current := &struct {
		Issue struct {
			State struct {
				ID string `json:"id"`
			} `json:"state"`
		} `json:"issue"`
	}{}
	if err := doGraphQL(ctx, integration.APIKey, graphqlRequest{Query: issueStateQuery, Variables: map[string]interface{}{"id": issue.LinearIssueID}}, current); err != nil {
		return err
	}
	if !linearsync.ShouldMoveIssue(current.Issue.State.ID, target, status, integration.StatusMapping) {
		return nil
	}

	out := &struct {
		IssueUpdate struct {
			Success bool `json:"success"`
		} `json:"issueUpdate"`
	}{}
	if err := doGraphQL(ctx, integration.APIKey, graphqlRequest{Query: issueUpdateStateMutation, Variables: map[string]interface{}{"id": issue.LinearIssueID, "stateId": target}}, out); err != nil {
		return err
	}
	if !out.IssueUpdate.Success {
		return errors.New("linear issueUpdate returned success=false")
	}
	log.Infof(ctx, "Moved Linear issue @{Issue} after the Fider post became @{Status}", dto.Props{
		"Issue":  issue.LinearIssueIdentifier,
		"Status": status,
	})
	return nil
}

// syncAllVotesToLinear backfills every post, one post and one transaction at
// a time, so an interrupted run keeps the posts it already finished.
func syncAllVotesToLinear(ctx context.Context, c *cmd.SyncAllVotesToLinear) error {
	integration, err := enabledIntegration(ctx)
	if err != nil || integration == nil {
		return err
	}
	ids := &query.ListPostIDsWithLinearIssue{}
	if err := bus.Dispatch(ctx, ids); err != nil {
		return err
	}

	upserted := map[string]bool{}
	synced := 0
	for _, postID := range ids.Result {
		if err := syncOnePost(ctx, integration, postID, upserted); err != nil {
			log.Error(ctx, errors.Wrap(err, "backfill votes of post %d", postID))
		} else {
			synced++
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backfillPause):
		}
	}
	log.Infof(ctx, "Linear vote backfill finished: @{Synced} of @{Total} posts", dto.Props{"Synced": synced, "Total": len(ids.Result)})
	return nil
}

func syncOnePost(ctx context.Context, integration *entity.LinearIntegration, postID int, upserted map[string]bool) error {
	trx, err := dbx.BeginTx(ctx)
	if err != nil {
		return err
	}
	postCtx := context.WithValue(ctx, app.TransactionCtxKey, trx)
	issue, err := linearIssueFor(postCtx, postID)
	if err == nil && issue != nil {
		err = syncVotes(postCtx, integration, issue, upserted)
	}
	if err != nil {
		trx.MustRollback()
		return err
	}
	return trx.Commit()
}
