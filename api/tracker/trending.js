import { fetchDexScreener, fetchDexScreenerBoosts } from "../../lib/tracker/dexscreener.js";

// Combines DexScreener's "top boosts" list (which tells us WHICH tokens are
// being promoted hardest right now) with full per-token lookups for the top N
// so the UI can render real price + liquidity + age data.
export default async function handler(req, res) {
  try {
    const boosts = await fetchDexScreenerBoosts();
    const filtered = boosts
      .filter((b) => b.chainId === "solana" || b.chainId === "ethereum")
      .slice(0, 18);

    const enriched = await Promise.all(
      filtered.map(async (b) => {
        try {
          const dex = await fetchDexScreener(b.tokenAddress);
          if (!dex.found) return null;
          return {
            address: b.tokenAddress,
            chain: b.chainId,
            name: dex.name,
            symbol: dex.symbol,
            icon: b.icon || dex.info?.imageUrl || null,
            description: b.description ? String(b.description).slice(0, 140) : null,
            price_usd: dex.price_usd,
            liquidity_usd: dex.liquidity_usd,
            volume_24h: dex.volume_24h,
            volume_1h: dex.volume_1h,
            price_change_24h: dex.price_change_24h,
            price_change_1h: dex.price_change_1h,
            pair_created_at: dex.pair_created_at,
            pair_age_hours: dex.pair_created_at
              ? (Date.now() - dex.pair_created_at) / 3_600_000
              : null,
            pair_url: dex.pair_url,
            boost_amount: b.amount || 0,
            boost_total: b.totalAmount || 0,
          };
        } catch {
          return null;
        }
      })
    );

    const items = enriched.filter(Boolean).sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));

    res.status(200).json({
      items,
      counts: {
        solana: items.filter((i) => i.chain === "solana").length,
        ethereum: items.filter((i) => i.chain === "ethereum").length,
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: "upstream_failed",
      detail: String(err?.message || err),
    });
  }
}
