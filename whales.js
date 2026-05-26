// $EDGE Whales frontend. URL-state driven:
//   /whales.html          → firehose + leaderboard
//   /whales.html?wallet=… → wallet detail
const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

// ── formatting ────────────────────────────────────────────────────────
const fmtUsd = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n < 0 ? "-" : "") + "$" + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n < 0 ? "-" : "") + "$" + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n < 0 ? "-" : "") + "$" + (a / 1e3).toFixed(1) + "K";
  return (n < 0 ? "-" : "") + "$" + a.toFixed(0);
};
const fmtUsdExact = (n) =>
  n == null || !Number.isFinite(n) ? "—" : "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtPct = (n) => (n == null || !Number.isFinite(n) ? "—" : (n > 0 ? "+" : "") + n.toFixed(2) + "%");
const fmtAgo = (ts) => {
  if (!ts) return "—";
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return Math.round(diff) + "s";
  if (diff < 3600) return Math.round(diff / 60) + "m";
  if (diff < 86400) return Math.round(diff / 3600) + "h";
  return Math.round(diff / 86400) + "d";
};
const short = (a, n = 6) => (!a ? "" : a.length <= 2 * n + 2 ? a : `${a.slice(0, n)}…${a.slice(-n)}`);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escapeAttr = (s) => escapeHtml(s).replace(/`/g, "&#96;");

const polymarketMarketUrl = (slug) => (slug ? `https://polymarket.com/market/${slug}` : "#");

// ── state ─────────────────────────────────────────────────────────────
const state = {
  threshold: 5000,
  seenTradeKeys: new Set(),
  refreshTimer: null,
};

// ── ROUTING ───────────────────────────────────────────────────────────
function route() {
  const params = new URLSearchParams(location.search);
  const wallet = params.get("wallet");
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.seenTradeKeys = new Set();

  if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    renderWalletShell(wallet);
    loadWallet(wallet);
  } else {
    renderListShell();
    loadFirehose();
    loadLeaderboard();
    state.refreshTimer = setInterval(() => {
      loadFirehose();
      loadLeaderboard();
    }, 30_000);
  }
}

// ── LIST PAGE ─────────────────────────────────────────────────────────
function renderListShell() {
  main.innerHTML = `
    <section class="hero">
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
    </section>

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
        <div class="skel-row"></div>
        <div class="skel-row"></div>
        <div class="skel-row"></div>
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
    b.addEventListener("click", () => {
      state.threshold = Number(b.dataset.min);
      document.querySelectorAll("#thresholdToggle button").forEach((x) => x.classList.toggle("active", x === b));
      $("#fhList").innerHTML = `<div class="skel-row"></div><div class="skel-row"></div>`;
      state.seenTradeKeys = new Set();
      loadFirehose();
    });
  });
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
