/**
 * GET /api/admin/stats
 * Dashboard summary for admin panel.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  try {
    const players = await db.prepare(`SELECT COUNT(*) AS c FROM game_players`).first();
    const spins = await db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(bet_amount),0) AS total_bet, COALESCE(SUM(win_amount),0) AS total_win FROM game_spins`).first();
    const sessions = await db.prepare(`SELECT COUNT(*) AS c FROM game_sessions WHERE status = 'active'`).first();
    const todaySpins = await db
      .prepare(`SELECT COUNT(*) AS c FROM game_spins WHERE date(created_at) = date('now')`)
      .first();
    const top = await db
      .prepare(
        `SELECT player_id, balance, spins_count, total_bet, total_win
         FROM game_players ORDER BY total_win DESC LIMIT 10`
      )
      .all();

    return ok({
      stats: {
        players: players?.c ?? 0,
        spins: spins?.c ?? 0,
        total_bet: spins?.total_bet ?? 0,
        total_win: spins?.total_win ?? 0,
        active_sessions: sessions?.c ?? 0,
        spins_today: todaySpins?.c ?? 0,
      },
      top_players: top.results || [],
    });
  } catch (e) {
    return err("Failed to load stats", 500);
  }
}
