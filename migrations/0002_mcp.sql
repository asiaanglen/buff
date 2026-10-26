-- OAuth provider's KV-compatible records, kept in the existing D1 database.
CREATE TABLE oauth_storage (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  metadata TEXT,
  expires INTEGER
);
CREATE INDEX oauth_storage_expiry ON oauth_storage(expires);
CREATE TABLE oauth_exchanges (name TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE mcp_approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  base_revision INTEGER NOT NULL,
  proposal TEXT NOT NULL,
  summary TEXT NOT NULL,
  preview TEXT NOT NULL,
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','rejected')),
  csrf_hash TEXT,
  session_hash TEXT
);
CREATE INDEX mcp_approvals_owner ON mcp_approvals(user_id,created);
CREATE INDEX mcp_approvals_expiry ON mcp_approvals(expires);
-- Commit an approved proposal and its status together, with optimistic concurrency.
CREATE TRIGGER apply_mcp_approval AFTER UPDATE OF status ON mcp_approvals
WHEN NEW.status='applied' AND OLD.status='pending'
BEGIN
  INSERT INTO journals(user_id,revision,data)
    SELECT NEW.user_id,NEW.base_revision+1,NEW.proposal
    WHERE NEW.base_revision=0 OR EXISTS(
      SELECT 1 FROM journals WHERE user_id=NEW.user_id AND revision=NEW.base_revision
    )
    ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=excluded.revision
    WHERE journals.revision=NEW.base_revision;
  SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'Journal changed since proposal') END;
END;
CREATE TABLE oauth_web_forms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX oauth_web_forms_expiry ON oauth_web_forms(expires);
