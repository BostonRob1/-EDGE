// News RSS signal collector.
// Pulls headlines from a curated list of major-outlet RSS feeds. Treats news
// items as a distinct "news" source (not user-generated chatter) — they're
// the causal signal that drives chatter spikes, so matching them to markets
// surfaces "what just happened" rather than "what people are saying."

const FEEDS = [
  { id: "npr-politics", outlet: "NPR", topic: "politics", url: "https://feeds.npr.org/1014/rss.xml" },
  { id: "nyt-politics", outlet: "NYT", topic: "politics", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml" },
  { id: "fox-politics", outlet: "Fox", topic: "politics", url: "https://moxie.foxnews.com/google-publisher/politics.xml" },
  { id: "politico", outlet: "Politico", topic: "politics", url: "https://rss.politico.com/politics-news.xml" },
  { id: "bbc-world", outlet: "BBC", topic: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "espn", outlet: "ESPN", topic: "sports", url: "https://www.espn.com/espn/rss/news" },
  { id: "coindesk", outlet: "CoinDesk", topic: "crypto", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
];

const UA = "edge-aggregator/1.0 (https://edge-two-psi.vercel.app)";

export async function fetchSignals({ limit = 50, perFeed = 8 } = {}) {
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f, perFeed))
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return all.slice(0, limit);
}

async function fetchFeed(feed, limit) {
  const r = await fetch(feed.url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`rss/${feed.id} ${r.status}`);
  const xml = await r.text();
  const items = parseRSS(xml).slice(0, limit);
  return items.map((it) => normalize(it, feed));
}

function normalize(item, feed) {
  const ts = item.pubDate ? Math.floor(Date.parse(item.pubDate) / 1000) : 0;
  const idSuffix = item.guid || item.link || item.title?.slice(0, 40);
  return {
    id: `news:${feed.id}:${hashish(idSuffix)}`,
    source: "news",
    subsource: feed.outlet,
    title: cleanText(item.title) || "(untitled)",
    body: cleanText(item.description || "").slice(0, 400),
    author: feed.outlet,
    author_url: null,
    url: item.link || feed.url,
    score: 0,
    comments: 0,
    created_at: Number.isFinite(ts) ? ts : 0,
    pinned: false,
    flair: feed.topic,
    thumbnail: null,
    outlet: feed.outlet,
    topic: feed.topic,
  };
}

// ── tiny RSS/Atom parser ────────────────────────────────────────────────
// Handles RSS 2.0 <item> blocks and Atom <entry> blocks. Tolerant of
// CDATA wrappers, namespaced tags, and minor inconsistencies.
function parseRSS(xml) {
  const items = [];
  const blockRegex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRegex.exec(xml))) {
    const block = m[2];
    items.push({
      title: tag(block, "title"),
      link: tagAttr(block, "link", "href") || tag(block, "link") || tag(block, "guid"),
      pubDate: tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date") || tag(block, "dcterms:modified"),
      description: tag(block, "description") || tag(block, "content:encoded") || tag(block, "summary") || tag(block, "content"),
      guid: tag(block, "guid"),
    });
  }
  return items;
}

function tag(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = re.exec(block);
  if (!m) return null;
  return cleanText(m[1]);
}

function tagAttr(block, tagName, attr) {
  const re = new RegExp(`<${tagName}\\b[^>]*\\s${attr}=["']([^"']+)["']`, "i");
  const m = re.exec(block);
  return m ? m[1] : null;
}

function cleanText(s) {
  if (!s) return "";
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashish(s) {
  // Tiny non-crypto hash, just for stable IDs across requests
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
