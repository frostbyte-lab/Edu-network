/**
 * POST /api/game/session
 * Body: { player_id, game_id? }
 * Creates a new active session.
 *
 * GET /api/game/session?session_id=xxx  OR  ?player_id=xxx&game_id=xxx
 * Returns session info.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  validSessionId,
  parseBody,
  ensurePlayer,
  getQuery,
  newSessionId,
  writeHistory,
} from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestPost({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const body = await parseBody(request);
  if (!body) return err("Request body must be valid JSON", 400);

  const playerId = typeof body.player_id === "string" ? body.player_id.trim() : "";
  const gameId = typeof body.game_id === "string" ? body.game_id.trim() : "default";

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);

  try {
    const player = await ensurePlayer(db, playerId);
    const sessionId = newSessionId();

    await db
      .prepare(
        `INSERT INTO game_sessions (session_id, player_id, game_id, status, balance_start)
         VALUES (?, ?, ?, 'active', ?)`
      )
      .bind(sessionId, playerId, gameId, player.balance)
      .run();

    await writeHistory(db, {
      playerId,
      gameId,
      sessionId,
      action: "session",
      amount: 0,
      balanceAfter: player.balance,
    });

    return ok({
      session: {
        session_id: sessionId,
        player_id: playerId,
        game_id: gameId,
        status: "active",
        balance_start: player.balance,
        balance: player.balance,
      },
    });
  } catch (e) {
    return err("Failed to create session", 500);
  }
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const sessionId = (q.get("session_id") || "").trim();
  const playerId = (q.get("player_id") || "").trim();
  const gameId = (q.get("game_id") || "default").trim();

  try {
    if (sessionId) {
      if (!validSessionId(sessionId)) return err("Invalid session_id", 400);
      const session = await db
        .prepare(`SELECT * FROM game_sessions WHERE session_id = ?`)
        .bind(sessionId)
        .first();
      if (!session) return err("Session not found", 404);
      const player = await db
        .prepare(`SELECT balance FROM game_players WHERE player_id = ?`)
        .bind(session.player_id)
        .first();
      return ok({
        session: {
          ...session,
          balance: player?.balance ?? null,
        },
      });
    }

    if (playerId) {
      if (!validPlayerId(playerId)) return err("Invalid player_id", 400);
      const session = await db
        .prepare(
          `SELECT * FROM game_sessions
           WHERE player_id = ? AND game_id = ? AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(playerId, gameId)
        .first();
      if (!session) return err("No active session", 404);
      const player = await db
        .prepare(`SELECT balance FROM game_players WHERE player_id = ?`)
        .bind(playerId)
        .first();
      return ok({
        session: {
          ...session,
          balance: player?.balance ?? null,
        },
      });
    }

    return err("Provide session_id or player_id", 400);
  } catch (e) {
    return err("Failed to read session", 500);
  }
}
