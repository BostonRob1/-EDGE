// DexScreener public API — no auth required.
// /latest/dex/tokens/{address} returns ALL pairs across all chains for the token.
// We pick the highest-liquidity pair as the canonical market.
const TOKENS_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const BOOSTS_URL = "https://api.dexscreener.com/token-boosts/top/v1";

export async function fetchDexScreener(address) {
  const r = await fetch(TOKENS_URL + encodeURIComponent(address), {
    headers: { "User-Agent": "edge-tracker/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`dexscreener ${r.status}`);
  const data = await r.json();
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  if (!pairs.length) return { found: false, pairs: [] };
  const best = [...pairs].sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
  const t = best.baseToken || {};
  return {
    found: true,
    name: t.name || null,
    symbol: t.symbol || null,
    chain: best.chainId || null,
    dex: best.dexId || null,
    pair_address: best.pairAddress || null,
    pair_url: best.url || null,
    price_usd: parseFloat(best.priceUsd) || null,
    price_native: parseFloat(best.priceNative) || null,
    liquidity_usd: best.liquidity?.usd || 0,
    volume_24h: best.volume?.h24 || 0,
    volume_6h: best.volume?.h6 || 0,
    volume_1h: best.volume?.h1 || 0,
    volume_5m: best.volume?.m5 || 0,
    price_change_24h: best.priceChange?.h24 || 0,
    price_change_6h: best.priceChange?.h6 || 0,
    price_change_1h: best.priceChange?.h1 || 0,
    price_change_5m: best.priceChange?.m5 || 0,
    txns_24h_buys: best.txns?.h24?.buys || 0,
    txns_24h_sells: best.txns?.h24?.sells || 0,
    txns_1h_buys: best.txns?.h1?.buys || 0,
    txns_1h_sells: best.txns?.h1?.sells || 0,
    fdv: best.fdv || null,
    market_cap: best.marketCap || null,
    pair_created_at: best.pairCreatedAt || null,
    pair_count: pairs.length,
    info: best.info || null,
  };
}

export async function fetchDexScreenerBoosts() {
  const r = await fetch(BOOSTS_URL, {
    headers: { "User-Agent": "edge-tracker/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`dexscreener-boosts ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
