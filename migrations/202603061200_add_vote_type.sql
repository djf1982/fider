ALTER TABLE post_votes ADD COLUMN vote_type SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE post_votes ADD CONSTRAINT post_votes_vote_type_check CHECK (vote_type IN (1, -1));
