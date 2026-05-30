import { matchWinners } from "../../lib/arb/match.js";
import { computeArb } from "../../lib/arb/compute.js";
import { fetchCrossPlatform } from "../../lib/arb/fetch.js";

// Cross-platform Polymarket ↔ Kalshi radar.
//
// Reality check baked into this endpoint: clean risk-free arbs between the two
// platforms are rare because they rarely list identically-settling contracts.
// So we surface TWO tiers, honestly labelled:
//   • DIVERGENCE — the same underlying question priced differently on each
//     platform. A research edge, not free money. Always the bulk of signal.
//   • ARB        — a divergence where the contracts genuinely align (same
//     threshold, comparable window) AND the gap survives fees. Rare; flagged.
//
// The matcher (lib/arb/match.js) is precision-first: it would rather return
// nothing than pair a Polymarket barrier bet to a Kalshi point-in-time strike.
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const feeBuffer = clampNum(url.searchParams.get("fee_buffer"), 0.02, 0, 0.1);
  const minDivergence = clampNum(url.searchParams.get("min_divergence"), 0, 0, 1); // pp/100
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 24));

  try {
    // Candidate/strike-level cross-platform surface (see lib/arb/fetch.js) —
    // this is what makes Poly "Will X win 2028?" pair with Kalshi "2028 — X".
    const { poly, kalshi } = await fetchCrossPlatform();

    const pairs = matchWinners(poly, kalshi);

    const signals = pairs
      .map((p) => {
        const P = Number(p.poly.yes_price);
        const K = Number(p.kalshi.yes_price);
        if (!Number.isFinite(P) || !Number.isFinite(K)) return null;
        const divergencePp = round(Math.abs(P - K) * 100);
        if (divergencePp < minDivergence * 100) return null;

        // Is this a genuine executable arb, not just a price gap?
        const arb =
          p.same_threshold && (p.window === "same" || p.window === "near")
            ? computeArb(p.poly, p.kalshi, { feeBuffer })
            : null;

        return {
          type: arb ? "ARB" : "DIVERGENCE",
          divergence_pp: divergencePp,
          match_score: p.match_score,
          window: p.window, // same | near | unknown
          same_threshold: p.same_threshold,
          poly: side(p.poly, P),
          kalshi: side(p.kalshi, K),
          arb: arb
            ? {
                fee_adj_edge_pp: arb.fee_adj_edge_pp,
                roi_pct_after_fees: arb.roi_pct_after_fees,
                confidence: arb.confidence,
                leg_poly: arb.leg_poly,
                leg_kalshi: arb.leg_kalshi,
              }
            : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Arbs first, then by divergence size.
        if ((a.type === "ARB") !== (b.type === "ARB")) return a.type === "ARB" ? -1 : 1;
        return b.divergence_pp - a.divergence_pp;
      })
      .slice(0, limit);

    const arbs = signals.filter((s) => s.type === "ARB");
    const stats = {
      poly_markets: poly.length,
      kalshi_markets: kalshi.length,
      pairs_matched: pairs.length,
      divergences_found: signals.length,
      arbs_found: arbs.length,
      biggest_divergence_pp: signals[0]?.divergence_pp || 0,
      biggest_arb_edge_pp: arbs[0]?.arb?.fee_adj_edge_pp || 0,
      fee_buffer_pp: round(feeBuffer * 100),
      categories: categoryBreakdown(kalshi),
    };

    // Always-on cross-platform landscape: the hottest live markets on each
    // platform side by side. Keeps the radar valuable even when no two
    // contracts align — and showcases what's actually trading.
    const byVol = (a, b) => (b.volume_24h || 0) - (a.volume_24h || 0);
    const landscape = {
      polymarket: [...poly].sort(byVol).slice(0, 8).map(lite),
      kalshi: [...kalshi].sort(byVol).slice(0, 8).map(lite),
    };

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({
      signals,
      landscape,
      stats,
      disclaimer:
        "DIVERGENCE = same question, different price across platforms — a research edge, not risk-free money. ARB = contracts genuinely align and the gap clears fees; verify settlement terms before executing. Kalshi requires US KYC.",
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "arb_scan_failed", detail: String(err?.message || err) });
  }
}

function lite(m) {
  return {
    title: m.title,
    yes_price: round(Number(m.yes_price) || 0),
    volume_24h: m.volume_24h || 0,
    category: m.category || "",
    link: m.link || null,
  };
}

function side(m, yes) {
  return {
    title: m.title,
    link: m.link,
    yes_price: round(yes),
    no_price: round(1 - yes),
    volume_24h: m.volume_24h,
    category: m.category,
    end_date: m.end_date,
  };
}

function categoryBreakdown(markets) {
  const c = {};
  for (const m of markets) {
    const k = (m.category || "Other").toString();
    c[k] = (c[k] || 0) + 1;
  }
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, n]) => ({ name, n }));
}

function clampNum(v, dflt, lo, hi) {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}
function round(n) {
  return Math.round(n * 100) / 100;
}
