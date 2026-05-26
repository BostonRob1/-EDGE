// Pull active Polymarket markets from the Gamma API. Used by the buzz matcher
// to score "what market is this thread about?"
//
// Both buzz endpoints (feed + markets) need this list, and a single page load
// hits both. Without caching we'd fetch the same 200-market payload twice in
// quick succession. Module-level TTL cache dedupes within a serverless
// function lifetime; Vercel's edge cache (30s on /api/*) handles cross-request
// reuse beyond that.
const GAMMA_URL =
  "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false";

const TTL_MS = 60_000;
let _cache = null; // { at: number, data: Market[] }
let _inflight = null; // Promise<Market[]> — coalesce concurrent callers

export async function fetchPolymarketMarkets() {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.data;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const r = await fetch(GAMMA_URL, {
        headers: { "User-Agent": "edge-aggregator/1.0", Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`polymarket-gamma ${r.status}`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      const normalized = arr.map((m) => ({
        source: "polymarket",
        title: m.question || "",
        slug: m.slug || "",
        condition_id: m.conditionId || null,
        volume_24h: parseFloat(m.volume24hr || m.volume24hrClob || 0) || 0,
        total_volume: parseFloat(m.volume || m.volumeNum || 0) || 0,
        end_date: m.endDate || m.endDateIso || null,
        icon: m.icon || null,
        url: m.slug ? `https://polymarket.com/market/${m.slug}` : null,
      }));
      _cache = { at: Date.now(), data: normalized };
      return normalized;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}
