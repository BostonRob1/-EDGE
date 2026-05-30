// Cross-platform market matcher (v2 — precision-first).
//
// Hard lesson from the data: Polymarket and Kalshi rarely list the SAME
// contract. Polymarket runs barrier/touch bets ("Will BTC reach $85k IN MAY")
// and single-game sports; Kalshi runs point-in-time strike ladders ("BTC price
// ON Jun 5 at 5pm — $85,000 or above") and multi-outcome winner markets. Same
// underlying, different question. A naive token/number matcher pairs them and
// invents arbs that aren't real.
//
// So v2 is built to REJECT mismatches, not maximise pairs:
//   - strong discriminating-token overlap, AND
//   - any $ thresholds present must AGREE (a $70k market is not a $85k market),
//   - any explicit years must AGREE (2028 race ≠ 2032 race),
//   - settlement windows must be in the same ballpark (a same-day Kalshi strike
//     is not Polymarket's end-of-month barrier).
// Result: far fewer pairs, but the ones it returns are genuinely comparable.
// Better to show nothing than to show a fake arb.

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in","on",
  "at","for","by","with","and","or","but","if","then","this","that","these","those",
  "it","its","from","as","do","does","did","done","have","has","had","can","could",
  "would","should","may","might","what","who","when","where","why","how","which",
  "whose","i","you","he","she","we","they","them","his","her","our","their","my",
  "me","us","no","not","yes","any","all","some","every","each","one","new","just",
  "very","more","most","much","many","also","only","over","under","into","out","up",
  "down","about","after","before","than","there","here","now","still","really","get",
  "got","make","made","take","go","will","wont","cant","dont","reach","hit","above",
  "below","price","range","close","closes",
  "market","markets","bet","bets","betting","odds","line","pick","picks","prediction",
  "polymarket","kalshi","trade","trades","trading","win","wins","won","lose","lost",
  "event","events","game","contest","contract","contracts","year",
]);

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

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

// Dollar / large-number thresholds, normalised to absolute integers.
function thresholds(s) {
  const out = new Set();
  const str = String(s || "").toLowerCase();
  const re = /\$\s?([0-9][0-9,]*)\s*(k|m|thousand|million)?/g;
  let m;
  while ((m = re.exec(str))) {
    let n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (m[2] === "k" || m[2] === "thousand") n *= 1e3;
    if (m[2] === "m" || m[2] === "million") n *= 1e6;
    if (n >= 1000) out.add(n);
  }
  return out;
}

function years(s) {
  const out = new Set();
  for (const y of String(s || "").matchAll(/\b(20[2-3][0-9])\b/g)) out.add(Number(y[1]));
  return out;
}

function monthsOf(s) {
  const str = String(s || "").toLowerCase();
  return new Set(MONTHS.filter((mo) => str.includes(mo)));
}

function conflict(setA, setB, tol = 0) {
  // Both sides specify values but none agree → conflict.
  if (!setA.size || !setB.size) return false;
  for (const a of setA) for (const b of setB) {
    if (tol > 0 ? Math.abs(a - b) <= tol * Math.max(a, b) : a === b) return false;
  }
  return true;
}

function tokenScore(aTokens, bTokens) {
  if (!aTokens.size || !bTokens.size) return { score: 0, inter: 0 };
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  const shorter = Math.min(aTokens.size, bTokens.size);
  const coverage = inter / shorter;
  const jaccard = inter / (aTokens.size + bTokens.size - inter);
  return { score: coverage * 0.6 + jaccard * 0.4, inter };
}

// Settlement windows comparable? Returns 'same' | 'near' | 'far' | 'unknown'.
function windowRelation(d1, d2) {
  if (!d1 || !d2) return "unknown";
  const t1 = Date.parse(d1), t2 = Date.parse(d2);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return "unknown";
  const days = Math.abs(t1 - t2) / 86400000;
  if (days <= 3) return "same";
  if (days <= 21) return "near";
  return "far";
}

/**
 * Pair each Polymarket market with its single best, genuinely-comparable Kalshi
 * counterpart. Conservative: returns [] when nothing clears the bar.
 *
 * @returns Array<{ poly, kalshi, match_score, window, same_threshold }>
 */
export function matchPairs(polyMarkets, kalshiMarkets, { minScore = 0.5 } = {}) {
  const kIndex = kalshiMarkets.map((k) => ({
    market: k,
    tokens: tokenize(k.title),
    thr: thresholds(k.title),
    yr: years(k.title),
    mo: monthsOf(k.title),
  }));

  const pairs = [];
  const usedKalshi = new Set();

  for (const p of polyMarkets) {
    const pTokens = tokenize(p.title);
    if (pTokens.size < 2) continue;
    const pThr = thresholds(p.title);
    const pYr = years(p.title);
    const pMo = monthsOf(p.title);

    let best = null;
    for (const ki of kIndex) {
      if (usedKalshi.has(ki.market.id)) continue;

      // Hard rejects — different contracts masquerading as the same.
      if (conflict(pThr, ki.thr, 0.01)) continue;   // different price thresholds
      if (conflict(pYr, ki.yr)) continue;           // different years (2028 vs 2032)
      if (pMo.size && ki.mo.size) {                 // different explicit months
        let share = false;
        for (const m of pMo) if (ki.mo.has(m)) share = true;
        if (!share) continue;
      }

      const { score, inter } = tokenScore(pTokens, ki.tokens);
      if (inter < 2) continue;                      // need ≥2 discriminating tokens
      if (score < minScore) continue;

      if (!best || score > best.score) best = { ki, score };
    }

    if (best) {
      const win = windowRelation(p.end_date, best.ki.market.end_date);
      // A Polymarket barrier vs a far-dated Kalshi strike is NOT comparable.
      if (win === "far") continue;
      const bothThr = pThr.size && best.ki.thr.size;
      pairs.push({
        poly: p,
        kalshi: best.ki.market,
        match_score: Number(best.score.toFixed(3)),
        window: win,
        same_threshold: bothThr ? true : false,
      });
      usedKalshi.add(best.ki.market.id);
    }
  }
  return pairs;
}
