package handlers

import (
	"net/http"

	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/web"
)

// Roadmap shows the planned, started and completed posts in three columns
func Roadmap() web.HandlerFunc {
	return func(c *web.Context) error {
		planned := &query.SearchPosts{View: "most-wanted", Limit: "50", Statuses: []enum.PostStatus{enum.PostPlanned}}
		started := &query.SearchPosts{View: "most-wanted", Limit: "50", Statuses: []enum.PostStatus{enum.PostStarted}}
		completed := &query.SearchPosts{View: "recent", Limit: "20", Statuses: []enum.PostStatus{enum.PostCompleted}}
		getAllTags := &query.GetAllTags{}

		if err := bus.Dispatch(c, planned, started, completed, getAllTags); err != nil {
			return c.Failure(err)
		}

		return c.Page(http.StatusOK, web.Props{
			Page:        "Roadmap/Roadmap.page",
			Title:       "Roadmap",
			Description: "What we have planned, what we are working on, and what we have shipped.",
			Data: web.Map{
				"planned":   planned.Result,
				"started":   started.Result,
				"completed": completed.Result,
				"tags":      getAllTags.Result,
			},
		})
	}
}
