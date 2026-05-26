// $EDGE Tracker frontend — search box + trending feed + result rendering.
// Pure browser ES module, no build step.
import { fmtUsd, fmtNum, fmtPct, fmtAge, short, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const form = $("#searchForm");
const input = $("#addrInput");
const btn = $("#analyzeBtn");
const results = $("#results");
const trendingGrid = $("#trendingGrid");
const trendingMeta = $("#trendingMeta");

const shortAddr = short;
const explorerToken = (chain, addr) =>
  chain === "solana"
    ? `https://solscan.io/token/${addr}`
    : `https://etherscan.io/token/${addr}`;
const explorerAccount = (chain, addr) =>
  chain === "solana"
    ? `https://solscan.io/account/${addr}`
    : `https://etherscan.io/address/${addr}`;

// ── chain detection (mirrors server-side) ─────────────────────────────
function detectChain(a) {
  if (!a) return null;
  const s = String(a).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return "ethereum";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return "solana";
  return null;
}

// ── trending feed ─────────────────────────────────────────────────────
async function loadTrending() {
  try {
    const r = await fetch("/api/tracker/trending");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderTrending(data);
  } catch (err) {
    trendingMeta.textContent = "feed unavailable";
    trendingGrid.innerHTML = `<div style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:12px;grid-column:1/-1">${escapeHtml(err.message)}</div>`;
  }
}

function renderTrending(data) {
  const items = data.items || [];
  trendingMeta.textContent = `${items.length} live · ${data.counts.solana} SOL · ${data.counts.ethereum} ETH`;
  if (!items.length) {
    trendingGrid.innerHTML = `<div style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:12px;grid-column:1/-1">No trending tokens right now.</div>`;
    return;
  }
  trendingGrid.innerHTML = items
    .map((t) => {
      const ch = t.price_change_24h || 0;
      const chCls = ch > 0 ? "pos" : ch < 0 ? "neg" : "";
      const sym = t.symbol || "?";
      const name = t.name || "Unknown";
      const chainCls = t.chain === "solana" ? "solana" : "ethereum";
      const chainLbl = t.chain === "solana" ? "SOL" : "ETH";
      return `
        <div class="trend-card" data-addr="${escapeAttr(t.address)}">
          <div class="trend-card-top">
            <div class="sym">${escapeHtml(sym)}</div>
            <span class="chain-badge ${chainCls}">${chainLbl}</span>
          </div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="row"><span class="lbl">Price</span><span class="val">${fmtUsd(t.price_usd)}</span></div>
          <div class="row"><span class="lbl">Liq</span><span class="val">${fmtUsd(t.liquidity_usd)}</span></div>
          <div class="row"><span class="lbl">Vol 24h</span><span class="val">${fmtUsd(t.volume_24h)}</span></div>
          <div class="row"><span class="lbl">24h Δ</span><span class="val ${chCls}">${ch ? ch.toFixed(2) + "%" : "—"}</span></div>
        </div>
      `;
    })
    .join("");
  $$(".trend-card", trendingGrid).forEach((card) => {
    card.addEventListener("click", () => {
      const addr = card.dataset.addr;
      input.value = addr;
      runAnalyze(addr);
    });
  });
}

// ── analyze ───────────────────────────────────────────────────────────
async function runAnalyze(rawAddress) {
  const address = String(rawAddress || "").trim();
  if (!address) return;
  const chain = detectChain(address);
  if (!chain) {
    showError("Address didn't match Solana base58 or Ethereum 0x format.");
    return;
  }
  results.classList.add("show");
  results.innerHTML = `<div class="loading"><span class="spin"></span>Scanning ${chain.toUpperCase()} · ${shortAddr(address, 8)}</div>`;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
  btn.disabled = true;
  btn.textContent = "Scanning…";

  try {
    const r = await fetch(`/api/tracker/analyze?address=${encodeURIComponent(address)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderResults(data);
  } catch (err) {
    showError(err.message || "Analysis failed.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Analyze";
  }
}

function showError(msg) {
  results.classList.add("show");
  results.innerHTML = `<div class="error-banner">⚠ ${escapeHtml(msg)}</div>`;
}

// ── render results ────────────────────────────────────────────────────
function renderResults(data) {
  const { token, market, onchain, risk, holders, errors, fetched_at } = data;
  const sym = token.symbol || "?";
  const name = token.name || "Unknown token";
  const chainCls = token.chain === "solana" ? "solana" : "ethereum";
  const chainLbl = token.chain === "solana" ? "SOLANA" : "ETHEREUM";

  const html = `
    ${errors ? renderErrors(errors) : ""}
    ${renderTokenHeader(token, sym, name, chainCls, chainLbl)}
    ${renderRisk(risk)}
    ${market ? renderMarket(market) : renderNoMarket()}
    ${renderFlags(risk.flags)}
    ${holders && holders.length ? renderHolders(holders, token.chain) : ""}
    ${onchain ? renderOnchain(onchain, token.chain) : ""}
    <div class="result-card-head" style="border:1px solid var(--border);">
      <span>Fetched ${new Date(fetched_at).toLocaleString()}</span>
      <span>Sources OK: ${(data.sources_ok || []).join(" · ")}</span>
    </div>
  `;
  results.innerHTML = html;
  attachResultHandlers();
  // Animate the gauge
  requestAnimationFrame(() => animateGauge(risk.score));
}

function renderTokenHeader(token, sym, name, chainCls, chainLbl) {
  const initial = (sym[0] || "?").toUpperCase();
  return `
    <div class="result-card">
      <div class="result-card-head"><span>Token</span><span class="chain-badge ${chainCls}">${chainLbl}</span></div>
      <div class="result-card-body">
        <div class="token-head">
          <div class="token-icon">${
            token.image ? `<img src="${escapeAttr(token.image)}" alt="">` : escapeHtml(initial)
          }</div>
          <div class="token-meta">
            <div class="sym">${escapeHtml(sym)}</div>
            <div class="name">${escapeHtml(name)}</div>
            <div class="addr">
              <code>${escapeHtml(token.address)}</code>
              <button class="btn-copy" data-copy="${escapeAttr(token.address)}">Copy</button>
            </div>
          </div>
          <div class="token-links">
            <a href="${escapeAttr(token.explorer_url)}" target="_blank" rel="noopener">Explorer ↗</a>
            ${
              token.chain === "ethereum"
                ? `<a href="https://app.uniswap.org/explore/tokens/ethereum/${escapeAttr(token.address)}" target="_blank" rel="noopener">Uniswap ↗</a>`
                : `<a href="https://jup.ag/swap/SOL-${escapeAttr(token.address)}" target="_blank" rel="noopener">Jupiter ↗</a>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRisk(risk) {
  const level = risk.level || "caution";
  const score = Math.round(risk.score || 0);
  const counts = risk.counts || { critical: 0, warn: 0, info: 0 };
  return `
    <div class="result-card">
      <div class="result-card-head"><span>Risk Score</span><span>0 = rug · 100 = clean</span></div>
      <div class="result-card-body">
        <div class="risk-row">
          <div class="gauge">
            <svg viewBox="0 0 120 120">
              <circle class="bg" cx="60" cy="60" r="50"></circle>
              <circle class="fg lvl-${level}" cx="60" cy="60" r="50"
                stroke="${gaugeColor(level)}"
                stroke-dasharray="314.159"
                stroke-dashoffset="314.159"
                data-target="${score}"></circle>
            </svg>
            <div class="score"><div class="num lvl-${level}" id="scoreNum">0</div><div class="of">/ 100</div></div>
          </div>
          <div class="risk-summary">
            <div class="level-label">Verdict</div>
            <div class="level-val lvl-${level}">${level}</div>
            <div class="flag-counts">
              <span class="flag-count critical"><span class="n">${counts.critical || 0}</span> critical</span>
              <span class="flag-count warn"><span class="n">${counts.warn || 0}</span> warn</span>
              <span class="flag-count info"><span class="n">${counts.info || 0}</span> good</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function gaugeColor(level) {
  return {
    safe: "#00FF85",
    caution: "#FFB800",
    high: "#FF7A00",
    critical: "#FF3344",
  }[level] || "#FFB800";
}

function animateGauge(score) {
  const fg = $(".gauge .fg");
  const num = $("#scoreNum");
  if (!fg || !num) return;
  const r = 50;
  const C = 2 * Math.PI * r;
  const offset = C - (Math.max(0, Math.min(100, score)) / 100) * C;
  fg.setAttribute("stroke-dasharray", String(C));
  fg.setAttribute("stroke-dashoffset", String(offset));
  // animate the number too
  const target = Math.round(score);
  const dur = 700;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    num.textContent = Math.round(target * easeOut(p));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function renderMarket(m) {
  const ch24 = m.price_change_24h || 0;
  const ch1 = m.price_change_1h || 0;
  const ch5 = m.price_change_5m || 0;
  const buys = m.txns_24h_buys || 0;
  const sells = m.txns_24h_sells || 0;
  return `
    <div class="result-card">
      <div class="result-card-head"><span>Market</span><span>${m.dex || ""} · ${m.pair_count || 1} pair${m.pair_count !== 1 ? "s" : ""}</span></div>
      <div class="market-grid">
        <div class="market-cell">
          <div class="lbl">Price</div>
          <div class="val">${fmtUsd(m.price_usd)}</div>
          <div class="sub ${ch24 > 0 ? "pos" : ch24 < 0 ? "neg" : ""}">${ch24 ? ch24.toFixed(2) + "% 24h" : "—"}</div>
        </div>
        <div class="market-cell">
          <div class="lbl">Liquidity</div>
          <div class="val">${fmtUsd(m.liquidity_usd)}</div>
          <div class="sub">depth</div>
        </div>
        <div class="market-cell">
          <div class="lbl">Volume 24h</div>
          <div class="val">${fmtUsd(m.volume_24h)}</div>
          <div class="sub">1h: ${fmtUsd(m.volume_1h)}</div>
        </div>
        <div class="market-cell">
          <div class="lbl">Market Cap</div>
          <div class="val">${fmtUsd(m.market_cap)}</div>
          <div class="sub">FDV: ${fmtUsd(m.fdv)}</div>
        </div>
        <div class="market-cell">
          <div class="lbl">Pair Age</div>
          <div class="val">${fmtAge(m.pair_age_hours)}</div>
          <div class="sub">${m.pair_created_at ? new Date(m.pair_created_at).toLocaleDateString() : "—"}</div>
        </div>
        <div class="market-cell">
          <div class="lbl">Buys / Sells 24h</div>
          <div class="val"><span class="pos">${fmtNum(buys)}</span> / <span class="neg">${fmtNum(sells)}</span></div>
          <div class="sub">1h Δ: ${ch1 ? ch1.toFixed(2) + "%" : "—"} · 5m: ${ch5 ? ch5.toFixed(2) + "%" : "—"}</div>
        </div>
      </div>
    </div>
  `;
}

function renderNoMarket() {
  return `
    <div class="result-card">
      <div class="result-card-head"><span>Market</span><span>—</span></div>
      <div class="result-card-body" style="text-align:center;color:var(--muted);padding:32px;">
        No DEX pair found for this token. It may be too new, delisted, or unknown to DexScreener.
      </div>
    </div>
  `;
}

function renderFlags(flags) {
  const groups = { critical: [], warn: [], info: [] };
  for (const f of flags || []) groups[f.level]?.push(f);

  const sections = ["critical", "warn", "info"]
    .map((lvl) => {
      const arr = groups[lvl];
      if (!arr.length) return "";
      const heading = lvl === "info" ? "Positives" : lvl === "warn" ? "Warnings" : "Critical";
      return `
        <div class="flag-section ${lvl}">
          <div class="flag-section-head">${heading} · ${arr.length}</div>
          <div class="flag-list">
            ${arr.map((f) => `
              <div class="flag-item ${lvl}">
                <div class="lbl">${escapeHtml(f.label)}</div>
                ${f.detail ? `<div class="detail">${escapeHtml(f.detail)}</div>` : ""}
                <div class="code">${escapeHtml(f.code)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  if (!sections.trim()) {
    return `
      <div class="result-card">
        <div class="result-card-head"><span>Flags</span><span>—</span></div>
        <div class="result-card-body" style="text-align:center;color:var(--muted);padding:32px;">
          No flags raised. (Note: absence of flags ≠ guarantee of safety. Always DYOR.)
        </div>
      </div>
    `;
  }

  return `
    <div class="result-card">
      <div class="result-card-head"><span>Flags</span><span>Risk Signals</span></div>
      <div class="result-card-body">${sections}</div>
    </div>
  `;
}

function renderHolders(holders, chain) {
  const rows = holders
    .slice(0, 10)
    .map((h, i) => {
      const pct = h.percent || 0;
      const pctDisplay = pct > 1 ? pct.toFixed(2) + "%" : (pct * 100).toFixed(2) + "%";
      const tag = h.tag || (h.is_locked ? "LOCKED" : h.is_contract ? "CONTRACT" : "");
      return `
        <div class="addr">#${i + 1} <a href="${escapeAttr(explorerAccount(chain, h.address))}" target="_blank" rel="noopener">${escapeHtml(shortAddr(h.address, 8))}</a></div>
        <div class="tag">${escapeHtml(tag)}</div>
        <div class="pct">${pctDisplay}</div>
        <div class="bar" style="--w:${Math.min(100, Math.abs(pct > 1 ? pct : pct * 100))}%"></div>
      `;
    })
    .join("");
  return `
    <div class="result-card">
      <div class="result-card-head"><span>Top Holders</span><span>${holders.length} of top 10</span></div>
      <div class="result-card-body">
        <div class="holders-table">
          <div class="h">Address</div>
          <div class="h">Tag</div>
          <div class="h" style="text-align:right">Share</div>
          ${rows}
        </div>
      </div>
    </div>
  `;
}

function renderOnchain(o, chain) {
  if (chain === "solana") {
    const supply = o.supply_raw && o.decimals != null
      ? (parseFloat(o.supply_raw) / Math.pow(10, o.decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : "—";
    return `
      <div class="result-card">
        <div class="result-card-head"><span>On-Chain</span><span>Solana SPL Mint</span></div>
        <div class="result-card-body">
          <dl class="kv-grid">
            <dt>Supply</dt><dd>${supply}</dd>
            <dt>Decimals</dt><dd>${o.decimals ?? "—"}</dd>
            <dt>Mint Authority</dt><dd>${
              o.mint_authority
                ? `<span class="active">ACTIVE</span> · <a href="${escapeAttr(explorerAccount("solana", o.mint_authority))}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(o.mint_authority)}</a>`
                : `<span class="renounced">RENOUNCED ✓</span>`
            }</dd>
            <dt>Freeze Authority</dt><dd>${
              o.freeze_authority
                ? `<span class="active">ACTIVE</span> · <a href="${escapeAttr(explorerAccount("solana", o.freeze_authority))}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(o.freeze_authority)}</a>`
                : `<span class="renounced">RENOUNCED ✓</span>`
            }</dd>
          </dl>
        </div>
      </div>
    `;
  }
  // Ethereum
  return `
    <div class="result-card">
      <div class="result-card-head"><span>On-Chain</span><span>Ethereum ERC-20</span></div>
      <div class="result-card-body">
        <dl class="kv-grid">
          <dt>Total Supply</dt><dd>${o.total_supply ? Number(o.total_supply).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</dd>
          <dt>Holders</dt><dd>${o.holder_count ? Number(o.holder_count).toLocaleString() : "—"}</dd>
          <dt>LP Holders</dt><dd>${o.lp_holder_count || "—"}</dd>
          <dt>Owner</dt><dd>${
            o.owner_address
              ? `<a href="${escapeAttr(explorerAccount("ethereum", o.owner_address))}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(o.owner_address)}</a>`
              : `<span class="renounced">RENOUNCED ✓</span>`
          }</dd>
          <dt>Creator</dt><dd>${
            o.creator_address
              ? `<a href="${escapeAttr(explorerAccount("ethereum", o.creator_address))}" target="_blank" rel="noopener" style="color:inherit">${escapeHtml(o.creator_address)}</a>`
              : "—"
          }</dd>
        </dl>
      </div>
    </div>
  `;
}

function renderErrors(errors) {
  const entries = Object.entries(errors);
  if (!entries.length) return "";
  return `
    <div class="error-banner">
      Some sources failed (others still analyzed): ${entries.map(([k, v]) => `<strong>${escapeHtml(k)}</strong> (${escapeHtml(v)})`).join(", ")}
    </div>
  `;
}

function attachResultHandlers() {
  $$(".btn-copy", results).forEach((b) => {
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

// ── wire it up ────────────────────────────────────────────────────────
form.addEventListener("submit", (e) => {
  e.preventDefault();
  runAnalyze(input.value);
});

$$(".chip", document).forEach((c) => {
  c.addEventListener("click", () => {
    const addr = c.dataset.addr;
    input.value = addr;
    runAnalyze(addr);
  });
});

// Auto-analyze if ?address=… is in the URL
const params = new URLSearchParams(location.search);
const initialAddr = params.get("address");
if (initialAddr) {
  input.value = initialAddr;
  runAnalyze(initialAddr);
}

loadTrending();
// Re-fetch trending every 60s while page is open
setInterval(loadTrending, 60_000);
