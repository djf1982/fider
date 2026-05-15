package webhooks

import (
	"encoding/json"

	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/dto"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/log"
	"github.com/getfider/fider/app/pkg/web"
	"github.com/getfider/fider/app/services/linear"
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

		statusName, ok := linear.ResolveStatus(integration.Result, stateID)
		if !ok {
			log.Debugf(c, "Linear state @{StateID} has no Fider mapping for tenant @{TenantID}", dto.Props{
				"StateID":  stateID,
				"TenantID": tenant.ID,
			})
			return c.Ok(web.Map{})
		}

		var newStatus enum.PostStatus
		if err := newStatus.UnmarshalText([]byte(statusName)); err != nil {
			return c.Failure(errors.Wrap(err, "unknown fider status"))
		}

		getPost := &query.GetPostByLinearIssueID{TenantID: tenant.ID, LinearIssueID: event.Data.ID}
		if err := bus.Dispatch(c, getPost); err != nil {
			log.Debugf(c, "No Fider post mapped to Linear issue @{IssueID}", dto.Props{"IssueID": event.Data.ID})
			return c.Ok(web.Map{})
		}
		if getPost.Result == nil {
			return c.Ok(web.Map{})
		}
		if getPost.Result.Status == newStatus {
			return c.Ok(web.Map{})
		}

		// Webhook requests have no authenticated user; setPostResponse writes
		// response_user_id and requires one. Attribute the change to any tenant
		// administrator so the audit trail and UI rendering stay consistent.
		actor := firstAdministrator(c)
		if actor == nil {
			return c.Failure(errors.New("no administrator available to attribute Linear status change"))
		}
		c.SetUser(actor)

		setResponse := &cmd.SetPostResponse{
			Post:   getPost.Result,
			Status: newStatus,
			Text:   "Status updated from Linear: " + event.Data.State.Name,
		}
		if err := bus.Dispatch(c, setResponse); err != nil {
			return c.Failure(err)
		}

		log.Infof(c, "Updated Fider post @{PostID} status to @{Status} from Linear", dto.Props{
			"PostID": getPost.Result.ID,
			"Status": newStatus.Name(),
		})

		return c.Ok(web.Map{})
	}
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
