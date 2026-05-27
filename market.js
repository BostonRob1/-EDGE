// $EDGE per-market detail page.
// Loads /api/market/detail?slug=… and renders everything: market header,
// Edge bars, whale trades on this market, buzz chatter, trade CTA.
import { fmtUsd, fmtNum, fmtAge, short, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);

async function load() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  const main = $("#main");

  if (!slug) {
    main.innerHTML = `
      <section class="hero">
        <div class="empty">
          <strong>No market specified.</strong><br>
          This page expects a <code>?slug=…</code> query param.<br><br>
          <a href="/dashboard.html" style="color:var(--lime)">← Back to dashboard</a>
        </div>
      </section>`;
    return;
  }

  try {
    const r = await fetch(`/api/market/detail?slug=${encodeURIComponent(slug)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
    render(data);
    updateMeta(data);
  } catch (err) {
    main.innerHTML = `
      <section class="hero">
        <div class="empty"><strong>Couldn't load market.</strong><br>${escapeHtml(err.message)}</div>
      </section>`;
  }
}

// Update <title>, OG meta, Twitter meta with this market's info
function updateMeta(data) {
  const m = data.market;
  const title = `${m.title} · $EDGE`;
  document.title = title;
  const yesC = Math.round((m.yes_price || 0) * 100);
  const noC = Math.round((m.no_price || 0) * 100);
  const vol = compactUsd(m.volume_24h);
  const ogUrl = `${location.origin}/api/og?surface=market&title=${encodeURIComponent(m.title.slice(0, 80))}&yes=${yesC}&no=${noC}&vol=${encodeURIComponent(vol)}&platform=${m.source}`;
  $("#ogTitle")?.setAttribute("content", title);
  $("#ogImage")?.setAttribute("content", ogUrl);
  $("#twImage")?.setAttribute("content", ogUrl);
  $("#ogDesc")?.setAttribute(
    "content",
    `YES ${yesC}¢ · NO ${noC}¢ · ${vol} 24h vol · live on ${m.source.toUpperCase()}`
  );
}

function compactUsd(n) {
  if (!n || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return "$" + (a / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return "$" + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return "$" + (a / 1e3).toFixed(0) + "K";
  return "$" + Math.round(a);
}

function render(data) {
  const m = data.market;
  const edge = data.edge;
  const buzz = data.buzz;
  const whales = data.whales;
  const aff = data.affiliate;

  const yes = ((m.yes_price || 0) * 100).toFixed(0);
  const no = ((m.no_price || 0) * 100).toFixed(0);
  const ch24 = m.price_change_24h || 0;
  const chCls = ch24 > 0 ? "pos" : ch24 < 0 ? "neg" : "";
  const ageHours = m.end_date
    ? (Date.parse(m.end_date) - Date.now()) / 3_600_000
    : null;
  const ageStr =
    ageHours == null
      ? "—"
      : ageHours <= 0
      ? "ended"
      : `${fmtAge(ageHours)}`;
  const platformLabel = m.source === "polymarket" ? "POLY" : "KALSHI";
  const platformCls = m.source === "polymarket" ? "src-poly" : "src-kalshi";

  // Hero
  const heroHtml = `
    <div class="eyebrow">
      <span class="${platformCls}">●</span>
      <span class="${platformCls}">${platformLabel}</span>
      <span style="color:var(--muted)">·</span>
      <span style="color:var(--muted)">${escapeHtml(m.category || "Markets")}</span>
      <span style="color:var(--muted)">·</span>
      <span style="color:var(--muted)">${ageStr === "ended" ? "ENDED" : ageStr + " to close"}</span>
    </div>
    <h1>${escapeHtml(m.title)}</h1>
    <div class="hero-grid">
      <div class="hero-cell yes">
        <div class="lbl">YES</div>
        <div class="val">${yes}¢</div>
        <div class="sub">implied prob</div>
      </div>
      <div class="hero-cell no">
        <div class="lbl">NO</div>
        <div class="val">${no}¢</div>
        <div class="sub">implied prob</div>
      </div>
      <div class="hero-cell vol">
        <div class="lbl">24h Volume</div>
        <div class="val">${compactUsd(m.volume_24h)}</div>
        <div class="sub">total vol: ${compactUsd(m.total_volume)}</div>
      </div>
      <div class="hero-cell age">
        <div class="lbl">24h Δ</div>
        <div class="val ${chCls}" style="${ch24 > 0 ? 'color:var(--green)' : ch24 < 0 ? 'color:var(--red)' : ''}">${ch24 ? (ch24 > 0 ? "+" : "") + ch24.toFixed(2) + "%" : "—"}</div>
        <div class="sub">price change</div>
      </div>
    </div>
  `;

  // Trade CTA
  const tradeHtml = aff
    ? `
      <div class="trade-cta">
        <a class="btn-trade" href="${escapeAttr(aff.url)}" target="_blank" rel="noopener">
          Trade on ${aff.platform === "polymarket" ? "Polymarket" : "Kalshi"} <span class="arrow">↗</span>
        </a>
        <button class="btn-share" id="shareBtn" type="button">Share market</button>
      </div>`
    : "";

  // Edge panel
  const edgeHtml = edge
    ? `
      <section class="panel">
        <div class="section-head">
          <h2>Edge <span class="accent">Score</span></h2>
          <div class="meta">money vs mouth divergence</div>
        </div>
        <div class="edge-panel">
          <div class="call-tag ${edgeCallClass(edge.edge_call)}">${escapeHtml(edge.edge_call)} · ${edge.divergence}Δ</div>
          <div class="edge-bars">
            <div class="bar-row money">
              <span class="lbl">Money</span>
              <div class="bar" style="--w:${edge.money_intensity}%"></div>
              <span class="v">${edge.money_intensity}</span>
            </div>
            <div class="bar-row mouth">
              <span class="lbl">Mouth</span>
              <div class="bar" style="--w:${edge.mouth_intensity}%"></div>
              <span class="v">${edge.mouth_intensity}</span>
            </div>
          </div>
          <div class="edge-thesis"><strong>${escapeHtml(edge.edge_call)}.</strong> ${escapeHtml(edge.edge_thesis || "")}</div>
        </div>
      </section>`
    : "";

  // Whales panel
  const whalesHtml = whales?.count
    ? `
      <section class="panel">
        <div class="section-head">
          <h2>Whales <span class="accent">on this Market</span></h2>
          <div class="meta">${whales.count} trades · sorted by USD size</div>
        </div>
        <div class="whales-table">
          <div class="h"></div>
          <div class="h">Trader</div>
          <div class="h">Side</div>
          <div class="h" style="justify-content:flex-end">Price</div>
          <div class="h" style="justify-content:flex-end">USD</div>
          ${whales.trades.slice(0, 12).map(t => `
            <a class="whale-row-link" href="/whales.html?wallet=${escapeAttr(t.wallet)}">
              <div class="avatar">${t.profile_image ? `<img src="${escapeAttr(t.profile_image)}">` : escapeHtml((t.name || "?")[0].toUpperCase())}</div>
              <div class="name">${escapeHtml(t.name || short(t.wallet, 6))}</div>
              <div class="side ${t.side}">${escapeHtml(t.side)} ${escapeHtml(t.outcome || "")}</div>
              <div class="price">${(t.price * 100).toFixed(0)}¢</div>
              <div class="usd">${fmtUsd(t.usd)}</div>
            </a>
          `).join("")}
        </div>
      </section>`
    : m.source === "polymarket"
    ? `
      <section class="panel">
        <div class="section-head">
          <h2>Whales <span class="accent">on this Market</span></h2>
        </div>
        <div class="empty">No whale-size trades captured in the current window. <strong>Quiet market.</strong></div>
      </section>`
    : `
      <section class="panel">
        <div class="section-head">
          <h2>Whales <span class="accent">on this Market</span></h2>
        </div>
        <div class="empty">Kalshi doesn't expose per-wallet trade data publicly. <strong>Whales view is Polymarket-only.</strong></div>
      </section>`;

  // Buzz panel
  const buzzHtml = buzz
    ? `
      <section class="panel">
        <div class="section-head">
          <h2>Buzz <span class="mag">Chatter</span></h2>
          <div class="meta">heat ${buzz.heat} · ${buzz.thread_count} threads · ${buzz.unique_sources?.length || 0} sources</div>
        </div>
        <div class="buzz-panel">
          <div class="buzz-stats">
            <div class="buzz-stat"><div class="lbl">Heat</div><div class="v">${buzz.heat}</div></div>
            <div class="buzz-stat"><div class="lbl">Threads</div><div class="v">${buzz.thread_count}</div></div>
            <div class="buzz-stat"><div class="lbl">Upvotes</div><div class="v">${fmtNum(buzz.total_upvotes)}</div></div>
            <div class="buzz-stat"><div class="lbl">Sources</div><div class="v">${buzz.unique_sources?.length || 0}</div></div>
          </div>
          ${buzz.top_threads?.[0] ? `
            <div class="buzz-top-thread">
              <div class="src">${escapeHtml(buzz.top_threads[0].source)} · ${escapeHtml(buzz.top_threads[0].subsource || "")}</div>
              ${escapeHtml(buzz.top_threads[0].title || "")}
            </div>
          ` : ""}
        </div>
      </section>`
    : `
      <section class="panel">
        <div class="section-head">
          <h2>Buzz <span class="mag">Chatter</span></h2>
        </div>
        <div class="empty">No chatter detected on this market yet. <strong>Quiet on the social side.</strong></div>
      </section>`;

  $("#main").innerHTML = `
    <div class="hero" id="hero">${heroHtml}</div>
    ${tradeHtml}
    ${edgeHtml}
    ${whalesHtml}
    ${buzzHtml}
  `;

  // Share button
  const shareBtn = $("#shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const url = location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url });
        } else {
          await navigator.clipboard.writeText(url);
          shareBtn.textContent = "Link copied ✓";
          setTimeout(() => (shareBtn.textContent = "Share market"), 1500);
        }
      } catch {}
    });
  }
}

function edgeCallClass(call) {
  if (!call) return "no";
  const c = call.toUpperCase();
  if (c.includes("INSIDER")) return "insider";
  if (c.includes("FRONT")) return "front";
  if (c.includes("ALIGNED")) return "aligned";
  if (c.includes("QUIET")) return "quiet";
  if (c.includes("LOUD")) return "loud";
  return "no";
}

load();
