/**
 * GET /api/admin/spins?limit=50&player_id=&game_id=
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, validPlayerId, validGameId, parseJsonField, getQuery } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
  const playerId = (q.get("player_id") || "").trim();
  const gameId = (q.get("game_id") || "").trim();

  if (playerId && !validPlayerId(playerId)) return err("Invalid player_id", 400);
  if (gameId && !validGameId(gameId)) return err("Invalid game_id", 400);

  try {
    let sql = `SELECT id, session_id, player_id, game_id, bet_amount, win_amount, net_amount,
                      symbols_json, result_json, status, created_at
               FROM game_spins WHERE 1=1`;
    const binds = [];
    if (playerId) { sql += ` AND player_id = ?`; binds.push(playerId); }
    if (gameId) { sql += ` AND game_id = ?`; binds.push(gameId); }
    sql += ` ORDER BY id DESC LIMIT ?`;
    binds.push(limit);

    const rows = await db.prepare(sql).bind(...binds).all();
    return ok({
      spins: (rows.results || []).map((r) => ({
        spin_id: r.id,
        session_id: r.session_id,
        player_id: r.player_id,
        game_id: r.game_id,
        bet: r.bet_amount,
        win: r.win_amount,
        net: r.net_amount,
        symbols: parseJsonField(r.symbols_json, []),
        result: parseJsonField(r.result_json, {}),
        status: r.status,
        created_at: r.created_at,
      })),
      limit,
    });
  } catch (e) {
    return err("Failed to list spins", 500);
  }
}
