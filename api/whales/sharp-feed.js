import { kvEnabled } from "../../lib/store/kv.js";
import { readSharpFeed } from "../../lib/whales/sharp.js";

// Windowed history of sharp trades for the Sharp Alerts feed. Windows run from
// the minute (1m) up to 60d — all from OUR persisted, timestamped log, which is
// what makes real-time "what are the sharps doing right now" possible (and which
// Polymarket's API can't serve). Without KV this returns empty + a flag; the
// client then falls back to its live session feed.
const MINUTES = {
  "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60,
  "6h": 360, "12h": 720, "24h": 1440, "7d": 10080, "30d": 43200, "60d": 86400,
};

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const window = url.searchParams.get("window") || "24h";
  const minutes = MINUTES[window] || 1440;
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
    const trades = (await readSharpFeed(minutes * 60 * 1000, limit)) || [];
    res.setHeader("Cache-Control", "public, s-maxage=8, stale-while-revalidate=40");
    res.status(200).json({ persistent: true, window, count: trades.length, trades, fetched_at: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: "sharp_feed_failed", detail: String(err?.message || err) });
  }
}
