export async function onRequestGet({ env }) {
  if (!env.EDU_DB) {
    return Response.json({ ok: false, error: "EDU_DB binding is not configured" }, { status: 503 });
  }

  try {
    const { results } = await env.EDU_DB
      .prepare("SELECT id, name, source_domain_id, version, synced_at FROM games ORDER BY id ASC")
      .all();

    return Response.json({ ok: true, games: results });
  } catch (_error) {
    return Response.json({ ok: false, error: "Failed to read games" }, { status: 500 });
  }
}
