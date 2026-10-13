-- SCO-4014: each Fider upvote becomes one Linear customer need on the post's
-- issue. This row links the vote to the need, so a removed vote can delete it.
-- user_id has no foreign key on purpose: when a user is deleted their votes go,
-- and the next sync must still find this row to delete the need in Linear.
CREATE TABLE post_linear_customer_needs (
    id              SERIAL PRIMARY KEY,
    tenant_id       INT NOT NULL,
    post_id         INT NOT NULL,
    user_id         INT NOT NULL,
    linear_need_id  VARCHAR(100) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, user_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_linear_customer_needs_tenant_post ON post_linear_customer_needs(tenant_id, post_id);

-- The Linear states a Fider decline or duplicate moves the issue to. Empty
-- means "do not sync that status back".
ALTER TABLE tenant_linear_integrations
    ADD COLUMN declined_state_id VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN duplicate_state_id VARCHAR(100) NOT NULL DEFAULT '';
