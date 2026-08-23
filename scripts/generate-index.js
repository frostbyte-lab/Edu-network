const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readMeta(gameDir) {
  const metaPath = path.join(root, gameDir, "edu-meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

function isPlaceholder(gameDir) {
  const indexPath = path.join(root, gameDir, "index.html");
  if (!fs.existsSync(indexPath)) return true;
  const html = fs.readFileSync(indexPath, "utf8");
  // placeholder bawaan scaffold
  if (/Game ini akan segera tersedia/i.test(html) && html.length < 800) return true;
  return false;
}

const games = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^game-\d+$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));

const published = [];
for (const game of games) {
  const meta = readMeta(game);
  const placeholder = isPlaceholder(game);
  // Tampil di web utama hanya yang punya meta published atau konten nyata
  if (meta && meta.published === false) continue;
  if (placeholder && !meta) continue; // slot kosong: tidak tampil di katalog publik
  if (placeholder && meta && !meta.title) continue;

  const title = (meta && meta.title) || game.replace(/^game-/, "Game ");
  const slot = meta && meta.slot != null ? meta.slot : Number(game.slice(5));
  published.push({ game, title, slot, placeholder });
}

const cards = published
  .map((g) => {
    const status = g.placeholder ? "Segera hadir" : "Mainkan";
    // Web utama: NAMA saja (nomor tidak ditampilkan)
    return (
      `<a class="game-card" href="./${g.game}/" title="">` +
      `<span class="game-title">${escapeHtml(g.title)}</span>` +
      `<span class="game-status">${status}</span>` +
      `</a>`
    );
  })
  .join("\n");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EDU Network — Learning Games</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#102a43;background:#f4f8fb}
*{box-sizing:border-box}body{margin:0}
main{max-width:1120px;margin:0 auto;padding:72px 24px}
.eyebrow{color:#147d92;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:.76rem}
h1{max-width:680px;margin:16px 0;font-size:clamp(2.4rem,6vw,5rem);line-height:.98;letter-spacing:-.055em}
.intro{max-width:560px;color:#486581;font-size:1.1rem;line-height:1.6}
.game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:48px}
.game-card{display:flex;min-height:116px;padding:20px;border-radius:18px;background:white;color:inherit;text-decoration:none;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(16,42,67,.08);transition:transform .2s ease,box-shadow .2s ease}
.game-card:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(16,42,67,.15)}
.game-title{font-size:1.05rem;font-weight:800;line-height:1.25}
.game-status{color:#829ab1;font-size:.86rem;margin-top:8px}
footer{margin-top:64px;color:#829ab1;font-size:.9rem}
</style>
</head>
<body>
<main>
  <div class="eyebrow">EDU Network</div>
  <h1>Belajar jadi lebih seru.</h1>
  <p class="intro">Kumpulan game edukasi untuk membantu siswa belajar, berlatih, dan berkembang melalui pengalaman interaktif.</p>
  <section class="game-grid" aria-label="Daftar game">
${cards || '<p class="intro">Belum ada game yang dipublikasikan.</p>'}
  </section>
  <footer>${published.length} game tersedia</footer>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), html);

// Admin manifest (nomor + nama) — untuk panel internal
const adminList = games.map((game) => {
  const meta = readMeta(game);
  const slot = Number(game.slice(5));
  return {
    slot,
    game_id: game,
    title: (meta && meta.title) || `Game ${slot}`,
    published: meta ? meta.published !== false : false,
    path: `/${game}/`,
    has_meta: !!meta,
    placeholder: isPlaceholder(game),
  };
});
fs.writeFileSync(
  path.join(root, "admin", "slots.json"),
  JSON.stringify({ updated_at: new Date().toISOString(), slots: adminList }, null, 2) + "\n",
);

console.log("Generated index.html with", published.length, "public games (names only)");
console.log("Generated admin/slots.json with", adminList.length, "slots (numbers + names)");
