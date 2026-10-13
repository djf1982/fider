package query

import "github.com/getfider/fider/app/models/entity"

// GetLinearIntegration loads the current tenant's Linear integration config.
type GetLinearIntegration struct {
	Result *entity.LinearIntegration
}

// GetLinearIssueForPost loads the Fider↔Linear mapping for a given post.
type GetLinearIssueForPost struct {
	PostID int

	Result *entity.PostLinearIssue
}

// GetPostByLinearIssueID resolves the Fider post for a given Linear issue ID, scoped to a tenant.
type GetPostByLinearIssueID struct {
	TenantID      int
	LinearIssueID string

	Result *entity.Post
}

// GetLinearIntegrationByWebhookSecret finds a tenant integration by its webhook secret prefix.
// Used by the inbound webhook handler when the request can't be tenant-resolved another way.
type GetLinearIntegrationByWebhookSecret struct {
	WebhookSecret string

	Result *entity.LinearIntegration
}

// ListLinearCustomerNeeds lists the vote ↔ customer need rows of a post.
type ListLinearCustomerNeeds struct {
	PostID int

	Result []*entity.PostLinearCustomerNeed
}

// ListPostIDsWithLinearIssue lists the current tenant's posts that have a
// Linear issue, oldest first.
type ListPostIDsWithLinearIssue struct {
	Result []int
}
