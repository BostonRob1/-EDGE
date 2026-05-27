// Pair Polymarket markets to Kalshi markets that refer to the SAME real-world
// event. Hardest piece of the arb pipeline.
//
// v0 approach: token-overlap scoring (same algorithm as the buzz matcher) with
// generous stopwords + date-proximity adjustment. Conservative threshold so
// false positives stay low — false positives in arbitrage are worse than
// false negatives because they invite the user into a trade that isn't
// actually risk-free.
//
// v1 will use semantic embeddings to catch pairs that share meaning but not
// vocabulary (e.g. "Trump wins 2028" vs "Republican wins Presidential 2028").

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in","on",
  "at","for","by","with","and","or","but","if","then","this","that","these","those",
  "it","its","from","as","do","does","did","done","have","has","had","can","could",
  "would","should","may","might","what","who","when","where","why","how","which",
  "whose","i","you","he","she","we","they","them","his","her","our","their","my",
  "me","us","no","not","yes","any","all","some","every","each","one","new","just",
  "very","more","most","much","many","also","only","over","under","into","out","up",
  "down","about","after","before","than","there","here","now","still","really","get",
  "got","make","made","take","took","go","goes","going","gone","will","wont","cant",
  "dont","im","ive","ill","youre","theyre","theres","whats","heres","wheres",
  // Prediction-market boilerplate that doesn't discriminate
  "market","markets","bet","bets","betting","odds","line","pick","picks","prediction",
  "predictions","polymarket","kalshi","price","trade","trades","trading","whale",
  "win","wins","won","lose","loss","loses","lost","close","closes","closed","open",
  "opens","opened","event","events","game","games","contest","contract","contracts",
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

function score(aTokens, bTokens) {
  if (!aTokens.size || !bTokens.size) return 0;
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  if (inter < 2) return 0; // Require at least 2 overlapping discriminating tokens
  const shorter = Math.min(aTokens.size, bTokens.size);
  const coverage = inter / shorter;
  const jaccard = inter / (aTokens.size + bTokens.size - inter);
  return coverage * 0.6 + jaccard * 0.4;
}

// Same-day end_dates strongly suggest same event. Days apart shrinks the bonus.
function dateProximityBonus(d1, d2) {
  if (!d1 || !d2) return 0;
  const t1 = Date.parse(d1);
  const t2 = Date.parse(d2);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  const daysApart = Math.abs(t1 - t2) / (24 * 3600 * 1000);
  if (daysApart < 1) return 0.2; // same day → strong bonus
  if (daysApart < 7) return 0.1; // same week
  if (daysApart < 30) return 0.05; // same month
  if (daysApart > 180) return -0.15; // very different timeframes — penalize
  return 0;
}

/**
 * Pair every Polymarket market with the single best Kalshi candidate, or
 * none if no candidate clears the threshold.
 *
 * @returns Array<{ poly, kalshi, match_score }>
 */
export function matchPairs(polyMarkets, kalshiMarkets, { minScore = 0.32 } = {}) {
  // Pre-tokenize Kalshi side for efficiency — we iterate over every Poly
  // market and score against every Kalshi candidate.
  const kIndex = kalshiMarkets.map((k) => ({ market: k, tokens: tokenize(k.title) }));

  const pairs = [];
  const usedKalshi = new Set(); // avoid re-pairing the same Kalshi market

  for (const p of polyMarkets) {
    const pTokens = tokenize(p.title);
    if (pTokens.size < 2) continue;

    let best = null;
    for (const ki of kIndex) {
      if (usedKalshi.has(ki.market.id)) continue;
      const base = score(pTokens, ki.tokens);
      if (base === 0) continue;
      const adj = base + dateProximityBonus(p.end_date, ki.market.end_date);
      if (adj < minScore) continue;
      if (!best || adj > best.score) best = { market: ki.market, score: adj };
    }

    if (best) {
      pairs.push({ poly: p, kalshi: best.market, match_score: Number(best.score.toFixed(3)) });
      usedKalshi.add(best.market.id);
    }
  }
  return pairs;
}
