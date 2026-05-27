// $EDGE Buzz — chatter aggregator frontend.
import { fmtNum, fmtAgo, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  feedFilter: "matched", // "matched" | "all"
  refreshTimer: null,
};

function confidenceCls(score) {
  if (score >= 0.5) return "";
  if (score >= 0.4) return "med";
  return "low";
}

// ── fetchers ──────────────────────────────────────────────────────────
async function loadHeat() {
  try {
    const r = await fetch("/api/buzz/markets?limit=20");
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderHeat(data);
  } catch (err) {
    $("#heatMeta").textContent = "feed error";
    $("#heatGrid").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

async function loadFeed() {
  try {
    const matchedOnly = state.feedFilter === "matched" ? "1" : "0";
    const r = await fetch(`/api/buzz/feed?limit=60&matched=${matchedOnly}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    renderFeed(data);
    updateStats(data);
  } catch (err) {
    $("#feedMeta").textContent = "feed error";
    $("#feedList").innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

// ── rendering ─────────────────────────────────────────────────────────
function updateStats(data) {
  $("#statThreads").textContent = data.counts.threads_total ?? "—";
  $("#statMatched").textContent = data.counts.threads_matched ?? "—";
  const pct =
    data.counts.threads_total > 0
      ? Math.round((data.counts.threads_matched / data.counts.threads_total) * 100)
      : 0;
  $("#statMatchPct").textContent = `${pct}% match rate`;

  const sources = data.sources_active || {};
  const active = Object.keys(sources).filter((k) => sources[k]);
  $("#statSources").textContent = active.length;
  $("#statSourcesSub").innerHTML = Object.keys(sources)
    .map((k) => `<span class="${sources[k] ? "source-active" : "source-inactive"}">${k}</span>`)
    .join(" · ");
}

function renderHeat(data) {
  const markets = data.markets || [];
  $("#heatMeta").textContent = `${data.counts.markets_with_chatter} markets · ${data.counts.threads_matched}/${data.counts.threads_total} threads matched · ${new Date(data.fetched_at).toLocaleTimeString()}`;
  $("#statHotMarkets").textContent = data.counts.markets_with_chatter ?? "—";

  if (!markets.length) {
    $("#heatGrid").innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        No markets with active chatter detected in the current window.
        <br><strong>Quiet news cycle</strong> — feed will pick up when conversations heat up.
      </div>`;
    return;
  }

  $("#heatGrid").innerHTML = markets
    .map((m, i) => {
      const cold = m.heat < 6;
      const tt = m.top_threads?.[0];
      return `
        <div class="heat-card ${cold ? "cold" : ""}" data-url="${escapeAttr(m.slug ? "/market.html?slug=" + encodeURIComponent(m.slug) : m.market_url || "#")}">
          <div class="heat-row">
            <span class="rank">#${i + 1}</span>
            <span class="heat-score">HEAT <span class="v">${m.heat}</span></span>
          </div>
          <div class="title">${escapeHtml(m.title)}</div>
          <div class="stats">
            <div class="stat"><span class="v">${m.thread_count}</span> threads</div>
            <div class="stat"><span class="v">${fmtNum(m.total_upvotes)}</span> upvotes</div>
            <div class="stat"><span class="v">${fmtNum(m.total_comments)}</span> comments</div>
            <div class="stat"><span class="v">${m.unique_sources.length}</span> sources</div>
          </div>
          ${
            tt
              ? `
            <div class="top-thread">
              <div class="src">${escapeHtml(tt.source)} · ${
                tt.source === "reddit" ? "r/" + escapeHtml(tt.subsource || "") :
                tt.source === "polymarket" ? "comment" :
                tt.source === "hn" ? "front page" :
                tt.source === "news" ? escapeHtml(tt.subsource || "") :
                escapeHtml(tt.subsource || "")
              } · ▲ ${tt.score} · ${fmtAgo(tt.created_at)} ago</div>
              <div class="t">${escapeHtml((tt.title || "").slice(0, 140))}</div>
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");

  $$(".heat-card", $("#heatGrid")).forEach((card) => {
    card.addEventListener("click", () => {
      const u = card.dataset.url;
      if (!u || u === "#") return;
      // Internal /market.html → in-tab; external → new tab
      if (u.startsWith("/")) location.href = u;
      else window.open(u, "_blank", "noopener");
    });
  });
}

function renderFeed(data) {
  const threads = data.threads || [];
  $("#feedMeta").textContent = `${threads.length} ${state.feedFilter === "matched" ? "matched" : ""} · ${new Date(data.fetched_at).toLocaleTimeString()}`;

  if (!threads.length) {
    $("#feedList").innerHTML = `
      <div class="empty">
        No ${state.feedFilter === "matched" ? "matched" : ""} threads in the current window.
      </div>`;
    return;
  }

  $("#feedList").innerHTML = threads
    .map((t) => {
      const srcCls = t.source;
      const subLabel =
        t.source === "reddit" ? `r/${t.subsource}` :
        t.source === "polymarket" ? "POLYMARKET" :
        t.source === "hn" ? "HACKER NEWS" :
        t.source === "news" ? (t.subsource || "NEWS").toUpperCase() :
        t.source === "x" ? "X" :
        (t.subsource || t.source);
      const matchPills = (t.matches || [])
        .slice(0, 3)
        .map(
          (m) => `
          <a href="${escapeAttr(m.url || "#")}" target="_blank" rel="noopener" class="feed-match">
            <span class="market">${escapeHtml((m.title || "").slice(0, 50))}</span>
            <span class="conf ${confidenceCls(m.score)}">${Math.round(m.score * 100)}%</span>
          </a>
        `
        )
        .join("");
      return `
        <div class="feed-row">
          <div class="feed-src ${srcCls}">${escapeHtml(subLabel)}</div>
          <div class="feed-body">
            <div class="feed-title">
              <a href="${escapeAttr(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.title)}</a>
            </div>
            <div class="feed-meta">
              <span>▲ ${fmtNum(t.score)}</span>
              <span>💬 ${fmtNum(t.comments)}</span>
              ${t.author ? `<span>by <a href="${escapeAttr(t.author_url || "#")}" target="_blank" rel="noopener">${escapeHtml(t.author)}</a></span>` : ""}
              <span>${fmtAgo(t.created_at)} ago</span>
              ${t.flair ? `<span style="color:var(--lime)">${escapeHtml(t.flair)}</span>` : ""}
            </div>
          </div>
          <div class="feed-matches">${matchPills || '<span style="color:var(--muted);font-family:JetBrains Mono,monospace;font-size:10px;text-transform:uppercase">no match</span>'}</div>
        </div>
      `;
    })
    .join("");
}

// ── filters ───────────────────────────────────────────────────────────
$$("#feedFilters button").forEach((b) => {
  b.addEventListener("click", () => {
    state.feedFilter = b.dataset.filter;
    $$("#feedFilters button").forEach((x) => x.classList.toggle("active", x === b));
    $("#feedList").innerHTML = `<div class="skel-row"></div><div class="skel-row"></div>`;
    loadFeed();
  });
});

// ── boot ──────────────────────────────────────────────────────────────
function refreshAll() {
  loadHeat();
  loadFeed();
}
refreshAll();
state.refreshTimer = setInterval(refreshAll, 60_000);
