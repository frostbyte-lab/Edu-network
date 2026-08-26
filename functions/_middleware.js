/**
 * EDU Network — Pages Middleware
 *
 * 1. CORS preflight untuk /api/*
 * 2. Inject SDK + game_id ke HTML game (path /game-N/)
 * 3. Rewrite domain API lama → domain EDU
 * 4. Paksa saldo bawaan client (999999, 9.999.999, dll.) → 0
 * 5. Asset binary dilewatkan apa adanya
 *
 * Saldo resmi = D1 (default 0, custom lewat config/admin).
 * File di Pages tetap mentah.
 */

const OLD_DOMAIN_PATTERNS = [
  /https?:\/\/(?:www\.)?(?:api\.)?example\.com/gi,
  /https?:\/\/(?:www\.)?(?:api\.)?provider-asli\.com/gi,
  /https?:\/\/[a-z0-9.-]+\.(?:ngrok(?:-free)?\.(?:app|io)|loca\.lt)/gi,
];

/** Pola saldo/kredit awal yang sering hardcode di game collect */
const BALANCE_ZERO_PATTERNS = [
  // balance / credits / cash / coin / saldo = 999999 atau 9_999_999 dll
  /\b(balance|credits?|credit|cash|coins?|saldo|money|chip|chips|wallet|userBalance|playerBalance|totalCredit|totalBalance|defaultBalance|startBalance|initBalance|initialBalance|START_BALANCE|DEFAULT_BALANCE|INIT_BALANCE|DEFAULT_CREDIT|START_CREDIT)\b(\s*[:=]\s*)(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+)(\s*[;,]?)/gi,
  // "balance": 9999999
  /("(?:balance|credits?|credit|cash|coins?|saldo|money|chip|chips|wallet)"\s*:\s*)(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+)/gi,
  // setBalance(999999) / updateBalance(1e6)
  /\b(setBalance|updateBalance|setCredit|setCredits|setCash|setCoin|setCoins|setSaldo)\s*\(\s*(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+|\d+e\d+)\s*\)/gi,
];

function extractGameIdFromPath(pathname) {
  const m = pathname.match(/^\/game-(\d{1,3})(?:\/|$)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 999) return null;
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

function zeroClientBalances(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  // assignment style: balance = 999999 → balance = 0
  out = out.replace(BALANCE_ZERO_PATTERNS[0], "$1$20$3");
  // JSON style: "balance": 999999 → "balance": 0
  out = out.replace(BALANCE_ZERO_PATTERNS[1], "$10");
  // function call: setBalance(999999) → setBalance(0)
  out = out.replace(BALANCE_ZERO_PATTERNS[2], "$1(0)");
  return out;
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
  out = zeroClientBalances(out);
  return out;
}

function balanceGuardScript(eduOrigin, gameId) {
  return `<script>
(function(){
  window.__EDU_GAME_ID__=${JSON.stringify(gameId || "default")};
  window.__EDU_ORIGIN__=${JSON.stringify(eduOrigin)};
  window.__EDU_FORCE_BALANCE_ZERO__=true;

  /* Paksa common global saldo client → 0 sebelum game boot */
  var KEYS=["balance","credits","credit","cash","coin","coins","saldo","money","chip","chips",
    "userBalance","playerBalance","totalCredit","totalBalance","defaultBalance","startBalance"];
  function zeroGlobals(obj){
    if(!obj)return;
    try{
      KEYS.forEach(function(k){
        if(typeof obj[k]==="number" && obj[k]>0) obj[k]=0;
      });
    }catch(e){}
  }
  zeroGlobals(window);
  document.addEventListener("DOMContentLoaded",function(){ zeroGlobals(window); });

  function bootSdk(){
    if(typeof EduGameClient==="undefined")return;
    try{
      window.edu=window.edu||new EduGameClient({
        baseUrl:window.__EDU_ORIGIN__||location.origin,
        gameId:window.__EDU_GAME_ID__||"default"
      });
      /* Init dengan saldo 0; custom balance datang dari server (config/admin) */
      window.edu.start({ initialBalance: 0 }).then(function(state){
        var bal = state && state.player ? state.player.balance : 0;
        zeroGlobals(window);
        try{
          KEYS.forEach(function(k){ if(k in window) window[k]=bal; });
        }catch(e){}
        window.__EDU_PLAYABLE__ = bal > 0;
        window.dispatchEvent(new CustomEvent("edu-balance",{ detail:{ balance: bal, playable: bal > 0, player: state && state.player } }));
        if (bal <= 0) {
          console.warn("[EDU] Saldo 0 — game tidak bisa dijalankan");
          window.dispatchEvent(new CustomEvent("edu-blocked",{ detail:{ reason: "BALANCE_ZERO", balance: 0 } }));
        }
      }).catch(function(e){ console.warn("[EDU SDK] start", e); });
    }catch(e){ console.warn("[EDU SDK]", e); }
  }

  if(!document.querySelector('script[src*="edu-game-client.js"]')){
    var s=document.createElement("script");
    s.src=(window.__EDU_ORIGIN__||"")+"/sdk/edu-game-client.js";
    s.defer=true;
    s.onload=bootSdk;
    document.head.appendChild(s);
  }else{
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bootSdk);
    else bootSdk();
  }
})();
</script>`;
}

function injectSdkIntoHtml(html, { eduOrigin, gameId }) {
  if (!html || typeof html !== "string") return html;
  // Hindari double-inject guard
  if (html.includes("__EDU_FORCE_BALANCE_ZERO__")) return html;

  const boot = balanceGuardScript(eduOrigin, gameId);

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
          "Content-Type, Authorization, X-Player-Id, X-Session-Id, X-Game-Id, X-Admin-Key",
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
