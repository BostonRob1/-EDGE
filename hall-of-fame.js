// $EDGE Hall of Fame — the permanent, ranked record of the most profitable
// Polymarket wallets. Reads /api/whales/hall-of-fame (persistent KV roster, or
// live top-50 fallback), renders a searchable leaderboard, refreshes on a loop.
import { short, escapeHtml, escapeAttr } from "/lib/client/format.js";
import { liveList, liveLoop } from "/lib/client/live.js";

const $ = (s, r = document) => r.querySelector(s);
const state = { wallets: [], query: "" };

function pnlUsd(n) {
  const a = Math.abs(Number(n) || 0);
  const s =
    a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B`
    : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M`
    : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K`
    : `$${Math.round(a)}`;
  return (n < 0 ? "−" : "+") + s;
}
function sinceLabel(ts) {
  if (!ts) return "—";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days < 30) return `${days}d`;
  const mo = Math.floor(days / 30);
  return mo < 12 ? `${mo}mo` : `${Math.floor(mo / 12)}y`;
}

async function load() {
  try {
    const r = await fetch("/api/whales/hall-of-fame?limit=200");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    state.wallets = data.wallets || [];
    renderStats(data);
    renderStatus(data);
    renderBoard();
  } catch (err) {
    $("#hofListMeta").textContent = "error";
    if (!$("#hofBoard .hof-row")) {
      $("#hofBoard").innerHTML = `<div class="empty"><strong>Hall of Fame offline.</strong><br>${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderStats(data) {
  const w = state.wallets;
  const top = w[0];
  $("#hofTotal").textContent = (data.total_tracked || w.length).toLocaleString();
  $("#hofTopName").textContent = top?.name || "—";
  $("#hofTop").textContent = top ? pnlUsd(top.pnl_usd) : "—";
  $("#hofCombined").textContent = pnlUsd(w.reduce((s, x) => s + (x.pnl_usd || 0), 0));
  const mode = $("#hofMode");
  mode.textContent = data.persistent ? "PERSISTENT" : "LIVE";
  mode.style.color = data.persistent ? "var(--green)" : "var(--amber)";
}

function renderStatus(data) {
  const el = $("#statusInner");
  if (data.persistent) {
    el.className = "inner persistent";
    el.innerHTML = `<span class="badge">● Persistent</span> <span><b>${(data.total_tracked || 0).toLocaleString()}</b> wallets in the permanent index — growing every harvest.</span>`;
  } else {
    el.className = "inner live";
    el.innerHTML = `<span class="badge">⚡ Live mode</span> <span>Showing Polymarket's live top 50. <b>Connect Vercel KV</b> to grow the record past 50 and remember every profitable wallet forever.</span>`;
  }
  el.style.display = "flex";
}

function renderBoard() {
  const q = state.query.trim().toLowerCase();
  const rows = q
    ? state.wallets.filter((w) => (w.name || "").toLowerCase().includes(q) || (w.wallet || "").toLowerCase().includes(q))
    : state.wallets;
  $("#hofListMeta").textContent = `${rows.length} wallet${rows.length === 1 ? "" : "s"}${q ? " matched" : ""}`;
  const board = $("#hofBoard");
  if (!rows.length) {
    board.innerHTML = `<div class="empty">No wallets match “${escapeHtml(state.query)}”.</div>`;
    return;
  }
  liveList(board, rows, { key: (w) => w.wallet, render: hofRow, flash: !q });
}

function hofRow(w) {
  const top = w.rank <= 3 ? ` top${w.rank}` : "";
  const av = w.image
    ? `<img src="${escapeAttr(w.image)}" alt="" loading="lazy">`
    : escapeHtml((w.name || w.wallet || "?")[0].toUpperCase());
  return `<a class="hof-row${top}" href="/whales.html?wallet=${escapeAttr(w.wallet)}">
    <div class="hof-rank">${w.rank}</div>
    <div class="hof-av">${av}</div>
    <div class="hof-id"><div class="n">${escapeHtml(w.name || short(w.wallet, 8))}</div><div class="w">${short(w.wallet, 10)}</div></div>
    <div class="hof-since">${w.first_seen ? `tracked ${sinceLabel(w.first_seen)}` : "—"}</div>
    <div class="hof-pnl"><div class="v">${pnlUsd(w.pnl_usd)}</div><div class="l">all-time profit</div></div>
  </a>`;
}

$("#hofSearch").addEventListener("input", (e) => {
  state.query = e.target.value;
  renderBoard();
});

liveLoop(load, 30_000);
