-- Safe to apply again. Each row is a daily total, never an individual visit.
CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('visit', 'resume', 'work')),
  source TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, event, source, target)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS stats_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at TEXT NOT NULL
);
INSERT OR IGNORE INTO stats_meta (id, started_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
