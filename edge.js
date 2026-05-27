// $EDGE Divergence Radar frontend.
// Fetches /api/edge/scores, renders Active Calls + full Markets table.
import { fmtUsd, fmtNum, fmtAgo, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function load() {
  try {
    const r = await fetch("/api/edge/scores?limit=30");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderStats(data.stats);
    renderActiveCalls(data.active_calls || []);
    renderAllMarkets(data.markets || []);
    $("#callsMeta").textContent = `${(data.active_calls || []).length} calls · ${new Date(data.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    $("#allMeta").textContent = `${(data.markets || []).length} markets · sorted by divergence`;
  } catch (err) {
    $("#callsGrid").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    $("#callsMeta").textContent = "error";
  }
}

function renderStats(s) {
  if (!s) return;
  $("#statAnalyzed").textContent = s.markets_analyzed ?? "—";
  $("#statAnalyzedSub").textContent = `${s.with_chatter} with chatter`;
  $("#statCalls").textContent = s.active_calls ?? "—";
  $("#statInsider").textContent = s.insider_flow_count ?? "—";
  $("#statFront").textContent = s.front_running_count ?? "—";
  $("#statMax").textContent = s.max_divergence ?? "—";
}

function callCls(call) {
  if (call === "INSIDER FLOW") return "insider";
  if (call === "FRONT-RUNNING") return "front";
  return "aligned";
}

function renderActiveCalls(calls) {
  const el = $("#callsGrid");
  if (!calls.length) {
    el.innerHTML = `
      <div class="empty">
        No divergences exceed the threshold right now. Money and mouth in agreement.<br>
        Calls re-evaluate every 30s.
      </div>`;
    return;
  }

  el.innerHTML = calls
    .map((c) => {
      const cls = callCls(c.edge_call);
      const yes = ((Number(c.yes_price) || 0) * 100).toFixed(0);
      const no = ((Number(c.no_price) || 0) * 100).toFixed(0);
      const ch24 = Number(c.price_change_24h) || 0;
      const chCls = ch24 > 0 ? "pos" : ch24 < 0 ? "neg" : "";
      return `
        <div class="call ${cls}" data-url="${escapeAttr(c.slug ? "/market.html?slug=" + encodeURIComponent(c.slug) : c.url || "#")}">
          <div class="call-head">
            <div>
              <div class="call-tag">${escapeHtml(c.edge_call)}</div>
            </div>
            <div class="call-divergence">${c.divergence}<span class="lbl">Δ score</span></div>
          </div>
          <div class="call-title">${escapeHtml(c.title)}</div>
          <div class="call-odds">
            <div><div class="lbl">YES</div><div class="val pos">${yes}¢</div></div>
            <div><div class="lbl">NO</div><div class="val neg">${no}¢</div></div>
            <div><div class="lbl">24h Δ</div><div class="val ${chCls}">${ch24 ? ch24.toFixed(2) + "%" : "—"}</div></div>
            <div><div class="lbl">Vol 24h</div><div class="val">${fmtUsd(c.volume_24h)}</div></div>
          </div>
          <div class="bars">
            <div class="bar-row money">
              <span class="lbl">Money</span>
              <div class="bar" style="--w:${c.money_intensity}%"></div>
              <span class="v">${c.money_intensity}</span>
            </div>
            <div class="bar-row mouth">
              <span class="lbl">Mouth</span>
              <div class="bar" style="--w:${c.mouth_intensity}%"></div>
              <span class="v">${c.mouth_intensity}</span>
            </div>
          </div>
          <div class="call-thesis"><strong>${escapeHtml(c.edge_call)}.</strong> ${escapeHtml(c.edge_thesis)}</div>
        </div>
      `;
    })
    .join("");
}

function renderAllMarkets(markets) {
  const table = $("#marketsTable");
  // Keep header (5 cells), replace rows
  const headerCount = 5;
  while (table.children.length > headerCount) table.removeChild(table.lastChild);

  if (!markets.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No markets returned.";
    table.appendChild(empty);
    return;
  }

  markets.forEach((m) => {
    const cls = callCls(m.edge_call);
    const wrap = document.createElement("div");
    wrap.className = "market-row-wrap";
    // Route to our internal per-market page instead of external Polymarket
    wrap.dataset.url = m.slug ? "/market.html?slug=" + encodeURIComponent(m.slug) : m.url || "#";
    wrap.innerHTML = `
      <div class="title">${escapeHtml(m.title)}</div>
      <div class="money">
        <div class="mini-bar" style="--w:${m.money_intensity}%"></div>
        <span>${m.money_intensity}</span>
      </div>
      <div class="mouth">
        <div class="mini-bar" style="--w:${m.mouth_intensity}%"></div>
        <span>${m.mouth_intensity}</span>
      </div>
      <div class="div"><span class="v">${m.divergence}</span></div>
      <div style="justify-content:center"><span class="pill ${cls}">${escapeHtml(m.edge_call)}</span></div>
    `;
    table.appendChild(wrap);
  });
}

// Click delegation — internal links (starting with /) navigate in-tab,
// external markets open in a new tab.
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-url]");
  if (!el) return;
  const url = el.dataset.url;
  if (!url || url === "#") return;
  if (url.startsWith("/")) {
    location.href = url;
  } else {
    window.open(url, "_blank", "noopener");
  }
});

load();
setInterval(load, 30_000);
