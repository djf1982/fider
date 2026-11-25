package webhooks

import (
	"encoding/json"
	"fmt"

	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/log"
	"github.com/getfider/fider/app/pkg/web"
	"github.com/getfider/fider/app/services/linear"
	"github.com/getfider/fider/app/services/linear/linearsync"
)

// linearWebhookPayload is the subset of the Linear webhook body we care about.
// Linear delivers a wider envelope; only the relevant fields are decoded here.
type linearWebhookPayload struct {
	Action string `json:"action"`
	Type   string `json:"type"`
	Data   struct {
		ID         string `json:"id"`
		Identifier string `json:"identifier"`
		StateID    string `json:"stateId"`
		State      struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"state"`
	} `json:"data"`
	// UpdatedFrom holds the previous values of the fields this update changed.
	// A stateId here means the issue changed state.
	UpdatedFrom struct {
		StateID string `json:"stateId"`
	} `json:"updatedFrom"`
}

// IncomingLinearWebhook receives Linear issue update events and applies status
// changes to the corresponding Fider post. Verifies HMAC against the per-tenant
// webhook secret stored on tenant_linear_integrations.
func IncomingLinearWebhook() web.HandlerFunc {
	return func(c *web.Context) error {
		tenant := c.Tenant()
		if tenant == nil {
			return c.NotFound()
		}

		integration := &query.GetLinearIntegration{}
		if err := bus.Dispatch(c, integration); err != nil || integration.Result == nil {
			return c.NotFound()
		}
		if !integration.Result.IsEnabled {
			return c.NotFound()
		}

		payload := []byte(c.Request.Body)
		signature := c.Request.GetHeader("Linear-Signature")
		if !linear.VerifyWebhookSignature(payload, signature, integration.Result.WebhookSecret) {
			return c.Failure(errors.New("invalid linear webhook signature"))
		}

		event := &linearWebhookPayload{}
		if err := json.Unmarshal(payload, event); err != nil {
			return c.Failure(errors.Wrap(err, "decode linear webhook"))
		}

		if event.Type != "Issue" || event.Action != "update" {
			return c.Ok(web.Map{})
		}

		stateID := event.Data.State.ID
		if stateID == "" {
			stateID = event.Data.StateID
		}
		if stateID == "" {
			return c.Ok(web.Map{})
		}

		statusName, mapped := linear.ResolveStatus(integration.Result, stateID)
		if mapped {
			if err := applyLinearStatus(c, tenant.ID, event.Data.ID, statusName, event.Data.State.Name); err != nil {
				return c.Failure(err)
			}
		} else {
			log.Debugf(c, "Linear state @{StateID} has no Fider mapping for tenant @{TenantID}", dto.Props{
				"StateID":  stateID,
				"TenantID": tenant.ID,
			})
		}

		// Duplicates. Only a state change can matter, so an ordinary edit costs
		// no Linear call. A failure here is logged, not returned: the post's own
		// status is already saved, and a retry would not change the outcome.
		if event.UpdatedFrom.StateID != "" {
			if err := followDuplicates(c, integration.Result, tenant.ID, event, statusName, mapped); err != nil {
				log.Warnf(c, "Linear duplicate sync failed for issue @{IssueID}: @{Error}", dto.Props{
					"IssueID": event.Data.Identifier,
					"Error":   err.Error(),
				})
			}
		}

		return c.Ok(web.Map{})
	}
}

// applyLinearStatus sets the status of the post linked to a Linear issue.
// It does nothing when no post is linked or the post already has the status.
func applyLinearStatus(c *web.Context, tenantID int, issueID, statusName, stateName string) error {
	post, err := postForIssue(c, tenantID, issueID)
	if err != nil || post == nil {
		return err
	}
	if post.Status.Name() == statusName {
		return nil
	}
	return setStatusFromLinear(c, post, statusName, "Status updated from Linear: "+stateName)
}

// followDuplicates carries a release across Linear duplicates, in both
// directions:
//   - this issue duplicates another that is already released: its post
//     closes with the original;
//   - other issues duplicate this one, and this one is now released: their
//     posts close too.
//
// Only a release carries over (linearsync.FollowsOriginal), and a closed post
// never moves.
func followDuplicates(c *web.Context, integration *entity.LinearIntegration, tenantID int, event *linearWebhookPayload, statusName string, mapped bool) error {
	links, err := linear.FetchDuplicateLinks(c, integration.APIKey, event.Data.ID)
	if err != nil {
		return err
	}

	if original := links.Original; original != nil {
		if originalStatus, ok := linear.ResolveStatus(integration, original.StateID); ok {
			text := fmt.Sprintf("Status updated from Linear: %s (as %s)", original.StateName, original.Identifier)
			if err := followOriginal(c, tenantID, event.Data.ID, originalStatus, text); err != nil {
				return err
			}
		}
	}

	if mapped {
		text := fmt.Sprintf("Status updated from Linear: %s (as %s)", event.Data.State.Name, event.Data.Identifier)
		for _, duplicateID := range links.DuplicateIDs {
			if err := followOriginal(c, tenantID, duplicateID, statusName, text); err != nil {
				return err
			}
		}
	}
	return nil
}

// followOriginal gives the post of a duplicate issue its original's status,
// when linearsync.FollowsOriginal allows it.
func followOriginal(c *web.Context, tenantID int, issueID, originalStatus, text string) error {
	post, err := postForIssue(c, tenantID, issueID)
	if err != nil || post == nil {
		return err
	}
	if !linearsync.FollowsOriginal(originalStatus, post.Status.Name()) {
		return nil
	}
	return setStatusFromLinear(c, post, originalStatus, text)
}

// postForIssue returns the post linked to a Linear issue, or nil.
func postForIssue(c *web.Context, tenantID int, issueID string) (*entity.Post, error) {
	getPost := &query.GetPostByLinearIssueID{TenantID: tenantID, LinearIssueID: issueID}
	if err := bus.Dispatch(c, getPost); err != nil {
		log.Debugf(c, "No Fider post mapped to Linear issue @{IssueID}", dto.Props{"IssueID": issueID})
		return nil, nil
	}
	return getPost.Result, nil
}

// setStatusFromLinear saves a status change that Linear caused.
func setStatusFromLinear(c *web.Context, post *entity.Post, statusName, text string) error {
	// Webhook requests have no authenticated user; setPostResponse writes
	// response_user_id and requires one. Attribute the change to any tenant
	// administrator so the audit trail and UI rendering stay consistent.
	if c.User() == nil {
		actor := firstAdministrator(c)
		if actor == nil {
			return errors.New("no administrator available to attribute Linear status change")
		}
		c.SetUser(actor)
	}

	setResponse, err := linear.StatusResponse(post, statusName, text)
	if err != nil {
		return err
	}
	if err := bus.Dispatch(c, setResponse); err != nil {
		return err
	}

	log.Infof(c, "Updated Fider post @{PostID} status to @{Status} from Linear", dto.Props{
		"PostID": post.ID,
		"Status": statusName,
	})
	return nil
}

// firstAdministrator returns any active administrator for the current tenant,
// or nil if none exist. Used to attribute system-initiated status changes
// (e.g. Linear webhook) to a real user so audit metadata is never NULL.
func firstAdministrator(c *web.Context) *entity.User {
	all := &query.GetAllUsers{}
	if err := bus.Dispatch(c, all); err != nil {
		return nil
	}
	for _, u := range all.Result {
		if u.Role == enum.RoleAdministrator && u.Status == enum.UserActive {
			return u
		}
	}
	return nil
}
