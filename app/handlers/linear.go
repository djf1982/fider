package handlers

import (
	"net/http"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/actions"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/web"
)

// ManageLinear renders the Linear integration admin page.
func ManageLinear() web.HandlerFunc {
	return func(c *web.Context) error {
		integration := &query.GetLinearIntegration{}
		if err := bus.Dispatch(c, integration); err != nil && errors.Cause(err) != app.ErrNotFound {
			return c.Failure(err)
		}

		// Webhook URL the admin should paste into Linear.
		webhookURL := c.BaseURL() + "/webhooks/linear"

		return c.Page(http.StatusOK, web.Props{
			Page:  "Administration/pages/ManageLinear.page",
			Title: "Linear Integration · Site Settings",
			Data: web.Map{
				"integration": integration.Result,
				"webhookURL":  webhookURL,
				"postStatuses": []string{
					"open", "planned", "started", "completed", "declined", "duplicate",
				},
			},
		})
	}
}

// SaveLinearIntegration persists the Linear integration configuration for the current tenant.
func SaveLinearIntegration() web.HandlerFunc {
	return func(c *web.Context) error {
		action := new(actions.SaveLinearIntegration)
		if result := c.BindTo(action); !result.Ok {
			return c.HandleValidation(result)
		}

		mapping := action.StatusMapping
		if mapping == nil {
			mapping = entity.LinearStatusMapping{}
		}

		apiKey := action.APIKey
		webhookSecret := action.WebhookSecret

		// Empty key/secret means "keep existing" — preserve whatever's already stored.
		if apiKey == "" || webhookSecret == "" {
			existing := &query.GetLinearIntegration{}
			if err := bus.Dispatch(c, existing); err == nil && existing.Result != nil {
				if apiKey == "" {
					apiKey = existing.Result.APIKey
				}
				if webhookSecret == "" {
					webhookSecret = existing.Result.WebhookSecret
				}
			}
		}

		if err := bus.Dispatch(c, &cmd.SaveLinearIntegration{
			APIKey:        apiKey,
			TeamID:        action.TeamID,
			LabelID:       action.LabelID,
			IsEnabled:     action.IsEnabled,
			StatusMapping: mapping,
			WebhookSecret: webhookSecret,
		}); err != nil {
			return c.Failure(err)
		}

		return c.Ok(web.Map{})
	}
}

// DeleteLinearIntegration removes the Linear integration for the current tenant.
func DeleteLinearIntegration() web.HandlerFunc {
	return func(c *web.Context) error {
		if err := bus.Dispatch(c, &cmd.DeleteLinearIntegration{}); err != nil {
			return c.Failure(err)
		}
		return c.Ok(web.Map{})
	}
}
