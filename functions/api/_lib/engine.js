/** Simple slot engine — symbols, spin, payout (virtual points only)
 *
 * RNG level (1|2|3):
 *  1 = down   — bias kalah (lebih sering lose, payout dipangkas)
 *  2 = imbang — fair crypto random
 *  3 = menang — bias menang (lebih sering pair/triple, payout sedikit naik)
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

/** Normalize rng level to 1|2|3 */
export function normalizeRngLevel(value, fallback = 2) {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3) return n;
  return fallback;
}

function cryptoUnit() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296; // [0, 1)
}

/**
 * Biased unit random based on rng level.
 * 1 down: skew low; 3 win: skew high; 2 fair.
 */
export function biasedRandom(rngLevel = 2) {
  const x = cryptoUnit();
  const lv = normalizeRngLevel(rngLevel, 2);
  if (lv === 1) return x * x; // more low values
  if (lv === 3) return Math.sqrt(x); // more high values
  return x;
}

/**
 * Draw reels with optional RNG bias.
 * Level 1: higher chance of mismatched symbols
 * Level 3: higher chance of matching symbols
 */
export function drawReels(symbolList = DEFAULT_SYMBOLS, reelCount = 3, rngLevel = 2) {
  const list = Array.isArray(symbolList) && symbolList.length ? symbolList : DEFAULT_SYMBOLS;
  const lv = normalizeRngLevel(rngLevel, 2);
  const symbols = [];

  for (let i = 0; i < reelCount; i++) {
    if (i > 0 && lv !== 2) {
      const forceMatch = lv === 3 ? biasedRandom(3) > 0.45 : biasedRandom(1) > 0.82;
      const forceMismatch = lv === 1 ? biasedRandom(1) < 0.55 : false;
      if (lv === 3 && forceMatch) {
        symbols.push(symbols[0]);
        continue;
      }
      if (lv === 1 && forceMismatch) {
        // pick different from first when possible
        const others = list.filter((s) => s !== symbols[0]);
        const pool = others.length ? others : list;
        const idx = Math.floor(biasedRandom(1) * pool.length) % pool.length;
        symbols.push(pool[idx]);
        continue;
      }
    }
    const idx = Math.floor(biasedRandom(lv) * list.length) % list.length;
    symbols.push(list[idx]);
  }
  return symbols;
}

/**
 * Calculate payout; apply soft multiplier by rng level.
 * Level 1: win * 0.7 (floor), level 3: win * 1.15 (ceil-ish)
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

export { DEFAULT_SYMBOLS, DEFAULT_PAYTABLE };
