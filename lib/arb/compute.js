// Cross-platform arb math.
//
// Risk-free arbitrage exists when you can pay LESS than $1 to lock in a $1
// payout regardless of outcome.
//
//   Buy YES on platform A at price P → pays $1 if YES, $0 if NO
//   Buy NO  on platform B at price (1−K) → pays $0 if YES, $1 if NO
//   Total cost: P + (1 − K)
//   Guaranteed payout: $1
//   Profit: 1 − P − (1 − K) = K − P  (only if K > P)
//
// The mirror direction works when P > K (buy NO on A + YES on B).
//
// Fees: Polymarket has minimal trading fees (estimate ~0.5% all-in including
// USDC frictions). Kalshi charges a per-contract fee that's roughly 1-7% of
// gross profit depending on market. We use a conservative blended buffer of
// 2.0% by default so v0 doesn't show ghost arbs that evaporate at execution.
//
// IMPORTANT: This is "implied edge based on quoted prices." Execution at $1k+
// stakes will have slippage. The UI surfaces this caveat prominently.

const DEFAULT_FEE_BUFFER = 0.02; // 2 percentage points
const MIN_EDGE_TO_SURFACE = 0.005; // 0.5pp after fees — below this is noise
// Sanity cap: real arbs in liquid prediction markets max out around 5-8%
// during news events. Edges above this are almost certainly matching errors
// (e.g. a binary "Will Trump pardon X?" matched to a multi-outcome "Who will
// Trump pardon?"). Surfacing them invites users into trades that aren't
// actually risk-free. Filter them out at v0 — better to miss the occasional
// real large arb than to lie.
const MAX_REASONABLE_EDGE = 0.12; // 12pp after fees
// Lower threshold for "high confidence" badge in UI — under 5% is what real
// arbs look like 95% of the time.
const HIGH_CONFIDENCE_EDGE = 0.05;

/**
 * Given a matched (poly, kalshi) pair, compute the arb opportunity if any.
 * Returns null when no fee-adjusted edge exists.
 */
export function computeArb(poly, kalshi, { feeBuffer = DEFAULT_FEE_BUFFER } = {}) {
  const P = Number(poly?.yes_price);
  const K = Number(kalshi?.yes_price);
  if (!Number.isFinite(P) || !Number.isFinite(K)) return null;
  if (P <= 0 || P >= 1 || K <= 0 || K >= 1) return null;

  const rawEdge = Math.abs(K - P);
  const feeAdjEdge = rawEdge - feeBuffer;
  if (feeAdjEdge < MIN_EDGE_TO_SURFACE) return null;
  // Drop "too good to be true" — almost always a matcher mismatch.
  if (feeAdjEdge > MAX_REASONABLE_EDGE) return null;

  // Direction
  const polyOverK = P > K; // Polymarket prices YES higher than Kalshi
  const directionLabel = polyOverK ? "poly_no_kalshi_yes" : "poly_yes_kalshi_no";

  // Leg construction — each "leg" is the cost per $1 of guaranteed payout
  let legPoly, legKalshi;
  if (polyOverK) {
    legPoly = {
      platform: "polymarket",
      side: "NO",
      price: round(1 - P),
      market_title: poly.title,
      market_link: poly.link,
      volume_24h: poly.volume_24h,
      liquidity: poly.liquidity,
    };
    legKalshi = {
      platform: "kalshi",
      side: "YES",
      price: round(K),
      market_title: kalshi.title,
      market_link: kalshi.link,
      volume_24h: kalshi.volume_24h,
      liquidity: kalshi.liquidity,
    };
  } else {
    legPoly = {
      platform: "polymarket",
      side: "YES",
      price: round(P),
      market_title: poly.title,
      market_link: poly.link,
      volume_24h: poly.volume_24h,
      liquidity: poly.liquidity,
    };
    legKalshi = {
      platform: "kalshi",
      side: "NO",
      price: round(1 - K),
      market_title: kalshi.title,
      market_link: kalshi.link,
      volume_24h: kalshi.volume_24h,
      liquidity: kalshi.liquidity,
    };
  }

  // Total capital per $1 of guaranteed payout — should be < $1 to be an arb.
  const costPerDollar = legPoly.price + legKalshi.price;
  // ROI as % of deployed capital — what the user actually cares about.
  const roiAfterFees = (1 - feeBuffer - costPerDollar) / costPerDollar;

  // Confidence tier — drives UI color and verification urgency
  const confidence =
    feeAdjEdge <= HIGH_CONFIDENCE_EDGE
      ? "HIGH"
      : feeAdjEdge <= 0.08
      ? "MEDIUM"
      : "VERIFY";

  return {
    direction: directionLabel,
    raw_edge_pp: round(rawEdge * 100),
    fee_buffer_pp: round(feeBuffer * 100),
    fee_adj_edge_pp: round(feeAdjEdge * 100),
    cost_per_dollar: round(costPerDollar),
    roi_pct_after_fees: round(roiAfterFees * 100),
    profit_per_100_capital: round((feeAdjEdge / costPerDollar) * 100),
    confidence,
    leg_poly: legPoly,
    leg_kalshi: legKalshi,
    // Min volume across legs — smaller-liquidity side will gate executable size
    min_volume_24h: Math.min(poly.volume_24h || 0, kalshi.volume_24h || 0),
    poly_yes_price: round(P),
    kalshi_yes_price: round(K),
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
