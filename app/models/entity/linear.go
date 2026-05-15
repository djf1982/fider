package entity

import (
	"database/sql/driver"
	"encoding/json"

	"github.com/getfider/fider/app/pkg/errors"
)

// LinearStatusMapping maps a Linear workflow state ID to a Fider post status name.
type LinearStatusMapping map[string]string

func (m LinearStatusMapping) Value() (driver.Value, error) {
	return json.Marshal(m)
}

func (m *LinearStatusMapping) Scan(src any) error {
	if src == nil {
		return nil
	}
	raw, ok := src.([]byte)
	if !ok {
		return errors.New("Invalid data stored in database")
	}
	return json.Unmarshal(raw, m)
}

// LinearIntegration is the per-tenant Linear configuration.
type LinearIntegration struct {
	ID            int                 `json:"id" db:"id"`
	TenantID      int                 `json:"-" db:"tenant_id"`
	APIKey        string              `json:"-" db:"api_key"`
	TeamID        string              `json:"team_id" db:"team_id"`
	IsEnabled     bool                `json:"is_enabled" db:"is_enabled"`
	StatusMapping LinearStatusMapping `json:"status_mapping" db:"status_mapping"`
	WebhookSecret string              `json:"-" db:"webhook_secret"`
}

// PostLinearIssue is the mapping between a Fider post and a Linear issue.
type PostLinearIssue struct {
	ID                    int    `json:"id" db:"id"`
	TenantID              int    `json:"-" db:"tenant_id"`
	PostID                int    `json:"post_id" db:"post_id"`
	LinearIssueID         string `json:"linear_issue_id" db:"linear_issue_id"`
	LinearIssueIdentifier string `json:"linear_issue_identifier" db:"linear_issue_identifier"`
	LinearIssueURL        string `json:"linear_issue_url" db:"linear_issue_url"`
}
