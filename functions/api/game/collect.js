/**
 * POST /api/game/collect
 * Body: { player_id, session_id?, game_id? }
 * Closes active session and returns final balance summary.
 * (Virtual points — no real-money withdrawal)
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  validSessionId,
  parseBody,
  ensurePlayer,
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
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);
  if (sessionId && !validSessionId(sessionId)) return err("Invalid session_id", 400);

  try {
    const player = await ensurePlayer(db, playerId);

    let closed = 0;
    if (sessionId) {
      const res = await db
        .prepare(
          `UPDATE game_sessions
           SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
           WHERE session_id = ? AND player_id = ? AND status = 'active'`
        )
        .bind(sessionId, playerId)
        .run();
      closed = res.meta?.changes ?? 0;
    } else {
      const res = await db
        .prepare(
          `UPDATE game_sessions
           SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
           WHERE player_id = ? AND game_id = ? AND status = 'active'`
        )
        .bind(playerId, gameId)
        .run();
      closed = res.meta?.changes ?? 0;
    }

    await writeHistory(db, {
      playerId,
      gameId,
      sessionId,
      action: "collect",
      amount: player.balance,
      balanceAfter: player.balance,
      detail: { sessions_closed: closed },
    });

    return ok({
      collected: true,
      sessions_closed: closed,
      player: {
        player_id: player.player_id,
        balance: player.balance,
        currency: player.currency,
        spins_count: player.spins_count,
        total_bet: player.total_bet,
        total_win: player.total_win,
      },
      message: "Session collected (virtual points retained on player)",
    });
  } catch (e) {
    return err("Failed to collect", 500);
  }
}
