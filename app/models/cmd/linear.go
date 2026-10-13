package cmd

import (
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
)

// SaveLinearIntegration upserts the per-tenant Linear integration config.
type SaveLinearIntegration struct {
	APIKey           string
	TeamID           string
	LabelID          string
	IsEnabled        bool
	StatusMapping    entity.LinearStatusMapping
	WebhookSecret    string
	DeclinedStateID  string
	DuplicateStateID string
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

// ClaimLinearCustomerNeed reserves the (post, voter) row before the sync
// calls Linear. Result is false when another run already holds the row.
type ClaimLinearCustomerNeed struct {
	PostID int
	UserID int

	Result bool
}

// SetLinearCustomerNeedID stores the Linear need created for a claimed row.
type SetLinearCustomerNeedID struct {
	PostID       int
	UserID       int
	LinearNeedID string
}

// DeleteLinearCustomerNeed removes the (post, voter) row. When LinearNeedID
// is set, only a row with that need ID is removed; when it is empty, only an
// unfinished claim is removed.
type DeleteLinearCustomerNeed struct {
	PostID       int
	UserID       int
	LinearNeedID string
}

// SyncPostVotesToLinear makes the Linear customer needs of a post's issue
// match the post's upvotes.
type SyncPostVotesToLinear struct {
	PostID int
}

// SyncPostStatusToLinear moves the Linear issue when staff decline a post or
// mark it as a duplicate in Fider.
type SyncPostStatusToLinear struct {
	PostID int
}

// SyncAllVotesToLinear runs SyncPostVotesToLinear for every post that has a
// Linear issue, one post and one transaction at a time.
type SyncAllVotesToLinear struct{}
