// Polymarket native-comments collector.
//
// HIGH-SIGNAL source: every comment is pre-attached to a specific Polymarket
// Event (the parent container of related markets — e.g. "2028 Presidential
// Election" event contains JD Vance / Harris / etc markets). So unlike Reddit
// threads, no fuzzy matching is needed — the comment IS about that event.
//
// Collectors return NormalizedThread objects with an optional
//   pre_matched: { title, slug, source, url, score: 1.0 }
// field. When present, the buzz matcher uses this directly instead of running
// token-overlap scoring.

const EVENTS_URL =
  "https://gamma-api.polymarket.com/events?closed=false&limit=15&order=volume24hr&ascending=false";

function commentsUrl(eventId, limit) {
  return `https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=${encodeURIComponent(
    eventId
  )}&limit=${limit}&order=createdAt&ascending=false`;
}

const UA = "edge-aggregator/1.0 (https://edge-two-psi.vercel.app)";

export async function fetchSignals({ limit = 60 } = {}) {
  // Pull the hottest events first so the comments we see are on markets that
  // actually matter right now.
  const events = await fetchTopEvents();
  if (!events.length) return [];

  const perEvent = Math.max(3, Math.ceil(limit / Math.max(1, events.length)));
  const results = await Promise.allSettled(
    events.map((e) => fetchEventComments(e, perEvent))
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return all.slice(0, limit);
}

async function fetchTopEvents() {
  const r = await fetch(EVENTS_URL, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`polymarket-events ${r.status}`);
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map((e) => ({
    id: e.id,
    title: e.title || "",
    slug: e.slug || "",
    icon: e.icon || null,
    volume_24h: parseFloat(e.volume24hr || 0) || 0,
    end_date: e.endDate || null,
  }));
}

async function fetchEventComments(event, limit) {
  const r = await fetch(commentsUrl(event.id, limit), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`polymarket-comments ${event.id} ${r.status}`);
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map((c) => normalize(c, event));
}

function normalize(c, event) {
  const profile = c.profile || {};
  const displayName = profile.displayUsernamePublic ? profile.name : profile.pseudonym;
  const created_at = c.createdAt ? Math.floor(new Date(c.createdAt).getTime() / 1000) : 0;
  return {
    id: `polymarket:event-${event.id}:${c.id}`,
    source: "polymarket",
    subsource: event.slug || `event-${event.id}`,
    title: (c.body || "").slice(0, 200),
    body: c.body || "",
    author: displayName || profile.pseudonym || null,
    author_url: profile.proxyWallet
      ? `https://polymarket.com/profile/${profile.proxyWallet}`
      : null,
    url: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
    score: Number(c.reactionCount) || 0,
    comments: 0, // comments don't nest in this endpoint
    created_at,
    pinned: false,
    flair: null,
    thumbnail: profile.profileImage || null,
    pre_matched: {
      title: event.title,
      slug: event.slug,
      source: "polymarket",
      url: event.slug ? `https://polymarket.com/event/${event.slug}` : null,
      icon: event.icon,
      score: 1.0,
      // Track that this is event-level, not single-market-level
      entity_type: "event",
      entity_id: event.id,
    },
  };
}
