/**
 * GET /api/admin/history?limit=50&player_id=
 * Action history for admin panel.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, validPlayerId, parseJsonField, getQuery } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
  const playerId = (q.get("player_id") || "").trim();

  if (playerId && !validPlayerId(playerId)) return err("Invalid player_id", 400);

  try {
    let rows;
    if (playerId) {
      rows = await db
        .prepare(
          `SELECT id, player_id, game_id, session_id, action, amount, balance_after, detail_json, created_at
           FROM game_history WHERE player_id = ? ORDER BY id DESC LIMIT ?`
        )
        .bind(playerId, limit)
        .all();
    } else {
      rows = await db
        .prepare(
          `SELECT id, player_id, game_id, session_id, action, amount, balance_after, detail_json, created_at
           FROM game_history ORDER BY id DESC LIMIT ?`
        )
        .bind(limit)
        .all();
    }

    return ok({
      history: (rows.results || []).map((r) => ({
        id: r.id,
        player_id: r.player_id,
        game_id: r.game_id,
        session_id: r.session_id,
        action: r.action,
        amount: r.amount,
        balance_after: r.balance_after,
        detail: parseJsonField(r.detail_json, null),
        created_at: r.created_at,
      })),
      limit,
    });
  } catch (e) {
    return err("Failed to load history", 500);
  }
}
