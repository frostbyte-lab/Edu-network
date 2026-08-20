const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const maxBytes = 25 * 1024 * 1024;
const ignored = new Set(['.git', 'node_modules']);
const oversized = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else { const size = fs.statSync(fullPath).size; if (size > maxBytes) oversized.push({ path: path.relative(root, fullPath), size }); }
  }
}
walk(root);
if (oversized.length) { console.error('Files exceeding the 25 MB Cloudflare Pages limit:'); for (const file of oversized) console.error('- ' + file.path + ': ' + (file.size / 1024 / 1024).toFixed(2) + ' MB'); process.exit(1); }
console.log('Size check passed: no file exceeds 25 MB.');
