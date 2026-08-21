/**
 * GET /api/game/result?spin_id=123
 * GET /api/game/result?player_id=xxx&limit=1  (latest)
 *
 * POST /api/game/result  — same as GET via body { spin_id } or { player_id }
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  parseBody,
  parseJsonField,
  getQuery,
} from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

async function fetchResult(db, { spinId, playerId, limit }) {
  if (spinId) {
    const row = await db
      .prepare(`SELECT * FROM game_spins WHERE id = ?`)
      .bind(spinId)
      .first();
    if (!row) return { error: "Spin not found", status: 404 };
    return {
      spin: {
        spin_id: row.id,
        session_id: row.session_id,
        player_id: row.player_id,
        game_id: row.game_id,
        bet: row.bet_amount,
        win: row.win_amount,
        net: row.net_amount,
        symbols: parseJsonField(row.symbols_json, []),
        result: parseJsonField(row.result_json, {}),
        bonus: parseJsonField(row.bonus_json, null),
        status: row.status,
        created_at: row.created_at,
      },
    };
  }

  if (playerId) {
    if (!validPlayerId(playerId)) return { error: "Invalid player_id", status: 400 };
    const lim = Math.min(Math.max(limit || 1, 1), 50);
    const rows = await db
      .prepare(
        `SELECT * FROM game_spins WHERE player_id = ? ORDER BY id DESC LIMIT ?`
      )
      .bind(playerId, lim)
      .all();
    return {
      spins: (rows.results || []).map((row) => ({
        spin_id: row.id,
        session_id: row.session_id,
        player_id: row.player_id,
        game_id: row.game_id,
        bet: row.bet_amount,
        win: row.win_amount,
        net: row.net_amount,
        symbols: parseJsonField(row.symbols_json, []),
        result: parseJsonField(row.result_json, {}),
        status: row.status,
        created_at: row.created_at,
      })),
    };
  }

  return { error: "Provide spin_id or player_id", status: 400 };
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const spinId = q.get("spin_id") ? Number(q.get("spin_id")) : null;
  const playerId = (q.get("player_id") || "").trim();
  const limit = q.get("limit") ? Number(q.get("limit")) : 1;

  try {
    const data = await fetchResult(db, {
      spinId: Number.isInteger(spinId) ? spinId : null,
      playerId: playerId || null,
      limit,
    });
    if (data.error) return err(data.error, data.status);
    return ok(data);
  } catch (e) {
    return err("Failed to fetch result", 500);
  }
}

export async function onRequestPost({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const body = await parseBody(request);
  if (!body) return err("Request body must be valid JSON", 400);

  const spinId = Number.isInteger(body.spin_id) ? body.spin_id : null;
  const playerId = typeof body.player_id === "string" ? body.player_id.trim() : null;
  const limit = Number.isInteger(body.limit) ? body.limit : 1;

  try {
    const data = await fetchResult(db, { spinId, playerId, limit });
    if (data.error) return err(data.error, data.status);
    return ok(data);
  } catch (e) {
    return err("Failed to fetch result", 500);
  }
}
