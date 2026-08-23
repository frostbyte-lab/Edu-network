/**
 * EDU Network — Pages Middleware
 *
 * 1. CORS preflight untuk /api/*
 * 2. Inject SDK + game_id ke HTML game (path /game-N/)
 * 3. Rewrite domain API lama → domain EDU (on-the-fly di JS/JSON/HTML)
 * 4. File lain (gambar, audio, css, font) dilewatkan apa adanya
 *
 * File yang di-upload ke Pages TETAP MENTAH.
 */
const EDU_HOSTS = new Set([
  "edu-network.pages.dev",
  "ea29118c.edu-network.pages.dev",
]);

const OLD_DOMAIN_PATTERNS = [
  /https?:\/\/(?:www\.)?(?:api\.)?example\.com/gi,
  /https?:\/\/(?:www\.)?(?:api\.)?provider-asli\.com/gi,
  /https?:\/\/[a-z0-9.-]+\.(?:ngrok(?:-free)?\.(?:app|io)|loca\.lt)/gi,
];

function extractGameIdFromPath(pathname) {
  const m = pathname.match(/^\/game-(\d{1,3})(?:\/|$)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 150) return null;
  return `game-${n}`;
}

function shouldRewriteBody(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.includes("javascript") ||
    ct.includes("json") ||
    ct.includes("text/html") ||
    ct.includes("text/css") ||
    ct.includes("application/x-javascript")
  );
}

function rewriteText(text, eduOrigin) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const re of OLD_DOMAIN_PATTERNS) {
    out = out.replace(re, eduOrigin);
  }
  out = out.replace(
    /(["'`])https?:\/\/[^"'`]+(\/api\/(?:game|slot|admin)(?:\/[^"'`]*)?)\1/gi,
    `$1${eduOrigin}$2$1`,
  );
  return out;
}

function injectSdkIntoHtml(html, { eduOrigin, gameId }) {
  if (!html || typeof html !== "string") return html;
  if (html.includes("edu-game-client.js") || html.includes("EduGameClient")) {
    if (gameId && !html.includes("__EDU_GAME_ID__")) {
      const boot = `<script>window.__EDU_GAME_ID__=${JSON.stringify(gameId)};window.__EDU_ORIGIN__=${JSON.stringify(eduOrigin)};</script>`;
      if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, boot + "</head>");
      return boot + html;
    }
    return html;
  }

  const boot = [
    `<script>window.__EDU_GAME_ID__=${JSON.stringify(gameId || "default")};window.__EDU_ORIGIN__=${JSON.stringify(eduOrigin)};</script>`,
    `<script src="${eduOrigin}/sdk/edu-game-client.js" defer></script>`,
    `<script>
(function(){
  function boot(){
    if(typeof EduGameClient==="undefined")return;
    try{
      window.edu=window.edu||new EduGameClient({
        baseUrl:window.__EDU_ORIGIN__||location.origin,
        gameId:window.__EDU_GAME_ID__||"default"
      });
    }catch(e){console.warn("[EDU SDK]",e)}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
</script>`,
  ].join("\n");

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, boot + "\n</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, "<body$1>\n" + boot);
  return boot + "\n" + html;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Player-Id, X-Session-Id, X-Game-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (pathname.startsWith("/api/")) {
    const response = await next();
    const headers = new Headers(response.headers);
    if (!headers.has("Access-Control-Allow-Origin")) {
      headers.set("Access-Control-Allow-Origin", "*");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const response = await next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!shouldRewriteBody(contentType)) return response;

  const eduOrigin = `${url.protocol}//${url.host}`;
  const gameId = extractGameIdFromPath(pathname);

  try {
    let text = await response.text();
    text = rewriteText(text, eduOrigin);
    if (contentType.includes("text/html")) {
      text = injectSdkIntoHtml(text, { eduOrigin, gameId });
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    if (contentType.includes("text/html") && gameId) {
      headers.set("Cache-Control", "public, max-age=60, must-revalidate");
    }
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return new Response(null, { status: response.status, headers: response.headers });
  }
}
