CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  started_at INTEGER NOT NULL
);
INSERT INTO admin_settings(id,started_at) VALUES(1,CAST(strftime('%s','now') AS INTEGER)*1000);
CREATE TABLE admin_account_activity (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  registered_at INTEGER,
  last_active_at INTEGER
);
INSERT INTO admin_account_activity(user_id) SELECT id FROM users;
CREATE INDEX admin_accounts_registered ON admin_account_activity(registered_at);
CREATE INDEX admin_accounts_active ON admin_account_activity(last_active_at);
CREATE TRIGGER admin_record_signup AFTER INSERT ON users BEGIN
  INSERT INTO admin_account_activity(user_id,registered_at) VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000);
END;
