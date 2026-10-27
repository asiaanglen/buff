CREATE TABLE program_shares (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  inviter_name TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX program_shares_owner ON program_shares(owner_id, program_id, created);
CREATE TABLE program_share_imports (
  share_token TEXT NOT NULL REFERENCES program_shares(token) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (share_token, user_id)
);
