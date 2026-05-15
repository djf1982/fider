package actions

import (
	"context"

	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/pkg/validate"
)

// SaveLinearIntegration is the admin action to upsert the Linear integration.
type SaveLinearIntegration struct {
	APIKey        string                     `json:"apiKey"`
	TeamID        string                     `json:"teamId"`
	LabelID       string                     `json:"labelID"`
	IsEnabled     bool                       `json:"isEnabled"`
	StatusMapping entity.LinearStatusMapping `json:"statusMapping"`
	WebhookSecret string                     `json:"webhookSecret"`
}

func (a *SaveLinearIntegration) IsAuthorized(_ context.Context, user *entity.User) bool {
	return user != nil && user.IsAdministrator()
}

func (a *SaveLinearIntegration) Validate(_ context.Context, _ *entity.User) *validate.Result {
	result := validate.Success()
	// Team ID is always required when enabled — unlike the API key/secret, the handler does
	// not auto-fill it from existing config.
	if a.IsEnabled && a.TeamID == "" {
		result.AddFieldFailure("teamId", "Linear team ID is required when the integration is enabled.")
	}
	if len(a.APIKey) > 500 {
		result.AddFieldFailure("apiKey", "API key is too long.")
	}
	if len(a.TeamID) > 100 {
		result.AddFieldFailure("teamId", "Team ID is too long.")
	}
	if len(a.LabelID) > 100 {
		result.AddFieldFailure("labelID", "Label ID is too long.")
	}
	if len(a.WebhookSecret) > 200 {
		result.AddFieldFailure("webhookSecret", "Webhook secret is too long.")
	}
	for k, v := range a.StatusMapping {
		if len(k) > 100 || len(v) > 40 {
			result.AddFieldFailure("statusMapping", "Status mapping entry is too long.")
			break
		}
	}
	return result
}
