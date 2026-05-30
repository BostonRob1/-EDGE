import { kvEnabled, kvCmd, kvPipe } from "../store/kv.js";

// Persistent log of every SHARP trade (a trade by a tracked profitable wallet).
// Stored in a Redis sorted set scored by timestamp so we can read arbitrary
// time windows back — 6h, 12h, 24h, 7d, 30d, 60d — which Polymarket's own API
// can't give us. The member is a compact JSON blob (and includes the tx hash,
// so re-seeing the same trade is an idempotent no-op).
const FEED = "sharp:feed";
const MAX_AGE_MS = 60 * 24 * 3600 * 1000; // keep 60 days
const HARD_CAP = 8000;

function member(t) {
  return JSON.stringify({
    w: t.wallet, n: t.name || "", img: t.image || "", s: t.side, o: t.outcome || "",
    u: Math.round(t.usd || 0), p: t.price || 0, mt: t.market_title || "", ms: t.market_slug || "",
    es: t.event_slug || "", ts: t.timestamp || 0, r: t.cred_rank || 0, cp: Math.round(t.cred_pnl || 0),
    cw: t.cred_window || "", tx: t.tx_hash || "",
  });
}
function parse(m) {
  try {
    const t = JSON.parse(m);
    return {
      wallet: t.w, name: t.n || null, image: t.img || null, side: t.s, outcome: t.o,
      usd: t.u, price: t.p, market_title: t.mt, market_slug: t.ms, event_slug: t.es,
      timestamp: t.ts, cred_rank: t.r, cred_pnl: t.cp, cred_window: t.cw, tx_hash: t.tx,
    };
  } catch {
    return null;
  }
}

// Append new sharp trades to the persistent feed (best-effort; no-op without KV).
export async function persistSharp(tape) {
  if (!kvEnabled || !Array.isArray(tape) || !tape.length) return;
  const cmds = [];
  for (const t of tape) {
    const tsMs = (Number(t.timestamp) || 0) * 1000; // firehose ts is unix seconds
    if (!tsMs) continue;
    cmds.push(["ZADD", FEED, String(tsMs), member(t)]);
  }
  if (!cmds.length) return;
  cmds.push(["ZREMRANGEBYSCORE", FEED, "0", String(Date.now() - MAX_AGE_MS)]); // prune old
  cmds.push(["ZREMRANGEBYRANK", FEED, "0", String(-HARD_CAP - 1)]); // cap total
  try { await kvPipe(cmds); } catch { /* best-effort */ }
}

// Read sharp trades from the last `windowMs`, newest first. null without KV.
export async function readSharpFeed(windowMs, limit = 300) {
  if (!kvEnabled) return null;
  const min = Date.now() - windowMs;
  const flat = (await kvCmd(["ZREVRANGEBYSCORE", FEED, "+inf", String(min), "LIMIT", "0", String(limit)])) || [];
  return flat.map(parse).filter(Boolean);
}
