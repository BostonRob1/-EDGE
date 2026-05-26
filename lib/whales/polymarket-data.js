// Thin client for Polymarket's public data-api.polymarket.com endpoints.
// All endpoints return JSON. No auth required.
const BASE = "https://data-api.polymarket.com";

async function get(path, params) {
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  const r = await fetch(`${BASE}${path}${qs}`, {
    headers: { "User-Agent": "edge-aggregator/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`polymarket-data ${path} ${r.status}`);
  return r.json();
}

// Global trade firehose. `limit` is capped server-side; we ask for the max we
// realistically need (a few hundred) to give us a wide aggregation window.
export function fetchTrades({ limit = 500, user, market, offset, taker_only } = {}) {
  return get("/trades", { limit, user, market, offset, taker_only });
}

// Open positions for a wallet (proxy address). Includes P&L per position.
export function fetchPositions({ user, limit = 50, sizeThreshold } = {}) {
  return get("/positions", { user, limit, sizeThreshold });
}

// Total USDC portfolio value for a wallet. Returns [{ user, value }].
export async function fetchValue(user) {
  const data = await get("/value", { user });
  return Array.isArray(data) && data[0] ? data[0].value : 0;
}

// Trade size in USDC = shares × price (price = implied probability 0..1).
export function tradeUsd(t) {
  return (Number(t?.size) || 0) * (Number(t?.price) || 0);
}
