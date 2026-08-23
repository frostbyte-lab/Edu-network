#!/usr/bin/env node
/**
 * Permanent re-patch existing game-N/ (tanpa re-upload).
 *
 *   node scripts/patch-game.js --slot 12
 *   node scripts/patch-game.js --slot 12 --domain https://old-api.example.com
 *   node scripts/patch-game.js --all
 */
const fs = require("node:fs");
const path = require("node:path");
const { patchGameDir, DEFAULT_ORIGIN } = require("./lib-patch-game.js");

const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { slot: null, all: false, origin: DEFAULT_ORIGIN, domains: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slot") out.slot = Number(argv[++i]);
    else if (a === "--all") out.all = true;
    else if (a === "--origin") out.origin = argv[++i];
    else if (a === "--domain") out.domains.push(argv[++i]);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const origin = args.origin.replace(/\/$/, "");
  const slots = [];

  if (args.all) {
    for (const name of fs.readdirSync(root)) {
      const m = name.match(/^game-(\d{1,3})$/);
      if (m) slots.push(Number(m[1]));
    }
    slots.sort((a, b) => a - b);
  } else if (args.slot >= 1 && args.slot <= 150) {
    slots.push(args.slot);
  } else {
    console.error("Usage: node scripts/patch-game.js --slot N | --all [--origin URL] [--domain OLD]");
    process.exit(1);
  }

  let total = 0;
  for (const n of slots) {
    const dest = path.join(root, `game-${n}`);
    if (!fs.existsSync(dest)) {
      console.warn(`Skip game-${n}: folder tidak ada`);
      continue;
    }
    const stats = patchGameDir(dest, {
      gameId: `game-${n}`,
      eduOrigin: origin,
      extraDomains: args.domains,
    });
    console.log(`game-${n}: ${stats.filesPatched} file, ${stats.htmlInjected} HTML inject`);
    total += stats.filesPatched;
  }
  console.log(`Selesai. Total file di-patch: ${total}`);
  console.log("Commit & push agar download dari Pages/Git sudah berisi API custom.");
}

main();
