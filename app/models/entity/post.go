package entity

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/getfider/fider/app/models/enum"
)

// Post represents an post on a tenant board
type Post struct {
	ID            int                 `json:"id"`
	Number        int                 `json:"number"`
	Title         string              `json:"title"`
	Slug          string              `json:"slug"`
	Description   string              `json:"description"`
	Problem       string              `json:"problem,omitempty"`
	IdealOutcome  string              `json:"idealOutcome,omitempty"`
	Workaround    string              `json:"workaround,omitempty"`
	Suggestion    string              `json:"suggestedSolution,omitempty"`
	Importance    enum.PostImportance `json:"importance,omitempty"`
	CreatedAt     time.Time           `json:"createdAt"`
	User          *User               `json:"user"`
	HasVoted      bool                `json:"hasVoted"`
	VoteType      int                 `json:"voteType"`
	VotesCount    int                 `json:"votesCount"`
	CommentsCount int                 `json:"commentsCount"`
	Status        enum.PostStatus     `json:"status"`
	Response      *PostResponse       `json:"response,omitempty"`
	Tags          []string            `json:"tags"`
	IsApproved    bool                `json:"isApproved"`
}

// CanBeVoted returns true if this post can have its vote changed
func (i *Post) CanBeVoted() bool {
	return i.Status != enum.PostCompleted && i.Status != enum.PostDeclined && i.Status != enum.PostDuplicate
}

func (i *Post) Url(baseURL string) string {
	return fmt.Sprintf("%s/posts/%d/%s", baseURL, i.Number, i.Slug)
}

// A structured post description starts with this heading.
// See composePostDescription in app/services/sqlstore/postgres/post.go.
const problemHeading = "**The problem**"

// The headings that can follow the problem section.
var nextSectionHeading = regexp.MustCompile(`\n\n\*\*(Ideal outcome|Importance|Current workaround|Suggested solution)\*\*[ \t]*(\n|$)`)

// Summary returns the Markdown to show in a short preview of the post.
// For a structured post, it is the text of "The problem" section only.
// For any other post, it is the full description.
// Keep this in step with postSummary in public/services/markdown.ts.
func (i *Post) Summary() string {
	if !strings.HasPrefix(i.Description, problemHeading) {
		return i.Description
	}
	body := strings.TrimLeft(strings.TrimPrefix(i.Description, problemHeading), " \t\n")
	if loc := nextSectionHeading.FindStringIndex(body); loc != nil {
		body = body[:loc[0]]
	}
	return strings.TrimSpace(body)
}

// PostResponse is a staff response to a given post
type PostResponse struct {
	Text        string        `json:"text"`
	RespondedAt time.Time     `json:"respondedAt"`
	User        *User         `json:"user"`
	Original    *OriginalPost `json:"original"`
}

// OriginalPost holds details of the original post of a duplicate
type OriginalPost struct {
	Number int             `json:"number"`
	Title  string          `json:"title"`
	Slug   string          `json:"slug"`
	Status enum.PostStatus `json:"status"`
}

func (i *OriginalPost) Url(baseURL string) string {
	return fmt.Sprintf("%s/posts/%d/%s", baseURL, i.Number, i.Slug)
}
