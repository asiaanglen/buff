CREATE TABLE usage_owners (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE usage_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  started_at INTEGER NOT NULL
);
INSERT INTO usage_settings VALUES(1, CAST(strftime('%s','now') AS INTEGER)*1000);
CREATE TABLE usage_hourly (
  hour TEXT PRIMARY KEY,
  samples INTEGER NOT NULL DEFAULT 0,
  requests_estimate REAL NOT NULL DEFAULT 0,
  reads_estimate REAL NOT NULL DEFAULT 0,
  writes_estimate REAL NOT NULL DEFAULT 0,
  response_ms_estimate REAL NOT NULL DEFAULT 0
);
CREATE TABLE usage_events (
  hour TEXT NOT NULL,
  event TEXT NOT NULL,
  category TEXT NOT NULL,
  status INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(hour,event,category,status)
);
CREATE TABLE usage_active_days (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY(day,visitor_hash)
);
CREATE TABLE usage_client_reports (
  report_hash TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL
);
CREATE INDEX usage_reports_day ON usage_client_reports(day);
CREATE INDEX usage_reports_visitor ON usage_client_reports(day,visitor_hash);
CREATE TABLE usage_setup (
  token_hash TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);
