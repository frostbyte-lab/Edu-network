/**
 * POST /api/game/spin
 * Body: { player_id, bet (or amount), game_id?, session_id? }
 * Deducts bet, draws symbols, credits win, records spin + history.
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
import {
  drawReels,
  calculatePayout,
  buildSpinResult,
  DEFAULT_SYMBOLS,
  DEFAULT_PAYTABLE,
} from "../_lib/engine.js";

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
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
  const bet = Number.isInteger(body.bet)
    ? body.bet
    : Number.isInteger(body.amount)
      ? body.amount
      : null;

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);
  if (!Number.isInteger(bet) || bet < 1) return err("bet must be a positive integer", 400);

  try {
    await ensurePlayer(db, playerId);
    const cfg = await getConfig(db, gameId);
    const minBet = cfg?.min_bet ?? 1;
    const maxBet = cfg?.max_bet ?? 500;
    const symbolsList = parseJsonField(cfg?.symbols_json, DEFAULT_SYMBOLS);
    const paytable = parseJsonField(cfg?.paytable_json, DEFAULT_PAYTABLE);

    if (bet < minBet || bet > maxBet) {
      return err(`bet must be between ${minBet} and ${maxBet}`, 400);
    }

    // Atomic debit
    const debit = await db
      .prepare(
        `UPDATE game_players
         SET balance = balance - ?,
             spins_count = spins_count + 1,
             total_bet = total_bet + ?,
             updated_at = datetime('now')
         WHERE player_id = ? AND balance >= ?`
      )
      .bind(bet, bet, playerId, bet)
      .run();

    if (!debit.meta || debit.meta.changes !== 1) {
      const p = await db
        .prepare(`SELECT balance FROM game_players WHERE player_id = ?`)
        .bind(playerId)
        .first();
      return err("Saldo poin tidak cukup", 409, { balance: p?.balance ?? 0, required: bet });
    }

    const symbols = drawReels(symbolsList, 3);
    const payout = calculatePayout(symbols, bet, paytable);
    const win = payout.win;

    // Credit win + insert spin
    const batch = await db.batch([
      db
        .prepare(
          `UPDATE game_players
           SET balance = balance + ?,
               total_win = total_win + ?,
               updated_at = datetime('now')
           WHERE player_id = ?`
        )
        .bind(win, win, playerId),
      db
        .prepare(
          `INSERT INTO game_spins
             (session_id, player_id, game_id, bet_amount, win_amount, net_amount, symbols_json, result_json, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'settled')`
        )
        .bind(
          sessionId,
          playerId,
          gameId,
          bet,
          win,
          win - bet,
          JSON.stringify(symbols),
          JSON.stringify({ type: payout.type, multiplier: payout.multiplier })
        ),
    ]);

    const spinId = batch[1]?.meta?.last_row_id ?? null;
    const player = await db
      .prepare(
        `SELECT player_id, balance, currency, spins_count, total_bet, total_win
         FROM game_players WHERE player_id = ?`
      )
      .bind(playerId)
      .first();

    const result = buildSpinResult({
      symbols,
      bet,
      payout,
      gameId,
      sessionId,
    });

    await writeHistory(db, {
      playerId,
      gameId,
      sessionId,
      action: "spin",
      amount: bet,
      balanceAfter: player.balance,
      detail: { spin_id: spinId, win, symbols },
    });

    return ok({
      spin_id: spinId,
      result,
      player: {
        player_id: player.player_id,
        balance: player.balance,
        currency: player.currency,
        spins_count: player.spins_count,
      },
    });
  } catch (e) {
    return err("Failed to process spin", 500);
  }
}
