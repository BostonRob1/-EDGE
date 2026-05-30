// $EDGE Cross-Platform Radar frontend.
// Renders the two-tier signal model from /api/arb/opportunities:
//   ARB        — contracts align + gap clears fees (rare, flagged green).
//   DIVERGENCE — same question, different price (the everyday research edge).
// Empty is a valid, honest state: it means the platforms aren't listing
// comparable contracts right now — shown transparently, not apologetically.
import { fmtUsd, escapeHtml, escapeAttr } from "/lib/client/format.js";
import { liveList, liveLoop } from "/lib/client/live.js";

const $ = (sel, root = document) => root.querySelector(sel);

async function load() {
  try {
    const r = await fetch("/api/arb/opportunities");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderStats(data.stats);
    renderSignals(data.signals || [], data.stats || {});
    renderLandscape(data.landscape || {});
    const arbs = (data.signals || []).filter((s) => s.type === "ARB").length;
    $("#oppsMeta").textContent =
      `${(data.signals || []).length} signals · ${arbs} arb${arbs === 1 ? "" : "s"} · ` +
      new Date(data.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (err) {
    $("#oppsMeta").textContent = "error";
    $("#arbGrid").innerHTML = `<div class="empty"><strong>Scanner offline.</strong><br>${escapeHtml(err.message || "scan failed")}</div>`;
  }
}

function renderStats(s) {
  if (!s) return;
  $("#statScanned").textContent = (s.poly_markets || 0) + (s.kalshi_markets || 0);
  $("#statScannedSub").textContent = `${s.poly_markets} poly · ${s.kalshi_markets} kalshi`;
  $("#statPairs").textContent = s.pairs_matched ?? "—";
  $("#statOpps").textContent = s.divergences_found ?? "—";
  $("#statBiggest").textContent = s.biggest_divergence_pp > 0 ? `${s.biggest_divergence_pp.toFixed(1)}pp` : "—";
  $("#statBuffer").textContent = s.arbs_found ?? "0";
}

function renderSignals(signals, stats) {
  const el = $("#arbGrid");
  if (!signals.length) {
    el.innerHTML = renderEmpty(stats);
    return;
  }
  liveList(el, signals, { key: (s) => `${s.poly.title}|${s.kalshi.title}`, render: renderSignal });
}

// Confident, transparent empty state — shows the scanner IS working hard.
function renderEmpty(stats) {
  const cats = (stats.categories || [])
    .map((c) => `<span class="cat-chip">${escapeHtml(c.name)} <b>${c.n}</b></span>`)
    .join("");
  return `
    <div class="empty radar-empty">
      <div class="radar-ping"><span></span><span></span><span></span></div>
      <strong>No comparable contracts live right now.</strong>
      <p>
        Scanning <b>${stats.poly_markets || 0}</b> Polymarket × <b>${stats.kalshi_markets || 0}</b> Kalshi
        markets every 30s. Zero matched pairs means the two platforms simply aren't listing the
        <em>same, identically-settling</em> question at this moment — Polymarket is heavy on sports
        and monthly "reach&nbsp;$X" bets; Kalshi is heavy on politics and point-in-time strikes.
      </p>
      <p class="radar-note">
        This is the honest default in healthy markets. The instant the same event prices differently
        on both — election day, a Fed print, a crypto level both list — it surfaces here.
        We'd rather show nothing than fake an arb.
      </p>
      <div class="cat-row"><span class="cat-lbl">Kalshi coverage now:</span>${cats}</div>
    </div>`;
}

function renderSignal(s) {
  const isArb = s.type === "ARB";
  const gap = s.divergence_pp.toFixed(1);
  const winNote =
    s.window === "same" ? "same settlement window"
    : s.window === "near" ? "windows ~aligned"
    : "verify settlement window";

  // Center metric: for arbs show the fee-adjusted edge + ROI; for divergences
  // show the raw price gap (honestly labelled as a research signal).
  const center = isArb
    ? `
      <div class="pp">${s.arb.fee_adj_edge_pp.toFixed(1)}pp</div>
      <div class="pp-lbl">fee-adj edge</div>
      <div class="conf-pill">EXECUTABLE ARB</div>
      <div class="stake-row"><strong>${s.arb.roi_pct_after_fees.toFixed(1)}% ROI</strong><br>${escapeHtml(s.arb.confidence)} confidence</div>`
    : `
      <div class="pp">${gap}pp</div>
      <div class="pp-lbl">price gap</div>
      <div class="conf-pill div">DIVERGENCE</div>
      <div class="stake-row">${winNote}<br><span style="opacity:.7">match ${(s.match_score * 100).toFixed(0)}%</span></div>`;

  return `
    <div class="arb ${isArb ? "conf-HIGH" : "is-divergence"}">
      <div class="leg">
        <div class="leg-platform poly"><span class="dot"></span>Polymarket</div>
        <div class="leg-action"><span class="price">${(s.poly.yes_price * 100).toFixed(0)}¢</span><span class="side-lbl">YES</span></div>
        <div class="leg-title">${escapeHtml(s.poly.title)}</div>
        <div class="leg-meta"><span>vol 24h ${fmtUsd(s.poly.volume_24h)}</span><span>·</span><span>${escapeHtml(s.poly.category || "")}</span></div>
        ${s.poly.link ? `<a href="${escapeAttr(s.poly.link)}" target="_blank" rel="noopener" class="leg-link">Open on Polymarket ↗</a>` : ""}
      </div>
      <div class="arb-edge">${center}</div>
      <div class="leg">
        <div class="leg-platform kalshi"><span class="dot"></span>Kalshi</div>
        <div class="leg-action"><span class="price">${(s.kalshi.yes_price * 100).toFixed(0)}¢</span><span class="side-lbl">YES</span></div>
        <div class="leg-title">${escapeHtml(s.kalshi.title)}</div>
        <div class="leg-meta"><span>vol 24h ${fmtUsd(s.kalshi.volume_24h)}</span><span>·</span><span>${escapeHtml(s.kalshi.category || "")}</span></div>
        ${s.kalshi.link ? `<a href="${escapeAttr(s.kalshi.link)}" target="_blank" rel="noopener" class="leg-link">Open on Kalshi ↗</a>` : ""}
      </div>
    </div>`;
}

// Always-on cross-platform heat board — the hottest live markets on each
// platform, side by side. Makes the radar valuable every second of the day.
function renderLandscape(l) {
  fillHeat("#heatPoly", l.polymarket || []);
  fillHeat("#heatKalshi", l.kalshi || []);
}
function fillHeat(sel, arr) {
  const el = $(sel);
  if (!el) return;
  if (!arr.length) { el.innerHTML = `<div class="heat-empty">waiting for feed…</div>`; return; }
  liveList(el, arr, { key: (m) => m.title, render: heatRow });
}
function heatRow(m) {
  return `<a class="heat-row"${m.link ? ` href="${escapeAttr(m.link)}" target="_blank" rel="noopener"` : ""}>
      <span class="heat-title">${escapeHtml(m.title)}</span>
      <span class="heat-num"><b>${Math.round((m.yes_price || 0) * 100)}¢</b><span>yes</span></span>
      <span class="heat-num heat-vol"><b>${fmtUsd(m.volume_24h)}</b><span>24h</span></span>
    </a>`;
}

// Live loop — 8s cadence (heavier scan), paused while the tab is hidden.
liveLoop(load, 8_000);
