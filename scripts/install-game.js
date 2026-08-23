#!/usr/bin/env node
/**
 * Install extracted game package into game-N/ slot.
 * Usage: node scripts/install-game.js --slot 12 --from ./extracted
 *        node scripts/install-game.js --slot 12 --from ./game.zip
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const MAX = 25 * 1024 * 1024;
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { slot: null, from: null, keep: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slot") out.slot = Number(argv[++i]);
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--keep") out.keep = true;
  }
  return out;
}

function walkFiles(dir, base = dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, list);
    else list.push({ full, rel: path.relative(base, full) });
  }
  return list;
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      emptyDir(full);
      fs.rmdirSync(full);
    } else fs.unlinkSync(full);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.slot || args.slot < 1 || args.slot > 150 || !args.from) {
    console.error("Usage: node scripts/install-game.js --slot N --from <dir|zip> [--keep]");
    process.exit(1);
  }

  let src = path.resolve(args.from);
  let tmp = null;

  if (src.endsWith(".zip") && fs.existsSync(src) && fs.statSync(src).isFile()) {
    tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "edu-game-"));
    try {
      execSync(`unzip -q -o ${JSON.stringify(src)} -d ${JSON.stringify(tmp)}`, { stdio: "inherit" });
    } catch {
      console.error("Gagal unzip. Pastikan perintah unzip tersedia.");
      process.exit(1);
    }
    const kids = fs.readdirSync(tmp).filter((n) => !n.startsWith("."));
    if (kids.length === 1 && fs.statSync(path.join(tmp, kids[0])).isDirectory()) {
      src = path.join(tmp, kids[0]);
    } else src = tmp;
  }

  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    console.error("Sumber tidak ditemukan atau bukan folder:", src);
    process.exit(1);
  }

  const files = walkFiles(src);
  const oversized = files.filter((f) => fs.statSync(f.full).size > MAX);
  if (oversized.length) {
    console.error("File melebihi 25 MB:");
    oversized.forEach((f) =>
      console.error(" -", f.rel, (fs.statSync(f.full).size / 1024 / 1024).toFixed(2) + " MB"),
    );
    process.exit(1);
  }

  if (!files.some((f) => f.rel === "index.html")) {
    const nested = files.find((f) => /^[^/]+\/index\.html$/.test(f.rel));
    if (nested) console.warn("index.html ada di subfolder:", nested.rel);
    else {
      console.error("Tidak ada index.html di paket sumber.");
      process.exit(1);
    }
  }

  const dest = path.join(root, `game-${args.slot}`);
  if (!args.keep) emptyDir(dest);
  fs.mkdirSync(dest, { recursive: true });

  for (const f of files) {
    const target = path.join(dest, f.rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(f.full, target);
  }

  if (tmp) {
    try { emptyDir(tmp); fs.rmdirSync(tmp); } catch (_) {}
  }

  console.log(`OK: ${files.length} file → game-${args.slot}/`);
  console.log(`Preview: /game-${args.slot}/`);
  console.log("Lanjut: npm run prepare-deploy && git add game-" + args.slot + " && git commit && git push");
}

main();
