package apiv1_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/handlers/apiv1"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/mock"
)

// linkFixture registers the bus handlers a link request needs: one post, an
// integration that maps state-released to completed, and a Linear API that
// answers every issue lookup with the given body.
type linkFixture struct {
	post      *entity.Post
	linkedTo  *entity.Post
	saved     *cmd.SaveLinearIssueMapping
	responses []*cmd.SetPostResponse
}

func newLinkFixture(postStatus enum.PostStatus, linearBody string) *linkFixture {
	f := &linkFixture{post: &entity.Post{ID: 7, Number: 316, Title: "Varied photo permissions", Status: postStatus}}

	bus.AddHandler(func(ctx context.Context, q *query.GetLinearIntegration) error {
		q.Result = &entity.LinearIntegration{
			APIKey:        "lin_api_test",
			IsEnabled:     true,
			StatusMapping: entity.LinearStatusMapping{"state-released": "completed", "state-progress": "started"},
		}
		return nil
	})
	bus.AddHandler(func(ctx context.Context, q *query.GetPostByNumber) error {
		if q.Number != f.post.Number {
			return app.ErrNotFound
		}
		q.Result = f.post
		return nil
	})
	bus.AddHandler(func(ctx context.Context, c *cmd.HTTPRequest) error {
		c.ResponseStatusCode = http.StatusOK
		c.ResponseBody = []byte(linearBody)
		return nil
	})
	bus.AddHandler(func(ctx context.Context, q *query.GetPostByLinearIssueID) error {
		if f.linkedTo == nil {
			return app.ErrNotFound
		}
		q.Result = f.linkedTo
		return nil
	})
	bus.AddHandler(func(ctx context.Context, c *cmd.SaveLinearIssueMapping) error {
		f.saved = c
		return nil
	})
	bus.AddHandler(func(ctx context.Context, c *cmd.SetPostResponse) error {
		f.responses = append(f.responses, c)
		return nil
	})
	return f
}

const releasedIssue = `{"data":{"issue":{"id":"uuid-1486","identifier":"SCO-1486","url":"https://linear.app/x/issue/SCO-1486","state":{"id":"state-released","name":"Released"}}}}`
const triageIssue = `{"data":{"issue":{"id":"uuid-2681","identifier":"SCO-2681","url":"https://linear.app/x/issue/SCO-2681","state":{"id":"state-triage","name":"Triage"}}}}`

func linkRequest(body string) (int, string) {
	code, response := mock.NewServer().
		OnTenant(mock.DemoTenant).
		AsUser(mock.JonSnow).
		AddParam("number", 316).
		ExecutePost(apiv1.LinkPostToLinearIssue(), body)
	return code, response.Body.String()
}

func TestLinkPostToLinearIssue_ALinkToAReleasedIssueClosesTheOpenPost(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostOpen, releasedIssue)

	code, body := linkRequest(`{"issue": " SCO-1486 "}`)

	Expect(code).Equals(http.StatusOK)
	Expect(f.saved.PostID).Equals(7)
	Expect(f.saved.LinearIssueID).Equals("uuid-1486")
	Expect(f.saved.LinearIssueIdentifier).Equals("SCO-1486")
	Expect(len(f.responses)).Equals(1)
	Expect(f.responses[0].Status).Equals(enum.PostCompleted)
	Expect(f.responses[0].Text).Equals("Status updated from Linear: Released")
	Expect(strings.Contains(body, `"status":"completed"`)).IsTrue()
}

func TestLinkPostToLinearIssue_AnUnmappedStateLinksWithoutChangingTheStatus(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostOpen, triageIssue)

	code, body := linkRequest(`{"issue": "SCO-2681"}`)

	Expect(code).Equals(http.StatusOK)
	Expect(f.saved.LinearIssueIdentifier).Equals("SCO-2681")
	Expect(len(f.responses)).Equals(0)
	Expect(strings.Contains(body, `"status":"open"`)).IsTrue()
}

func TestLinkPostToLinearIssue_RefusesAnIssueLinkedToAnotherPost(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostOpen, releasedIssue)
	f.linkedTo = &entity.Post{ID: 99, Number: 85}

	code, body := linkRequest(`{"issue": "SCO-1486"}`)

	Expect(code).Equals(http.StatusBadRequest)
	Expect(f.saved).IsNil()
	Expect(strings.Contains(body, "already linked to post #85")).IsTrue()
}

func TestLinkPostToLinearIssue_RefusesAnIssueLinearDoesNotHave(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostOpen, `{"data":{"issue":null}}`)

	code, body := linkRequest(`{"issue": "SCO-0"}`)

	Expect(code).Equals(http.StatusBadRequest)
	Expect(f.saved).IsNil()
	Expect(strings.Contains(body, "Linear has no issue SCO-0")).IsTrue()
}

func TestLinkPostToLinearIssue_RefusesAnEmptyIssue(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostOpen, releasedIssue)

	code, _ := linkRequest(`{"issue": "  "}`)

	Expect(code).Equals(http.StatusBadRequest)
	Expect(f.saved).IsNil()
}

func TestLinkPostToLinearIssue_NeverReopensACompletedPost(t *testing.T) {
	RegisterT(t)
	f := newLinkFixture(enum.PostCompleted, `{"data":{"issue":{"id":"uuid-9","identifier":"SCO-9","url":"u","state":{"id":"state-progress","name":"In Progress"}}}}`)

	code, _ := linkRequest(`{"issue": "SCO-9"}`)

	Expect(code).Equals(http.StatusOK)
	Expect(f.saved.LinearIssueIdentifier).Equals("SCO-9")
	Expect(len(f.responses)).Equals(0)
}

func TestListLinearIssueLinks_ListsLinksByPostNumber(t *testing.T) {
	RegisterT(t)
	bus.AddHandler(func(ctx context.Context, q *query.ListLinearIssueLinks) error {
		q.Result = []*entity.PostLinearIssueLink{
			{PostNumber: 316, IssueIdentifier: "SCO-1486", IssueURL: "https://linear.app/x/issue/SCO-1486"},
			{PostNumber: 337, IssueIdentifier: "SCO-1711", IssueURL: "https://linear.app/x/issue/SCO-1711"},
		}
		return nil
	})

	code, response := mock.NewServer().OnTenant(mock.DemoTenant).Execute(apiv1.ListLinearIssueLinks())

	Expect(code).Equals(http.StatusOK)
	Expect(response.Body.String()).ContainsSubstring(`{"postNumber":337,"issueIdentifier":"SCO-1711","issueUrl":"https://linear.app/x/issue/SCO-1711"}`)
}
