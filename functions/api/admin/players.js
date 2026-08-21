/**
 * GET /api/admin/players?limit=50&offset=0&q=
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, getQuery } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(q.get("offset")) || 0, 0);
  const search = (q.get("q") || "").trim();

  try {
    let rows;
    if (search) {
      rows = await db
        .prepare(
          `SELECT player_id, balance, currency, spins_count, total_bet, total_win, created_at, updated_at
           FROM game_players WHERE player_id LIKE ?
           ORDER BY updated_at DESC LIMIT ? OFFSET ?`
        )
        .bind("%" + search + "%", limit, offset)
        .all();
    } else {
      rows = await db
        .prepare(
          `SELECT player_id, balance, currency, spins_count, total_bet, total_win, created_at, updated_at
           FROM game_players ORDER BY updated_at DESC LIMIT ? OFFSET ?`
        )
        .bind(limit, offset)
        .all();
    }
    const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM game_players`).first();
    return ok({ players: rows.results || [], total: countRow?.c ?? 0, limit, offset });
  } catch (e) {
    return err("Failed to list players", 500);
  }
}
