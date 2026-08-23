/**
 * Admin — atur saldo player / initial_balance per game
 *
 * GET  /api/admin/balance?player_id=...
 * POST /api/admin/balance
 *   { "player_id": "x", "balance": 5000 }                 → set saldo player
 *   { "game_id": "game-12", "initial_balance": 1000 }     → default saldo baru utk game
 *   { "player_id": "x", "balance": 0, "reset": true }     → paksa 0
 *
 * Header opsional: X-Admin-Key (jika env.ADMIN_KEY di-set)
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, validPlayerId, validGameId, ensurePlayer, getPlayer } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

function checkAdmin(request, env) {
  const key = env.ADMIN_KEY;
  if (!key) return true; // open jika belum di-set (dev)
  const h = request.headers.get("X-Admin-Key") || "";
  return h === key;
}

export async function onRequestGet({ request, env }) {
  if (!checkAdmin(request, env)) return err("Unauthorized", 401);
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const url = new URL(request.url);
  const playerId = (url.searchParams.get("player_id") || "").trim();
  if (!validPlayerId(playerId)) return err("player_id required", 400);

  try {
    const player = await getPlayer(db, playerId);
    if (!player) return err("Player not found", 404);
    return ok({ player });
  } catch {
    return err("Failed to read balance", 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!checkAdmin(request, env)) return err("Unauthorized", 401);
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  let body;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  try {

    // Set rng_level saja
    if (body.game_id != null && body.rng_level != null && body.initial_balance == null && body.player_id == null) {
      const gameId = String(body.game_id).trim();
      if (!validGameId(gameId)) return err("Invalid game_id", 400);
      const lv = Number(body.rng_level);
      if (lv !== 1 && lv !== 2 && lv !== 3) return err("rng_level must be 1, 2, or 3", 400);

      const row = await db
        .prepare(`SELECT game_id, meta_json FROM game_config WHERE game_id = ?`)
        .bind(gameId)
        .first();
      let meta = {};
      if (row?.meta_json) {
        try { meta = JSON.parse(row.meta_json) || {}; } catch { meta = {}; }
      }
      meta.rng_level = lv;
      if (row) {
        await db.prepare(`UPDATE game_config SET meta_json = ?, updated_at = datetime('now') WHERE game_id = ?`)
          .bind(JSON.stringify(meta), gameId).run();
      } else {
        await db.prepare(`INSERT INTO game_config (game_id, title, meta_json) VALUES (?, ?, ?)`)
          .bind(gameId, gameId, JSON.stringify(meta)).run();
      }
      return ok({ game_id: gameId, rng_level: lv, message: "RNG level disimpan (1=down 2=imbang 3=menang)" });
    }

    // Set initial_balance default untuk game (disimpan di meta_json)
    if (body.game_id != null && body.initial_balance != null) {
      const gameId = String(body.game_id).trim();
      if (!validGameId(gameId)) return err("Invalid game_id", 400);
      const initial = Number(body.initial_balance);
      if (!Number.isInteger(initial) || initial < 0) {
        return err("initial_balance must be integer >= 0", 400);
      }

      const row = await db
        .prepare(`SELECT game_id, meta_json FROM game_config WHERE game_id = ?`)
        .bind(gameId)
        .first();

      let meta = {};
      if (row?.meta_json) {
        try { meta = JSON.parse(row.meta_json) || {}; } catch { meta = {}; }
      }
      meta.initial_balance = initial;
      if (body.rng_level === 1 || body.rng_level === 2 || body.rng_level === 3) meta.rng_level = Number(body.rng_level);

      if (row) {
        await db
          .prepare(
            `UPDATE game_config SET meta_json = ?, updated_at = datetime('now') WHERE game_id = ?`,
          )
          .bind(JSON.stringify(meta), gameId)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO game_config (game_id, title, meta_json) VALUES (?, ?, ?)`,
          )
          .bind(gameId, gameId, JSON.stringify(meta))
          .run();
      }

      return ok({
        game_id: gameId,
        initial_balance: initial,
        message: "Default initial_balance untuk player baru di game ini",
      });
    }

    // Set saldo player
    const playerId = typeof body.player_id === "string" ? body.player_id.trim() : "";
    if (!validPlayerId(playerId)) return err("player_id required", 400);

    let balance = body.reset === true ? 0 : Number(body.balance);
    if (!Number.isInteger(balance) || balance < 0) {
      return err("balance must be integer >= 0 (or reset:true)", 400);
    }

    await ensurePlayer(db, playerId, 0);
    await db
      .prepare(
        `UPDATE game_players SET balance = ?, updated_at = datetime('now') WHERE player_id = ?`,
      )
      .bind(balance, playerId)
      .run();

    const player = await getPlayer(db, playerId);
    return ok({ player, message: "Balance updated" });
  } catch (e) {
    return err("Failed to update balance", 500);
  }
}
