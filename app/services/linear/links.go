package linear

import (
	"context"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/pkg/errors"
	"github.com/getfider/fider/app/services/linear/linearsync"
)

// Issue is a Linear issue as the link and duplicate sync read it.
type Issue struct {
	ID         string
	Identifier string
	URL        string
	StateID    string
	StateName  string
}

const issueByRefQuery = `
query IssueByRef($id: String!) {
  issue(id: $id) { id identifier url state { id name } }
}`

type issueByRefData struct {
	Issue *struct {
		ID         string `json:"id"`
		Identifier string `json:"identifier"`
		URL        string `json:"url"`
		State      struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"state"`
	} `json:"issue"`
}

// FetchIssue loads one Linear issue by its ID or its identifier (SCO-123).
// It returns app.ErrNotFound when Linear has no such issue.
func FetchIssue(ctx context.Context, apiKey, ref string) (*Issue, error) {
	out := &issueByRefData{}
	err := doGraphQL(ctx, apiKey, graphqlRequest{
		Query:     issueByRefQuery,
		Variables: map[string]interface{}{"id": ref},
	}, out)
	if err != nil {
		// Linear answers an unknown issue with an "Entity not found" error.
		return nil, errors.Wrap(err, "load linear issue %s", ref)
	}
	if out.Issue == nil || out.Issue.ID == "" {
		return nil, app.ErrNotFound
	}
	return &Issue{
		ID:         out.Issue.ID,
		Identifier: out.Issue.Identifier,
		URL:        out.Issue.URL,
		StateID:    out.Issue.State.ID,
		StateName:  out.Issue.State.Name,
	}, nil
}

const issueDuplicatesQuery = `
query IssueDuplicates($id: String!) {
  issue(id: $id) {
    relations(first: 50) {
      nodes { type relatedIssue { id identifier state { id name } } }
    }
    inverseRelations(first: 50) {
      nodes { type issue { id identifier } }
    }
  }
}`

type relatedIssueNode struct {
	ID         string `json:"id"`
	Identifier string `json:"identifier"`
	State      struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"state"`
}

type issueDuplicatesData struct {
	Issue *struct {
		Relations struct {
			Nodes []struct {
				Type         string           `json:"type"`
				RelatedIssue relatedIssueNode `json:"relatedIssue"`
			} `json:"nodes"`
		} `json:"relations"`
		InverseRelations struct {
			Nodes []struct {
				Type  string           `json:"type"`
				Issue relatedIssueNode `json:"issue"`
			} `json:"nodes"`
		} `json:"inverseRelations"`
	} `json:"issue"`
}

// DuplicateLinks are an issue's duplicate relations in both directions.
type DuplicateLinks struct {
	// Original is the issue this one duplicates, with its current state, or nil.
	Original *linearsync.Relation
	// DuplicateIDs are the issues marked as duplicates of this one.
	DuplicateIDs []string
}

// FetchDuplicateLinks loads the duplicate relations of one Linear issue.
func FetchDuplicateLinks(ctx context.Context, apiKey, issueID string) (*DuplicateLinks, error) {
	out := &issueDuplicatesData{}
	err := doGraphQL(ctx, apiKey, graphqlRequest{
		Query:     issueDuplicatesQuery,
		Variables: map[string]interface{}{"id": issueID},
	}, out)
	if err != nil {
		return nil, errors.Wrap(err, "load linear duplicate relations")
	}
	if out.Issue == nil {
		return &DuplicateLinks{}, nil
	}

	relations := make([]linearsync.Relation, 0, len(out.Issue.Relations.Nodes))
	for _, n := range out.Issue.Relations.Nodes {
		relations = append(relations, linearsync.Relation{
			Type:       n.Type,
			IssueID:    n.RelatedIssue.ID,
			Identifier: n.RelatedIssue.Identifier,
			StateID:    n.RelatedIssue.State.ID,
			StateName:  n.RelatedIssue.State.Name,
		})
	}
	inverse := make([]linearsync.Relation, 0, len(out.Issue.InverseRelations.Nodes))
	for _, n := range out.Issue.InverseRelations.Nodes {
		inverse = append(inverse, linearsync.Relation{
			Type:       n.Type,
			IssueID:    n.Issue.ID,
			Identifier: n.Issue.Identifier,
		})
	}
	return &DuplicateLinks{
		Original:     linearsync.DuplicateOriginal(relations),
		DuplicateIDs: linearsync.DuplicateIssueIDs(inverse),
	}, nil
}

// StatusResponse builds the command that sets a post's status from Linear.
func StatusResponse(post *entity.Post, statusName, text string) (*cmd.SetPostResponse, error) {
	var status enum.PostStatus
	if err := status.UnmarshalText([]byte(statusName)); err != nil {
		return nil, errors.Wrap(err, "unknown fider status %s", statusName)
	}
	return &cmd.SetPostResponse{Post: post, Status: status, Text: text}, nil
}
