package cmd

import (
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
)

// SaveLinearIntegration upserts the per-tenant Linear integration config.
type SaveLinearIntegration struct {
	APIKey        string
	TeamID        string
	IsEnabled     bool
	StatusMapping entity.LinearStatusMapping
	WebhookSecret string
}

// DeleteLinearIntegration removes the per-tenant Linear integration config.
type DeleteLinearIntegration struct{}

// SaveLinearIssueMapping persists a Fider post ↔ Linear issue link.
type SaveLinearIssueMapping struct {
	PostID                int
	LinearIssueID         string
	LinearIssueIdentifier string
	LinearIssueURL        string
}

// SyncPostToLinear creates a Linear issue for a Fider post.
// On success, it persists the mapping via SaveLinearIssueMapping.
type SyncPostToLinear struct {
	Post *entity.Post
}

// SyncCommentToLinear appends a Fider comment to the mapped Linear issue.
type SyncCommentToLinear struct {
	Post    *entity.Post
	Comment *entity.Comment
}

// UpdatePostStatusFromLinear applies a Linear-driven status update to a Fider post.
type UpdatePostStatusFromLinear struct {
	Post   *entity.Post
	Status enum.PostStatus
}
