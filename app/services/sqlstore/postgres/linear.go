package postgres

import (
	"context"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/models/cmd"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/query"
	"github.com/getfider/fider/app/pkg/dbx"
	"github.com/getfider/fider/app/pkg/errors"
)

type dbLinearIntegration struct {
	ID               int                        `db:"id"`
	TenantID         int                        `db:"tenant_id"`
	APIKey           string                     `db:"api_key"`
	TeamID           string                     `db:"team_id"`
	LabelID          string                     `db:"label_id"`
	IsEnabled        bool                       `db:"is_enabled"`
	StatusMapping    entity.LinearStatusMapping `db:"status_mapping"`
	WebhookSecret    string                     `db:"webhook_secret"`
	DeclinedStateID  string                     `db:"declined_state_id"`
	DuplicateStateID string                     `db:"duplicate_state_id"`
}

func (m *dbLinearIntegration) toModel() *entity.LinearIntegration {
	mapping := m.StatusMapping
	if mapping == nil {
		mapping = entity.LinearStatusMapping{}
	}
	return &entity.LinearIntegration{
		ID:               m.ID,
		TenantID:         m.TenantID,
		APIKey:           m.APIKey,
		TeamID:           m.TeamID,
		LabelID:          m.LabelID,
		IsEnabled:        m.IsEnabled,
		StatusMapping:    mapping,
		WebhookSecret:    m.WebhookSecret,
		DeclinedStateID:  m.DeclinedStateID,
		DuplicateStateID: m.DuplicateStateID,
	}
}

type dbPostLinearIssue struct {
	ID                    int    `db:"id"`
	TenantID              int    `db:"tenant_id"`
	PostID                int    `db:"post_id"`
	LinearIssueID         string `db:"linear_issue_id"`
	LinearIssueIdentifier string `db:"linear_issue_identifier"`
	LinearIssueURL        string `db:"linear_issue_url"`
}

func (m *dbPostLinearIssue) toModel() *entity.PostLinearIssue {
	return &entity.PostLinearIssue{
		ID:                    m.ID,
		TenantID:              m.TenantID,
		PostID:                m.PostID,
		LinearIssueID:         m.LinearIssueID,
		LinearIssueIdentifier: m.LinearIssueIdentifier,
		LinearIssueURL:        m.LinearIssueURL,
	}
}

func getLinearIntegration(ctx context.Context, q *query.GetLinearIntegration) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		row := &dbLinearIntegration{}
		err := trx.Get(row, `
			SELECT id, tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret, declined_state_id, duplicate_state_id
			FROM tenant_linear_integrations
			WHERE tenant_id = $1
		`, tenant.ID)
		if err != nil {
			return err
		}
		q.Result = row.toModel()
		return nil
	})
}

func getLinearIntegrationByWebhookSecret(ctx context.Context, q *query.GetLinearIntegrationByWebhookSecret) error {
	trx, _ := ctx.Value(app.TransactionCtxKey).(*dbx.Trx)
	if trx == nil {
		return errors.New("no transaction in context")
	}
	if q.WebhookSecret == "" {
		return app.ErrNotFound
	}
	row := &dbLinearIntegration{}
	err := trx.Get(row, `
		SELECT id, tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret, declined_state_id, duplicate_state_id
		FROM tenant_linear_integrations
		WHERE webhook_secret = $1
	`, q.WebhookSecret)
	if err != nil {
		return err
	}
	q.Result = row.toModel()
	return nil
}

func saveLinearIntegration(ctx context.Context, c *cmd.SaveLinearIntegration) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		mapping := c.StatusMapping
		if mapping == nil {
			mapping = entity.LinearStatusMapping{}
		}
		_, err := trx.Execute(`
			INSERT INTO tenant_linear_integrations
				(tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret, declined_state_id, duplicate_state_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
			ON CONFLICT (tenant_id)
			DO UPDATE SET
				api_key = EXCLUDED.api_key,
				team_id = EXCLUDED.team_id,
				label_id = EXCLUDED.label_id,
				is_enabled = EXCLUDED.is_enabled,
				status_mapping = EXCLUDED.status_mapping,
				webhook_secret = EXCLUDED.webhook_secret,
				declined_state_id = EXCLUDED.declined_state_id,
				duplicate_state_id = EXCLUDED.duplicate_state_id,
				updated_at = NOW()
		`, tenant.ID, c.APIKey, c.TeamID, c.LabelID, c.IsEnabled, mapping, c.WebhookSecret, c.DeclinedStateID, c.DuplicateStateID)
		if err != nil {
			return errors.Wrap(err, "failed to save linear integration")
		}
		return nil
	})
}

func deleteLinearIntegration(ctx context.Context, c *cmd.DeleteLinearIntegration) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		_, err := trx.Execute(`DELETE FROM tenant_linear_integrations WHERE tenant_id = $1`, tenant.ID)
		if err != nil {
			return errors.Wrap(err, "failed to delete linear integration")
		}
		return nil
	})
}

func saveLinearIssueMapping(ctx context.Context, c *cmd.SaveLinearIssueMapping) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		_, err := trx.Execute(`
			INSERT INTO post_linear_issues
				(tenant_id, post_id, linear_issue_id, linear_issue_identifier, linear_issue_url, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (post_id)
			DO UPDATE SET
				linear_issue_id = EXCLUDED.linear_issue_id,
				linear_issue_identifier = EXCLUDED.linear_issue_identifier,
				linear_issue_url = EXCLUDED.linear_issue_url
		`, tenant.ID, c.PostID, c.LinearIssueID, c.LinearIssueIdentifier, c.LinearIssueURL)
		if err != nil {
			return errors.Wrap(err, "failed to save linear issue mapping")
		}
		return nil
	})
}

func getLinearIssueForPost(ctx context.Context, q *query.GetLinearIssueForPost) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		row := &dbPostLinearIssue{}
		err := trx.Get(row, `
			SELECT id, tenant_id, post_id, linear_issue_id, linear_issue_identifier, linear_issue_url
			FROM post_linear_issues
			WHERE tenant_id = $1 AND post_id = $2
		`, tenant.ID, q.PostID)
		if err != nil {
			return err
		}
		q.Result = row.toModel()
		return nil
	})
}

func getPostByLinearIssueID(ctx context.Context, q *query.GetPostByLinearIssueID) error {
	trx, _ := ctx.Value(app.TransactionCtxKey).(*dbx.Trx)
	if trx == nil {
		return errors.New("no transaction in context")
	}
	if q.LinearIssueID == "" {
		return app.ErrNotFound
	}
	var postID int
	err := trx.Scalar(&postID, `
		SELECT post_id FROM post_linear_issues
		WHERE tenant_id = $1 AND linear_issue_id = $2
	`, q.TenantID, q.LinearIssueID)
	if err != nil {
		return err
	}

	getPost := &query.GetPostByID{PostID: postID}
	tenant := &entity.Tenant{ID: q.TenantID}
	subCtx := context.WithValue(ctx, app.TenantCtxKey, tenant)
	if err := getPostByID(subCtx, getPost); err != nil {
		return err
	}
	q.Result = getPost.Result
	return nil
}

func listLinearCustomerNeeds(ctx context.Context, q *query.ListLinearCustomerNeeds) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		q.Result = []*entity.PostLinearCustomerNeed{}
		err := trx.Select(&q.Result, `
			SELECT user_id, linear_need_id, created_at
			FROM post_linear_customer_needs
			WHERE tenant_id = $1 AND post_id = $2
			ORDER BY id
		`, tenant.ID, q.PostID)
		if err != nil {
			return errors.Wrap(err, "failed to list linear customer needs")
		}
		return nil
	})
}

func claimLinearCustomerNeed(ctx context.Context, c *cmd.ClaimLinearCustomerNeed) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		// A concurrent run inserting the same row waits here until the first
		// run commits, then gets no row back: only one run creates the need.
		var id int
		err := trx.Scalar(&id, `
			INSERT INTO post_linear_customer_needs (tenant_id, post_id, user_id, linear_need_id, created_at)
			VALUES ($1, $2, $3, '', NOW())
			ON CONFLICT (post_id, user_id) DO NOTHING
			RETURNING id
		`, tenant.ID, c.PostID, c.UserID)
		if errors.Cause(err) == app.ErrNotFound {
			c.Result = false
			return nil
		}
		if err != nil {
			return errors.Wrap(err, "failed to claim linear customer need")
		}
		c.Result = true
		return nil
	})
}

func setLinearCustomerNeedID(ctx context.Context, c *cmd.SetLinearCustomerNeedID) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		_, err := trx.Execute(`
			UPDATE post_linear_customer_needs SET linear_need_id = $4
			WHERE tenant_id = $1 AND post_id = $2 AND user_id = $3
		`, tenant.ID, c.PostID, c.UserID, c.LinearNeedID)
		if err != nil {
			return errors.Wrap(err, "failed to store linear customer need id")
		}
		return nil
	})
}

func deleteLinearCustomerNeed(ctx context.Context, c *cmd.DeleteLinearCustomerNeed) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		_, err := trx.Execute(`
			DELETE FROM post_linear_customer_needs
			WHERE tenant_id = $1 AND post_id = $2 AND user_id = $3 AND linear_need_id = $4
		`, tenant.ID, c.PostID, c.UserID, c.LinearNeedID)
		if err != nil {
			return errors.Wrap(err, "failed to delete linear customer need")
		}
		return nil
	})
}

func listPostIDsWithLinearIssue(ctx context.Context, q *query.ListPostIDsWithLinearIssue) error {
	return using(ctx, func(trx *dbx.Trx, tenant *entity.Tenant, user *entity.User) error {
		if tenant == nil {
			return app.ErrNotFound
		}
		q.Result = []int{}
		type row struct {
			PostID int `db:"post_id"`
		}
		rows := []*row{}
		err := trx.Select(&rows, `
			SELECT post_id FROM post_linear_issues WHERE tenant_id = $1 ORDER BY post_id
		`, tenant.ID)
		if err != nil {
			return errors.Wrap(err, "failed to list posts with a linear issue")
		}
		for _, r := range rows {
			q.Result = append(q.Result, r.PostID)
		}
		return nil
	})
}
