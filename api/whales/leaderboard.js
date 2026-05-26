import { fetchTrades, fetchValue, tradeUsd } from "../../lib/whales/polymarket-data.js";

// Active-whale leaderboard. Aggregates the most recent N trades by wallet,
// then enriches the top M whales with their current portfolio value.
// Edge-cached for 60s (vercel.json).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const window = Math.min(500, Math.max(50, Number(url.searchParams.get("window")) || 500));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const enrich = Math.min(limit, 25); // cap parallel /value calls

  try {
    const raw = await fetchTrades({ limit: window });
    const trades = Array.isArray(raw) ? raw : [];

    const byWallet = new Map();
    for (const t of trades) {
      const w = t.proxyWallet;
      if (!w) continue;
      const usd = tradeUsd(t);
      if (!byWallet.has(w)) {
        byWallet.set(w, {
          wallet: w,
          name: t.name || null,
          pseudonym: t.pseudonym || null,
          profile_image: t.profileImageOptimized || t.profileImage || null,
          bio: t.bio || null,
          total_usd: 0,
          trade_count: 0,
          biggest_usd: 0,
          biggest_trade: null,
          last_trade_ts: 0,
          last_market: null,
          markets: new Set(),
        });
      }
      const w0 = byWallet.get(w);
      w0.total_usd += usd;
      w0.trade_count += 1;
      if (usd > w0.biggest_usd) {
        w0.biggest_usd = usd;
        w0.biggest_trade = {
          side: t.side,
          outcome: t.outcome,
          usd,
          price: Number(t.price) || 0,
          market_title: t.title,
          market_slug: t.slug,
          timestamp: t.timestamp,
        };
      }
      if (t.timestamp > w0.last_trade_ts) {
        w0.last_trade_ts = t.timestamp;
        w0.last_market = t.title;
      }
      if (t.conditionId) w0.markets.add(t.conditionId);
    }

    let ranked = [...byWallet.values()]
      .map((w) => ({
        ...w,
        unique_markets: w.markets.size,
        markets: undefined,
      }))
      .sort((a, b) => b.total_usd - a.total_usd)
      .slice(0, limit);

    // Enrich top whales with current portfolio value in parallel
    const top = ranked.slice(0, enrich);
    const values = await Promise.allSettled(top.map((w) => fetchValue(w.wallet)));
    top.forEach((w, i) => {
      w.portfolio_usd =
        values[i].status === "fulfilled" ? Number(values[i].value) || 0 : null;
    });

    res.status(200).json({
      whales: ranked,
      window_size: window,
      total_active_wallets: byWallet.size,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "upstream_failed", detail: String(err?.message || err) });
  }
}
