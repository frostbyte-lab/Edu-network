/**
 * POST /api/game/bet
 * Body: { player_id, amount, game_id?, session_id? }
 * Validates bet against config min/max. Does NOT deduct yet (deduct on spin).
 * Returns accepted bet info.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  parseBody,
  ensurePlayer,
  getConfig,
  writeHistory,
} from "../_lib/db.js";

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
  const amount = body.amount;

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);
  if (!Number.isInteger(amount) || amount < 1) return err("amount must be a positive integer", 400);

  try {
    const player = await ensurePlayer(db, playerId);
    const cfg = await getConfig(db, gameId);
    const minBet = cfg?.min_bet ?? 1;
    const maxBet = cfg?.max_bet ?? 500;

    if (amount < minBet || amount > maxBet) {
      return err(`amount must be between ${minBet} and ${maxBet}`, 400, {
        min_bet: minBet,
        max_bet: maxBet,
      });
    }

    if (player.balance < amount) {
      return err("Saldo poin tidak cukup", 409, { balance: player.balance, required: amount });
    }

    await writeHistory(db, {
      playerId,
      gameId,
      sessionId,
      action: "bet",
      amount,
      balanceAfter: player.balance,
      detail: { accepted: true, min_bet: minBet, max_bet: maxBet },
    });

    return ok({
      bet: {
        amount,
        currency: player.currency,
        game_id: gameId,
        session_id: sessionId,
        accepted: true,
      },
      player: {
        player_id: player.player_id,
        balance: player.balance,
      },
    });
  } catch (e) {
    return err("Failed to process bet", 500);
  }
}
