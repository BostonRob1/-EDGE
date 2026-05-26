// Pull active Polymarket markets from the Gamma API. Used by the buzz matcher
// to score "what market is this thread about?"
const GAMMA_URL =
  "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false";

export async function fetchPolymarketMarkets() {
  const r = await fetch(GAMMA_URL, {
    headers: { "User-Agent": "edge-aggregator/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`polymarket-gamma ${r.status}`);
  const data = await r.json();
  const arr = Array.isArray(data) ? data : [];
  return arr.map((m) => ({
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
}
