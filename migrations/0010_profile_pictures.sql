CREATE TABLE profile_pictures (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  image BLOB NOT NULL,
  updated INTEGER NOT NULL
);
