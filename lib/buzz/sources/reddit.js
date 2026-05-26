// Reddit signal collector.
// Uses Reddit's public JSON endpoints (no OAuth required for read-only browse).
// 60 req/min rate limit per IP; we batch via Promise.allSettled and let Vercel
// edge-cache the API response.

const SUBREDDITS = [
  "Polymarket",
  "sportsbook",
  "Kalshi",
  "sportsbetting",
  "PredictIt",
  "wallstreetbets",
  "Daytrading",
  "Elections2024",
  "PredictionMarkets",
];

const UA = "edge-aggregator/1.0 (https://edge-two-psi.vercel.app)";

export async function fetchSignals({ limit = 40 } = {}) {
  const perSub = Math.max(3, Math.ceil(limit / SUBREDDITS.length));
  const results = await Promise.allSettled(
    SUBREDDITS.map((sub) => fetchSubreddit(sub, perSub))
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // Newest first; stickies/megathreads tend to be top-of-hot but stale — push down
  all.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? 1 : -1;
    return b.created_at - a.created_at;
  });
  return all;
}

async function fetchSubreddit(sub, limit) {
  const r = await fetch(
    `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } }
  );
  if (!r.ok) throw new Error(`reddit/${sub} ${r.status}`);
  const data = await r.json();
  const children = data?.data?.children || [];
  return children
    .map((c) => normalize(c.data, sub))
    .filter((t) => t && t.title && !t.removed);
}

function normalize(p, sub) {
  if (!p || p.removed_by_category) return null;
  return {
    id: `reddit:${sub}:${p.id}`,
    source: "reddit",
    subsource: sub,
    title: p.title || "",
    body: (p.selftext || "").slice(0, 600),
    author: p.author || null,
    author_url: p.author && p.author !== "[deleted]" ? `https://reddit.com/u/${p.author}` : null,
    url: p.permalink ? `https://reddit.com${p.permalink}` : p.url,
    score: Number(p.score) || 0,
    comments: Number(p.num_comments) || 0,
    created_at: Number(p.created_utc) || 0,
    pinned: !!p.stickied,
    flair: p.link_flair_text || null,
    thumbnail: p.thumbnail && /^https?:/.test(p.thumbnail) ? p.thumbnail : null,
  };
}
