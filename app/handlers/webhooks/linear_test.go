package webhooks_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"testing"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/handlers/webhooks"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/mock"
)

const webhookSecret = "linear-webhook-secret"

// webhookFixture: the integration maps state-released to completed. Posts are
// linked by Linear issue ID. linearBody answers every Linear API call, and
// linearCalls counts them.
type webhookFixture struct {
	posts       map[string]*entity.Post
	responses   map[int]*cmd.SetPostResponse
	linearCalls int
}

func newWebhookFixture(linearBody string) *webhookFixture {
	f := &webhookFixture{posts: map[string]*entity.Post{}, responses: map[int]*cmd.SetPostResponse{}}

	bus.AddHandler(func(ctx context.Context, q *query.GetLinearIntegration) error {
		q.Result = &entity.LinearIntegration{
			APIKey:        "lin_api_test",
			IsEnabled:     true,
			WebhookSecret: webhookSecret,
			StatusMapping: entity.LinearStatusMapping{"state-released": "completed", "state-progress": "started"},
		}
		return nil
	})
	bus.AddHandler(func(ctx context.Context, q *query.GetPostByLinearIssueID) error {
		post, ok := f.posts[q.LinearIssueID]
		if !ok {
			return app.ErrNotFound
		}
		q.Result = post
		return nil
	})
	bus.AddHandler(func(ctx context.Context, c *cmd.HTTPRequest) error {
		f.linearCalls++
		c.ResponseStatusCode = http.StatusOK
		c.ResponseBody = []byte(linearBody)
		return nil
	})
	bus.AddHandler(func(ctx context.Context, q *query.GetAllUsers) error {
		q.Result = []*entity.User{mock.JonSnow}
		return nil
	})
	bus.AddHandler(func(ctx context.Context, c *cmd.SetPostResponse) error {
		f.responses[c.Post.ID] = c
		return nil
	})
	return f
}

func sign(body string) string {
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write([]byte(body))
	return hex.EncodeToString(mac.Sum(nil))
}

func deliver(body string) int {
	code, _ := mock.NewServer().
		OnTenant(mock.DemoTenant).
		AddHeader("Linear-Signature", sign(body)).
		ExecutePost(webhooks.IncomingLinearWebhook(), body)
	return code
}

func issueUpdate(id, identifier, stateID, stateName, previousStateID string) string {
	updatedFrom := "{}"
	if previousStateID != "" {
		updatedFrom = `{"stateId":"` + previousStateID + `"}`
	}
	return `{"action":"update","type":"Issue","data":{"id":"` + id + `","identifier":"` + identifier +
		`","state":{"id":"` + stateID + `","name":"` + stateName + `","type":"completed"}},"updatedFrom":` + updatedFrom + `}`
}

const noRelations = `{"data":{"issue":{"relations":{"nodes":[]},"inverseRelations":{"nodes":[]}}}}`

func TestLinearWebhook_AReleaseClosesThePostsOfItsDuplicates(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(`{"data":{"issue":{"relations":{"nodes":[]},"inverseRelations":{"nodes":[
		{"type":"duplicate","issue":{"id":"issue-dup","identifier":"SCO-1486"}},
		{"type":"related","issue":{"id":"issue-related","identifier":"SCO-9"}}]}}}}`)
	f.posts["issue-original"] = &entity.Post{ID: 1, Number: 100, Status: enum.PostStarted}
	f.posts["issue-dup"] = &entity.Post{ID: 2, Number: 316, Status: enum.PostOpen}
	f.posts["issue-related"] = &entity.Post{ID: 3, Number: 317, Status: enum.PostOpen}

	code := deliver(issueUpdate("issue-original", "SCO-1365", "state-released", "Released", "state-progress"))

	Expect(code).Equals(http.StatusOK)
	Expect(f.responses[1].Status).Equals(enum.PostCompleted)
	Expect(f.responses[2].Status).Equals(enum.PostCompleted)
	Expect(f.responses[2].Text).Equals("Status updated from Linear: Released (as SCO-1365)")
	Expect(f.responses[3]).IsNil()
}

func TestLinearWebhook_ADuplicateOfAReleasedIssueClosesItsPost(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(`{"data":{"issue":{"relations":{"nodes":[
		{"type":"duplicate","relatedIssue":{"id":"issue-original","identifier":"SCO-1365","state":{"id":"state-released","name":"Released"}}}]},
		"inverseRelations":{"nodes":[]}}}}`)
	f.posts["issue-dup"] = &entity.Post{ID: 2, Number: 316, Status: enum.PostOpen}

	// Duplicate is not a mapped state, so the post's own state changes nothing.
	code := deliver(issueUpdate("issue-dup", "SCO-1486", "state-duplicate", "Duplicate", "state-idea"))

	Expect(code).Equals(http.StatusOK)
	Expect(f.responses[2].Status).Equals(enum.PostCompleted)
	Expect(f.responses[2].Text).Equals("Status updated from Linear: Released (as SCO-1365)")
}

func TestLinearWebhook_ADuplicateOfAnUnreleasedIssueStaysOpen(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(`{"data":{"issue":{"relations":{"nodes":[
		{"type":"duplicate","relatedIssue":{"id":"issue-original","identifier":"SCO-3950","state":{"id":"state-progress","name":"In Progress"}}}]},
		"inverseRelations":{"nodes":[]}}}}`)
	f.posts["issue-dup"] = &entity.Post{ID: 2, Number: 459, Status: enum.PostOpen}

	code := deliver(issueUpdate("issue-dup", "SCO-4701", "state-duplicate", "Duplicate", "state-idea"))

	Expect(code).Equals(http.StatusOK)
	Expect(f.responses[2]).IsNil()
}

func TestLinearWebhook_AReleaseNeverMovesADeclinedDuplicate(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(`{"data":{"issue":{"relations":{"nodes":[]},"inverseRelations":{"nodes":[
		{"type":"duplicate","issue":{"id":"issue-dup","identifier":"SCO-1486"}}]}}}}`)
	f.posts["issue-dup"] = &entity.Post{ID: 2, Number: 316, Status: enum.PostDeclined}

	code := deliver(issueUpdate("issue-original", "SCO-1365", "state-released", "Released", "state-progress"))

	Expect(code).Equals(http.StatusOK)
	Expect(f.responses[2]).IsNil()
}

func TestLinearWebhook_AnEditWithNoStateChangeMakesNoLinearCall(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(noRelations)
	f.posts["issue-original"] = &entity.Post{ID: 1, Number: 100, Status: enum.PostCompleted}

	code := deliver(issueUpdate("issue-original", "SCO-1365", "state-released", "Released", ""))

	Expect(code).Equals(http.StatusOK)
	Expect(f.linearCalls).Equals(0)
}

func TestLinearWebhook_AFailedDuplicateLookupStillSavesThePostStatus(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(`{"errors":[{"message":"rate limited"}]}`)
	f.posts["issue-original"] = &entity.Post{ID: 1, Number: 100, Status: enum.PostStarted}

	code := deliver(issueUpdate("issue-original", "SCO-1365", "state-released", "Released", "state-progress"))

	Expect(code).Equals(http.StatusOK)
	Expect(f.responses[1].Status).Equals(enum.PostCompleted)
}

func TestLinearWebhook_RejectsABadSignature(t *testing.T) {
	RegisterT(t)
	f := newWebhookFixture(noRelations)
	f.posts["issue-original"] = &entity.Post{ID: 1, Number: 100, Status: enum.PostStarted}
	body := issueUpdate("issue-original", "SCO-1365", "state-released", "Released", "state-progress")

	code, _ := mock.NewServer().
		OnTenant(mock.DemoTenant).
		AddHeader("Linear-Signature", strings.Repeat("0", 64)).
		ExecutePost(webhooks.IncomingLinearWebhook(), body)

	Expect(code).NotEquals(http.StatusOK)
	Expect(len(f.responses)).Equals(0)
}
