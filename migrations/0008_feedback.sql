CREATE TABLE feedback_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('feedback','bug')),
  message TEXT NOT NULL,
  steps TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  source_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX feedback_reports_user_created ON feedback_reports(user_id,created);
CREATE INDEX feedback_reports_status_created ON feedback_reports(status,created);
CREATE INDEX feedback_reports_created ON feedback_reports(created);
