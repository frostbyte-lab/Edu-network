/**
 * GET /api/game/health
 * Quick health check for Game API + D1.
 */
import { ok, err, corsPreflight } from "../_lib/response.js";
import { requireDb } from "../_lib/db.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet({ env }) {
  const { db, error, status } = requireDb(env);
  if (error) return err(error, status);

  try {
    const row = await db.prepare(`SELECT 1 AS ok`).first();
    let tables = [];
    try {
      const t = await db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'game_%' ORDER BY name`
        )
        .all();
      tables = (t.results || []).map((r) => r.name);
    } catch {
      tables = [];
    }

    return ok({
      service: "edu-network-game-api",
      db: row?.ok === 1 ? "up" : "unknown",
      tables,
      endpoints: [
        "/api/game/config",
        "/api/game/init",
        "/api/game/session",
        "/api/game/balance",
        "/api/game/bet",
        "/api/game/spin",
        "/api/game/result",
        "/api/game/history",
        "/api/game/collect",
        "/api/game/bonus",
        "/api/game/health",
      ],
      connected_to: {
        github: "https://github.com/frostbyte-lab/Edu-network",
        live: "https://ea29118c.edu-network.pages.dev/",
      },
    });
  } catch (e) {
    return err("DB health check failed", 500);
  }
}
