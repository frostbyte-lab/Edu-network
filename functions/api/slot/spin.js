const SYMBOLS = ["cherry", "lemon", "bell", "star", "seven"];

function errorResponse(message, status) {
  return Response.json({ ok: false, error: message }, { status });
}

function validPlayerId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

function normalizeRng(v) {
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? n : 2;
}

function unit() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4294967296;
}

function biased(rngLevel) {
  const x = unit();
  if (rngLevel === 1) return x * x;
  if (rngLevel === 3) return Math.sqrt(x);
  return x;
}

function drawSymbols(rngLevel = 2) {
  const lv = normalizeRng(rngLevel);
  // Level 1: ~80% force lose (3 simbol berbeda)
  if (lv === 1 && unit() < 0.8) {
    const a = SYMBOLS[Math.floor(biased(1) * SYMBOLS.length) % SYMBOLS.length];
    let b = SYMBOLS[Math.floor(biased(1) * SYMBOLS.length) % SYMBOLS.length];
    let g = 0;
    while (b === a && g++ < 16) b = SYMBOLS[Math.floor(biased(1) * SYMBOLS.length) % SYMBOLS.length];
    if (b === a) b = SYMBOLS.find((s) => s !== a) || SYMBOLS[1];
    let c = SYMBOLS[Math.floor(biased(1) * SYMBOLS.length) % SYMBOLS.length];
    g = 0;
    while ((c === a || c === b) && g++ < 16) c = SYMBOLS[Math.floor(biased(1) * SYMBOLS.length) % SYMBOLS.length];
    if (c === a || c === b) c = SYMBOLS.find((s) => s !== a && s !== b) || SYMBOLS[2];
    return [a, b, c];
  }
  const symbols = [];
  for (let i = 0; i < 3; i++) {
    if (i > 0 && lv === 3 && biased(3) > 0.45) {
      symbols.push(symbols[0]);
      continue;
    }
    symbols.push(SYMBOLS[Math.floor(biased(lv) * SYMBOLS.length) % SYMBOLS.length]);
  }
  return symbols;
}

function calculatePayout(symbols, stake, rngLevel = 2) {
  let payout = 0;
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    const multiplier = symbols[0] === "seven" ? 10 : symbols[0] === "star" ? 5 : 3;
    payout = stake * multiplier;
  } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
    payout = stake * 2;
  }
  if (payout > 0 && rngLevel === 1) payout = Math.max(0, Math.round(payout * 0.7));
  if (payout > 0 && rngLevel === 3) payout = Math.round(payout * 1.15);
  return payout;
}

export async function onRequestPost({ request, env }) {
  if (!env.EDU_DB) return errorResponse("EDU_DB binding is not configured", 503);

  let body;
  try {
    body = await request.json();
  } catch (_error) {
    return errorResponse("Request body must be valid JSON", 400);
  }
  const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
  const stake = body?.stake;
  const rngLevel = normalizeRng(body?.rng_level);
  if (!validPlayerId(playerId)) return errorResponse("A valid player_id is required", 400);
  if (!Number.isInteger(stake) || stake < 1 || stake > 100) {
    return errorResponse("stake must be an integer between 1 and 100", 400);
  }

  const symbols = drawSymbols(rngLevel);
  const payout = calculatePayout(symbols, stake, rngLevel);
  try {
    await env.EDU_DB.prepare("INSERT OR IGNORE INTO slot_players (player_id) VALUES (?)").bind(playerId).run();
    const debit = await env.EDU_DB.prepare(
      "UPDATE slot_players SET balance = balance - ?, spins_count = spins_count + 1, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND balance >= ?",
    )
      .bind(stake, playerId, stake)
      .run();
    if (!debit.meta || debit.meta.changes !== 1) return errorResponse("Saldo poin tidak cukup", 409);

    const record = await env.EDU_DB.batch([
      env.EDU_DB.prepare("INSERT INTO slot_spins (player_id, symbols, stake, payout) VALUES (?, ?, ?, ?)").bind(
        playerId,
        JSON.stringify(symbols),
        stake,
        payout,
      ),
      env.EDU_DB.prepare("UPDATE slot_players SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ?").bind(
        payout,
        playerId,
      ),
    ]);
    const player = await env.EDU_DB.prepare("SELECT player_id, balance, spins_count FROM slot_players WHERE player_id = ?")
      .bind(playerId)
      .first();
    return Response.json({
      ok: true,
      spin: { symbols, stake, payout, net: payout - stake, rng_level: rngLevel },
      player,
      spin_id: record[0]?.meta?.last_row_id || null,
    });
  } catch (_error) {
    return errorResponse("Failed to process spin", 500);
  }
}
