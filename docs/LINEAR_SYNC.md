# Linear sync

This fork syncs Fider posts with Linear issues in both directions. Each post has at most one Linear issue (`post_linear_issues`).

## What goes where

| Event | Effect |
| --- | --- |
| Someone creates a post | The sync creates a Linear issue and links it to the post. |
| Someone comments on a post | The sync copies the comment to the issue. |
| Someone votes on a post | The sync adds or removes a Linear customer need for the voter's group. |
| Staff decline a post, or mark it a duplicate | The sync moves the issue to the configured declined or duplicate state. |
| The issue changes to a mapped state | The post takes the mapped Fider status (**Admin → Linear → status mapping**). |
| The issue is released, and other issues are its Linear duplicates | Their posts close as completed too. |
| The issue becomes a Linear duplicate of a released issue | Its post closes as completed. |

Only a release (a state mapped to `completed`) carries across duplicates. A Linear change never reopens a completed, declined or duplicate post.

## API

| Call | Who | What it does |
| --- | --- | --- |
| `GET /api/v1/linear/links` | Anyone | Lists `{postNumber, issueIdentifier, issueUrl}` for every visible post that has an issue. |
| `PUT /api/v1/posts/:number/linear` with `{"issue": "SCO-123"}` | Administrator | Links a post to an existing issue, for example a post from before the sync. When the issue's state is mapped, the post takes that status now. |
| `PUT /api/v1/posts/:number/status` | Collaborator or administrator | Sets the status directly. Prefer a Linear change, so the two stay in step. |

The link call refuses an issue that is linked to another post, because one issue has at most one post.

## Tests

- `app/services/linear/linearsync` holds the decisions. Its tests need only `go test`.
- `app/handlers/apiv1/linear_test.go` and `app/handlers/webhooks/linear_test.go` use the mock bus. They need `ssr.js` (`make build-ssr`).
- `app/services/sqlstore/postgres/linear_test.go` needs the test database: `docker compose up -d pgtest`, then `godotenv -f .test.env ./fider migrate`.
