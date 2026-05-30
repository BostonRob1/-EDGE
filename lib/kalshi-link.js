// Canonical Kalshi URL builder with the $EDGE referral code attached.
//
// The referral rides on EVERY kalshi.com link we emit, so any sign-up that
// follows a click is credited to $EDGE. The code is a PUBLIC affiliate tag
// (it travels inside shared URLs) — not a secret — so it ships in the default.
// Ops can override it without a code change via the KALSHI_AFFILIATE_REF env var.
export const KALSHI_REFERRAL =
  (typeof process !== "undefined" && process.env && process.env.KALSHI_AFFILIATE_REF) ||
  "76c980b3-a1a5-461c-841e-de3e01b22408";

// Append ?referral=<code> to any kalshi.com URL. No-ops on non-Kalshi or empty
// links, and is idempotent — it will not double-stamp a URL that already
// carries a referral param.
export function withKalshiRef(url) {
  if (!url || !/kalshi\.com/i.test(url)) return url || null;
  if (/[?&]referral=/i.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}referral=${encodeURIComponent(KALSHI_REFERRAL)}`;
}

// Build a Kalshi market/event deep link with the referral already attached.
export function kalshiMarketUrl(seriesTicker, eventTicker) {
  if (!seriesTicker) return null;
  const path = `${String(seriesTicker).toLowerCase()}/${String(eventTicker).toLowerCase()}`;
  return withKalshiRef(`https://kalshi.com/markets/${path}`);
}
