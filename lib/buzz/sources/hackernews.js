// Hacker News signal collector.
// Uses HN's Algolia search API (free, public, no auth).
// Strategy: pull the last 24h of front-page stories and let the matcher
// filter them by token overlap to live markets. The front page is the
// signal — when an Iran story hits HN front page, it's the same news
// driving the Iran market, even if HN voters aren't traders themselves.

const URL_FN = (hours = 24) => {
  // Algolia exposes a numericFilters arg: created_at_i is a unix timestamp
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=created_at_i>${since}&hitsPerPage=40`;
};

const UA = "edge-aggregator/1.0 (https://www.thepolyedge.com)";

export async function fetchSignals({ limit = 40, hours = 24 } = {}) {
  const r = await fetch(URL_FN(hours), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`hn-algolia ${r.status}`);
  const data = await r.json();
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  return hits
    .map((h) => normalize(h))
    .filter((t) => t && t.title)
    .slice(0, limit);
}

function normalize(h) {
  const id = h.objectID || h.story_id;
  if (!id) return null;
  return {
    id: `hn:${id}`,
    source: "hn",
    subsource: "front_page",
    title: h.title || h.story_title || "",
    body: (h.story_text || h.comment_text || "").slice(0, 500),
    author: h.author || null,
    author_url: h.author ? `https://news.ycombinator.com/user?id=${h.author}` : null,
    url: h.url || `https://news.ycombinator.com/item?id=${id}`,
    score: Number(h.points) || 0,
    comments: Number(h.num_comments) || 0,
    created_at: Number(h.created_at_i) || 0,
    pinned: false,
    flair: null,
    thumbnail: null,
  };
}
