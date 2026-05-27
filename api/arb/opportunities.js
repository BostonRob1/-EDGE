import { matchPairs } from "../../lib/arb/match.js";
import { computeArb } from "../../lib/arb/compute.js";

// Cross-platform Polymarket ↔ Kalshi arbitrage scanner.
//
// Flow:
//   1. Same-origin fetch /api/markets (already aggregates both platforms)
//   2. Split by source
//   3. Match Poly ↔ Kalshi pairs via token overlap + date alignment
//   4. For each pair, compute fee-adjusted edge
//   5. Surface pairs where edge survives fees
//
// Edge cache 30s (vercel.json) — arbs evaporate in minutes during news
// events, so we don't want stale-but-cached data. 30s is a sane compromise
// between freshness and not hammering upstream.
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const minEdgeParam = url.searchParams.get("min_edge");
  const minEdge =
    minEdgeParam != null && Number.isFinite(Number(minEdgeParam))
      ? Math.max(0, Number(minEdgeParam))
      : 0.5;
  const feeBufferParam = url.searchParams.get("fee_buffer");
  const feeBuffer =
    feeBufferParam != null && Number.isFinite(Number(feeBufferParam))
      ? Math.max(0, Math.min(0.1, Number(feeBufferParam)))
      : 0.02;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.connection?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  try {
    const marketsRes = await fetch(`${base}/api/markets`);
    if (!marketsRes.ok) throw new Error(`markets ${marketsRes.status}`);
    const data = await marketsRes.json();
    const all = Array.isArray(data.markets) ? data.markets : [];

    const poly = all.filter((m) => m.source === "polymarket");
    const kalshi = all.filter((m) => m.source === "kalshi");

    const pairs = matchPairs(poly, kalshi);

    const opportunities = pairs
      .map((p) => {
        const arb = computeArb(p.poly, p.kalshi, { feeBuffer });
        if (!arb) return null;
        // Don't surface arbs that are barely above the user's threshold
        if (arb.fee_adj_edge_pp < minEdge) return null;
        return {
          match_score: p.match_score,
          ...arb,
          poly_market: {
            title: p.poly.title,
            link: p.poly.link,
            yes_price: p.poly.yes_price,
            no_price: p.poly.no_price,
            volume_24h: p.poly.volume_24h,
            category: p.poly.category,
            end_date: p.poly.end_date,
          },
          kalshi_market: {
            title: p.kalshi.title,
            link: p.kalshi.link,
            yes_price: p.kalshi.yes_price,
            no_price: p.kalshi.no_price,
            volume_24h: p.kalshi.volume_24h,
            category: p.kalshi.category,
            end_date: p.kalshi.end_date,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.fee_adj_edge_pp - a.fee_adj_edge_pp)
      .slice(0, limit);

    const stats = {
      poly_markets: poly.length,
      kalshi_markets: kalshi.length,
      pairs_matched: pairs.length,
      opportunities_found: opportunities.length,
      biggest_edge_pp: opportunities[0]?.fee_adj_edge_pp || 0,
      fee_buffer_pp: Math.round(feeBuffer * 1000) / 10, // for display
      min_edge_pp: minEdge,
    };

    res.status(200).json({
      opportunities,
      stats,
      disclaimer:
        "Implied edge based on quoted prices. Slippage on $500+ stakes is real; actual fills may differ. Kalshi requires US KYC; not all users can execute both legs.",
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: "arb_scan_failed",
      detail: String(err?.message || err),
    });
  }
}
