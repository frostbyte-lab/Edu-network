/**
 * POST /api/game/init
 * Body: { player_id, game_id?, initial_balance? }
 * Creates/ensures player + returns config + balance
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  parseBody,
  ensurePlayer,
  getConfig,
  parseJsonField,
  writeHistory,
} from "../_lib/db.js";
import { DEFAULT_SYMBOLS, DEFAULT_PAYTABLE } from "../_lib/engine.js";

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
  if (!validPlayerId(playerId)) return err("A valid player_id is required (3-64 chars)", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);

  try {
    const cfg = await getConfig(db, gameId);
    let meta = {};
    try {
      meta = cfg && cfg.meta_json ? JSON.parse(cfg.meta_json) : (cfg && cfg.meta) || {};
    } catch (_) { meta = {}; }
    if (!meta || typeof meta !== "object") meta = {};

    // Prioritas: body.initial_balance → config.meta.initial_balance → 0
    let initialBalance = 0;
    if (Number.isInteger(body.initial_balance) && body.initial_balance >= 0) {
      initialBalance = body.initial_balance;
    } else if (Number.isInteger(meta.initial_balance) && meta.initial_balance >= 0) {
      initialBalance = meta.initial_balance;
    }

    const player = await ensurePlayer(db, playerId, initialBalance);

    await writeHistory(db, {
      playerId,
      gameId,
      action: "init",
      amount: 0,
      balanceAfter: player.balance,
      detail: { initial_balance: initialBalance },
    });

    return ok({
      player: {
        player_id: player.player_id,
        balance: player.balance,
        currency: player.currency,
        spins_count: player.spins_count,
      },
      config: cfg
        ? {
            game_id: cfg.game_id,
            title: cfg.title,
            rtp: cfg.rtp,
            min_bet: cfg.min_bet,
            max_bet: cfg.max_bet,
            default_bet: cfg.default_bet,
            currency: cfg.currency,
            symbols: parseJsonField(cfg.symbols_json, DEFAULT_SYMBOLS),
            paytable: parseJsonField(cfg.paytable_json, DEFAULT_PAYTABLE),
            features: parseJsonField(cfg.features_json, []),
          }
        : {
            game_id: gameId,
            title: "EDU Default",
            rtp: 96,
            min_bet: 1,
            max_bet: 500,
            default_bet: 10,
            currency: "pts",
            symbols: DEFAULT_SYMBOLS,
            paytable: DEFAULT_PAYTABLE,
            features: ["freespin", "bonus", "wild", "scatter"],
          },
      message: "Game initialized",
    });
  } catch (e) {
    return err("Failed to init game", 500);
  }
}
