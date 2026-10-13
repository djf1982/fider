package entity

import (
	"database/sql/driver"
	"encoding/json"
	"time"

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
	TeamID        string              `json:"teamId" db:"team_id"`
	LabelID       string              `json:"labelID" db:"label_id"`
	IsEnabled     bool                `json:"isEnabled" db:"is_enabled"`
	StatusMapping LinearStatusMapping `json:"statusMapping" db:"status_mapping"`
	WebhookSecret string              `json:"-" db:"webhook_secret"`
	// DeclinedStateID and DuplicateStateID are the Linear states a Fider
	// decline or duplicate moves the issue to. Empty means "do not sync".
	DeclinedStateID  string `json:"declinedStateID" db:"declined_state_id"`
	DuplicateStateID string `json:"duplicateStateID" db:"duplicate_state_id"`
}

// PostLinearIssue is the mapping between a Fider post and a Linear issue.
type PostLinearIssue struct {
	ID                    int    `json:"id" db:"id"`
	TenantID              int    `json:"-" db:"tenant_id"`
	PostID                int    `json:"postID" db:"post_id"`
	LinearIssueID         string `json:"linearIssueID" db:"linear_issue_id"`
	LinearIssueIdentifier string `json:"linearIssueIdentifier" db:"linear_issue_identifier"`
	LinearIssueURL        string `json:"linearIssueURL" db:"linear_issue_url"`
}

// PostLinearCustomerNeed links one upvote to one Linear customer need.
// LinearNeedID is empty while a sync run holds the claim.
type PostLinearCustomerNeed struct {
	UserID       int       `db:"user_id"`
	LinearNeedID string    `db:"linear_need_id"`
	CreatedAt    time.Time `db:"created_at"`
}
