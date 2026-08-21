/**
 * GET /api/game/balance?player_id=xxx
 * Returns current balance and stats.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, validPlayerId, ensurePlayer, getQuery } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const playerId = (q.get("player_id") || "").trim();

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);

  try {
    const player = await ensurePlayer(db, playerId);
    return ok({
      player_id: player.player_id,
      balance: player.balance,
      currency: player.currency,
      spins_count: player.spins_count,
      total_bet: player.total_bet,
      total_win: player.total_win,
      updated_at: player.updated_at,
    });
  } catch (e) {
    return err("Failed to read balance", 500);
  }
}
