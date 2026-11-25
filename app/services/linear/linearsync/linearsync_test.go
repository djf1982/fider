package linearsync_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/services/linear/linearsync"
)

var now = time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)

func userIDs(voters []linearsync.Voter) []int {
	ids := []int{}
	for _, v := range voters {
		ids = append(ids, v.UserID)
	}
	return ids
}

func needUserIDs(needs []linearsync.StoredNeed) []int {
	ids := []int{}
	for _, n := range needs {
		ids = append(ids, n.UserID)
	}
	return ids
}

func TestUpvoters_LeavesOutDownvotes(t *testing.T) {
	votes := []*entity.Vote{
		{User: &entity.VoteUser{ID: 1, Name: "Up", Email: "up@example.com"}, VoteType: 1},
		{User: &entity.VoteUser{ID: 2, Name: "Down", Email: "down@example.com"}, VoteType: -1},
		{User: &entity.VoteUser{ID: 3, Name: "Legacy", Email: "legacy@example.com"}, VoteType: 0},
	}

	got := userIDs(linearsync.Upvoters(votes))

	if !reflect.DeepEqual(got, []int{1, 3}) {
		t.Fatalf("upvoters = %v, want [1 3]: a downvote is not demand", got)
	}
}

func TestPlanNeeds_CreatesForANewUpvoterAndKeepsAnExistingOne(t *testing.T) {
	upvoters := []linearsync.Voter{{UserID: 1}, {UserID: 2}}
	stored := []linearsync.StoredNeed{{UserID: 1, NeedID: "need-1", ClaimedAt: now.Add(-time.Hour)}}

	plan := linearsync.PlanNeeds(upvoters, stored, now)

	if got := userIDs(plan.Create); !reflect.DeepEqual(got, []int{2}) {
		t.Fatalf("create = %v, want [2]", got)
	}
	if len(plan.Delete) != 0 || len(plan.Reclaim) != 0 {
		t.Fatalf("delete = %v, reclaim = %v, want none", plan.Delete, plan.Reclaim)
	}
}

func TestPlanNeeds_DeletesTheNeedOfARemovedVote(t *testing.T) {
	stored := []linearsync.StoredNeed{
		{UserID: 1, NeedID: "need-1", ClaimedAt: now.Add(-time.Hour)},
		{UserID: 2, NeedID: "need-2", ClaimedAt: now.Add(-time.Hour)},
	}

	plan := linearsync.PlanNeeds([]linearsync.Voter{{UserID: 2}}, stored, now)

	if got := needUserIDs(plan.Delete); !reflect.DeepEqual(got, []int{1}) {
		t.Fatalf("delete = %v, want [1]", got)
	}
	if len(plan.Create) != 0 {
		t.Fatalf("create = %v, want none", plan.Create)
	}
}

func TestPlanNeeds_LeavesAFreshClaimToTheRunThatHoldsIt(t *testing.T) {
	stored := []linearsync.StoredNeed{{UserID: 1, NeedID: "", ClaimedAt: now.Add(-time.Minute)}}

	upvoted := linearsync.PlanNeeds([]linearsync.Voter{{UserID: 1}}, stored, now)
	unvoted := linearsync.PlanNeeds(nil, stored, now)

	for name, plan := range map[string]linearsync.Plan{"upvoted": upvoted, "unvoted": unvoted} {
		if len(plan.Create)+len(plan.Delete)+len(plan.Reclaim) != 0 {
			t.Fatalf("%s: plan = %+v, want nothing: a second run must not create a second need", name, plan)
		}
	}
}

func TestPlanNeeds_ReclaimsAStaleClaimAndRecreatesOnlyIfTheVoteStands(t *testing.T) {
	stored := []linearsync.StoredNeed{{UserID: 1, NeedID: "", ClaimedAt: now.Add(-linearsync.StaleClaimAfter - time.Second)}}

	upvoted := linearsync.PlanNeeds([]linearsync.Voter{{UserID: 1}}, stored, now)
	unvoted := linearsync.PlanNeeds(nil, stored, now)

	if got := needUserIDs(upvoted.Reclaim); !reflect.DeepEqual(got, []int{1}) {
		t.Fatalf("upvoted reclaim = %v, want [1]", got)
	}
	if got := userIDs(upvoted.Create); !reflect.DeepEqual(got, []int{1}) {
		t.Fatalf("upvoted create = %v, want [1]", got)
	}
	if got := needUserIDs(unvoted.Reclaim); !reflect.DeepEqual(got, []int{1}) {
		t.Fatalf("unvoted reclaim = %v, want [1]", got)
	}
	if len(unvoted.Create)+len(unvoted.Delete) != 0 {
		t.Fatalf("unvoted plan = %+v, want reclaim only", unvoted)
	}
}

func TestCustomerFor_UsesTheGroupOrTheCatchAll(t *testing.T) {
	group := linearsync.CustomerFor(&linearsync.VoterGroup{GroupID: "g-1", Name: "1st Testville", MemberCount: 84})
	none := linearsync.CustomerFor(nil)

	if group != (linearsync.Customer{ExternalID: "scoutworks-group:g-1", Name: "1st Testville", Size: 84}) {
		t.Fatalf("group customer = %+v", group)
	}
	if none.ExternalID != linearsync.NoAccountExternalID || none.ExternalID == group.ExternalID {
		t.Fatalf("no-account customer = %+v, want the catch-all", none)
	}
}

func TestTargetState_OnlyDeclinedAndDuplicateSyncBack(t *testing.T) {
	cases := map[string]string{
		"declined":  "state-wont-do",
		"duplicate": "state-duplicate",
		"started":   "",
		"completed": "",
	}
	for status, want := range cases {
		if got := linearsync.TargetState(status, "state-wont-do", "state-duplicate"); got != want {
			t.Errorf("TargetState(%q) = %q, want %q", status, got, want)
		}
	}
}

func TestShouldMoveIssue_SkipsAStateThatAlreadyMeansTheSameStatus(t *testing.T) {
	mapping := map[string]string{"state-canceled": "declined", "state-in-progress": "started", "state-wont-do": "declined"}

	cases := []struct {
		name, current, target string
		want                  bool
	}{
		{"moves an issue that is in progress", "state-in-progress", "state-wont-do", true},
		{"leaves an issue already in a declined state", "state-canceled", "state-wont-do", false},
		{"leaves an issue already in the target state", "state-wont-do", "state-wont-do", false},
		{"does nothing with no target configured", "state-in-progress", "", false},
	}
	for _, c := range cases {
		if got := linearsync.ShouldMoveIssue(c.current, c.target, "declined", mapping); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestChunk_SplitsAtTheLookupLimit(t *testing.T) {
	emails := make([]string, 205)
	got := []int{}
	for _, part := range linearsync.Chunk(emails, 100) {
		got = append(got, len(part))
	}
	if !reflect.DeepEqual(got, []int{100, 100, 5}) {
		t.Fatalf("chunks = %v, want [100 100 5]", got)
	}
}

func TestDuplicateOriginal_FindsTheIssueThisOneDuplicates(t *testing.T) {
	relations := []linearsync.Relation{
		{Type: "related", IssueID: "issue-related"},
		{Type: "duplicate", IssueID: "issue-original", Identifier: "SCO-1365", StateID: "state-released"},
	}
	got := linearsync.DuplicateOriginal(relations)
	if got == nil || got.IssueID != "issue-original" {
		t.Fatalf("DuplicateOriginal = %+v, want issue-original", got)
	}
	if linearsync.DuplicateOriginal(relations[:1]) != nil {
		t.Errorf("DuplicateOriginal found an original among non-duplicate relations")
	}
}

func TestDuplicateIssueIDs_ListsEachDuplicateOnceAndSkipsOtherRelations(t *testing.T) {
	inverse := []linearsync.Relation{
		{Type: "duplicate", IssueID: "issue-a"},
		{Type: "blocks", IssueID: "issue-b"},
		{Type: "duplicate", IssueID: "issue-a"},
		{Type: "duplicate", IssueID: "issue-c"},
	}
	got := linearsync.DuplicateIssueIDs(inverse)
	if !reflect.DeepEqual(got, []string{"issue-a", "issue-c"}) {
		t.Errorf("DuplicateIssueIDs = %v, want [issue-a issue-c]", got)
	}
}

func TestFollowsOriginal_OnlyAReleaseClosesAnOpenDuplicate(t *testing.T) {
	cases := []struct {
		name, original, post string
		want                 bool
	}{
		{"a released original closes an open duplicate", "completed", "open", true},
		{"a released original closes a planned duplicate", "completed", "planned", true},
		{"a started original leaves the duplicate open", "started", "open", false},
		{"a declined original does not decline the duplicate", "declined", "open", false},
		{"a closed duplicate never moves", "completed", "declined", false},
	}
	for _, c := range cases {
		if got := linearsync.FollowsOriginal(c.original, c.post); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestStatusOnLink_TakesTheIssueStatusButNeverReopensAClosedPost(t *testing.T) {
	cases := []struct {
		name, mappedStatus string
		mapped             bool
		post, want         string
	}{
		{"a released issue closes an open post", "completed", true, "open", "completed"},
		{"an issue in progress starts an open post", "started", true, "open", "started"},
		{"an unmapped state leaves the post", "", false, "open", ""},
		{"the same status changes nothing", "started", true, "started", ""},
		{"an open issue never reopens a completed post", "open", true, "completed", ""},
		{"a duplicate post stays a duplicate", "completed", true, "duplicate", ""},
	}
	for _, c := range cases {
		if got := linearsync.StatusOnLink(c.mappedStatus, c.mapped, c.post); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
