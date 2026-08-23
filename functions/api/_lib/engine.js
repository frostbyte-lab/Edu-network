/** Simple slot engine — symbols, spin, payout (virtual points only)
 *
 * RNG level (1|2|3):
 *  1 = down   — target ~80% kalah (force mismatch), sisa 20% bisa menang (payout ×0.7)
 *  2 = imbang — fair crypto random
 *  3 = menang — bias menang (lebih sering match, payout ×1.15)
 */

const DEFAULT_SYMBOLS = ["cherry", "lemon", "bell", "star", "seven", "wild", "scatter"];

const DEFAULT_PAYTABLE = {
  cherry: 3,
  lemon: 3,
  bell: 5,
  star: 8,
  seven: 15,
  wild: 20,
  scatter: 0,
};

/** Level 1: probabilitas spin dipaksa kalah (tidak ada pair/triple) */
const LEVEL1_LOSE_RATE = 0.8;

export function normalizeRngLevel(value, fallback = 2) {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3) return n;
  return fallback;
}

function cryptoUnit() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

export function biasedRandom(rngLevel = 2) {
  const x = cryptoUnit();
  const lv = normalizeRngLevel(rngLevel, 2);
  if (lv === 1) return x * x;
  if (lv === 3) return Math.sqrt(x);
  return x;
}

function pickSymbol(list, rngLevel) {
  const idx = Math.floor(biasedRandom(rngLevel) * list.length) % list.length;
  return list[idx];
}

/** Paksa 3 simbol berbeda (tanpa pair) — hasil pasti kalah di paytable 3-reel */
function forceLoseSymbols(list) {
  const pool = list.length >= 3 ? list : DEFAULT_SYMBOLS;
  const a = pickSymbol(pool, 1);
  let b = pickSymbol(pool, 1);
  let guard = 0;
  while ((b === a || b === "wild") && guard++ < 20) b = pickSymbol(pool, 1);
  if (b === a) b = pool.find((s) => s !== a && s !== "wild") || pool[1] || a;

  let c = pickSymbol(pool, 1);
  guard = 0;
  while ((c === a || c === b || c === "wild") && guard++ < 20) c = pickSymbol(pool, 1);
  if (c === a || c === b) {
    c = pool.find((s) => s !== a && s !== b && s !== "wild") || pool[2] || c;
  }
  return [a, b, c];
}

/**
 * Draw reels with RNG bias.
 * Level 1: ~80% force lose (no matching symbols), 20% normal draw (masih bisa kalah alami)
 * Level 3: higher chance of matching symbols
 */
export function drawReels(symbolList = DEFAULT_SYMBOLS, reelCount = 3, rngLevel = 2) {
  const list = Array.isArray(symbolList) && symbolList.length ? symbolList : DEFAULT_SYMBOLS;
  const lv = normalizeRngLevel(rngLevel, 2);

  // Level 1 — 80% kalah dipaksa
  if (lv === 1 && reelCount >= 3 && cryptoUnit() < LEVEL1_LOSE_RATE) {
    return forceLoseSymbols(list).slice(0, reelCount);
  }

  const symbols = [];
  for (let i = 0; i < reelCount; i++) {
    if (i > 0 && lv === 3) {
      // ~55% chance copy first symbol → pair/triple lebih sering
      if (biasedRandom(3) > 0.45) {
        symbols.push(symbols[0]);
        continue;
      }
    }
    symbols.push(pickSymbol(list, lv));
  }
  return symbols;
}

/**
 * Calculate payout; level 1 trims wins ×0.7; level 3 boosts ×1.15
 */
export function calculatePayout(symbols, bet, paytable = DEFAULT_PAYTABLE, rngLevel = 2) {
  if (!Array.isArray(symbols) || symbols.length < 3) {
    return { win: 0, multiplier: 0, type: "none", rng_level: normalizeRngLevel(rngLevel) };
  }

  const lv = normalizeRngLevel(rngLevel, 2);
  const [a, b, c] = symbols;
  const isWild = (s) => s === "wild";

  const allSame =
    (a === b && b === c) ||
    (isWild(a) && b === c) ||
    (isWild(b) && a === c) ||
    (isWild(c) && a === b) ||
    (isWild(a) && isWild(b)) ||
    (isWild(b) && isWild(c)) ||
    (isWild(a) && isWild(c));

  let payout;
  if (allSame) {
    const base =
      (!isWild(a) && a) ||
      (!isWild(b) && b) ||
      (!isWild(c) && c) ||
      "wild";
    const mult = paytable[base] ?? 3;
    payout = { win: bet * mult, multiplier: mult, type: "triple", symbol: base };
  } else if (a === b || b === c || a === c || isWild(a) || isWild(b) || isWild(c)) {
    payout = { win: bet * 2, multiplier: 2, type: "pair" };
  } else {
    payout = { win: 0, multiplier: 0, type: "none" };
  }

  if (payout.win > 0 && lv !== 2) {
    const factor = lv === 1 ? 0.7 : 1.15;
    const adjusted = Math.max(0, Math.round(payout.win * factor));
    payout = {
      ...payout,
      win: adjusted,
      multiplier: bet > 0 ? adjusted / bet : payout.multiplier,
      raw_win: payout.win,
      rng_factor: factor,
    };
  }

  return { ...payout, rng_level: lv };
}

export function buildSpinResult({ symbols, bet, payout, gameId, sessionId, rngLevel }) {
  return {
    symbols,
    bet,
    win: payout.win,
    net: payout.win - bet,
    multiplier: payout.multiplier,
    type: payout.type,
    game_id: gameId,
    session_id: sessionId,
    rng_level: payout.rng_level ?? normalizeRngLevel(rngLevel, 2),
    ts: new Date().toISOString(),
  };
}

export { DEFAULT_SYMBOLS, DEFAULT_PAYTABLE, LEVEL1_LOSE_RATE };
