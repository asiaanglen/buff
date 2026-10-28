CREATE TABLE coach_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL
);
CREATE TABLE coach_invites (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  coach_id TEXT NOT NULL REFERENCES coach_profiles(user_id) ON DELETE CASCADE,
  source_program_id TEXT NOT NULL, snapshot TEXT NOT NULL, client_email TEXT,
  created INTEGER NOT NULL, expires INTEGER NOT NULL, revoked INTEGER,
  accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL, assignment_id TEXT
);
CREATE INDEX coach_invites_owner ON coach_invites(coach_id, created);
CREATE TABLE coaching_assignments (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL UNIQUE REFERENCES coach_invites(id),
  coach_id TEXT NOT NULL REFERENCES coach_profiles(user_id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL, source_program_id TEXT NOT NULL, program_name TEXT NOT NULL,
  client_name TEXT NOT NULL, client_email TEXT NOT NULL, coach_name TEXT NOT NULL,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, revoked INTEGER
);
CREATE INDEX coaching_assignments_coach ON coaching_assignments(coach_id, created);
CREATE INDEX coaching_assignments_client ON coaching_assignments(client_id, created);
CREATE TABLE coaching_log_events (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES coaching_assignments(id) ON DELETE CASCADE,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX coaching_logs_assignment ON coaching_log_events(assignment_id, created);
