import { kvEnabled } from "../../lib/store/kv.js";
import { harvestBoards, readHallOfFame, lastHarvestMs } from "../../lib/whales/hof.js";

// The persistent all-time Hall of Fame of profitable Polymarket wallets.
// Reads the accumulated roster from KV (grows past Polymarket's top-50 cap),
// and piggybacks a rate-limited harvest on organic traffic so the list keeps
// filling in even between cron runs. Falls back to the live top-50 when KV
// isn't connected yet.
const HARVEST_EVERY_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));

  try {
    let harvest = null;
    if (kvEnabled && Date.now() - (await lastHarvestMs()) > HARVEST_EVERY_MS) {
      try {
        harvest = await harvestBoards();
      } catch {
        /* best-effort — never block the read */
      }
    }

    const data = await readHallOfFame(limit);
    res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");
    res.status(200).json({
      mode: data.persistent ? "persistent" : "live-fallback",
      persistent: data.persistent,
      total_tracked: data.total_tracked,
      wallets: data.wallets,
      harvest,
      note: data.persistent
        ? undefined
        : "Live top-50 fallback. Connect Vercel KV to grow past Polymarket's cap and record history.",
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "hall_of_fame_failed", detail: String(err?.message || err) });
  }
}
