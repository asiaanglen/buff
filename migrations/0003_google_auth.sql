CREATE TABLE google_identities (
  subject TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE google_auth_flows (
  id TEXT PRIMARY KEY,
  cookie_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  return_to TEXT NOT NULL,
  link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT,
  expires INTEGER NOT NULL
);
CREATE INDEX google_auth_flows_expiry ON google_auth_flows(expires);
