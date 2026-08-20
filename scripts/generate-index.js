const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const games = fs.readdirSync(root, { withFileTypes: true })
  .filter(function (entry) { return entry.isDirectory() && /^game-\d+$/.test(entry.name); })
  .map(function (entry) { return entry.name; })
  .sort(function (a, b) { return Number(a.slice(5)) - Number(b.slice(5)); });
const cards = games.map(function (game) {
  const number = game.slice(5);
  return '<a class=\"game-card\" href=\"./' + game + '/\"><span class=\"game-number\">Game ' + number + '</span><span class=\"game-status\">Open game</span></a>';
}).join('\n');
const html = '<!doctype html>\n<html lang=\"id\">\n<head>\n<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>EDU Network — Learning Games</title>\n<style>\n:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#102a43;background:#f4f8fb}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:0 auto;padding:72px 24px}.eyebrow{color:#147d92;font-weight:800;letter-spacing:.14em;text-transform:uppercase;font-size:.76rem}h1{max-width:680px;margin:16px 0;font-size:clamp(2.4rem,6vw,5rem);line-height:.98;letter-spacing:-.055em}.intro{max-width:560px;color:#486581;font-size:1.1rem;line-height:1.6}.game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:48px}.game-card{display:flex;min-height:116px;padding:20px;border-radius:18px;background:white;color:inherit;text-decoration:none;flex-direction:column;justify-content:space-between;box-shadow:0 8px 24px rgba(16,42,67,.08);transition:transform .2s ease,box-shadow .2s ease}.game-card:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(16,42,67,.15)}.game-number{font-size:1.15rem;font-weight:800}.game-status{color:#829ab1;font-size:.86rem}footer{margin-top:64px;color:#829ab1;font-size:.9rem}\n</style>\n</head>\n<body><main><div class=\"eyebrow\">EDU Network</div><h1>Belajar jadi lebih seru.</h1><p class=\"intro\">Kumpulan game edukasi untuk membantu siswa belajar, berlatih, dan berkembang melalui pengalaman interaktif.</p><section class=\"game-grid\" aria-label=\"Daftar game\">' + cards + '</section><footer>' + games.length + ' ruang game tersedia</footer></main></body></html>\n';
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('Generated catalog for ' + games.length + ' games.');
