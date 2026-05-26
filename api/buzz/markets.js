import * as reddit from "../../lib/buzz/sources/reddit.js";
import * as xStub from "../../lib/buzz/sources/_x_stub.js";
import { fetchPolymarketMarkets } from "../../lib/buzz/polymarket-markets.js";
import { matchThreadsToMarkets, aggregateMarketHeat } from "../../lib/buzz/market-match.js";

// Markets ranked by chatter heat. Heat = composite of thread count, total
// upvotes, distinct source diversity, and best match confidence.
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 25));

  const [redditR, xR, marketsR] = await Promise.allSettled([
    reddit.fetchSignals({ limit: 80 }),
    xStub.fetchSignals({ limit: 30 }),
    fetchPolymarketMarkets(),
  ]);

  const threads = [
    ...(redditR.status === "fulfilled" ? redditR.value : []),
    ...(xR.status === "fulfilled" ? xR.value : []),
  ];
  const markets = marketsR.status === "fulfilled" ? marketsR.value : [];

  const matched = matchThreadsToMarkets(threads, markets);
  const ranked = aggregateMarketHeat(matched, { limit });

  res.status(200).json({
    markets: ranked,
    counts: {
      markets_with_chatter: ranked.length,
      threads_total: threads.length,
      threads_matched: matched.filter((m) => m.matches.length > 0).length,
    },
    sources_active: {
      reddit: redditR.status === "fulfilled" && (redditR.value?.length || 0) > 0,
      x: xR.status === "fulfilled" && (xR.value?.length || 0) > 0,
    },
    fetched_at: new Date().toISOString(),
  });
}
