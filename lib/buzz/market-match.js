// Match social-media threads to live markets by keyword overlap.
//
// v0 approach: tokenize titles, drop stopwords, score by hybrid of
// intersection count + coverage of the shorter token set. Cheap, debuggable,
// good-enough for surfacing chatter; v1 (next session) can layer LLM
// embeddings on top once we have a track record to evaluate against.

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in","on","at",
  "for","by","with","and","or","but","if","then","this","that","these","those","it",
  "its","from","as","do","does","did","done","have","has","had","can","could","would",
  "should","may","might","what","who","when","where","why","how","which","whose","i",
  "you","he","she","we","they","them","his","her","our","their","my","me","us","no",
  "not","yes","any","all","some","every","each","one","two","three","new","just","very",
  "more","most","much","many","also","only","over","under","into","out","up","down",
  "about","after","before","than","there","here","now","still","really","very","get",
  "got","make","made","take","took","go","goes","going","gone","will","wont","cant",
  "dont","im","ive","ill","youre","theyre","theres","whats","heres","wheres","got",
  // Prediction-market / betting noise — too common to be discriminating
  "market","markets","bet","bets","betting","odds","line","pick","picks","prediction",
  "predictions","polymarket","kalshi","price","trade","trades","trading","whale","yes",
  "no","win","wins","won","lose","loss","loses","lost","sports","sport","game","games",
]);

function tokenize(s) {
  if (!s) return new Set();
  return new Set(
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s$%-]/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^[-$%]+|[-%]+$/g, ""))
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
  );
}

function score(threadTokens, marketTokens) {
  if (!threadTokens.size || !marketTokens.size) return 0;
  let inter = 0;
  for (const t of threadTokens) if (marketTokens.has(t)) inter++;
  if (inter < 2) return 0;
  const shorter = Math.min(threadTokens.size, marketTokens.size);
  const coverage = inter / shorter;
  const jaccard = inter / (threadTokens.size + marketTokens.size - inter);
  return coverage * 0.7 + jaccard * 0.3;
}

export function matchThreadsToMarkets(threads, markets, { threshold = 0.3, maxPerThread = 3 } = {}) {
  const marketTokens = markets.map((m) => ({
    market: m,
    tokens: tokenize(m.title),
  }));

  return threads.map((t) => {
    // Pre-matched threads (e.g. Polymarket native comments tied to an event)
    // skip fuzzy scoring — they're attached to their market by construction.
    if (t.pre_matched) {
      return {
        thread: t,
        matches: [{ market: t.pre_matched, score: t.pre_matched.score ?? 1.0 }],
      };
    }

    const threadTokens = tokenize(`${t.title} ${t.body || ""}`);
    if (threadTokens.size < 2) return { thread: t, matches: [] };

    const scored = marketTokens
      .map((mt) => ({ market: mt.market, score: score(threadTokens, mt.tokens) }))
      .filter((s) => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerThread);

    return { thread: t, matches: scored };
  });
}

// Aggregate matched threads into per-market heat scores
export function aggregateMarketHeat(matched, { limit = 30 } = {}) {
  const byKey = new Map();
  for (const m of matched) {
    for (const match of m.matches) {
      const key = match.market.slug || match.market.title;
      if (!byKey.has(key)) {
        byKey.set(key, {
          slug: match.market.slug,
          title: match.market.title,
          source: match.market.source,
          icon: match.market.icon,
          market_url: match.market.url,
          volume_24h: match.market.volume_24h,
          end_date: match.market.end_date,
          thread_count: 0,
          unique_sources: new Set(),
          total_upvotes: 0,
          total_comments: 0,
          best_match_score: 0,
          top_threads: [],
        });
      }
      const h = byKey.get(key);
      h.thread_count++;
      h.unique_sources.add(m.thread.source);
      h.total_upvotes += m.thread.score || 0;
      h.total_comments += m.thread.comments || 0;
      h.best_match_score = Math.max(h.best_match_score, match.score);
      h.top_threads.push({ ...m.thread, match_score: match.score });
    }
  }

  return [...byKey.values()]
    .map((h) => {
      h.top_threads.sort((a, b) => (b.score || 0) - (a.score || 0));
      h.top_threads = h.top_threads.slice(0, 5);
      const heat =
        h.thread_count * 2 +
        Math.log10(h.total_upvotes + 1) * 1.5 +
        h.unique_sources.size * 3 +
        h.best_match_score * 4;
      return {
        ...h,
        unique_sources: [...h.unique_sources],
        heat: Math.round(heat * 10) / 10,
      };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, limit);
}
