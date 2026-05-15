package linear

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/env"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/pkg/web"
)

const linearAPIEndpoint = "https://api.linear.app/graphql"

func init() {
	bus.Register(Service{})
}

type Service struct{}

func (s Service) Name() string {
	return "Linear"
}

func (s Service) Category() string {
	return "linear"
}

func (s Service) Enabled() bool {
	return !env.IsTest()
}

func (s Service) Init() {
	bus.AddHandler(syncPostToLinear)
	bus.AddHandler(syncCommentToLinear)
}

// VerifyWebhookSignature validates the Linear-Signature header against the raw body.
// Linear signs the raw request body with HMAC-SHA256 using the webhook secret.
func VerifyWebhookSignature(body []byte, signatureHeader, secret string) bool {
	if signatureHeader == "" || secret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signatureHeader))
}

type graphqlRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

type graphqlError struct {
	Message string `json:"message"`
}

type graphqlResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []graphqlError  `json:"errors"`
}

func doGraphQL(ctx context.Context, apiKey string, req graphqlRequest, out interface{}) error {
	body, err := json.Marshal(req)
	if err != nil {
		return errors.Wrap(err, "marshal linear request")
	}

	httpReq := &cmd.HTTPRequest{
		URL:    linearAPIEndpoint,
		Method: "POST",
		Body:   bytes.NewReader(body),
		Headers: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": apiKey,
		},
	}
	if err := bus.Dispatch(ctx, httpReq); err != nil {
		return errors.Wrap(err, "linear graphql request failed")
	}
	if httpReq.ResponseStatusCode < 200 || httpReq.ResponseStatusCode >= 300 {
		return errors.New("linear graphql returned %d: %s", httpReq.ResponseStatusCode, string(httpReq.ResponseBody))
	}

	resp := &graphqlResponse{}
	if err := json.Unmarshal(httpReq.ResponseBody, resp); err != nil {
		return errors.Wrap(err, "decode linear response")
	}
	if len(resp.Errors) > 0 {
		return errors.New("linear graphql error: %s", resp.Errors[0].Message)
	}
	if out != nil {
		if err := json.Unmarshal(resp.Data, out); err != nil {
			return errors.Wrap(err, "decode linear data")
		}
	}
	return nil
}

const issueCreateMutation = `
mutation IssueCreate($teamId: String!, $title: String!, $description: String!, $labelIds: [String!]) {
  issueCreate(input: { teamId: $teamId, title: $title, description: $description, labelIds: $labelIds }) {
    success
    issue { id identifier url }
  }
}`

type issueCreateData struct {
	IssueCreate struct {
		Success bool `json:"success"`
		Issue   struct {
			ID         string `json:"id"`
			Identifier string `json:"identifier"`
			URL        string `json:"url"`
		} `json:"issue"`
	} `json:"issueCreate"`
}

func syncPostToLinear(ctx context.Context, c *cmd.SyncPostToLinear) error {
	if c.Post == nil {
		return errors.New("syncPostToLinear: post is nil")
	}

	integration := &query.GetLinearIntegration{}
	if err := bus.Dispatch(ctx, integration); err != nil {
		return errors.Wrap(err, "load linear integration")
	}
	if integration.Result == nil || !integration.Result.IsEnabled {
		return nil
	}

	postURL := web.BaseURL(ctx) + fmt.Sprintf("/posts/%d/%s", c.Post.Number, c.Post.Slug)
	description := fmt.Sprintf("%s\n\n---\nFider post: %s", c.Post.Description, postURL)

	variables := map[string]interface{}{
		"teamId":      integration.Result.TeamID,
		"title":       c.Post.Title,
		"description": description,
	}
	if integration.Result.LabelID != "" {
		variables["labelIds"] = []string{integration.Result.LabelID}
	}

	out := &issueCreateData{}
	err := doGraphQL(ctx, integration.Result.APIKey, graphqlRequest{
		Query:     issueCreateMutation,
		Variables: variables,
	}, out)
	if err != nil {
		return err
	}
	if !out.IssueCreate.Success {
		return errors.New("linear issueCreate returned success=false")
	}

	return bus.Dispatch(ctx, &cmd.SaveLinearIssueMapping{
		PostID:                c.Post.ID,
		LinearIssueID:         out.IssueCreate.Issue.ID,
		LinearIssueIdentifier: out.IssueCreate.Issue.Identifier,
		LinearIssueURL:        out.IssueCreate.Issue.URL,
	})
}

const commentCreateMutation = `
mutation CommentCreate($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
  }
}`

type commentCreateData struct {
	CommentCreate struct {
		Success bool `json:"success"`
	} `json:"commentCreate"`
}

func syncCommentToLinear(ctx context.Context, c *cmd.SyncCommentToLinear) error {
	if c.Post == nil || c.Comment == nil {
		return errors.New("syncCommentToLinear: post or comment is nil")
	}

	integration := &query.GetLinearIntegration{}
	if err := bus.Dispatch(ctx, integration); err != nil {
		return errors.Wrap(err, "load linear integration")
	}
	if integration.Result == nil || !integration.Result.IsEnabled {
		return nil
	}

	mapping := &query.GetLinearIssueForPost{PostID: c.Post.ID}
	if err := bus.Dispatch(ctx, mapping); err != nil {
		return nil
	}
	if mapping.Result == nil || mapping.Result.LinearIssueID == "" {
		return nil
	}

	author := "Unknown"
	if c.Comment.User != nil {
		author = c.Comment.User.Name
	}
	body := fmt.Sprintf("**%s commented on Fider:**\n\n%s", author, c.Comment.Content)

	out := &commentCreateData{}
	if err := doGraphQL(ctx, integration.Result.APIKey, graphqlRequest{
		Query: commentCreateMutation,
		Variables: map[string]interface{}{
			"issueId": mapping.Result.LinearIssueID,
			"body":    body,
		},
	}, out); err != nil {
		return err
	}
	if !out.CommentCreate.Success {
		return errors.New("linear commentCreate returned success=false")
	}
	return nil
}

// ResolveStatus returns the Fider PostStatus configured for a Linear workflow state, or false if unmapped.
func ResolveStatus(integration *entity.LinearIntegration, linearStateID string) (string, bool) {
	if integration == nil || integration.StatusMapping == nil {
		return "", false
	}
	v, ok := integration.StatusMapping[linearStateID]
	return v, ok
}
