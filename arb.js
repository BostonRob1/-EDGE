// $EDGE Arbitrage Radar frontend.
// Fetches /api/arb/opportunities, renders ranked arb cards.
import { fmtUsd, fmtNum, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);

async function load() {
  try {
    const r = await fetch("/api/arb/opportunities");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderStats(data.stats);
    renderOpps(data.opportunities || []);
    $("#oppsMeta").textContent =
      (data.opportunities || []).length +
      " arbs · last scan " +
      new Date(data.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (err) {
    $("#oppsMeta").textContent = "error";
    $("#arbGrid").innerHTML = `<div class="empty">${escapeHtml(err.message || "scan failed")}</div>`;
  }
}

function renderStats(s) {
  if (!s) return;
  $("#statScanned").textContent = (s.poly_markets || 0) + (s.kalshi_markets || 0);
  $("#statScannedSub").textContent = `${s.poly_markets} poly · ${s.kalshi_markets} kalshi`;
  $("#statPairs").textContent = s.pairs_matched ?? "—";
  $("#statOpps").textContent = s.opportunities_found ?? "—";
  $("#statBiggest").textContent =
    s.biggest_edge_pp > 0 ? `${s.biggest_edge_pp.toFixed(1)}pp` : "—";
  $("#statBuffer").textContent = s.fee_buffer_pp ? `${s.fee_buffer_pp.toFixed(1)}pp` : "—";
}

function renderOpps(opps) {
  const el = $("#arbGrid");
  if (!opps.length) {
    el.innerHTML = `
      <div class="empty">
        <span class="pulse"></span><strong>No arbitrage opportunities right now.</strong><br><br>
        Cross-platform arbs are rare — Polymarket and Kalshi often cover different events,
        and tight markets equilibrate within minutes. The scanner re-runs every 30 seconds.
        <br><br>
        Honest take: a quiet scanner is the <strong>default state</strong> in healthy markets.
        Edges appear during news events, market opens/closes, or when one platform's
        liquidity thins.
      </div>`;
    return;
  }

  el.innerHTML = opps.map(renderArb).join("");
}

function renderArb(a) {
  const conf = a.confidence || "MEDIUM";
  const stake100 = Math.round(a.profit_per_100_capital * 10) / 10; // already a percentage
  const profitOn1000 = Math.round(stake100 * 10);

  return `
    <div class="arb conf-${conf}">
      <!-- LEFT LEG: POLYMARKET -->
      <div class="leg">
        <div class="leg-platform poly"><span class="dot"></span>Polymarket</div>
        <div class="leg-action">
          <span class="side ${a.leg_poly.side}">BUY ${escapeHtml(a.leg_poly.side)}</span>
          <span class="price">${(a.leg_poly.price * 100).toFixed(0)}¢</span>
        </div>
        <div class="leg-title">${escapeHtml(a.poly_market.title)}</div>
        <div class="leg-meta">
          <span>vol 24h ${fmtUsd(a.poly_market.volume_24h)}</span>
          <span>·</span>
          <span>${escapeHtml(a.poly_market.category || "")}</span>
        </div>
        ${a.leg_poly.market_link ? `<a href="${escapeAttr(a.leg_poly.market_link)}" target="_blank" rel="noopener" class="leg-link">Open on Polymarket ↗</a>` : ""}
      </div>

      <!-- CENTER: EDGE METRICS -->
      <div class="arb-edge">
        <div class="pp">${a.fee_adj_edge_pp.toFixed(1)}pp</div>
        <div class="pp-lbl">fee-adj edge</div>
        <div class="conf-pill">${escapeHtml(conf)}</div>
        <div class="stake-row">
          <strong>${a.roi_pct_after_fees.toFixed(2)}% ROI</strong><br>
          $${profitOn1000} profit per $1k<br>
          <span style="opacity:0.7">match score ${(a.match_score * 100).toFixed(0)}%</span>
        </div>
      </div>

      <!-- RIGHT LEG: KALSHI -->
      <div class="leg">
        <div class="leg-platform kalshi"><span class="dot"></span>Kalshi</div>
        <div class="leg-action">
          <span class="side ${a.leg_kalshi.side}">BUY ${escapeHtml(a.leg_kalshi.side)}</span>
          <span class="price">${(a.leg_kalshi.price * 100).toFixed(0)}¢</span>
        </div>
        <div class="leg-title">${escapeHtml(a.kalshi_market.title)}</div>
        <div class="leg-meta">
          <span>vol 24h ${fmtUsd(a.kalshi_market.volume_24h)}</span>
          <span>·</span>
          <span>${escapeHtml(a.kalshi_market.category || "")}</span>
        </div>
        ${a.leg_kalshi.market_link ? `<a href="${escapeAttr(a.leg_kalshi.market_link)}" target="_blank" rel="noopener" class="leg-link">Open on Kalshi ↗</a>` : ""}
      </div>
    </div>
  `;
}

load();
setInterval(load, 30_000);
