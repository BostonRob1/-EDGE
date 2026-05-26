// Divergence Radar — the actual "Edge" product, made tangible.
//
// Thesis: where MONEY and MOUTH disagree, the Edge lives.
//
//   money_intensity (0-100): how much real capital is on this market right now
//     - 24h dollar volume (vs population)
//     - whale activity count
//     - price velocity (|24h % change|)
//
//   mouth_intensity (0-100): how much social/news attention this market gets
//     - matched thread count from /api/buzz/markets
//     - upvotes / engagement sum
//     - distinct source count (more sources = more confidence)
//
//   divergence (0-100): asymmetry between the two
//     - |money_intensity - mouth_intensity|
//
//   edge_call (string):
//     - "INSIDER FLOW"   — money_intensity ≫ mouth_intensity
//       (whales positioning; chatter hasn't caught up — usually bullish for
//        the side whales are taking)
//     - "FRONT-RUNNING"  — mouth_intensity ≫ money_intensity
//       (chatter is ahead of money; either sentiment is wrong, or money is
//        about to flow in — directional read depends on sentiment polarity)
//     - "ALIGNED"        — money and mouth roughly agree
//
// This is the v0. v1 will add sentiment polarity (LLM embeddings → bullish/
// bearish lean per chatter source) so the call gets a direction, and full
// persistence + receipts via Vercel KV.

// Min-max normalize a value across an array to [0, 100]
function normalize(values, val) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return 50;
  return Math.round(((val - min) / (max - min)) * 100);
}

// Log-scale a value before normalizing — useful for power-law distributed
// data (volume, upvotes) so a single mega-market doesn't crush everything else.
function logScale(values) {
  return values.map((v) => Math.log10(Math.max(0, v) + 1));
}

export function computeScores(markets, heatByKey) {
  if (!markets.length) return [];

  // Pre-compute raw measures
  const rawMoney = markets.map((m) => {
    const vol = Number(m.volume_24h) || 0;
    const priceMag = Math.abs(Number(m.price_change_24h) || 0);
    const whaleCount = Number(m.whale_count || 0); // future hook
    // log-scaled volume + linear price magnitude + whale activity
    return Math.log10(vol + 1) * 8 + priceMag * 0.8 + whaleCount * 2;
  });

  const rawMouth = markets.map((m) => {
    const heat = heatByKey.get(matchKey(m));
    if (!heat) return 0;
    return (
      heat.thread_count * 6 +
      Math.log10(heat.total_upvotes + 1) * 4 +
      heat.unique_sources.length * 8 +
      heat.best_match_score * 12
    );
  });

  // Normalize both to 0-100
  return markets.map((m, i) => {
    const money_intensity = normalize(rawMoney, rawMoney[i]);
    const mouth_intensity = normalize(rawMouth, rawMouth[i]);
    const divergence = Math.abs(money_intensity - mouth_intensity);
    const lean = money_intensity - mouth_intensity; // signed

    let edge_call;
    let edge_thesis;

    // Require real signal on BOTH sides before claiming an edge. Otherwise
    // the call would just be "we don't have chatter data" dressed up as
    // alpha. Honest is better than loud at v0.
    if (mouth_intensity < 8 && money_intensity < 8) {
      edge_call = "NO SIGNAL";
      edge_thesis = "Insufficient data on both sides. Watching for activity.";
    } else if (mouth_intensity < 8) {
      edge_call = "QUIET FLOW";
      edge_thesis =
        "Money is on this market but no chatter detected yet. Could be early-stage capital positioning before the crowd notices — or just a quiet news cycle.";
    } else if (money_intensity < 8) {
      edge_call = "LOUD ROOM";
      edge_thesis =
        "Plenty of chatter but no real capital behind it yet. Either retail noise that won't move price, or institutional money hasn't paid attention.";
    } else if (Math.abs(lean) < 20) {
      edge_call = "ALIGNED";
      edge_thesis = "Money and mouth in agreement. No edge.";
    } else if (lean > 0) {
      edge_call = "INSIDER FLOW";
      edge_thesis =
        "Whales are positioning ahead of where the crowd is looking. Capital sees something chatter hasn't priced in yet — high-conviction edge.";
    } else {
      edge_call = "FRONT-RUNNING";
      edge_thesis =
        "Chatter is loud but money hasn't moved yet. Either sentiment is wrong, or capital is about to follow the noise — watch for confirmation.";
    }

    const heat = heatByKey.get(matchKey(m));
    return {
      title: m.title,
      slug: m.slug,
      source: m.source,
      url: m.url || (m.slug ? `https://polymarket.com/market/${m.slug}` : null),
      icon: m.icon,
      category: m.category,
      volume_24h: m.volume_24h,
      total_volume: m.total_volume,
      yes_price: m.yes_price,
      no_price: m.no_price,
      price_change_24h: m.price_change_24h,
      end_date: m.end_date,
      money_intensity,
      mouth_intensity,
      divergence,
      lean,
      edge_call,
      edge_thesis,
      chatter: heat
        ? {
            threads: heat.thread_count,
            upvotes: heat.total_upvotes,
            sources: heat.unique_sources,
            top_thread: heat.top_threads?.[0] || null,
          }
        : null,
    };
  });
}

// Markets list (from /api/markets) uses `title`; Buzz heat list uses the same
// title via aggregateMarketHeat. Lower-case for case-insensitive match.
export function matchKey(m) {
  return (m.slug || m.title || "").toLowerCase().trim();
}

export function buildHeatMap(buzzMarkets) {
  const map = new Map();
  for (const h of buzzMarkets) {
    map.set((h.slug || h.title || "").toLowerCase().trim(), h);
  }
  return map;
}
