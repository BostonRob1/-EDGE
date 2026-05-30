// $EDGE Dashboard — command center frontend.
// Four panels, each refreshing independently from its own endpoint.
import { fmtUsd, fmtAgo, short, escapeHtml, escapeAttr } from "/lib/client/format.js";
import { liveList, liveLoop } from "/lib/client/live.js";

const $ = (sel, root = document) => root.querySelector(sel);

// Refresh intervals tuned to source freshness:
//   markets    — Polymarket/Kalshi pricing moves quickly; 25s
//   whales     — whale firehose flashes constantly; 20s
//   buzz       — chatter rolls in slower; 45s
//   news       — RSS feeds publish hourly-ish; 60s
const INTERVALS = {
  markets: 5_000, // prices tick fast — poll every 5s
  whales: 5_000,  // firehose flashes constantly
  buzz: 15_000,
  news: 45_000,
};

const STALE_AFTER = 90_000; // turn refresh dot amber after this many ms
const DEAD_AFTER = 180_000; // turn red after this

const lastFetchedAt = { markets: 0, whales: 0, buzz: 0, news: 0 };

// ── HOT MARKETS (cross-platform, filterable, movement-aware) ──────────
let allMarkets = [];
let marketFilter = "all"; // all | movers | poly | kalshi

function renderMarkets() {
  const body = $("#bodyMarkets");
  if (!body) return;
  let list = allMarkets.slice();
  if (marketFilter === "poly") list = list.filter((m) => m.source === "polymarket");
  else if (marketFilter === "kalshi") list = list.filter((m) => m.source === "kalshi");
  else if (marketFilter === "movers")
    list.sort((a, b) => Math.abs(b.price_change_24h || 0) - Math.abs(a.price_change_24h || 0));
  list = list.slice(0, marketFilter === "movers" ? 16 : 14);
  if (!list.length) { body.innerHTML = `<div class="empty">No markets in this view.</div>`; return; }
  liveList(body, list, { key: (m) => m.id, render: renderMarketRow });
}

// Filter chips — switch the market lens (delegated; chips are static markup)
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".mkt-chip");
  if (!chip) return;
  marketFilter = chip.dataset.f || "all";
  document.querySelectorAll(".mkt-chip").forEach((c) => c.classList.toggle("active", c === chip));
  renderMarkets();
});

async function loadMarkets() {
  const dot = $("#dotMarkets");
  const meta = $("#metaMarkets");
  const body = $("#bodyMarkets");
  try {
    const r = await fetch("/api/markets");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);

    lastFetchedAt.markets = Date.now();
    allMarkets = data.markets || [];
    renderMarkets();
    meta.textContent = `${allMarkets.length} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    updateGlobalStats(data);
  } catch (err) {
    meta.textContent = "error";
    body.innerHTML = `<div class="empty">${escapeHtml(err.message || "failed")}</div>`;
  }
}

function renderMarketRow(m) {
  const isPoly = m.source === "polymarket";
  // Route through our internal /market.html so we capture intent + serve the
  // affiliate-wrapped Trade CTA from a $EDGE-branded page rather than
  // sending users straight off-site to Polymarket / Kalshi.
  const url = m.slug ? `/market.html?slug=${encodeURIComponent(m.slug)}` : "#";
  const yes = (Number(m.yes_price) || 0) * 100;
  const no = (Number(m.no_price) || 0) * 100;
  return `
    <div class="row market-row" data-url="${escapeAttr(url)}">
      <div>
        <div class="market-title">${escapeHtml(m.title || "")}</div>
        <div class="market-meta">
          <span class="badge ${isPoly ? "poly" : "kalshi"}">${isPoly ? "POLY" : "KALSHI"}</span>
          <span>${escapeHtml(m.category || "")}</span>
          ${renderMove(m.price_change_24h)}
        </div>
      </div>
      <div class="market-odds">
        <div><span class="yes">${yes.toFixed(0)}¢</span><span class="v">yes</span></div>
        <div><span class="no">${no.toFixed(0)}¢</span><span class="v">no</span></div>
      </div>
      <div class="market-vol">${fmtUsd(m.volume_24h)}<span class="v">vol 24h</span></div>
    </div>
  `;
}

// 24h price movement chip — the alpha signal traders scan for.
function renderMove(ch) {
  const pp = Math.abs(Number(ch) || 0) * 100;
  if (pp < 0.5) return "";
  const up = (Number(ch) || 0) > 0;
  return `<span class="mv ${up ? "up" : "dn"}">${up ? "▲" : "▼"}${pp.toFixed(pp >= 10 ? 0 : 1)}</span>`;
}

// ── WHALE FIREHOSE ────────────────────────────────────────────────────
async function loadWhales() {
  const meta = $("#metaWhales");
  const body = $("#bodyWhales");
  // Try descending thresholds so the panel never goes dead during quiet
  // markets. Each tier is the threshold + the label we show in the meta.
  const tiers = [
    { min: 5000, label: "≥$5K" },
    { min: 1000, label: "≥$1K" },
    { min: 100, label: "≥$100" },
    { min: 0, label: "all" },
  ];
  try {
    let trades = [];
    let activeLabel = "";
    for (const t of tiers) {
      const r = await fetch(`/api/whales/firehose?min=${t.min}&limit=20`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
      if ((data.trades || []).length) {
        trades = data.trades;
        activeLabel = t.label;
        break;
      }
    }
    lastFetchedAt.whales = Date.now();
    if (!trades.length) {
      body.innerHTML = `<div class="empty">No trades in current window.<br>Polymarket activity at zero — extremely rare.</div>`;
      meta.textContent = "0 trades";
      return;
    }
    liveList(body, trades, { key: (t) => `${t.wallet}|${t.market_title}|${t.side}|${t.usd}`, render: renderWhaleRow });
    meta.textContent = `${trades.length} · ${activeLabel} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (err) {
    meta.textContent = "error";
    body.innerHTML = `<div class="empty">${escapeHtml(err.message || "failed")}</div>`;
  }
}

function renderWhaleRow(t) {
  const sideCls = t.side === "BUY" ? "buy" : "sell";
  const initial = (t.name || t.wallet || "?")[0].toUpperCase();
  return `
    <div class="row whale-row" data-wallet="${escapeAttr(t.wallet)}">
      <div class="whale-avatar">${
        t.profile_image
          ? `<img src="${escapeAttr(t.profile_image)}" alt="">`
          : escapeHtml(initial)
      }</div>
      <div class="whale-who">
        <div class="name">${escapeHtml(t.name || short(t.wallet, 6))}</div>
        <div class="meta">
          <span class="side ${sideCls}">${t.side} ${escapeHtml(t.outcome || "")}</span>
          <span>·</span>
          <span>${escapeHtml((t.market_title || "").slice(0, 50))}</span>
        </div>
      </div>
      <div class="whale-amount">${fmtUsd(t.usd)}</div>
    </div>
  `;
}

// ── BUZZ HEAT INDEX ───────────────────────────────────────────────────
async function loadBuzz() {
  const meta = $("#metaBuzz");
  const body = $("#bodyBuzz");
  try {
    const r = await fetch("/api/buzz/markets?limit=12");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);

    lastFetchedAt.buzz = Date.now();
    const markets = data.markets || [];
    if (!markets.length) {
      body.innerHTML = `<div class="empty">No active chatter detected.</div>`;
      meta.textContent = "0 markets";
      return;
    }
    liveList(body, markets, { key: (m) => m.market_url || m.title, render: renderBuzzRow });
    meta.textContent = `${markets.length} · ${data.counts.threads_matched}/${data.counts.threads_total} matched`;
    $("#globalBuzz").textContent = data.counts.threads_matched.toLocaleString();
    $("#globalBuzzSub").textContent = `of ${data.counts.threads_total} threads`;
  } catch (err) {
    meta.textContent = "error";
    body.innerHTML = `<div class="empty">${escapeHtml(err.message || "failed")}</div>`;
  }
}

function renderBuzzRow(m) {
  const url = m.market_url || "#";
  return `
    <div class="row buzz-row" data-url="${escapeAttr(url)}">
      <div>
        <div class="title">${escapeHtml(m.title || "")}</div>
        <div class="meta">${m.thread_count} threads · ${m.unique_sources.length} sources · ${m.total_upvotes} upvotes</div>
      </div>
      <div class="buzz-heat">${m.heat}<span class="lbl">heat</span></div>
    </div>
  `;
}

// ── BREAKING NEWS ─────────────────────────────────────────────────────
// Sources: news (RSS) + hn. Pulled from /api/buzz/feed filtered client-side.
async function loadNews() {
  const meta = $("#metaNews");
  const body = $("#bodyNews");
  try {
    const r = await fetch("/api/buzz/feed?limit=80&matched=0");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);

    lastFetchedAt.news = Date.now();
    const news = (data.threads || [])
      .filter((t) => t.source === "news" || t.source === "hn")
      .slice(0, 18);
    if (!news.length) {
      body.innerHTML = `<div class="empty">No fresh news in window.</div>`;
      meta.textContent = "0";
      return;
    }
    liveList(body, news, { key: (t) => t.url || t.title, render: renderNewsRow });
    meta.textContent = `${news.length} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (err) {
    meta.textContent = "error";
    body.innerHTML = `<div class="empty">${escapeHtml(err.message || "failed")}</div>`;
  }
}

function renderNewsRow(t) {
  const outlet = t.source === "hn" ? "HN · FRONT PAGE" : (t.subsource || "NEWS").toUpperCase();
  const match = t.matches && t.matches[0];
  return `
    <div class="row news-row" data-url="${escapeAttr(t.url)}">
      <div class="outlet">${escapeHtml(outlet)}</div>
      <div class="headline">${escapeHtml(t.title || "")}</div>
      <div class="meta-foot">
        <span>${fmtAgo(t.created_at)} ago</span>
        ${t.score ? `<span>▲ ${t.score}</span>` : ""}
        ${
          match
            ? `<span class="matched-pill"><span class="market">${escapeHtml(match.title.slice(0, 40))}</span><span style="color:var(--lime)">${Math.round(match.score * 100)}%</span></span>`
            : ""
        }
      </div>
    </div>
  `;
}

// ── GLOBAL STATS (from markets endpoint) ──────────────────────────────
function updateGlobalStats(data) {
  if (!data || !data.stats) return;
  const s = data.stats;
  $("#globalVolume").textContent = fmtUsd(s.total_volume_24h);
  $("#globalMarkets").textContent = s.total_markets ?? "—";
  $("#globalMarketsSub").innerHTML = `<span class="pos">${s.by_source?.polymarket || 0}</span> poly · <span class="pos">${s.by_source?.kalshi || 0}</span> kalshi`;
}

// ── refresh state indicator ──────────────────────────────────────────
function updateRefreshDots() {
  const now = Date.now();
  for (const [name, lastAt] of Object.entries(lastFetchedAt)) {
    const dot = $(`#dot${name[0].toUpperCase() + name.slice(1)}`);
    if (!dot) continue;
    if (!lastAt) {
      dot.classList.add("dead");
      continue;
    }
    const age = now - lastAt;
    dot.classList.toggle("stale", age >= STALE_AFTER && age < DEAD_AFTER);
    dot.classList.toggle("dead", age >= DEAD_AFTER);
    if (age < STALE_AFTER) dot.classList.remove("stale", "dead");
  }
  const newest = Math.max(...Object.values(lastFetchedAt));
  $("#lastPulse").textContent = newest ? fmtAgo(Math.floor(newest / 1000)) : "—";
}

// ── click delegation (avoid attaching listeners on every refresh) ────
document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-wallet]");
  if (row) {
    location.href = `/whales.html?wallet=${row.dataset.wallet}`;
    return;
  }
  const link = e.target.closest("[data-url]");
  if (link) {
    const url = link.dataset.url;
    if (!url || url === "#") return;
    // Internal links (start with /) — in-tab navigation feels native.
    // External (Polymarket / Kalshi / news articles) — new tab so the user
    // doesn't lose the dashboard.
    if (url.startsWith("/")) {
      location.href = url;
    } else {
      window.open(url, "_blank", "noopener");
    }
  }
});

// ── boot + schedule ───────────────────────────────────────────────────
// Live loops — poll on cadence, pause while the tab is hidden, refresh on return.
liveLoop(loadMarkets, INTERVALS.markets);
liveLoop(loadWhales, INTERVALS.whales);
liveLoop(loadBuzz, INTERVALS.buzz);
liveLoop(loadNews, INTERVALS.news);
setInterval(updateRefreshDots, 1_000);

// Whales count from the leaderboard (separate, lower-freq)
async function updateWhalesGlobal() {
  try {
    const r = await fetch("/api/whales/leaderboard?limit=5");
    const data = await r.json();
    if (data?.total_active_wallets) {
      $("#globalWhales").textContent = data.total_active_wallets.toLocaleString();
    }
  } catch {}
}
updateWhalesGlobal();
setInterval(updateWhalesGlobal, 120_000);
