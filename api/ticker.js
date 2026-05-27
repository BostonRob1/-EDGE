// Live activity ticker — merges three event streams into one chronological
// firehose for the always-visible scrolling tape that rides under the header
// on every page.
//
// Sources:
//   1. WHALE_TRADE — large Polymarket trades from /api/whales/firehose
//   2. NEWS_DROP   — fresh news items from /api/buzz/feed filtered to news+hn
//   3. EDGE_CALL   — active divergence calls from /api/edge/scores
//
// Each entry is normalized to a compact shape the ticker JS can render
// without extra logic. Sorted newest-first. Cached at the edge for 30s
// (vercel.json) so the ticker isn't hammering upstream on every page load.

export default async function handler(req, res) {
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.connection?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  const [whalesR, buzzR, edgeR] = await Promise.allSettled([
    fetch(`${base}/api/whales/firehose?min=500&limit=15`).then((r) => r.json()),
    fetch(`${base}/api/buzz/feed?matched=0&limit=40`).then((r) => r.json()),
    fetch(`${base}/api/edge/scores?limit=8`).then((r) => r.json()),
  ]);

  const events = [];

  // ── WHALE TRADES ──────────────────────────────────────────────────────
  if (whalesR.status === "fulfilled") {
    const trades = whalesR.value?.trades || [];
    for (const t of trades.slice(0, 10)) {
      events.push({
        type: "WHALE_TRADE",
        ts: t.timestamp || 0,
        usd: t.usd || 0,
        // Short, scannable: "$5.2K · NAME bought YES on Iran ceasefire"
        text: `${escapeForTicker(t.name || shortWallet(t.wallet))} ${t.side === "BUY" ? "bought" : "sold"} ${t.outcome || ""} on ${escapeForTicker((t.market_title || "").slice(0, 60))}`,
        amount: t.usd,
        href: t.wallet ? `/whales.html?wallet=${encodeURIComponent(t.wallet)}` : "/whales.html",
      });
    }
  }

  // ── NEWS DROPS ────────────────────────────────────────────────────────
  if (buzzR.status === "fulfilled") {
    const threads = buzzR.value?.threads || [];
    for (const t of threads.filter((x) => x.source === "news" || x.source === "hn").slice(0, 10)) {
      const outlet =
        t.source === "hn"
          ? "HN"
          : (t.subsource || "NEWS").toUpperCase();
      events.push({
        type: "NEWS_DROP",
        ts: t.created_at || 0,
        text: `${escapeForTicker(outlet)} · ${escapeForTicker((t.title || "").slice(0, 90))}`,
        href: t.url || "/buzz.html",
        outlet,
      });
    }
  }

  // ── EDGE CALLS ────────────────────────────────────────────────────────
  if (edgeR.status === "fulfilled") {
    const calls = edgeR.value?.active_calls || [];
    const now = Math.floor(Date.now() / 1000);
    for (const c of calls.slice(0, 5)) {
      events.push({
        type: "EDGE_CALL",
        ts: now, // edge calls are continuously live; use now so they bubble
        text: `${escapeForTicker(c.edge_call)} · ${escapeForTicker((c.title || "").slice(0, 80))} · ${c.divergence}Δ`,
        href: c.url || "/edge.html",
        call: c.edge_call,
        divergence: c.divergence,
      });
    }
  }

  // Sort newest-first, then cap
  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const out = events.slice(0, 30);

  res.status(200).json({
    events: out,
    counts: {
      whale_trades: events.filter((e) => e.type === "WHALE_TRADE").length,
      news_drops: events.filter((e) => e.type === "NEWS_DROP").length,
      edge_calls: events.filter((e) => e.type === "EDGE_CALL").length,
      total: out.length,
    },
    fetched_at: new Date().toISOString(),
  });
}

function shortWallet(w) {
  if (!w) return "?";
  return w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

// Strip characters that'd break the ticker's CSS or look weird in a scrolling
// strip. Keep the text human; this is display-only.
function escapeForTicker(s) {
  if (!s) return "";
  return String(s).replace(/[\r\n\t]+/g, " ").trim();
}
