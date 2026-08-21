const SYMBOLS = ["cherry", "lemon", "bell", "star", "seven"];

function errorResponse(message, status) {
  return Response.json({ ok: false, error: message }, { status });
}

function validPlayerId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

function drawSymbols() {
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => SYMBOLS[value % SYMBOLS.length]);
}

function calculatePayout(symbols, stake) {
  if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
    const multiplier = symbols[0] === "seven" ? 10 : symbols[0] === "star" ? 5 : 3;
    return stake * multiplier;
  }
  if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) return stake * 2;
  return 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.EDU_DB) return errorResponse("EDU_DB binding is not configured", 503);

  let body;
  try { body = await request.json(); } catch (_error) { return errorResponse("Request body must be valid JSON", 400); }
  const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
  const stake = body?.stake;
  if (!validPlayerId(playerId)) return errorResponse("A valid player_id is required", 400);
  if (!Number.isInteger(stake) || stake < 1 || stake > 100) return errorResponse("stake must be an integer between 1 and 100", 400);

  const symbols = drawSymbols();
  const payout = calculatePayout(symbols, stake);
  try {
    await env.EDU_DB.prepare("INSERT OR IGNORE INTO slot_players (player_id) VALUES (?)").bind(playerId).run();
    const debit = await env.EDU_DB.prepare("UPDATE slot_players SET balance = balance - ?, spins_count = spins_count + 1, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND balance >= ?").bind(stake, playerId, stake).run();
    if (!debit.meta || debit.meta.changes !== 1) return errorResponse("Saldo poin tidak cukup", 409);

    const record = await env.EDU_DB.batch([
      env.EDU_DB.prepare("INSERT INTO slot_spins (player_id, symbols, stake, payout) VALUES (?, ?, ?, ?)").bind(playerId, JSON.stringify(symbols), stake, payout),
      env.EDU_DB.prepare("UPDATE slot_players SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ?").bind(payout, playerId)
    ]);
    const player = await env.EDU_DB.prepare("SELECT player_id, balance, spins_count FROM slot_players WHERE player_id = ?").bind(playerId).first();
    return Response.json({ ok: true, spin: { symbols, stake, payout, net: payout - stake }, player, spin_id: record[0]?.meta?.last_row_id || null });
  } catch (_error) {
    return errorResponse("Failed to process spin", 500);
  }
}
