import { fetchTrades, tradeUsd } from "../../lib/whales/polymarket-data.js";

// Live whale-trade firehose. Polymarket doesn't support a server-side min-size
// filter, so we pull a wide window and filter here. Caches at the edge for 20s
// (see vercel.json headers for /api/*).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const min = Math.max(0, Number(url.searchParams.get("min")) || 5000);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 40));

  try {
    const raw = await fetchTrades({ limit: 500 });
    const trades = (Array.isArray(raw) ? raw : [])
      .map((t) => ({
        wallet: t.proxyWallet,
        name: t.name || null,
        pseudonym: t.pseudonym || null,
        profile_image: t.profileImageOptimized || t.profileImage || null,
        bio: t.bio || null,
        side: t.side,
        outcome: t.outcome,
        outcome_index: t.outcomeIndex,
        size: Number(t.size) || 0,
        price: Number(t.price) || 0,
        usd: tradeUsd(t),
        timestamp: t.timestamp,
        market_title: t.title,
        market_slug: t.slug,
        event_slug: t.eventSlug,
        icon: t.icon,
        condition_id: t.conditionId,
        asset: t.asset,
        tx_hash: t.transactionHash,
      }))
      .filter((t) => t.usd >= min)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    res.status(200).json({
      trades,
      threshold_usd: min,
      window_size: 500,
      returned: trades.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "upstream_failed", detail: String(err?.message || err) });
  }
}
