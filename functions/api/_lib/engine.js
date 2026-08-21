/** Simple slot engine — symbols, spin, payout (virtual points only) */

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

export function drawReels(symbolList = DEFAULT_SYMBOLS, reelCount = 3) {
  const values = new Uint32Array(reelCount);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => symbolList[v % symbolList.length]);
}

/**
 * Calculate payout for 3-reel style.
 * - 3 same = paytable multiplier
 * - 2 same = 2x bet
 * - wild substitutes for non-scatter
 */
export function calculatePayout(symbols, bet, paytable = DEFAULT_PAYTABLE) {
  if (!Array.isArray(symbols) || symbols.length < 3) {
    return { win: 0, multiplier: 0, type: "none" };
  }

  const [a, b, c] = symbols;
  const isWild = (s) => s === "wild";

  // All three equal (or wild substitute)
  const allSame =
    (a === b && b === c) ||
    (isWild(a) && b === c) ||
    (isWild(b) && a === c) ||
    (isWild(c) && a === b) ||
    (isWild(a) && isWild(b)) ||
    (isWild(b) && isWild(c)) ||
    (isWild(a) && isWild(c));

  if (allSame) {
    const base =
      (!isWild(a) && a) ||
      (!isWild(b) && b) ||
      (!isWild(c) && c) ||
      "wild";
    const mult = paytable[base] ?? 3;
    return { win: bet * mult, multiplier: mult, type: "triple", symbol: base };
  }

  // Any two match
  if (a === b || b === c || a === c || isWild(a) || isWild(b) || isWild(c)) {
    return { win: bet * 2, multiplier: 2, type: "pair" };
  }

  return { win: 0, multiplier: 0, type: "none" };
}

export function buildSpinResult({ symbols, bet, payout, gameId, sessionId }) {
  return {
    symbols,
    bet,
    win: payout.win,
    net: payout.win - bet,
    multiplier: payout.multiplier,
    type: payout.type,
    game_id: gameId,
    session_id: sessionId,
    ts: new Date().toISOString(),
  };
}

export { DEFAULT_SYMBOLS, DEFAULT_PAYTABLE };
