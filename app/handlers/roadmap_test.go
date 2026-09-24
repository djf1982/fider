package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/getfider/fider/app/handlers"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/mock"
)

func TestRoadmapHandler(t *testing.T) {
	RegisterT(t)

	searched := map[enum.PostStatus]string{}
	bus.AddHandler(func(ctx context.Context, q *query.SearchPosts) error {
		Expect(q.Statuses).HasLen(1)
		searched[q.Statuses[0]] = q.View
		q.Result = []*entity.Post{{Number: 1, Title: "A post", Status: q.Statuses[0]}}
		return nil
	})
	bus.AddHandler(func(ctx context.Context, q *query.GetAllTags) error {
		return nil
	})

	server := mock.NewServer()
	code, _ := server.OnTenant(mock.DemoTenant).
		AsUser(mock.JonSnow).
		Execute(handlers.Roadmap())

	Expect(code).Equals(http.StatusOK)
	Expect(searched[enum.PostPlanned]).Equals("most-wanted")
	Expect(searched[enum.PostStarted]).Equals("most-wanted")
	Expect(searched[enum.PostCompleted]).Equals("recent")
}
