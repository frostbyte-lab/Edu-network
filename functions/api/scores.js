function jsonError(error, status) {
  return Response.json({ ok: false, error }, { status });
}

function normalizeScore(row) {
  if (!row) return row;
  let metadata = {};
  try {
    metadata = JSON.parse(row.metadata || "{}");
  } catch (_error) {
    metadata = {};
  }
  return { ...row, metadata };
}

export async function onRequestGet({ request, env }) {
  if (!env.EDU_DB) return jsonError("EDU_DB binding is not configured", 503);

  const url = new URL(request.url);
  const gameSlug = url.searchParams.get("game_slug");
  const playerId = url.searchParams.get("player_id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);

  try {
    let query = "SELECT id, game_slug, player_id, score, metadata, created_at FROM scores";
    const conditions = [];
    const values = [];
    if (gameSlug) { conditions.push("game_slug = ?"); values.push(gameSlug); }
    if (playerId) { conditions.push("player_id = ?"); values.push(playerId); }
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " ORDER BY created_at DESC, id DESC LIMIT ?";
    values.push(limit);

    const statement = env.EDU_DB.prepare(query);
    const { results } = await statement.bind(...values).all();
    return Response.json({ ok: true, scores: results.map(normalizeScore) });
  } catch (_error) {
    return jsonError("Failed to read scores", 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.EDU_DB) return jsonError("EDU_DB binding is not configured", 503);

  let body;
  try {
    body = await request.json();
  } catch (_error) {
    return jsonError("Request body must be valid JSON", 400);
  }

  const gameSlug = typeof body?.game_slug === "string" ? body.game_slug.trim() : "";
  const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
  const score = body?.score;
  if (!gameSlug || !playerId || !Number.isInteger(score) || score < 0) {
    return jsonError("game_slug, player_id, and a non-negative integer score are required", 400);
  }

  let metadata = "{}";
  if (body.metadata !== undefined) {
    if (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      return jsonError("metadata must be a JSON object", 400);
    }
    metadata = JSON.stringify(body.metadata);
  }

  try {
    const result = await env.EDU_DB
      .prepare("INSERT INTO scores (game_slug, player_id, score, metadata) VALUES (?, ?, ?, ?)")
      .bind(gameSlug, playerId, score, metadata)
      .run();

    return Response.json({ ok: true, score_id: result.meta.last_row_id }, { status: 201 });
  } catch (_error) {
    return jsonError("Failed to save score", 500);
  }
}
