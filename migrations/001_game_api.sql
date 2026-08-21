-- EDU Network Game API schema
-- Run: wrangler d1 execute EDU --file=migrations/001_game_api.sql
-- Atau lewat Dashboard D1 → EDU → Console

CREATE TABLE IF NOT EXISTS game_players (
  player_id   TEXT PRIMARY KEY,
  balance     INTEGER NOT NULL DEFAULT 10000,
  currency    TEXT NOT NULL DEFAULT 'pts',
  spins_count INTEGER NOT NULL DEFAULT 0,
  total_bet   INTEGER NOT NULL DEFAULT 0,
  total_win   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_sessions (
  session_id  TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL,
  game_id     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active', -- active | closed
  balance_start INTEGER NOT NULL,
  meta_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at   TEXT,
  FOREIGN KEY (player_id) REFERENCES game_players(player_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game ON game_sessions(game_id);

CREATE TABLE IF NOT EXISTS game_spins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT,
  player_id   TEXT NOT NULL,
  game_id     TEXT NOT NULL,
  bet_amount  INTEGER NOT NULL,
  win_amount  INTEGER NOT NULL DEFAULT 0,
  net_amount  INTEGER NOT NULL DEFAULT 0,
  symbols_json TEXT,
  result_json TEXT,
  bonus_json  TEXT,
  status      TEXT NOT NULL DEFAULT 'settled', -- pending | settled | cancelled
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES game_players(player_id)
);

CREATE INDEX IF NOT EXISTS idx_spins_player ON game_spins(player_id);
CREATE INDEX IF NOT EXISTS idx_spins_session ON game_spins(session_id);
CREATE INDEX IF NOT EXISTS idx_spins_game ON game_spins(game_id);

CREATE TABLE IF NOT EXISTS game_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   TEXT NOT NULL,
  game_id     TEXT NOT NULL,
  session_id  TEXT,
  action      TEXT NOT NULL, -- bet | spin | collect | bonus | init
  amount      INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER,
  detail_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_player ON game_history(player_id);
CREATE INDEX IF NOT EXISTS idx_history_game ON game_history(game_id);

CREATE TABLE IF NOT EXISTS game_config (
  game_id     TEXT PRIMARY KEY,
  title       TEXT,
  rtp         REAL NOT NULL DEFAULT 96.0,
  min_bet     INTEGER NOT NULL DEFAULT 1,
  max_bet     INTEGER NOT NULL DEFAULT 1000,
  default_bet INTEGER NOT NULL DEFAULT 10,
  currency    TEXT NOT NULL DEFAULT 'pts',
  symbols_json TEXT,
  paytable_json TEXT,
  features_json TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  meta_json   TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default config untuk game generik
INSERT OR IGNORE INTO game_config (game_id, title, rtp, min_bet, max_bet, default_bet, symbols_json, paytable_json, features_json)
VALUES (
  'default',
  'EDU Default Slot',
  96.0,
  1,
  500,
  10,
  '["cherry","lemon","bell","star","seven","wild","scatter"]',
  '{"cherry":3,"lemon":3,"bell":5,"star":8,"seven":15,"wild":20,"scatter":0}',
  '["freespin","bonus","wild","scatter"]'
);
