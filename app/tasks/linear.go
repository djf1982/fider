package tasks

import (
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/worker"
)

// SyncNewPostToLinear creates a Linear issue for a newly created Fider post.
// Silently no-ops if the tenant has no Linear integration configured.
func SyncNewPostToLinear(post *entity.Post) worker.Task {
	return describe("Sync new post to Linear", func(c *worker.Context) error {
		if err := bus.Dispatch(c, &cmd.SyncPostToLinear{Post: post}); err != nil {
			return c.Failure(err)
		}
		return nil
	})
}

// SyncNewCommentToLinear appends a Fider comment to the mapped Linear issue.
// Silently no-ops if the post has no Linear mapping.
func SyncNewCommentToLinear(post *entity.Post, comment *entity.Comment) worker.Task {
	return describe("Sync new comment to Linear", func(c *worker.Context) error {
		if err := bus.Dispatch(c, &cmd.SyncCommentToLinear{Post: post, Comment: comment}); err != nil {
			return c.Failure(err)
		}
		return nil
	})
}

// SyncPostVotesToLinear makes the Linear customer needs of a post's issue
// match its upvotes. Silently no-ops without a Linear integration or issue.
func SyncPostVotesToLinear(postID int) worker.Task {
	return describe("Sync post votes to Linear", func(c *worker.Context) error {
		if err := bus.Dispatch(c, &cmd.SyncPostVotesToLinear{PostID: postID}); err != nil {
			return c.Failure(err)
		}
		return nil
	})
}

// SyncPostStatusToLinear moves the Linear issue after staff decline a post
// or mark it as a duplicate. Other statuses do nothing.
func SyncPostStatusToLinear(postID int) worker.Task {
	return describe("Sync post status to Linear", func(c *worker.Context) error {
		if err := bus.Dispatch(c, &cmd.SyncPostStatusToLinear{PostID: postID}); err != nil {
			return c.Failure(err)
		}
		return nil
	})
}

// SyncAllVotesToLinear backfills the votes of every post with a Linear issue.
func SyncAllVotesToLinear() worker.Task {
	return describe("Sync all votes to Linear", func(c *worker.Context) error {
		if err := bus.Dispatch(c, &cmd.SyncAllVotesToLinear{}); err != nil {
			return c.Failure(err)
		}
		return nil
	})
}
