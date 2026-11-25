// Package linearsync holds the decisions of the Fider ↔ Linear sync that need
// no I/O: which votes count, which customer needs to create or delete, which
// customer a voter belongs to, and when a Fider status moves a Linear issue.
//
// It imports nothing that needs cgo, so its tests run with a plain `go test`.
package linearsync

import (
	"time"

	"github.com/getfider/fider/app/models/entity"
)

// StaleClaimAfter is how long a claimed but unfinished customer need may sit
// before a later run takes it over. A run claims the row before it calls
// Linear, so a crash between the two leaves a claim with no need ID.
const StaleClaimAfter = 10 * time.Minute

// NoAccountExternalID is the catch-all Linear customer for voters with no
// Scoutworks account.
const NoAccountExternalID = "fider-no-scoutworks-account"

// NoAccountName is the catch-all customer's name in Linear.
const NoAccountName = "Fider: no Scoutworks account"

// Voter is one upvoter of a post.
type Voter struct {
	UserID int
	Name   string
	Email  string
}

// StoredNeed is the row that links one voter's vote to one Linear customer
// need. NeedID is empty while a run holds the claim.
type StoredNeed struct {
	UserID    int
	NeedID    string
	ClaimedAt time.Time
}

// Plan is what one run must do to make Linear match the post's votes.
type Plan struct {
	// Create holds the voters who need a customer need.
	Create []Voter
	// Delete holds the needs whose vote is gone.
	Delete []StoredNeed
	// Reclaim holds stale claims: delete the row before anything else.
	Reclaim []StoredNeed
}

// Upvoters returns the votes that count as demand. A downvote does not.
// Vote type 0 is a vote from before downvotes existed, and counts as up.
func Upvoters(votes []*entity.Vote) []Voter {
	voters := make([]Voter, 0, len(votes))
	for _, v := range votes {
		if v == nil || v.User == nil || v.VoteType < 0 {
			continue
		}
		voters = append(voters, Voter{UserID: v.User.ID, Name: v.User.Name, Email: v.User.Email})
	}
	return voters
}

// PlanNeeds compares the post's upvoters with the needs already stored.
func PlanNeeds(upvoters []Voter, stored []StoredNeed, now time.Time) Plan {
	plan := Plan{}
	voted := make(map[int]bool, len(upvoters))
	for _, v := range upvoters {
		voted[v.UserID] = true
	}

	held := make(map[int]bool, len(stored))
	for _, n := range stored {
		if n.NeedID == "" {
			if now.Sub(n.ClaimedAt) <= StaleClaimAfter {
				// Another run holds this claim. Leave it, vote or no vote.
				held[n.UserID] = true
				continue
			}
			plan.Reclaim = append(plan.Reclaim, n)
			continue
		}
		held[n.UserID] = true
		if !voted[n.UserID] {
			plan.Delete = append(plan.Delete, n)
		}
	}

	for _, v := range upvoters {
		if !held[v.UserID] {
			plan.Create = append(plan.Create, v)
		}
	}
	return plan
}

// VoterGroup is the Scoutworks group a vote counts for.
type VoterGroup struct {
	GroupID     string `json:"groupId"`
	Name        string `json:"name"`
	MemberCount int    `json:"memberCount"`
}

// Customer is a Linear customer, matched on ExternalID.
type Customer struct {
	ExternalID string
	Name       string
	Size       int
}

// CustomerFor returns the Linear customer for a voter's group. A voter with
// no group counts under the catch-all customer.
func CustomerFor(group *VoterGroup) Customer {
	if group == nil || group.GroupID == "" {
		return Customer{ExternalID: NoAccountExternalID, Name: NoAccountName}
	}
	return Customer{
		ExternalID: "scoutworks-group:" + group.GroupID,
		Name:       group.Name,
		Size:       group.MemberCount,
	}
}

// TargetState returns the Linear state a Fider status moves the issue to.
// Only a decline and a duplicate sync back: Linear owns the rest of the
// lifecycle. An empty result means "do not move the issue".
func TargetState(fiderStatus, declinedStateID, duplicateStateID string) string {
	switch fiderStatus {
	case "declined":
		return declinedStateID
	case "duplicate":
		return duplicateStateID
	}
	return ""
}

// ShouldMoveIssue reports whether to move the issue to target. It does not
// move an issue whose current state already maps to the same Fider status:
// that keeps a Canceled issue from being forced to Won't do, and it stops
// the webhook round trip (Linear → Fider → Linear) at the first step.
func ShouldMoveIssue(currentStateID, targetStateID, fiderStatus string, mapping map[string]string) bool {
	if targetStateID == "" || currentStateID == targetStateID {
		return false
	}
	return mapping[currentStateID] != fiderStatus
}

// Chunk splits items into slices of at most size.
func Chunk[T any](items []T, size int) [][]T {
	chunks := [][]T{}
	for start := 0; start < len(items); start += size {
		end := min(start+size, len(items))
		chunks = append(chunks, items[start:end])
	}
	return chunks
}

// Fider statuses a post can no longer leave through Linear. A Linear change
// never reopens a post that staff closed or merged.
var closedStatuses = map[string]bool{
	"completed": true,
	"declined":  true,
	"duplicate": true,
	"deleted":   true,
}

// IsClosed reports whether a Fider status ends a post's life on the board.
func IsClosed(fiderStatus string) bool {
	return closedStatuses[fiderStatus]
}

// relationDuplicate is the Linear relation type of "this issue duplicates that one".
const relationDuplicate = "duplicate"

// Relation is one Linear issue relation, as the duplicate sync reads it. For a
// relation, the issue fields name the related issue; for an inverse relation,
// they name the issue that points here.
type Relation struct {
	Type       string
	IssueID    string
	Identifier string
	StateID    string
	StateName  string
}

// DuplicateOriginal returns the issue that this issue duplicates, or nil.
func DuplicateOriginal(relations []Relation) *Relation {
	for i := range relations {
		if relations[i].Type == relationDuplicate && relations[i].IssueID != "" {
			return &relations[i]
		}
	}
	return nil
}

// DuplicateIssueIDs returns the IDs of the issues marked as duplicates of
// this one, once each.
func DuplicateIssueIDs(inverse []Relation) []string {
	seen := map[string]bool{}
	ids := []string{}
	for _, r := range inverse {
		if r.Type != relationDuplicate || r.IssueID == "" || seen[r.IssueID] {
			continue
		}
		seen[r.IssueID] = true
		ids = append(ids, r.IssueID)
	}
	return ids
}

// FollowsOriginal reports whether the post of a duplicate issue takes the
// status of its original issue. Only a release carries over: the person who
// asked must hear that it shipped. An open post on a duplicate stays open
// while the original is still planned, and a closed post never moves.
func FollowsOriginal(originalStatus, postStatus string) bool {
	return originalStatus == "completed" && !IsClosed(postStatus)
}

// StatusOnLink returns the status a post takes when staff link it to an
// existing Linear issue: the status the issue's state maps to. It returns ""
// when the state has no mapping, when the post already has that status, or
// when the post is closed and the issue is not.
func StatusOnLink(mappedStatus string, mapped bool, postStatus string) string {
	if !mapped || mappedStatus == "" || mappedStatus == postStatus {
		return ""
	}
	if IsClosed(postStatus) && !IsClosed(mappedStatus) {
		return ""
	}
	if postStatus == "duplicate" || postStatus == "deleted" {
		return ""
	}
	return mappedStatus
}
