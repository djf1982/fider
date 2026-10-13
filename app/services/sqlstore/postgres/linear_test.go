package postgres_test

import (
	"testing"

	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/query"
	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/pkg/bus"
)

func newLinkedPost(t *testing.T, title, issueID string) *entity.Post {
	newPost := &cmd.AddNewPost{Title: title, Description: "a request"}
	Expect(bus.Dispatch(jonSnowCtx, newPost)).IsNil()
	Expect(bus.Dispatch(jonSnowCtx, &cmd.SaveLinearIssueMapping{
		PostID:                newPost.Result.ID,
		LinearIssueID:         issueID,
		LinearIssueIdentifier: "SCO-" + issueID,
	})).IsNil()
	return newPost.Result
}

func TestLinearStorage_ASecondClaimForTheSameVoteIsRefused(t *testing.T) {
	SetupDatabaseTest(t)
	defer TeardownDatabaseTest()
	post := newLinkedPost(t, "Claim twice", "issue-1")

	first := &cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID}
	second := &cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID}
	other := &cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: sansaStark.ID}
	Expect(bus.Dispatch(jonSnowCtx, first, second, other)).IsNil()

	Expect(first.Result).IsTrue()
	Expect(second.Result).IsFalse()
	Expect(other.Result).IsTrue()
}

func TestLinearStorage_StoresTheNeedIDAndDeletesOnlyTheMatchingRow(t *testing.T) {
	SetupDatabaseTest(t)
	defer TeardownDatabaseTest()
	post := newLinkedPost(t, "Delete by need", "issue-2")

	Expect(bus.Dispatch(jonSnowCtx,
		&cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID},
		&cmd.SetLinearCustomerNeedID{PostID: post.ID, UserID: aryaStark.ID, LinearNeedID: "need-a"},
		&cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: sansaStark.ID},
	)).IsNil()

	// An unfinished-claim delete must not remove a finished row, and a delete
	// for another need ID must not either.
	Expect(bus.Dispatch(jonSnowCtx,
		&cmd.DeleteLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID},
		&cmd.DeleteLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID, LinearNeedID: "need-other"},
	)).IsNil()
	listed := &query.ListLinearCustomerNeeds{PostID: post.ID}
	Expect(bus.Dispatch(jonSnowCtx, listed)).IsNil()
	Expect(listed.Result).HasLen(2)
	Expect(listed.Result[0].UserID).Equals(aryaStark.ID)
	Expect(listed.Result[0].LinearNeedID).Equals("need-a")
	Expect(listed.Result[1].LinearNeedID).Equals("")

	Expect(bus.Dispatch(jonSnowCtx,
		&cmd.DeleteLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID, LinearNeedID: "need-a"},
		&cmd.DeleteLinearCustomerNeed{PostID: post.ID, UserID: sansaStark.ID},
	)).IsNil()
	listed = &query.ListLinearCustomerNeeds{PostID: post.ID}
	Expect(bus.Dispatch(jonSnowCtx, listed)).IsNil()
	Expect(listed.Result).HasLen(0)
}

func TestLinearStorage_AnotherTenantSeesNoNeedsAndNoLinkedPosts(t *testing.T) {
	SetupDatabaseTest(t)
	defer TeardownDatabaseTest()
	post := newLinkedPost(t, "Tenant scoped", "issue-3")
	Expect(bus.Dispatch(jonSnowCtx,
		&cmd.ClaimLinearCustomerNeed{PostID: post.ID, UserID: aryaStark.ID},
	)).IsNil()

	ownNeeds := &query.ListLinearCustomerNeeds{PostID: post.ID}
	ownPosts := &query.ListPostIDsWithLinearIssue{}
	Expect(bus.Dispatch(jonSnowCtx, ownNeeds, ownPosts)).IsNil()
	otherNeeds := &query.ListLinearCustomerNeeds{PostID: post.ID}
	otherPosts := &query.ListPostIDsWithLinearIssue{}
	Expect(bus.Dispatch(avengersTenantCtx, otherNeeds, otherPosts)).IsNil()

	Expect(ownNeeds.Result).HasLen(1)
	Expect(ownPosts.Result).Equals([]int{post.ID})
	Expect(otherNeeds.Result).HasLen(0)
	Expect(otherPosts.Result).HasLen(0)
}

func TestLinearStorage_ListsOnlyPostsWithAnIssue(t *testing.T) {
	SetupDatabaseTest(t)
	defer TeardownDatabaseTest()
	linked := newLinkedPost(t, "Has an issue", "issue-4")
	unlinked := &cmd.AddNewPost{Title: "No issue", Description: "not synced"}
	Expect(bus.Dispatch(jonSnowCtx, unlinked)).IsNil()

	ids := &query.ListPostIDsWithLinearIssue{}
	Expect(bus.Dispatch(jonSnowCtx, ids)).IsNil()

	Expect(ids.Result).Equals([]int{linked.ID})
}

func TestLinearStorage_SavesTheDeclineAndDuplicateStates(t *testing.T) {
	SetupDatabaseTest(t)
	defer TeardownDatabaseTest()

	Expect(bus.Dispatch(demoTenantCtx, &cmd.SaveLinearIntegration{
		APIKey:           "key",
		TeamID:           "team",
		IsEnabled:        true,
		StatusMapping:    entity.LinearStatusMapping{"state-wont-do": "declined"},
		DeclinedStateID:  "state-wont-do",
		DuplicateStateID: "state-duplicate",
	})).IsNil()
	saved := &query.GetLinearIntegration{}
	Expect(bus.Dispatch(demoTenantCtx, saved)).IsNil()
	Expect(saved.Result.DeclinedStateID).Equals("state-wont-do")
	Expect(saved.Result.DuplicateStateID).Equals("state-duplicate")

	Expect(bus.Dispatch(demoTenantCtx, &cmd.SaveLinearIntegration{
		APIKey: "key", TeamID: "team", IsEnabled: true,
	})).IsNil()
	cleared := &query.GetLinearIntegration{}
	Expect(bus.Dispatch(demoTenantCtx, cleared)).IsNil()
	Expect(cleared.Result.DeclinedStateID).Equals("")
	Expect(cleared.Result.DuplicateStateID).Equals("")
}
