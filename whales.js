// $EDGE Whales frontend. URL-state driven:
//   /whales.html          → firehose + leaderboard
//   /whales.html?wallet=… → wallet detail
import { fmtUsd, fmtUsdExact, fmtPct, fmtAgo, short, escapeHtml, escapeAttr } from "/lib/client/format.js";
import { liveList, liveLoop } from "/lib/client/live.js";

const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

const polymarketMarketUrl = (slug) => (slug ? `https://polymarket.com/market/${slug}` : "#");

// ── state ─────────────────────────────────────────────────────────────
const state = {
  tab: "smart",
  threshold: 5000,
  seenTradeKeys: new Set(),
  refreshTimer: null,
  stopSmart: null,
  smart: { data: null, window: "all", minTape: 0 },
};

// ── ROUTING ───────────────────────────────────────────────────────────
function route() {
  const params = new URLSearchParams(location.search);
  const wallet = params.get("wallet");
  clearTimers();
  state.seenTradeKeys = new Set();

  if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    renderWalletShell(wallet);
    loadWallet(wallet);
  } else {
    state.tab = params.get("tab") === "live" ? "live" : "smart";
    renderListShell();
    activateTab(state.tab);
  }
}

function clearTimers() {
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  if (state.stopSmart) { state.stopSmart(); state.stopSmart = null; }
}

// ── LIST PAGE (tabbed: Smart Money / Live Action) ─────────────────────
function renderListShell() {
  main.innerHTML = `
    <section class="hero" id="whaleHero"></section>
    <div class="whale-tabs">
      <button class="whale-tab" data-tab="smart"><span class="tico">🏆</span> Smart Money <span class="tnew">NEW</span></button>
      <button class="whale-tab" data-tab="live"><span class="tico">⚡</span> Live Action</button>
    </div>
    <div id="tabHost"></div>
  `;
  document.querySelectorAll(".whale-tab").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.tab === state.tab) return;
      history.replaceState({}, "", b.dataset.tab === "live" ? "?tab=live" : location.pathname);
      activateTab(b.dataset.tab);
    });
  });
}

function activateTab(tab) {
  clearTimers();
  state.tab = tab;
  state.seenTradeKeys = new Set();
  document.querySelectorAll(".whale-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "live") renderLiveTab();
  else renderSmartTab();
}

// money formatting for P&L (always signed): +$22.1M / -$340K
function pnlUsd(n) {
  const a = Math.abs(Number(n) || 0);
  const s =
    a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B`
    : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M`
    : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K`
    : `$${Math.round(a)}`;
  return (n < 0 ? "−" : "+") + s;
}
const WIN_LABEL = { "1d": "last 24h", "7d": "last 7 days", "30d": "last 30 days", all: "all-time" };
const WIN_SHORT = { "1d": "24h", "7d": "7d", "30d": "30d", all: "all-time" };

// ── SMART MONEY TAB ───────────────────────────────────────────────────
function renderSmartTab() {
  $("#whaleHero").innerHTML = `
    <h1>SMART <span class="accent">MONEY</span></h1>
    <p class="tagline">
      The <strong>most profitable wallets</strong> on Polymarket — ranked by real, settled profit —
      and every bet they place, <strong>the second they place it</strong>.
    </p>
    <div class="stat-strip">
      <div class="stat-cell pnl"><div class="lbl">#1 · <span id="smTopName">—</span></div><div class="val" id="smTop">—</div></div>
      <div class="stat-cell pnl"><div class="lbl">Top 50 Combined P&L</div><div class="val" id="smCombined">—</div></div>
      <div class="stat-cell alt"><div class="lbl">Profitable Wallets Tracked</div><div class="val" id="smTracked">—</div></div>
      <div class="stat-cell alt"><div class="lbl"><span class="live-pulse"><span class="dot"></span>Live Now</span></div><div class="val" id="smLive">—</div></div>
    </div>
  `;
  $("#tabHost").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>Most <span class="accent">Profitable</span> Wallets</h2>
        <div class="threshold-toggle" id="smWindowToggle">
          <button data-w="1d">24H</button>
          <button data-w="7d">7D</button>
          <button data-w="30d">30D</button>
          <button data-w="all" class="active">All-Time</button>
        </div>
        <div class="meta" id="smBoardMeta">loading…</div>
      </div>
      <div class="sm-board" id="smBoard">
        <div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>
      </div>
      <div class="kalshi-note">
        <b>Why Polymarket only?</b> It settles on-chain, so every wallet's profit is public and verifiable —
        that's how we can rank who is actually winning. Kalshi keeps trader identities and P&L private, so an
        honest leaderboard isn't possible there. We'd rather show real, provable names than fake a list.
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>Smart Money <span class="accent">Moving Now</span></h2>
        <div class="threshold-toggle" id="smTapeToggle">
          <button data-min="0" class="active">All</button>
          <button data-min="1000">$1K+</button>
          <button data-min="10000">$10K+</button>
          <button data-min="50000">$50K+</button>
        </div>
        <div class="meta" id="smTapeMeta">loading…</div>
      </div>
      <div class="sm-tape" id="smTape">
        <div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>
      </div>
      <div class="sm-note">
        Live trades placed by any of the tracked profitable wallets, newest first. Each badge shows that
        wallet's <b>standing</b>. Polymarket clears hundreds of trades a minute — this refreshes every few seconds.
      </div>
    </section>
  `;
  document.querySelectorAll("#smWindowToggle button").forEach((b) => {
    b.addEventListener("click", () => {
      state.smart.window = b.dataset.w;
      document.querySelectorAll("#smWindowToggle button").forEach((x) => x.classList.toggle("active", x === b));
      renderSmartBoard();
    });
  });
  document.querySelectorAll("#smTapeToggle button").forEach((b) => {
    b.addEventListener("click", () => {
      state.smart.minTape = Number(b.dataset.min);
      document.querySelectorAll("#smTapeToggle button").forEach((x) => x.classList.toggle("active", x === b));
      renderSmartTape();
    });
  });
  state.stopSmart = liveLoop(loadSmart, 6_000);
}

async function loadSmart() {
  try {
    const r = await fetch("/api/whales/smart-money");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    state.smart.data = data;
    renderSmartStats(data.stats);
    renderSmartBoard();
    renderSmartTape();
  } catch (err) {
    const meta = $("#smBoardMeta"); if (meta) meta.textContent = "feed error";
    const b = $("#smBoard");
    if (b && !b.querySelector(".sm-row")) b.innerHTML = `<div class="empty"><strong>Smart-money feed offline.</strong><br>${escapeHtml(err.message)}</div>`;
  }
}

function renderSmartStats(s) {
  if (!s) return;
  const set = (id, v) => { const el = $("#" + id); if (el) el.textContent = v; };
  set("smTopName", s.top_name || "—");
  set("smTop", pnlUsd(s.top_pnl));
  set("smCombined", pnlUsd(s.top50_combined_pnl));
  set("smTracked", (s.tracked_wallets || 0).toLocaleString());
  set("smLive", (s.tape_matches || 0).toLocaleString());
}

function renderSmartBoard() {
  const data = state.smart.data; if (!data) return;
  const win = state.smart.window;
  const rows = data.windows?.[win] || [];
  const meta = $("#smBoardMeta");
  if (meta) meta.textContent = `top ${rows.length} by profit · ${WIN_LABEL[win]}`;
  const board = $("#smBoard"); if (!board) return;
  if (!rows.length) { board.innerHTML = `<div class="empty">No ranked wallets for this window yet.</div>`; return; }
  liveList(board, rows, { key: (w) => w.wallet, render: smRow });
}

function smRow(w) {
  const top = w.rank <= 3 ? ` top${w.rank}` : "";
  const av = w.image
    ? `<img src="${escapeAttr(w.image)}" alt="" loading="lazy">`
    : escapeHtml((w.name || w.wallet || "?")[0].toUpperCase());
  return `<a class="sm-row${top}" href="?wallet=${escapeAttr(w.wallet)}">
    <div class="sm-rank">${w.rank}</div>
    <div class="sm-av">${av}</div>
    <div class="sm-id"><div class="n">${escapeHtml(w.name || short(w.wallet, 8))}</div><div class="w">${short(w.wallet, 8)}</div></div>
    <div class="sm-pnl"><div class="v">${pnlUsd(w.pnl_usd)}</div><div class="l">profit</div></div>
  </a>`;
}

function renderSmartTape() {
  const data = state.smart.data; if (!data) return;
  const min = state.smart.minTape;
  const rows = (data.tape || []).filter((t) => (t.usd || 0) >= min);
  const meta = $("#smTapeMeta");
  if (meta) {
    meta.innerHTML = `<span class="live-pulse"><span class="dot"></span></span> ${rows.length} sharp trade${rows.length === 1 ? "" : "s"} · ${new Date(data.fetched_at).toLocaleTimeString()}`;
  }
  const tape = $("#smTape"); if (!tape) return;
  if (!rows.length) {
    tape.innerHTML = `<div class="empty">No tracked sharp has traded ${min ? `above ${fmtUsd(min)} ` : ""}in the last ${data.firehose_window} market trades.<br>They move constantly — sit tight${min ? `, or drop the filter` : ""}.</div>`;
    return;
  }
  liveList(tape, rows, {
    key: (t) => `${t.tx_hash || ""}-${t.timestamp}-${t.wallet}`,
    render: smTapeRow,
    max: 40,
  });
}

function smTapeRow(t) {
  const dir = t.side === "BUY" ? "buy" : "sell";
  const av = t.image
    ? `<img src="${escapeAttr(t.image)}" alt="" loading="lazy">`
    : escapeHtml((t.name || t.wallet || "?")[0].toUpperCase());
  const cred = `<span class="rk">#${t.cred_rank} ${WIN_SHORT[t.cred_window] || ""}</span> · <span class="pnl">${pnlUsd(t.cred_pnl)}</span>`;
  return `<a class="sm-tape-row" href="?wallet=${escapeAttr(t.wallet)}">
    <div class="sm-tw">
      <div class="sm-tav">${av}</div>
      <div class="sm-tid"><div class="n">${escapeHtml(t.name || short(t.wallet, 6))}</div><div class="sm-cred">${cred}</div></div>
    </div>
    <div class="sm-tmkt" title="${escapeAttr(t.market_title || "")}">${escapeHtml((t.market_title || "").slice(0, 72))}</div>
    <div class="sm-tact ${dir}">${t.side} ${escapeHtml(t.outcome || "")}</div>
    <div class="sm-tamt"><div class="v">${fmtUsd(t.usd)}</div><div class="t">${fmtAgo(t.timestamp)} ago · ${(t.price * 100).toFixed(0)}¢</div></div>
  </a>`;
}

// ── LIVE ACTION TAB (firehose + active-whale leaderboard) ─────────────
function renderLiveTab() {
  $("#whaleHero").innerHTML = `
    <h1>WHALE <span class="accent">RADAR</span></h1>
    <p class="tagline">
      Every <strong>>$${(state.threshold).toLocaleString()}</strong> Polymarket trade. Live.
      Plus a leaderboard of <strong>active whales</strong> right now. Click any wallet to drill into their book.
    </p>
    <div class="stat-strip" id="statStrip">
      <div class="stat-cell"><div class="lbl">Active Wallets</div><div class="val" id="statActive">—</div></div>
      <div class="stat-cell alt"><div class="lbl">Whale Volume / window</div><div class="val" id="statVol">—</div></div>
      <div class="stat-cell"><div class="lbl">Biggest Trade</div><div class="val" id="statBiggest">—</div></div>
      <div class="stat-cell alt"><div class="lbl">Refreshes</div><div class="val" id="statRefresh">30s</div></div>
    </div>
  `;
  $("#tabHost").innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>Live <span class="accent">Firehose</span></h2>
        <div class="threshold-toggle" id="thresholdToggle">
          <button data-min="1000">$1K+</button>
          <button data-min="5000" class="active">$5K+</button>
          <button data-min="10000">$10K+</button>
          <button data-min="25000">$25K+</button>
        </div>
        <div class="meta" id="fhMeta">loading…</div>
      </div>
      <div class="firehose-list" id="fhList">
        <div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>Active <span class="accent">Whales</span></h2>
        <div class="meta" id="lbMeta">loading…</div>
      </div>
      <div class="lb-table" id="lbTable">
        <div class="h">#</div>
        <div class="h"></div>
        <div class="h">Trader</div>
        <div class="h" style="justify-content:flex-end">Volume</div>
        <div class="h hide-mobile" style="justify-content:flex-end">Portfolio</div>
        <div class="h hide-mobile" style="justify-content:flex-end">Trades</div>
      </div>
    </section>
  `;
  document.querySelectorAll("#thresholdToggle button").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === state.threshold);
    b.addEventListener("click", () => {
      state.threshold = Number(b.dataset.min);
      document.querySelectorAll("#thresholdToggle button").forEach((x) => x.classList.toggle("active", x === b));
      $("#fhList").innerHTML = `<div class="skel-row"></div><div class="skel-row"></div>`;
      state.seenTradeKeys = new Set();
      loadFirehose();
    });
  });
  loadFirehose();
  loadLeaderboard();
  state.refreshTimer = setInterval(() => { loadFirehose(); loadLeaderboard(); }, 30_000);
}

async function loadFirehose() {
  try {
    const r = await fetch(`/api/whales/firehose?min=${state.threshold}&limit=40`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderFirehose(data);
  } catch (err) {
    $("#fhMeta").textContent = "feed error";
    $("#fhList").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function renderFirehose(data) {
  const list = $("#fhList");
  const trades = data.trades || [];
  $("#fhMeta").textContent = `${trades.length} trades · ≥${fmtUsd(data.threshold_usd)} · ${new Date(data.fetched_at).toLocaleTimeString()}`;

  if (!trades.length) {
    list.innerHTML = `
      <div class="empty">
        No whale trades ≥${fmtUsd(data.threshold_usd)} in the last ${data.window_size} matched trades.
        <br>Try a <strong>lower threshold</strong> or wait — quiet markets clear in minutes.
      </div>`;
    return;
  }

  // Highlight new entries on refresh
  const html = trades
    .map((t) => {
      const key = `${t.tx_hash || ""}-${t.timestamp}-${t.wallet}`;
      const isNew = state.seenTradeKeys.size > 0 && !state.seenTradeKeys.has(key);
      return `
        <div class="fh-row${isNew ? " new" : ""}" data-wallet="${escapeAttr(t.wallet)}">
          <div class="fh-avatar">
            ${t.profile_image ? `<img src="${escapeAttr(t.profile_image)}" alt="">` : escapeHtml((t.name || t.wallet)[0].toUpperCase())}
          </div>
          <div class="fh-who">
            <div class="name">${escapeHtml(t.name || short(t.wallet, 6))}</div>
            <div class="wallet">${short(t.wallet, 6)}</div>
          </div>
          <div class="fh-action ${t.side === "BUY" ? "buy" : "sell"}">${t.side} ${escapeHtml(t.outcome || "")}</div>
          <div class="fh-market" title="${escapeAttr(t.market_title || "")}">${escapeHtml((t.market_title || "").slice(0, 80))}</div>
          <div>
            <div class="fh-amount">${fmtUsd(t.usd)}</div>
            <div class="fh-time" style="text-align:right">${fmtAgo(t.timestamp)} ago · ${(t.price * 100).toFixed(1)}¢</div>
          </div>
        </div>
      `;
    })
    .join("");
  list.innerHTML = html;
  trades.forEach((t) => state.seenTradeKeys.add(`${t.tx_hash || ""}-${t.timestamp}-${t.wallet}`));

  list.querySelectorAll(".fh-row").forEach((row) => {
    row.addEventListener("click", () => {
      location.search = `?wallet=${row.dataset.wallet}`;
    });
  });
}

async function loadLeaderboard() {
  try {
    const r = await fetch(`/api/whales/leaderboard?limit=20`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderLeaderboard(data);
  } catch (err) {
    $("#lbMeta").textContent = "feed error";
  }
}

function renderLeaderboard(data) {
  const whales = data.whales || [];
  $("#lbMeta").textContent = `top ${whales.length} of ${data.total_active_wallets} active · last ${data.window_size} trades`;

  // Stats from leaderboard
  const totalVol = whales.reduce((s, w) => s + w.total_usd, 0);
  const biggest = whales.reduce((max, w) => Math.max(max, w.biggest_usd || 0), 0);
  $("#statActive").textContent = (data.total_active_wallets || 0).toLocaleString();
  $("#statVol").textContent = fmtUsd(totalVol);
  $("#statBiggest").textContent = fmtUsd(biggest);

  const table = $("#lbTable");
  // Keep header, replace rows
  const headerCells = 6;
  while (table.children.length > headerCells) table.removeChild(table.lastChild);

  if (!whales.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.gridColumn = "1 / -1";
    empty.textContent = "No active whales right now.";
    table.appendChild(empty);
    return;
  }

  whales.forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `
      <div class="lb-rank">#${i + 1}</div>
      <div class="lb-avatar">
        ${w.profile_image ? `<img src="${escapeAttr(w.profile_image)}" alt="">` : escapeHtml((w.name || w.wallet)[0].toUpperCase())}
      </div>
      <div class="lb-name">
        <div class="name">${escapeHtml(w.name || short(w.wallet, 8))}</div>
        <div class="wallet">${short(w.wallet, 8)} · last: ${escapeHtml((w.last_market || "").slice(0, 40))}</div>
      </div>
      <div class="lb-num bright">${fmtUsd(w.total_usd)}</div>
      <div class="lb-num hide-mobile">${w.portfolio_usd == null ? "—" : fmtUsd(w.portfolio_usd)}</div>
      <div class="lb-num hide-mobile">${w.trade_count} · ${w.unique_markets}m</div>
    `;
    row.addEventListener("click", () => {
      location.search = `?wallet=${w.wallet}`;
    });
    table.appendChild(row);
  });
}

// ── WALLET DETAIL ─────────────────────────────────────────────────────
function renderWalletShell(wallet) {
  main.innerHTML = `
    <section class="panel">
      <a href="/whales.html" class="back-link">← All Whales</a>
      <div id="walletBody">
        <div class="skel-row" style="height:120px;margin-bottom:16px"></div>
        <div class="skel-row" style="height:80px"></div>
      </div>
    </section>
  `;
}

async function loadWallet(wallet) {
  try {
    const r = await fetch(`/api/whales/wallet?user=${encodeURIComponent(wallet)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderWallet(data);
  } catch (err) {
    $("#walletBody").innerHTML = `<div class="empty">Failed to load wallet: ${escapeHtml(err.message)}</div>`;
  }
}

// Update <title>, og:image, og:title etc so every share of a specific wallet
// URL renders the branded whale OG card with this wallet's stats baked in.
function updateMetaForWallet(data, { name }) {
  const { wallet, summary } = data;
  const value = fmtUsd(summary.total_value);
  const positions = summary.open_positions ?? 0;
  const pnl = summary.total_unrealized_pnl ?? 0;
  const pnlStr = pnl > 0 ? `+${fmtUsd(pnl)}` : pnl < 0 ? fmtUsd(pnl) : "$0";
  const title = `${name} · $EDGE Whale`;
  document.title = title;
  const ogUrl =
    `${location.origin}/api/og?surface=whale` +
    `&name=${encodeURIComponent(name)}` +
    `&value=${encodeURIComponent(value)}` +
    `&positions=${positions}` +
    `&pnl=${encodeURIComponent(pnlStr)}` +
    `&pnlnum=${Math.round(pnl)}`;
  document.getElementById("ogTitle")?.setAttribute("content", title);
  document.getElementById("ogImage")?.setAttribute("content", ogUrl);
  document.getElementById("twImage")?.setAttribute("content", ogUrl);
  document.getElementById("ogDesc")?.setAttribute(
    "content",
    `${value} portfolio · ${positions} open positions · ${pnlStr} unrealized · live on Polymarket`
  );
}

function renderWallet(data) {
  const { wallet, identity, summary, positions, trades, errors } = data;
  const name = identity?.name || short(wallet, 8);
  const pseudo = identity?.pseudonym;
  const pic = identity?.profile_image;
  const bio = identity?.bio;

  const upnlCls = summary.total_unrealized_pnl > 0 ? "pos" : summary.total_unrealized_pnl < 0 ? "neg" : "";
  const rpnlCls = summary.total_realized_pnl > 0 ? "pos" : summary.total_realized_pnl < 0 ? "neg" : "";
  const winRate =
    summary.open_positions > 0
      ? Math.round((summary.winning_positions / summary.open_positions) * 100)
      : null;

  // Update page metadata so every share of this wallet URL gets the branded
  // whale OG card with this specific wallet's stats baked in.
  updateMetaForWallet(data, { name, winRate });

  $("#walletBody").innerHTML = `
    ${errors ? `<div class="empty" style="border-color:var(--red);color:var(--red);margin-bottom:16px">Partial data — failed sources: ${escapeHtml(Object.keys(errors).join(", "))}</div>` : ""}
    <div class="wallet-head">
      <div class="wallet-avatar">
        ${pic ? `<img src="${escapeAttr(pic)}" alt="">` : escapeHtml(name[0].toUpperCase())}
      </div>
      <div class="wallet-meta">
        <div class="name">${escapeHtml(name)}</div>
        ${pseudo ? `<div class="pseudonym">aka ${escapeHtml(pseudo)}</div>` : ""}
        <div class="addr">
          <code>${escapeHtml(wallet)}</code>
          <button class="btn-copy" data-copy="${escapeAttr(wallet)}">Copy</button>
          <a href="https://polymarket.com/profile/${escapeAttr(wallet)}" target="_blank" rel="noopener" style="color:var(--lime);text-decoration:none;font-size:11px">View on Polymarket ↗</a>
        </div>
        ${bio ? `<div class="bio">${escapeHtml(bio)}</div>` : ""}
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-cell"><div class="lbl">Portfolio Value</div><div class="val">${fmtUsdExact(summary.total_value)}</div></div>
      <div class="summary-cell"><div class="lbl">Open Positions</div><div class="val">${summary.open_positions}</div></div>
      <div class="summary-cell"><div class="lbl">Unrealized P&L</div><div class="val ${upnlCls}">${fmtUsdExact(summary.total_unrealized_pnl)}</div></div>
      <div class="summary-cell"><div class="lbl">Realized P&L</div><div class="val ${rpnlCls}">${fmtUsdExact(summary.total_realized_pnl)}</div></div>
      <div class="summary-cell"><div class="lbl">Win Rate (open)</div><div class="val">${winRate == null ? "—" : winRate + "%"}</div></div>
      <div class="summary-cell"><div class="lbl">W / L</div><div class="val"><span class="pos">${summary.winning_positions}</span> / <span class="neg">${summary.losing_positions}</span></div></div>
    </div>

    <div class="section-head">
      <h2>Positions <span class="accent">${positions.length}</span></h2>
      <div class="meta">sorted by current value</div>
    </div>
    ${positions.length ? `
      <div class="pos-table">
        <div class="h">Market</div>
        <div class="h" style="justify-content:flex-end">Size</div>
        <div class="h" style="justify-content:flex-end">Avg → Cur</div>
        <div class="h" style="justify-content:flex-end">Value</div>
        <div class="h" style="justify-content:flex-end">P&L</div>
        ${positions
          .slice(0, 25)
          .map((p) => {
            const pnlCls = p.cash_pnl > 0 ? "pos" : p.cash_pnl < 0 ? "neg" : "";
            const outcomeCls = p.outcome_index === 0 ? "pos" : "neg";
            return `
              <div class="title">
                <div>
                  <span class="market">${escapeHtml((p.market_title || "").slice(0, 80))}</span>
                  <span class="outcome">
                    <span class="outcome-pill ${outcomeCls}">${escapeHtml(p.outcome || "")}</span>
                    ${p.market_slug ? `· <a href="${polymarketMarketUrl(p.market_slug)}" target="_blank" rel="noopener" style="color:var(--muted);text-decoration:none;border-bottom:1px dashed var(--border)">market ↗</a>` : ""}
                  </span>
                </div>
              </div>
              <div class="num">${p.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div class="num">${(p.avg_price * 100).toFixed(1)}¢ → ${(p.cur_price * 100).toFixed(1)}¢</div>
              <div class="num">${fmtUsd(p.current_value)}</div>
              <div class="num ${pnlCls}">${fmtUsd(p.cash_pnl)} (${fmtPct(p.percent_pnl)})</div>
            `;
          })
          .join("")}
      </div>
    ` : `<div class="empty">No open positions.</div>`}

    <div class="section-head" style="margin-top:32px">
      <h2>Recent <span class="accent">Trades</span></h2>
      <div class="meta">last ${trades.length}</div>
    </div>
    ${trades.length ? `
      <div class="trade-list">
        <div class="h">Side</div>
        <div class="h">Market</div>
        <div class="h" style="justify-content:flex-end">Price</div>
        <div class="h" style="justify-content:flex-end">Value</div>
        <div class="h" style="justify-content:flex-end">When</div>
        ${trades.map((t) => `
          <div class="${t.side === "BUY" ? "pos" : "neg"}" style="font-weight:600">${t.side} ${escapeHtml(t.outcome || "")}</div>
          <div>${escapeHtml((t.market_title || "").slice(0, 70))}</div>
          <div class="num">${(t.price * 100).toFixed(1)}¢</div>
          <div class="num">${fmtUsd(t.usd)}</div>
          <div class="num">${fmtAgo(t.timestamp)} ago</div>
        `).join("")}
      </div>
    ` : `<div class="empty">No recent trades.</div>`}
  `;

  document.querySelectorAll(".btn-copy").forEach((b) => {
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        const orig = b.textContent;
        b.textContent = "Copied ✓";
        setTimeout(() => (b.textContent = orig), 1200);
      } catch {}
    });
  });
}

// ── boot ──────────────────────────────────────────────────────────────
route();
window.addEventListener("popstate", route);
