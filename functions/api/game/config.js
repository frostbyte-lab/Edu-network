/**
 * GET /api/game/config?game_id=xxx
 * Returns game configuration (RTP, bets, symbols, paytable, features)
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb, validGameId, getConfig, parseJsonField, getQuery } from "../_lib/db.js";
import { DEFAULT_SYMBOLS, DEFAULT_PAYTABLE } from "../_lib/engine.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ request, env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  const q = getQuery(request);
  const gameId = (q.get("game_id") || "default").trim();
  if (!validGameId(gameId)) return err("Invalid game_id", 400);

  try {
    const row = await getConfig(db, gameId);
    if (!row) {
      return ok({
        game_id: gameId,
        title: "EDU Default",
        rtp: 96.0,
        min_bet: 1,
        max_bet: 500,
        default_bet: 10,
        currency: "pts",
        symbols: DEFAULT_SYMBOLS,
        paytable: DEFAULT_PAYTABLE,
        features: ["freespin", "bonus", "wild", "scatter"],
        enabled: true,
        initial_balance: 0,
        rng_level: 2,
        source: "fallback",
      });
    }

    return ok({
      game_id: row.game_id,
      title: row.title,
      rtp: row.rtp,
      min_bet: row.min_bet,
      max_bet: row.max_bet,
      default_bet: row.default_bet,
      currency: row.currency,
      symbols: parseJsonField(row.symbols_json, DEFAULT_SYMBOLS),
      paytable: parseJsonField(row.paytable_json, DEFAULT_PAYTABLE),
      features: parseJsonField(row.features_json, []),
      enabled: !!row.enabled,
      meta: parseJsonField(row.meta_json, {}),
      initial_balance: (function(){ try { const m = parseJsonField(row.meta_json, {}); return Number.isInteger(m.initial_balance) ? m.initial_balance : 0; } catch { return 0; } })(),
      rng_level: (function(){ try { const m = parseJsonField(row.meta_json, {}); const n = Number(m.rng_level); return n === 1 || n === 2 || n === 3 ? n : 2; } catch { return 2; } })(),
      updated_at: row.updated_at,
      source: "db",
    });
  } catch (e) {
    return err("Failed to load config", 500);
  }
}
