/**
 * Permanent patch: rewrite API domain, zero hard-coded balances, inject SDK into index.html.
 * Used by install-game.js and patch-game.js so downloaded files already have custom EDU API.
 */
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ORIGIN = "https://ea29118c.edu-network.pages.dev";

const OLD_DOMAIN_PATTERNS = [
  /https?:\/\/(?:www\.)?(?:api\.)?example\.com/gi,
  /https?:\/\/(?:www\.)?(?:api\.)?provider-asli\.com/gi,
  /https?:\/\/[a-z0-9.-]+\.(?:ngrok(?:-free)?\.(?:app|io)|loca\.lt)/gi,
];

const TEXT_EXT = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".json", ".css", ".txt", ".xml", ".svg",
  ".map", ".ts", ".jsx", ".tsx",
]);

function isTextFile(filePath) {
  return TEXT_EXT.has(path.extname(filePath).toLowerCase());
}

function zeroClientBalances(text) {
  let out = text;
  out = out.replace(
    /\b(balance|credits?|credit|cash|coins?|saldo|money|chip|chips|wallet|userBalance|playerBalance|totalCredit|totalBalance|defaultBalance|startBalance|initBalance|initialBalance|START_BALANCE|DEFAULT_BALANCE|INIT_BALANCE|DEFAULT_CREDIT|START_CREDIT)\b(\s*[:=]\s*)(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+)(\s*[;,]?)/gi,
    "$1$20$3",
  );
  out = out.replace(
    /("(?:balance|credits?|credit|cash|coins?|saldo|money|chip|chips|wallet)"\s*:\s*)(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+)/gi,
    "$10",
  );
  out = out.replace(
    /\b(setBalance|updateBalance|setCredit|setCredits|setCash|setCoin|setCoins|setSaldo)\s*\(\s*(?:[\d_]{4,}|\d{1,3}(?:[.,]\d{3})+|\d+e\d+)\s*\)/gi,
    "$1(0)",
  );
  return out;
}

function rewriteDomains(text, eduOrigin) {
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

function injectSdkHtml(html, { eduOrigin, gameId }) {
  if (html.includes("__EDU_PATCHED_PERMANENT__")) return html;

  const boot = `<script>
/* __EDU_PATCHED_PERMANENT__ */
window.__EDU_GAME_ID__=${JSON.stringify(gameId || "default")};
window.__EDU_ORIGIN__=${JSON.stringify(eduOrigin)};
window.__EDU_FORCE_BALANCE_ZERO__=true;
</script>
<script src="${eduOrigin}/sdk/edu-game-client.js" defer></script>
<script>
(function(){
  var KEYS=["balance","credits","credit","cash","coin","coins","saldo","money","chip","chips",
    "userBalance","playerBalance","totalCredit","totalBalance","defaultBalance","startBalance"];
  function zeroGlobals(){
    try{ KEYS.forEach(function(k){ if(typeof window[k]==="number"&&window[k]>0) window[k]=0; }); }catch(e){}
  }
  zeroGlobals();
  function boot(){
    if(typeof EduGameClient==="undefined")return;
    try{
      window.edu=window.edu||new EduGameClient({
        baseUrl:window.__EDU_ORIGIN__||location.origin,
        gameId:window.__EDU_GAME_ID__||"default"
      });
      window.edu.start({ initialBalance: 0 }).then(function(state){
        var bal=state&&state.player?state.player.balance:0;
        zeroGlobals();
        try{ KEYS.forEach(function(k){ if(k in window) window[k]=bal; }); }catch(e){}
        window.dispatchEvent(new CustomEvent("edu-balance",{detail:{balance:bal}}));
      }).catch(function(e){ console.warn("[EDU]",e); });
    }catch(e){ console.warn("[EDU]",e); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 0);
})();
</script>`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, boot + "\n</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, "<body$1>\n" + boot);
  return boot + "\n" + html;
}

/**
 * Patch all text files under destDir in-place.
 * @returns {{ filesPatched: number, htmlInjected: number }}
 */
function patchGameDir(destDir, { gameId, eduOrigin = DEFAULT_ORIGIN, extraDomains = [] } = {}) {
  const stats = { filesPatched: 0, htmlInjected: 0 };
  const domains = [...OLD_DOMAIN_PATTERNS];
  for (const d of extraDomains) {
    if (!d) continue;
    const escaped = String(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    domains.push(new RegExp(escaped, "gi"));
  }

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!isTextFile(full)) continue;
      let text = fs.readFileSync(full, "utf8");
      const before = text;

      let out = text;
      for (const re of domains) out = out.replace(re, eduOrigin);
      out = out.replace(
        /(["'`])https?:\/\/[^"'`]+(\/api\/(?:game|slot|admin)(?:\/[^"'`]*)?)\1/gi,
        `$1${eduOrigin}$2$1`,
      );
      out = zeroClientBalances(out);

      const isHtml = /\.html?$/i.test(entry.name);
      if (isHtml && (entry.name.toLowerCase() === "index.html" || out.includes("<html"))) {
        const injected = injectSdkHtml(out, { eduOrigin, gameId });
        if (injected !== out) stats.htmlInjected++;
        out = injected;
      }

      if (out !== before) {
        fs.writeFileSync(full, out, "utf8");
        stats.filesPatched++;
      }
    }
  }

  walk(destDir);
  return stats;
}

module.exports = {
  patchGameDir,
  DEFAULT_ORIGIN,
  zeroClientBalances,
  rewriteDomains,
  injectSdkHtml,
  isTextFile,
};
