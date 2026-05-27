import { getStats, getSignup, getLeaderboard } from "../../lib/waitlist/storage.js";

// GET /api/waitlist/stats?wallet=… → { count, recent, persistence, you?, leaderboard }
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const wallet = url.searchParams.get("wallet")?.trim() || null;

  try {
    const [stats, leaderboard] = await Promise.all([
      getStats(),
      getLeaderboard(10),
    ]);

    let you = null;
    if (wallet) {
      const rec = await getSignup(wallet);
      if (rec) {
        you = {
          wallet: rec.wallet,
          position: rec.position,
          joined_at: rec.joined_at,
          predicted: Array.isArray(rec.predictions) && rec.predictions.length > 0,
          projected_score: rec.projected_score || 0,
        };
      }
    }

    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    res.status(200).json({
      ...stats,
      you,
      leaderboard,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "stats_failed", detail: String(err?.message || err) });
  }
}
