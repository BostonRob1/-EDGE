import { kvEnabled } from "../../lib/store/kv.js";
import { readSharpFeed } from "../../lib/whales/sharp.js";

// Windowed history of sharp trades for the Sharp Alerts feed. The granular
// windows (6h/12h/60d) come from OUR persisted log — Polymarket's API can't
// serve them. Without KV connected this returns empty + a flag; the client
// then falls back to its live session feed.
const HOURS = { "6h": 6, "12h": 12, "24h": 24, "7d": 168, "30d": 720, "60d": 1440 };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const window = url.searchParams.get("window") || "24h";
  const hours = HOURS[window] || 24;
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 300));

  try {
    if (!kvEnabled) {
      res.setHeader("Cache-Control", "public, s-maxage=10");
      return res.status(200).json({
        persistent: false,
        window,
        trades: [],
        note: "Live session only. Connect Vercel KV to store + replay sharp-trade history.",
      });
    }
    const trades = (await readSharpFeed(hours * 3600 * 1000, limit)) || [];
    res.setHeader("Cache-Control", "public, s-maxage=8, stale-while-revalidate=40");
    res.status(200).json({ persistent: true, window, count: trades.length, trades, fetched_at: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: "sharp_feed_failed", detail: String(err?.message || err) });
  }
}
