package dbEntities

import (
	"context"
	"time"

	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/pkg/dbx"
	"github.com/lib/pq"
)

type Post struct {
	ID             int            `db:"id"`
	Number         int            `db:"number"`
	Title          string         `db:"title"`
	Slug           string         `db:"slug"`
	Description    string         `db:"description"`
	Problem        dbx.NullString `db:"problem"`
	IdealOutcome   dbx.NullString `db:"ideal_outcome"`
	Workaround     dbx.NullString `db:"workaround"`
	Suggestion     dbx.NullString `db:"suggested_solution"`
	Importance     int            `db:"importance"`
	CreatedAt      time.Time      `db:"created_at"`
	Search         []byte         `db:"search"`
	User           *User          `db:"user"`
	VoteType       dbx.NullInt    `db:"vote_type"`
	VotesCount     int            `db:"votes_count"`
	CommentsCount  int            `db:"comments_count"`
	RecentVotes    int            `db:"recent_votes_count"`
	RecentComments int            `db:"recent_comments_count"`
	Status         int            `db:"status"`
	Response       dbx.NullString `db:"response"`
	RespondedAt    dbx.NullTime   `db:"response_date"`
	ResponseUser   *User          `db:"response_user"`
	OriginalNumber dbx.NullInt    `db:"original_number"`
	OriginalTitle  dbx.NullString `db:"original_title"`
	OriginalSlug   dbx.NullString `db:"original_slug"`
	OriginalStatus dbx.NullInt    `db:"original_status"`
	Tags           pq.StringArray `db:"tags"`
	IsApproved     bool           `db:"is_approved"`
}

func (i *Post) ToModel(ctx context.Context) *entity.Post {
	post := &entity.Post{
		ID:            i.ID,
		Number:        i.Number,
		Title:         i.Title,
		Slug:          i.Slug,
		Description:   i.Description,
		Problem:       i.Problem.String,
		IdealOutcome:  i.IdealOutcome.String,
		Workaround:    i.Workaround.String,
		Suggestion:    i.Suggestion.String,
		Importance:    enum.PostImportance(i.Importance),
		CreatedAt:     i.CreatedAt,
		User:          i.User.ToModel(ctx),
		VoteType:      int(i.VoteType.Int64),
		HasVoted:      i.VoteType.Valid && i.VoteType.Int64 != 0,
		VotesCount:    i.VotesCount,
		CommentsCount: i.CommentsCount,
		Status:        enum.PostStatus(i.Status),
		Tags:          i.Tags,
		IsApproved:    i.IsApproved,
	}

	if i.Response.Valid {
		post.Response = &entity.PostResponse{
			Text:        i.Response.String,
			RespondedAt: i.RespondedAt.Time,
			User:        i.ResponseUser.ToModel(ctx),
		}

		if i.OriginalNumber.Valid {
			post.Response.Original = &entity.OriginalPost{
				Number: int(i.OriginalNumber.Int64),
				Title:  i.OriginalTitle.String,
				Slug:   i.OriginalSlug.String,
				Status: enum.PostStatus(i.OriginalStatus.Int64),
			}
		}
	}

	return post
}
