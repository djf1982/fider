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
	ID            int                        `db:"id"`
	TenantID      int                        `db:"tenant_id"`
	APIKey        string                     `db:"api_key"`
	TeamID        string                     `db:"team_id"`
	LabelID       string                     `db:"label_id"`
	IsEnabled     bool                       `db:"is_enabled"`
	StatusMapping entity.LinearStatusMapping `db:"status_mapping"`
	WebhookSecret string                     `db:"webhook_secret"`
}

func (m *dbLinearIntegration) toModel() *entity.LinearIntegration {
	mapping := m.StatusMapping
	if mapping == nil {
		mapping = entity.LinearStatusMapping{}
	}
	return &entity.LinearIntegration{
		ID:            m.ID,
		TenantID:      m.TenantID,
		APIKey:        m.APIKey,
		TeamID:        m.TeamID,
		LabelID:       m.LabelID,
		IsEnabled:     m.IsEnabled,
		StatusMapping: mapping,
		WebhookSecret: m.WebhookSecret,
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
			SELECT id, tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret
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
		SELECT id, tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret
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
				(tenant_id, api_key, team_id, label_id, is_enabled, status_mapping, webhook_secret, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
			ON CONFLICT (tenant_id)
			DO UPDATE SET
				api_key = EXCLUDED.api_key,
				team_id = EXCLUDED.team_id,
				label_id = EXCLUDED.label_id,
				is_enabled = EXCLUDED.is_enabled,
				status_mapping = EXCLUDED.status_mapping,
				webhook_secret = EXCLUDED.webhook_secret,
				updated_at = NOW()
		`, tenant.ID, c.APIKey, c.TeamID, c.LabelID, c.IsEnabled, mapping, c.WebhookSecret)
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
