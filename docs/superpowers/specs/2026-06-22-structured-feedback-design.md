# Structured Feature Request Submission — Design

**Date:** 2026-06-22
**Status:** Approved for implementation

## Problem

Users submit free-text feature requests through a single description box. This invites
low-quality, solution-shaped requests ("add a dropdown here") instead of the underlying
need ("I can't find my past orders"). Product teams can't act on these efficiently.

## Goal

Replace the single-description submission form with a guided, structured form that
separates the **problem** from the **solution** and captures lightweight triage metadata,
while protecting submission volume with a light-touch, progressive design.

## Scope

- **Feature requests only.** Bugs/questions are handled elsewhere — no type branching.
- One fixed, opinionated template for all tenants. No per-tenant form builder.
- Light-touch friction: one required field (problem/goal); the rest optional but visible.
- Duplicate detection already exists (`SimilarPosts`) and is retained.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Configurability | Fixed improved template (no admin form builder) |
| Friction | Light-touch (short by default, guided helper text, optional extras) |
| Type branching | No — feature requests only |
| Duplicate detection | Keep existing `SimilarPosts` live search |
| Field structure | Truly structured — real DB columns for every field |
| Storage | Real columns for all fields |

## Fields

| Field | Column | Type | Required | Prompt |
|---|---|---|---|---|
| Problem | `problem` | text | **Yes** | "What would you love to be able to do?" |
| Ideal outcome | `ideal_outcome` | text | No | "What would a good solution let you do?" |
| Importance | `importance` | smallint | No | Nice-to-have / Important / Critical |
| Workaround | `workaround` | text | No | "How do you deal with this today?" |
| Suggested solution | `suggested_solution` | text | No | "Got a solution in mind? (optional)" |

`title` is unchanged (required, 10–100 chars, still auto-derivable). `description` is
**retained** and now **composed server-side** from the structured fields (see below).

## Architecture

### Key design: structured columns + composed description

Every existing consumer reads `posts.description`:
- Post detail page renders it as Markdown (`PostDetails.tsx`)
- Edit flow round-trips through `description`
- Full-text search builds the `search` tsvector from title + description
- Linear sync and email notifications include `description`

To get **real, queryable columns** *without* breaking any of those, on create we:
1. Store each structured field in its own column.
2. **Compose a Markdown `description`** from the populated fields (headed sections:
   **The problem**, **Ideal outcome**, **Importance**, **Current workaround**,
   **Suggested solution**). Empty optional fields are omitted.

This means: triage/query on the columns; display/search/sync keep working unchanged via
the composed `description`. Legacy posts (null structured columns) render their original
`description` exactly as today.

### Backend changes

1. **Migration** `migrations/202606221300_add_structured_post_fields.sql` — add nullable
   columns `problem`, `ideal_outcome`, `workaround`, `suggested_solution` (text) and
   `importance` (smallint, nullable) to `posts`. Nullable = legacy posts unaffected.
2. **Enum** `app/models/enum/post_importance.go` — `PostImportance` (0 unset / 1 nice-to-have
   / 2 important / 3 critical).
3. **entity.Post** — add the 5 fields (JSON tags, `omitempty` where natural).
4. **dbEntities.Post** — add nullable db columns + map in `ToModel`.
5. **action.CreateNewPost** — add fields; require `problem` (non-empty); keep title rules.
   Title may now be derived client-side from `problem` if blank (client concern).
6. **cmd.AddNewPost** — add fields; compose `Description` from them in the postgres handler.
7. **postgres.addNewPost** — INSERT the new columns; compose description before insert so
   language detection + tsvector use the composed text.
8. **apiv1.CreatePost handler** — pass new action fields into the command.

### Frontend changes

1. **`actions.createPost`** — extend signature/body with the new fields.
2. **`ShareFeedback.tsx`** — replace the single editor with:
   - **Problem** (required, multi-line) — primary field, framed positively ("What would
     you love to be able to do?") with goal-focused helper text.
   - **Title** (required) — auto-derived from problem if untouched (reuse existing logic).
   - `SimilarPosts` live dedup (retained).
   - **Optional detail fields, always visible** (no collapsible): Ideal outcome, Importance
     (segmented control), Workaround, Suggested solution — all optional.
   - Submit gate stays on title length; problem required client + server side.
   - Tags + attachments unchanged.

## Backwards compatibility

- New columns nullable; existing posts and `description` untouched.
- `description` still authored on edit (edit form unchanged — edits the composed body).
- Search, Linear sync, notifications unchanged (read composed `description`).
- API response for create unchanged.

## Out of scope

- Per-tenant form configuration / form builder.
- Type branching (bug/question).
- Editing structured fields individually after creation (edit still works on `description`).
- Server-side priority scoring (importance is stored as an input signal only).

## Testing

- Go: extend `app/actions` post tests for `problem` required; postgres store test that
  structured columns persist and `description` is composed.
- Jest: `ShareFeedback` renders the problem field and the always-visible optional fields,
  submit passes new fields.
- `make lint` + `make test` green.
