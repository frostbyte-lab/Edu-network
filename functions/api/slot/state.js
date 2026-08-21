function errorResponse(message, status) {
  return Response.json({ ok: false, error: message }, { status });
}

function validPlayerId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

export async function onRequestGet({ request, env }) {
  if (!env.EDU_DB) return errorResponse("EDU_DB binding is not configured", 503);
  const playerId = new URL(request.url).searchParams.get("player_id") || "";
  if (!validPlayerId(playerId)) return errorResponse("A valid player_id is required", 400);

  try {
    await env.EDU_DB.prepare("INSERT OR IGNORE INTO slot_players (player_id) VALUES (?)").bind(playerId).run();
    const player = await env.EDU_DB.prepare("SELECT player_id, balance, spins_count, created_at, updated_at FROM slot_players WHERE player_id = ?").bind(playerId).first();
    const history = await env.EDU_DB.prepare("SELECT id, symbols, stake, payout, created_at FROM slot_spins WHERE player_id = ? ORDER BY id DESC LIMIT 10").bind(playerId).all();
    return Response.json({ ok: true, player, history: history.results || [] });
  } catch (_error) {
    return errorResponse("Failed to read slot state", 500);
  }
}
