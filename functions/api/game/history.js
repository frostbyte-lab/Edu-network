/**
 * GET /api/game/history?player_id=xxx&limit=20&game_id=optional
 * Returns recent actions / spins for a player.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  parseJsonField,
  getQuery,
} from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const playerId = (q.get("player_id") || "").trim();
  const gameId = (q.get("game_id") || "").trim();
  const limit = Math.min(Math.max(Number(q.get("limit")) || 20, 1), 100);

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (gameId && !validGameId(gameId)) return err("Invalid game_id", 400);

  try {
    let history;
    if (gameId) {
      history = await db
        .prepare(
          `SELECT id, player_id, game_id, session_id, action, amount, balance_after, detail_json, created_at
           FROM game_history
           WHERE player_id = ? AND game_id = ?
           ORDER BY id DESC LIMIT ?`
        )
        .bind(playerId, gameId, limit)
        .all();
    } else {
      history = await db
        .prepare(
          `SELECT id, player_id, game_id, session_id, action, amount, balance_after, detail_json, created_at
           FROM game_history
           WHERE player_id = ?
           ORDER BY id DESC LIMIT ?`
        )
        .bind(playerId, limit)
        .all();
    }

    const spins = await db
      .prepare(
        `SELECT id, session_id, game_id, bet_amount, win_amount, net_amount, symbols_json, status, created_at
         FROM game_spins
         WHERE player_id = ?
         ORDER BY id DESC LIMIT ?`
      )
      .bind(playerId, Math.min(limit, 50))
      .all();

    return ok({
      player_id: playerId,
      history: (history.results || []).map((r) => ({
        id: r.id,
        game_id: r.game_id,
        session_id: r.session_id,
        action: r.action,
        amount: r.amount,
        balance_after: r.balance_after,
        detail: parseJsonField(r.detail_json, null),
        created_at: r.created_at,
      })),
      spins: (spins.results || []).map((r) => ({
        spin_id: r.id,
        session_id: r.session_id,
        game_id: r.game_id,
        bet: r.bet_amount,
        win: r.win_amount,
        net: r.net_amount,
        symbols: parseJsonField(r.symbols_json, []),
        status: r.status,
        created_at: r.created_at,
      })),
    });
  } catch (e) {
    return err("Failed to load history", 500);
  }
}
