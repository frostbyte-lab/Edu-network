/**
 * POST /api/game/bonus
 * Body: { player_id, game_id?, session_id?, type?: "daily"|"freespin"|"manual", amount? }
 * Awards bonus points (virtual). Simple daily-claim style + manual credit.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import {
  requireDb,
  validPlayerId,
  validGameId,
  parseBody,
  ensurePlayer,
  writeHistory,
} from "../_lib/db.js";

const DAILY_BONUS = 500;
const FREESPIN_BONUS = 100;

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
  const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "daily";

  if (!validPlayerId(playerId)) return err("A valid player_id is required", 400);
  if (!validGameId(gameId)) return err("Invalid game_id", 400);

  let amount = Number.isInteger(body.amount) && body.amount > 0 ? body.amount : null;

  if (type === "daily") amount = amount ?? DAILY_BONUS;
  else if (type === "freespin") amount = amount ?? FREESPIN_BONUS;
  else if (type === "manual") {
    if (!amount) return err("amount required for type=manual", 400);
  } else {
    return err("type must be daily | freespin | manual", 400);
  }

  if (amount > 100000) return err("amount too large", 400);

  try {
    await ensurePlayer(db, playerId);

    // Simple daily gate: 1 daily bonus per player per UTC day
    if (type === "daily") {
      const recent = await db
        .prepare(
          `SELECT id FROM game_history
           WHERE player_id = ? AND action = 'bonus'
             AND detail_json LIKE '%"type":"daily"%'
             AND date(created_at) = date('now')
           LIMIT 1`
        )
        .bind(playerId)
        .first();
      if (recent) {
        return err("Daily bonus already claimed today", 409);
      }
    }

    await db
      .prepare(
        `UPDATE game_players
         SET balance = balance + ?, updated_at = datetime('now')
         WHERE player_id = ?`
      )
      .bind(amount, playerId)
      .run();

    const player = await db
      .prepare(
        `SELECT player_id, balance, currency, spins_count, total_bet, total_win
         FROM game_players WHERE player_id = ?`
      )
      .bind(playerId)
      .first();

    await writeHistory(db, {
      playerId,
      gameId,
      sessionId,
      action: "bonus",
      amount,
      balanceAfter: player.balance,
      detail: { type },
    });

    return ok({
      bonus: {
        type,
        amount,
        currency: player.currency,
      },
      player: {
        player_id: player.player_id,
        balance: player.balance,
        currency: player.currency,
      },
    });
  } catch (e) {
    return err("Failed to award bonus", 500);
  }
}
