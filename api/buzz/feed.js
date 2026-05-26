import * as reddit from "../../lib/buzz/sources/reddit.js";
import * as polyComments from "../../lib/buzz/sources/polymarket-comments.js";
import * as xStub from "../../lib/buzz/sources/_x_stub.js";
import { fetchPolymarketMarkets } from "../../lib/buzz/polymarket-markets.js";
import { matchThreadsToMarkets } from "../../lib/buzz/market-match.js";

// Chronological feed across all sources, with per-thread market matches.
// Vercel edge-caches /api/* for 30s already (see vercel.json).
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 60));
  const onlyMatched = url.searchParams.get("matched") === "1";

  const [redditR, polyR, xR, marketsR] = await Promise.allSettled([
    reddit.fetchSignals({ limit: 80 }),
    polyComments.fetchSignals({ limit: 80 }),
    xStub.fetchSignals({ limit: 30 }),
    fetchPolymarketMarkets(),
  ]);

  const threads = [
    ...(redditR.status === "fulfilled" ? redditR.value : []),
    ...(polyR.status === "fulfilled" ? polyR.value : []),
    ...(xR.status === "fulfilled" ? xR.value : []),
  ];
  const markets = marketsR.status === "fulfilled" ? marketsR.value : [];

  const matched = matchThreadsToMarkets(threads, markets);

  // Chronological newest-first
  matched.sort((a, b) => (b.thread.created_at || 0) - (a.thread.created_at || 0));

  const out = matched
    .filter((m) => !onlyMatched || m.matches.length > 0)
    .slice(0, limit)
    .map((m) => ({
      ...m.thread,
      matches: m.matches.map((s) => ({
        title: s.market.title,
        slug: s.market.slug,
        source: s.market.source,
        url: s.market.url,
        icon: s.market.icon,
        score: Math.round(s.score * 100) / 100,
      })),
    }));

  const errors = {};
  if (redditR.status === "rejected") errors.reddit = String(redditR.reason?.message || redditR.reason);
  if (polyR.status === "rejected") errors.polymarket = String(polyR.reason?.message || polyR.reason);
  if (marketsR.status === "rejected") errors.markets = String(marketsR.reason?.message || marketsR.reason);

  res.status(200).json({
    threads: out,
    counts: {
      threads_total: threads.length,
      threads_matched: matched.filter((m) => m.matches.length > 0).length,
      markets_loaded: markets.length,
    },
    sources_active: {
      reddit: redditR.status === "fulfilled" && (redditR.value?.length || 0) > 0,
      polymarket: polyR.status === "fulfilled" && (polyR.value?.length || 0) > 0,
      x: xR.status === "fulfilled" && (xR.value?.length || 0) > 0,
    },
    errors: Object.keys(errors).length ? errors : undefined,
    fetched_at: new Date().toISOString(),
  });
}
