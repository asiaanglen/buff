CREATE TABLE ai_program_drafts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 preferences TEXT NOT NULL,
 content TEXT,
 conversation TEXT NOT NULL DEFAULT '[]',
 weight_history TEXT NOT NULL DEFAULT '[]',
 version INTEGER NOT NULL DEFAULT 0,
 lease TEXT,
 lease_until INTEGER,
 saved_program_id TEXT,
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX ai_drafts_user_updated ON ai_program_drafts(user_id,updated);
CREATE INDEX ai_drafts_expiry ON ai_program_drafts(expires);
CREATE TABLE ai_program_budgets (
 day TEXT PRIMARY KEY,
 reserved_micros INTEGER NOT NULL DEFAULT 0,
 requests INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ai_program_usage (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
CREATE TABLE ai_program_requests (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 draft_id TEXT REFERENCES ai_program_drafts(id) ON DELETE SET NULL,
 day TEXT NOT NULL,
 created INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'running',
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 actual_micros INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ai_requests_day ON ai_program_requests(day);
