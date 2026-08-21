export async function onRequestGet({ env }) {
  if (!env.EDU_DB) {
    return Response.json({ ok: false, error: "EDU_DB binding is not configured" }, { status: 503 });
  }

  try {
    const result = await env.EDU_DB.prepare("SELECT 1 AS connected").first();
    return Response.json({
      ok: result?.connected === 1,
      database: "EDU",
    });
  } catch (_error) {
    return Response.json(
      { ok: false, error: "D1 query failed" },
      { status: 500 },
    );
  }
}
