// X (Twitter) signal collector — STUB.
//
// Wiring contract (replace stub with real impl when you have a key):
//   1. Set env var X_BEARER_TOKEN with a Basic-tier+ X API v2 key.
//   2. Replace `fetchSignals` below with calls to:
//        GET https://api.twitter.com/2/tweets/search/recent
//      with query like: (polymarket OR kalshi OR "prediction market" -is:retweet)
//      and `tweet.fields=author_id,created_at,public_metrics`
//      and `expansions=author_id` with `user.fields=username,name,profile_image_url`.
//   3. Honor the Basic tier 10k tweets/month read cap. Strategy: one query
//      pulled every ~5 min covers ~8.6k/month; leave headroom for ad-hoc
//      lookups. Cache aggressively at the edge.
//   4. Normalize each tweet to the NormalizedThread shape:
//        { id: `x:${tweet.id}`, source: 'x', subsource: query_tag,
//          title: tweet.text.slice(0, 120), body: tweet.text,
//          author: user.username, author_url: `https://x.com/${user.username}`,
//          url: `https://x.com/${user.username}/status/${tweet.id}`,
//          score: tweet.public_metrics.like_count + retweet_count*2,
//          comments: reply_count, created_at: Date.parse(created_at)/1000 }
//
// Until the key exists, returns [] — pipeline keeps working with Reddit-only.

export async function fetchSignals({ limit = 25 } = {}) {
  if (!process.env.X_BEARER_TOKEN) return [];
  // TODO(when key provisioned): implement the real /tweets/search/recent call.
  // Keeping the stub returns [] so partial deployments don't break.
  return [];
}
