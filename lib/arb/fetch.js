// Dedicated cross-platform fetch for the radar.
//
// /api/markets flattens every Kalshi event to ONE market (the top candidate /
// strike), which is right for the dashboard but fatal for matching: it throws
// away the candidate that makes a pair. To match Polymarket's "Will X win 2028?"
// to Kalshi's "2028 winner — X", we need CANDIDATE-LEVEL markets. So the radar
// fetches its own richer surface:
//   • Polymarket — 5 pages deep (election markets live below the sports volume)
//   • Kalshi general — event-level (for the landscape + binary matching)
//   • Kalshi winner/macro series — every nested candidate/strike, expanded
//
// This is what turns "0 pairs" into real, identically-settling cross-platform
// divergences (the 2028 field is live on both platforms today).

const POLY = "https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volume24hr&ascending=false&limit=100";
const KBASE = "https://api.elections.kalshi.com/trade-api/v2";
const K_GENERAL = `${KBASE}/events?status=open&with_nested_markets=true&limit=200`;
// Multi-outcome "winner" markets settle identically to Polymarket's per-option
// markets → genuine pairs. Expanded to candidate level.
const K_WINNER = ["KXPRESPERSON", "KXDEMNOM28", "KXGOPNOM28", "KXNEXTAG", "KXNEXTODNI", "KXCABOUT"];
const K_MACRO = ["KXFED", "KXCPIYOY"];
const KH = { "User-Agent": "Mozilla/5.0 (edge-arb)", Accept: "application/json" };

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp = (p) => Math.max(0, Math.min(1, num(p)));
function arr(v) { if (Array.isArray(v)) return v; try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
async function getJson(url, dflt) {
  try { const r = await fetch(url, { headers: KH }); return r.ok ? await r.json() : dflt; } catch { return dflt; }
}

function polyCat(q) {
  const s = (q || "").toLowerCase();
  if (/2028|presidential|senate|nominee|nomination|election|congress|pardon|cabinet/.test(s)) return "Politics";
  if (/bitcoin|\bbtc\b|ethereum|\beth\b|crypto|solana/.test(s)) return "Crypto";
  if (/\bfed\b|inflation|\bcpi\b|interest rate|recession|\bgdp\b|jobs/.test(s)) return "Economics";
  if (/ vs | win |cup|league|garros|\bnba\b|\bnfl\b|super bowl/.test(s)) return "Sports";
  return "Other";
}

async function fetchPoly() {
  const pages = await Promise.all([0, 100, 200, 300, 400].map((off) => getJson(`${POLY}&offset=${off}`, [])));
  const out = [];
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const m of page) {
      const prices = arr(m.outcomePrices);
      const outcomes = arr(m.outcomes);
      const yi = outcomes.findIndex((o) => /yes/i.test(String(o)));
      const yes = parseFloat(prices[yi >= 0 ? yi : 0]);
      const v24 = num(m.volume24hr ?? m.volume24hrClob);
      if (!m.question || !Number.isFinite(yes) || v24 <= 0) continue;
      out.push({
        id: `poly_${m.id}`,
        source: "polymarket",
        title: m.question,
        category: polyCat(m.question),
        yes_token: arr(m.clobTokenIds)[yi >= 0 ? yi : 0] || null,
        yes_price: clamp(yes),
        no_price: clamp(1 - yes),
        volume_24h: v24,
        end_date: m.endDate || m.endDateIso || null,
        link: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
      });
    }
  }
  return uniq(out);
}

function kEntry(eventTitle, mk, cat, series, eticker, v24) {
  const yes = num(mk.yes_ask_dollars) || num(mk.last_price_dollars);
  if (!yes || yes <= 0 || yes >= 1) return null;
  const sub = (mk.yes_sub_title || "").trim();
  const title = sub && !/^(yes|no)$/i.test(sub) ? `${eventTitle} — ${sub}` : eventTitle;
  return {
    id: `kalshi_${mk.ticker || eticker}`,
    source: "kalshi",
    title,
    category: cat || "Other",
    yes_price: clamp(yes),
    no_price: clamp(1 - yes),
    volume_24h: v24 != null ? v24 : num(mk.volume_24h_fp),
    end_date: mk.close_time || null,
    link: series ? `https://kalshi.com/markets/${String(series).toLowerCase()}/${String(eticker).toLowerCase()}` : null,
  };
}

async function fetchKalshi() {
  const [general, ...rest] = await Promise.all([
    getJson(K_GENERAL, { events: [] }),
    ...[...K_WINNER, ...K_MACRO].map((s) =>
      getJson(`${KBASE}/events?series_ticker=${s}&status=open&with_nested_markets=true`, { events: [] }),
    ),
  ]);
  const out = [];
  // General feed → event-level (top nested market), event volume = sum of legs.
  for (const e of general.events || []) {
    const ms = e.markets || [];
    if (!ms.length) continue;
    const v24 = ms.reduce((s, m) => s + num(m.volume_24h_fp), 0);
    const top = ms.reduce((b, m) => (num(m.volume_24h_fp) > num(b.volume_24h_fp) ? m : b));
    const ent = kEntry(e.title || "", top, e.category, e.series_ticker, e.event_ticker, v24);
    if (ent) out.push(ent);
  }
  // Winner + macro series → candidate/strike-level (every leg priced).
  for (const data of rest) {
    for (const e of data.events || []) {
      for (const mk of e.markets || []) {
        const ent = kEntry(e.title || "", mk, e.category, e.series_ticker, e.event_ticker, null);
        if (ent) out.push(ent);
      }
    }
  }
  return uniq(out);
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const m of list) if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
  return out;
}

export async function fetchCrossPlatform() {
  const [poly, kalshi] = await Promise.all([fetchPoly(), fetchKalshi()]);
  return { poly, kalshi };
}
