-- Add structured feature-request fields to posts.
-- All nullable so existing posts are unaffected; new posts populate these alongside
-- a server-composed description (kept for display, search, sync and notifications).
ALTER TABLE posts ADD COLUMN problem TEXT NULL;
ALTER TABLE posts ADD COLUMN ideal_outcome TEXT NULL;
ALTER TABLE posts ADD COLUMN workaround TEXT NULL;
ALTER TABLE posts ADD COLUMN suggested_solution TEXT NULL;
-- importance: 0/NULL unset, 1 nice-to-have, 2 important, 3 critical
ALTER TABLE posts ADD COLUMN importance SMALLINT NOT NULL DEFAULT 0;
