#!/usr/bin/env node
/**
 * Install extracted game into game-N/ + permanent EDU API patch.
 *
 * Usage:
 *   node scripts/install-game.js --slot 12 --from ./extracted
 *   node scripts/install-game.js --slot 12 --from ./game.zip
 *   node scripts/install-game.js --slot 12 --from ./extracted --origin https://ea29118c.edu-network.pages.dev
 *   node scripts/install-game.js --slot 12 --from ./extracted --domain https://old-provider.com
 *   node scripts/install-game.js --slot 12 --from ./extracted --no-patch   # raw only
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { patchGameDir, DEFAULT_ORIGIN } = require("./lib-patch-game.js");

const MAX = 25 * 1024 * 1024;
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    slot: null,
    from: null,
    keep: false,
    noPatch: false,
    origin: DEFAULT_ORIGIN,
    domains: [],
    name: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slot") out.slot = Number(argv[++i]);
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--keep") out.keep = true;
    else if (a === "--no-patch") out.noPatch = true;
    else if (a === "--origin") out.origin = argv[++i];
    else if (a === "--domain") out.domains.push(argv[++i]);
    else if (a === "--name") out.name = argv[++i];
  }
  return out;
}

function guessNameFromSource(src, fromArg) {
  const base = path.basename(fromArg || src).replace(/\.zip$/i, "");
  const cleaned = base
    .replace(/^game-?\d+[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return null;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function writeMeta(dest, { slot, name, origin }) {
  const meta = {
    slot: slot,
    game_id: "game-" + slot,
    title: name || ("Game " + slot),
    origin: origin,
    patched_at: new Date().toISOString(),
    published: true,
  };
  fs.writeFileSync(path.join(dest, "edu-meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
  return meta;
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
    console.error("Usage: node scripts/install-game.js --slot N --from <dir|zip> [--name \"Nama Game\"] [--origin URL] [--domain OLD_URL] [--no-patch] [--keep]");
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
    try {
      emptyDir(tmp);
      fs.rmdirSync(tmp);
    } catch (_) {}
  }

  console.log(`Copied: ${files.length} file → game-${args.slot}/`);

  const displayName = args.name || guessNameFromSource(src, args.from) || ("Game " + args.slot);
  const meta = writeMeta(dest, { slot: args.slot, name: displayName, origin: args.origin.replace(/\/$/, "") });
  console.log(`Nama publik: ${meta.title} (slot admin: ${meta.slot})`);


  if (!args.noPatch) {
    const gameId = `game-${args.slot}`;
    const stats = patchGameDir(dest, {
      gameId,
      eduOrigin: args.origin.replace(/\/$/, ""),
      extraDomains: args.domains,
    });
    console.log(`Permanent patch: ${stats.filesPatched} file diubah, ${stats.htmlInjected} HTML inject SDK`);
    console.log(`API origin: ${args.origin}`);
  } else {
    console.log("Skip patch (--no-patch). File tetap mentah; andalkan middleware on-the-fly.");
  }

  console.log(`Preview: /game-${args.slot}/`);
  console.log("Lanjut: npm run prepare-deploy && git add game-" + args.slot + " && git commit && git push");
}

main();
