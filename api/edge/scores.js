import { computeScores, buildHeatMap } from "../../lib/edge/score.js";

// The Divergence Radar endpoint. Joins active markets with chatter heat,
// computes money/mouth/divergence scores, returns sorted by divergence.
//
// This is the API behind /edge.html — the "Edge" product made tangible.
// Edge-cached 30s (vercel.json).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const minDivergence = Math.max(0, Number(url.searchParams.get("min_div")) || 0);

  // Same-origin fan-out keeps everything in-cluster; let Vercel's edge cache
  // serve repeat callers.
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.connection?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  try {
    const [marketsR, buzzR] = await Promise.all([
      fetch(`${base}/api/markets`).then((r) => r.json()),
      fetch(`${base}/api/buzz/markets?limit=50`).then((r) => r.json()),
    ]);

    const markets = Array.isArray(marketsR.markets) ? marketsR.markets : [];
    const heat = buildHeatMap(Array.isArray(buzzR.markets) ? buzzR.markets : []);
    const scored = computeScores(markets, heat);

    // Active Calls — only true edges: real signal on BOTH money and mouth
    // sides, with directional divergence. Filtering on edge_call so
    // QUIET FLOW / LOUD ROOM / NO SIGNAL / ALIGNED don't pollute the picks.
    const activeCalls = scored
      .filter((s) => s.edge_call === "INSIDER FLOW" || s.edge_call === "FRONT-RUNNING")
      .sort((a, b) => b.divergence - a.divergence)
      .slice(0, 10);

    // Full sorted list
    const all = scored
      .filter((s) => s.divergence >= minDivergence)
      .sort((a, b) => b.divergence - a.divergence)
      .slice(0, limit);

    const stats = {
      markets_analyzed: markets.length,
      with_chatter: scored.filter((s) => s.chatter).length,
      active_calls: activeCalls.length,
      insider_flow_count: scored.filter((s) => s.edge_call === "INSIDER FLOW").length,
      front_running_count: scored.filter((s) => s.edge_call === "FRONT-RUNNING").length,
      aligned_count: scored.filter((s) => s.edge_call === "ALIGNED").length,
      median_divergence: median(scored.map((s) => s.divergence)),
      max_divergence: scored.length ? Math.max(...scored.map((s) => s.divergence)) : 0,
    };

    res.status(200).json({
      active_calls: activeCalls,
      markets: all,
      stats,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: "score_failed",
      detail: String(err?.message || err),
    });
  }
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
