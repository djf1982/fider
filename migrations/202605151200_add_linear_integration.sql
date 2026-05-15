CREATE TABLE tenant_linear_integrations (
    id              SERIAL PRIMARY KEY,
    tenant_id       INT NOT NULL,
    api_key         TEXT NOT NULL,
    team_id         VARCHAR(100) NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    status_mapping  JSONB NOT NULL DEFAULT '{}'::jsonb,
    webhook_secret  TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_tenant_linear_integrations_tenant_id ON tenant_linear_integrations(tenant_id);

CREATE TABLE post_linear_issues (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INT NOT NULL,
    post_id                 INT NOT NULL,
    linear_issue_id         VARCHAR(100) NOT NULL,
    linear_issue_identifier VARCHAR(100) NOT NULL DEFAULT '',
    linear_issue_url        TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id),
    UNIQUE (tenant_id, linear_issue_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_linear_issues_tenant_id ON post_linear_issues(tenant_id);
CREATE INDEX idx_post_linear_issues_linear_issue_id ON post_linear_issues(linear_issue_id);
