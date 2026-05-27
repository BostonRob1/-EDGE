import { fetchTrades } from "../../lib/whales/polymarket-data.js";

// Per-market detail endpoint. Composes everything we know about a single
// market into one payload for /market.html?slug=… to render without further
// fan-out from the browser.
//
// Returns:
//   market   — basic info (title, odds, vol, end date, source)
//   whales   — recent large trades on this market (Polymarket only)
//   buzz     — chatter heat for this market if matched
//   edge     — Money/Mouth/Divergence score
//   affiliate— wrapped trade URLs with our referral codes (when set)
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug_required", detail: "Pass ?slug=<market-slug>" });
    return;
  }

  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.connection?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  try {
    const [marketsR, buzzR, edgeR] = await Promise.allSettled([
      fetch(`${base}/api/markets`).then((r) => r.json()),
      fetch(`${base}/api/buzz/markets?limit=50`).then((r) => r.json()),
      fetch(`${base}/api/edge/scores?limit=50`).then((r) => r.json()),
    ]);

    const allMarkets = marketsR.status === "fulfilled" ? marketsR.value?.markets || [] : [];
    const market = allMarkets.find((m) => m.slug === slug);

    if (!market) {
      res.status(404).json({ error: "market_not_found", slug });
      return;
    }

    // Buzz: find this market in the heat list (key is slug-or-title)
    const buzz =
      buzzR.status === "fulfilled"
        ? (buzzR.value?.markets || []).find(
            (b) => (b.slug || "").toLowerCase() === slug.toLowerCase()
          )
        : null;

    // Edge: same lookup
    const edge =
      edgeR.status === "fulfilled"
        ? (edgeR.value?.markets || []).find(
            (e) => (e.slug || "").toLowerCase() === slug.toLowerCase()
          )
        : null;

    // Whales — only meaningful for Polymarket markets (Kalshi has no
    // wallet-level public data). Filter the global trades feed by this
    // market's conditionId.
    let whales = [];
    if (market.source === "polymarket" && market.id) {
      // market.id is "poly_<gamma-id>" but the conditionId we need is what
      // /api/markets has from upstream. We don't store it in the markets
      // response; instead, look up by clobTokenId via the trades feed.
      // For v0, pull recent trades and filter by title match — imprecise
      // but workable. v1 should index conditionId properly.
      try {
        const trades = await fetchTrades({ limit: 500 });
        const titleLower = (market.title || "").toLowerCase();
        whales = (Array.isArray(trades) ? trades : [])
          .filter((t) => (t.title || "").toLowerCase() === titleLower)
          .slice(0, 20)
          .map((t) => ({
            wallet: t.proxyWallet,
            name: t.name || null,
            profile_image: t.profileImageOptimized || t.profileImage || null,
            side: t.side,
            outcome: t.outcome,
            size: Number(t.size) || 0,
            price: Number(t.price) || 0,
            usd: (Number(t.size) || 0) * (Number(t.price) || 0),
            timestamp: t.timestamp,
            tx_hash: t.transactionHash,
          }))
          .sort((a, b) => b.usd - a.usd); // biggest first
      } catch {
        whales = [];
      }
    }

    // Affiliate wrap — placeholder until referral codes are wired into env.
    // When POLY_AFFILIATE_REF / KALSHI_AFFILIATE_REF are set, this becomes
    // the canonical trade URL we send users to.
    const affiliate = buildAffiliateLink(market);

    res.status(200).json({
      market: {
        id: market.id,
        source: market.source,
        title: market.title,
        slug: market.slug,
        category: market.category,
        yes_price: market.yes_price,
        no_price: market.no_price,
        volume_24h: market.volume_24h,
        total_volume: market.total_volume,
        liquidity: market.liquidity,
        end_date: market.end_date,
        price_change_24h: market.price_change_24h,
        link: market.link,
        image: market.image,
      },
      whales: {
        count: whales.length,
        trades: whales,
      },
      buzz: buzz
        ? {
            heat: buzz.heat,
            thread_count: buzz.thread_count,
            unique_sources: buzz.unique_sources,
            total_upvotes: buzz.total_upvotes,
            top_threads: buzz.top_threads,
          }
        : null,
      edge: edge
        ? {
            money_intensity: edge.money_intensity,
            mouth_intensity: edge.mouth_intensity,
            divergence: edge.divergence,
            edge_call: edge.edge_call,
            edge_thesis: edge.edge_thesis,
          }
        : null,
      affiliate,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: "market_detail_failed",
      detail: String(err?.message || err),
    });
  }
}

// Build the trade-on-platform URL with affiliate codes when configured.
// Currently passthrough until env vars exist.
function buildAffiliateLink(market) {
  if (!market?.link) return null;
  const polyRef = process.env.POLY_AFFILIATE_REF;
  const kalshiRef = process.env.KALSHI_AFFILIATE_REF;
  if (market.source === "polymarket") {
    if (polyRef) {
      const sep = market.link.includes("?") ? "&" : "?";
      return { url: `${market.link}${sep}ref=${encodeURIComponent(polyRef)}`, platform: "polymarket", has_ref: true };
    }
    return { url: market.link, platform: "polymarket", has_ref: false };
  }
  if (market.source === "kalshi") {
    if (kalshiRef) {
      const sep = market.link.includes("?") ? "&" : "?";
      return { url: `${market.link}${sep}referral=${encodeURIComponent(kalshiRef)}`, platform: "kalshi", has_ref: true };
    }
    return { url: market.link, platform: "kalshi", has_ref: false };
  }
  return { url: market.link, platform: market.source, has_ref: false };
}
