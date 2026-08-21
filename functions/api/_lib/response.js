/** Shared JSON helpers for EDU Network Game API */

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Player-Id, X-Session-Id, X-Game-Id",
      ...extraHeaders,
    },
  });
}

export function ok(data = {}, status = 200) {
  return json({ ok: true, ...data }, status);
}

export function err(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, ...extra }, status);
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Player-Id, X-Session-Id, X-Game-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
