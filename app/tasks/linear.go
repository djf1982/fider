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
