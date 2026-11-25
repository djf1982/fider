package apiv1

import (
	"fmt"
	"strings"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/web"
	"github.com/getfider/fider/app/services/linear"
	"github.com/getfider/fider/app/services/linear/linearsync"
	"github.com/getfider/fider/app/tasks"
)

// ListLinearIssueLinks lists which Linear issue each post is linked to, by
// post number. It lets an audit match the board to Linear without guessing
// from issue descriptions.
func ListLinearIssueLinks() web.HandlerFunc {
	return func(c *web.Context) error {
		q := &query.ListLinearIssueLinks{}
		if err := bus.Dispatch(c, q); err != nil {
			return c.Failure(err)
		}
		return c.Ok(q.Result)
	}
}

type linkPostInput struct {
	Issue string `json:"issue"`
}

// LinkPostToLinearIssue links a post to an existing Linear issue, such as a
// post from before the sync. From then on, the issue's status changes reach
// the post. When the issue's state already maps to a Fider status, the post
// takes that status now, so linking a released issue closes the post.
func LinkPostToLinearIssue() web.HandlerFunc {
	return func(c *web.Context) error {
		number, err := c.ParamAsInt("number")
		if err != nil {
			return c.NotFound()
		}

		input := &linkPostInput{}
		if err := c.Bind(input); err != nil {
			return c.BadRequest(web.Map{"issue": "Send the Linear issue, for example {\"issue\": \"SCO-123\"}."})
		}
		ref := strings.TrimSpace(input.Issue)
		if ref == "" {
			return c.BadRequest(web.Map{"issue": "Send the Linear issue, for example {\"issue\": \"SCO-123\"}."})
		}

		integration := &query.GetLinearIntegration{}
		if err := bus.Dispatch(c, integration); err != nil && errors.Cause(err) != app.ErrNotFound {
			return c.Failure(err)
		}
		if integration.Result == nil || !integration.Result.IsEnabled {
			return c.BadRequest(web.Map{"issue": "The Linear integration is not set up on this site."})
		}

		getPost := &query.GetPostByNumber{Number: number}
		if err := bus.Dispatch(c, getPost); err != nil {
			return c.Failure(err)
		}
		post := getPost.Result

		issue, err := linear.FetchIssue(c, integration.Result.APIKey, ref)
		if err != nil {
			if errors.Cause(err) == app.ErrNotFound || strings.Contains(err.Error(), "not found") {
				return c.BadRequest(web.Map{"issue": fmt.Sprintf("Linear has no issue %s.", ref)})
			}
			return c.Failure(err)
		}

		linked := &query.GetPostByLinearIssueID{TenantID: c.Tenant().ID, LinearIssueID: issue.ID}
		if err := bus.Dispatch(c, linked); err == nil && linked.Result != nil && linked.Result.ID != post.ID {
			return c.BadRequest(web.Map{"issue": fmt.Sprintf("%s is already linked to post #%d.", issue.Identifier, linked.Result.Number)})
		}

		if err := bus.Dispatch(c, &cmd.SaveLinearIssueMapping{
			PostID:                post.ID,
			LinearIssueID:         issue.ID,
			LinearIssueIdentifier: issue.Identifier,
			LinearIssueURL:        issue.URL,
		}); err != nil {
			return c.Failure(err)
		}

		mappedStatus, mapped := linear.ResolveStatus(integration.Result, issue.StateID)
		next := linearsync.StatusOnLink(mappedStatus, mapped, post.Status.Name())
		if next != "" {
			setResponse, err := linear.StatusResponse(post, next, "Status updated from Linear: "+issue.StateName)
			if err != nil {
				return c.Failure(err)
			}
			if err := bus.Dispatch(c, setResponse); err != nil {
				return c.Failure(err)
			}
		}

		c.Enqueue(tasks.SyncPostVotesToLinear(post.ID))

		status := post.Status.Name()
		if next != "" {
			status = next
		}
		return c.Ok(web.Map{
			"postNumber":      post.Number,
			"issueIdentifier": issue.Identifier,
			"issueUrl":        issue.URL,
			"status":          status,
		})
	}
}

// CreateLinearIssueForPost creates a Linear issue for a post that has none,
// as the sync does for every new post. Use it for posts from before the sync.
// It refuses a post that already has an issue.
func CreateLinearIssueForPost() web.HandlerFunc {
	return func(c *web.Context) error {
		number, err := c.ParamAsInt("number")
		if err != nil {
			return c.NotFound()
		}

		integration := &query.GetLinearIntegration{}
		if err := bus.Dispatch(c, integration); err != nil && errors.Cause(err) != app.ErrNotFound {
			return c.Failure(err)
		}
		if integration.Result == nil || !integration.Result.IsEnabled {
			return c.BadRequest(web.Map{"issue": "The Linear integration is not set up on this site."})
		}

		getPost := &query.GetPostByNumber{Number: number}
		if err := bus.Dispatch(c, getPost); err != nil {
			return c.Failure(err)
		}
		post := getPost.Result

		existing := &query.GetLinearIssueForPost{PostID: post.ID}
		if err := bus.Dispatch(c, existing); err == nil && existing.Result != nil && existing.Result.LinearIssueID != "" {
			return c.BadRequest(web.Map{"issue": fmt.Sprintf("Post #%d is already linked to %s.", post.Number, existing.Result.LinearIssueIdentifier)})
		}

		if err := bus.Dispatch(c, &cmd.SyncPostToLinear{Post: post}); err != nil {
			return c.Failure(err)
		}

		created := &query.GetLinearIssueForPost{PostID: post.ID}
		if err := bus.Dispatch(c, created); err != nil || created.Result == nil {
			return c.Failure(errors.New("the Linear issue for post #%d was not saved", post.Number))
		}
		return c.Ok(web.Map{
			"postNumber":      post.Number,
			"issueIdentifier": created.Result.LinearIssueIdentifier,
			"issueUrl":        created.Result.LinearIssueURL,
		})
	}
}
