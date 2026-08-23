/** D1 helpers + validation for EDU Network Game API */

export function requireDb(env) {
  if (!env?.EDU_DB) {
    return { error: "EDU_DB binding is not configured", status: 503 };
  }
  return { db: env.EDU_DB };
}

export function validPlayerId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

export function validGameId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

export function validSessionId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

export function parseBody(request) {
  return request.json().catch(() => null);
}

export function getQuery(request) {
  return new URL(request.url).searchParams;
}

/** Ensure player row exists; return player object */
export async function ensurePlayer(db, playerId, initialBalance = 0) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_players (player_id, balance) VALUES (?, ?)`
    )
    .bind(playerId, initialBalance)
    .run();

  const player = await db
    .prepare(
      `SELECT player_id, balance, currency, spins_count, total_bet, total_win, created_at, updated_at
       FROM game_players WHERE player_id = ?`
    )
    .bind(playerId)
    .first();

  return player;
}

export async function getPlayer(db, playerId) {
  return db
    .prepare(
      `SELECT player_id, balance, currency, spins_count, total_bet, total_win, created_at, updated_at
       FROM game_players WHERE player_id = ?`
    )
    .bind(playerId)
    .first();
}

export async function getConfig(db, gameId) {
  let row = await db
    .prepare(`SELECT * FROM game_config WHERE game_id = ? AND enabled = 1`)
    .bind(gameId)
    .first();

  if (!row) {
    row = await db
      .prepare(`SELECT * FROM game_config WHERE game_id = 'default' AND enabled = 1`)
      .first();
  }
  return row;
}

export function parseJsonField(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function newSessionId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function writeHistory(db, { playerId, gameId, sessionId, action, amount, balanceAfter, detail }) {
  await db
    .prepare(
      `INSERT INTO game_history (player_id, game_id, session_id, action, amount, balance_after, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      playerId,
      gameId || "default",
      sessionId || null,
      action,
      amount ?? 0,
      balanceAfter ?? null,
      detail ? JSON.stringify(detail) : null
    )
    .run();
}
