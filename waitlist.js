// $EDGE Waitlist + Prediction Game frontend.
import { fmtNum, fmtUsd, short, escapeHtml, escapeAttr } from "/lib/client/format.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;

const state = {
  wallet: null,
  joined: false,
  position: null,
  predictions: new Map(), // slug → { side, confidence, market_title }
  topMarkets: [],
};

// ── COUNTER ───────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const params = state.wallet ? `?wallet=${encodeURIComponent(state.wallet)}` : "";
    const r = await fetch(`/api/waitlist/stats${params}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
    $("#counter").textContent = (data.count || 0).toLocaleString();
    $("#counterSub").textContent = data.persistence === "kv"
      ? `live · refreshing every 30s`
      : `local session · KV pending`;
    if (data.persistence !== "kv") {
      $("#persistenceNotice").style.display = "block";
    } else {
      $("#persistenceNotice").style.display = "none";
    }
    if (data.you && !state.joined) {
      // Re-render position card if returning visitor
      state.joined = true;
      state.position = data.you.position;
      showPosition(data.you.position);
    }
    renderLeaderboard(data.leaderboard || []);
  } catch (err) {
    $("#counterSub").textContent = "stats error";
  }
}

function renderLeaderboard(entries) {
  const table = $("#lbTable");
  // Keep header (3 cells), replace rows
  const headerCount = 3;
  while (table.children.length > headerCount) table.removeChild(table.lastChild);

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.style.gridColumn = "1 / -1";
    empty.style.padding = "24px";
    empty.style.color = "var(--muted)";
    empty.style.textAlign = "center";
    empty.style.fontFamily = "'JetBrains Mono', monospace";
    empty.style.fontSize = "12px";
    empty.textContent = "No predictions submitted yet — be first.";
    table.appendChild(empty);
    return;
  }

  entries.forEach((e, i) => {
    const rank = document.createElement("div");
    rank.className = "lb-rank";
    rank.textContent = `#${i + 1}`;
    const w = document.createElement("div");
    w.className = "lb-wallet";
    w.textContent = short(e.wallet, 8);
    const s = document.createElement("div");
    s.className = "lb-score";
    s.textContent = (e.score || 0).toFixed(2);
    table.appendChild(rank);
    table.appendChild(w);
    table.appendChild(s);
  });
}

// ── WALLET CONNECT (Phantom) ──────────────────────────────────────────
$("#connectBtn").addEventListener("click", async () => {
  if (!window.solana || !window.solana.isPhantom) {
    setMsg("#signupMsg", "Phantom not detected. Install phantom.app or paste your wallet manually.", "error");
    return;
  }
  try {
    const resp = await window.solana.connect();
    const pubKey = resp.publicKey?.toString?.();
    if (pubKey) {
      $("#walletInput").value = pubKey;
      setMsg("#signupMsg", "Connected. Click Claim Position to continue.", "ok");
    }
  } catch (err) {
    setMsg("#signupMsg", `Connection cancelled.`, "error");
  }
});

// ── SIGNUP ────────────────────────────────────────────────────────────
$("#signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const wallet = $("#walletInput").value.trim();
  const email = $("#emailInput").value.trim() || null;
  if (!wallet) return setMsg("#signupMsg", "Wallet required.", "error");
  if (!SOL_RE.test(wallet) && !ETH_RE.test(wallet)) {
    return setMsg("#signupMsg", "Wallet must be Solana base58 or 0x… ETH.", "error");
  }

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = "Claiming…";
  setMsg("#signupMsg", "Submitting…", "");

  // Referral code pickup from URL
  const params = new URLSearchParams(location.search);
  const referredBy = params.get("ref") || null;

  try {
    const r = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, email, referredBy }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
    state.wallet = wallet;
    state.joined = true;
    state.position = data.position;
    showPosition(data.position, data.already_joined);
    loadStats(); // refresh counter
    loadTopMarkets(); // start the game
  } catch (err) {
    setMsg("#signupMsg", err.message || "Join failed.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Claim Position";
  }
});

function showPosition(position, alreadyJoined) {
  $("#posNumber").textContent = (position || 0).toLocaleString();
  $("#positionCard").classList.add("show");
  setMsg(
    "#signupMsg",
    alreadyJoined ? `Already on the list at #${position}.` : `You're in. Position #${position}.`,
    "ok"
  );
  // Build share links
  const ref = state.wallet;
  const shareUrl = `${location.origin}/waitlist.html?ref=${encodeURIComponent(ref)}`;
  const tweetText = encodeURIComponent(
    `Just claimed position #${position} on the $EDGE waitlist. Money meets Mouth — where they disagree, the Edge lives. ${shareUrl}`
  );
  $("#shareX").href = `https://twitter.com/intent/tweet?text=${tweetText}`;
  $("#shareTg").href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${tweetText}`;
  $("#copyLink").onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      $("#copyLink").textContent = "Copied ✓";
      setTimeout(() => ($("#copyLink").textContent = "Copy referral link"), 1500);
    } catch {}
  };
  // Scroll into view
  $("#positionCard").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ── PREDICTION GAME ───────────────────────────────────────────────────
async function loadTopMarkets() {
  $("#gameSection").style.display = "block";
  try {
    const r = await fetch("/api/markets");
    const data = await r.json();
    if (!r.ok) throw new Error(`markets ${r.status}`);
    // Pick top 5 by volume, excluding very-skewed markets (yes < 5% or > 95%) — boring picks
    state.topMarkets = (data.markets || [])
      .filter((m) => m.yes_price > 0.05 && m.yes_price < 0.95)
      .slice(0, 5);
    renderPredictionGame();
  } catch (err) {
    $("#predictionsGrid").innerHTML = `<div class="notice">${escapeHtml(err.message || "markets failed")}</div>`;
  }
}

function renderPredictionGame() {
  if (!state.topMarkets.length) {
    $("#predictionsGrid").innerHTML = `<div class="notice">No actionable markets right now.</div>`;
    return;
  }
  $("#gameMeta").textContent = `${state.topMarkets.length} markets · live odds`;
  $("#predictionsGrid").innerHTML = state.topMarkets
    .map((m) => {
      const yes = ((m.yes_price || 0) * 100).toFixed(0);
      const no = ((m.no_price || 0) * 100).toFixed(0);
      const srcLabel = m.source === "polymarket" ? "POLY" : "KALSHI";
      return `
        <div class="prediction" data-slug="${escapeAttr(m.slug)}" data-title="${escapeAttr(m.title)}">
          <div class="market-info">
            <div class="market-title">${escapeHtml(m.title)}</div>
            <div class="market-meta">
              <span>${srcLabel}</span>
              <span>·</span>
              <span>${escapeHtml(m.category || "")}</span>
              <span>·</span>
              <span>vol ${fmtUsd(m.volume_24h)}</span>
            </div>
          </div>
          <div class="live-odds">
            <span class="y">${yes}¢</span> / <span class="n">${no}¢</span>
          </div>
          <div class="pred-buttons" data-slug="${escapeAttr(m.slug)}">
            <button class="pred-btn" data-side="YES">YES</button>
            <button class="pred-btn" data-side="NO">NO</button>
          </div>
        </div>
      `;
    })
    .join("");

  // Wire prediction buttons
  $$(".pred-btn", $("#predictionsGrid")).forEach((b) => {
    b.addEventListener("click", () => {
      const parent = b.closest(".pred-buttons");
      const slug = parent.dataset.slug;
      const market = state.topMarkets.find((m) => m.slug === slug);
      const side = b.dataset.side;
      // Toggle — clicking same side again clears
      const existing = state.predictions.get(slug);
      if (existing && existing.side === side) {
        state.predictions.delete(slug);
        $$(".pred-btn", parent).forEach((btn) => btn.classList.remove("active", "YES", "NO"));
      } else {
        // Confidence = how much it deviates from the implied probability
        // (signals conviction beyond the market). For v0 we just use market price.
        const impliedYes = market?.yes_price || 0.5;
        const confidence = side === "YES" ? Math.min(0.95, 1 - impliedYes) : Math.min(0.95, impliedYes);
        state.predictions.set(slug, { side, confidence, market_title: market?.title });
        $$(".pred-btn", parent).forEach((btn) => {
          btn.classList.remove("active", "YES", "NO");
          if (btn === b) btn.classList.add("active", side);
        });
      }
      const submit = $("#submitPredictions");
      submit.disabled = state.predictions.size === 0;
    });
  });
}

$("#submitPredictions").addEventListener("click", async () => {
  if (!state.wallet || state.predictions.size === 0) return;
  const btn = $("#submitPredictions");
  btn.disabled = true;
  btn.textContent = "Submitting…";
  setMsg("#gameMsg", "Saving predictions…", "");

  const predictions = [...state.predictions.entries()].map(([slug, p]) => ({
    market_slug: slug,
    market_title: p.market_title,
    side: p.side,
    confidence: p.confidence,
  }));

  try {
    const r = await fetch("/api/waitlist/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: state.wallet, predictions }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
    setMsg(
      "#gameMsg",
      `Locked in ${data.predictions_saved} predictions. Projected score: ${data.projected_score.toFixed(2)}`,
      "ok"
    );
    loadStats(); // refresh leaderboard
  } catch (err) {
    setMsg("#gameMsg", err.message || "Save failed.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit Predictions";
  }
});

// ── UTIL ──────────────────────────────────────────────────────────────
function setMsg(sel, text, cls) {
  const el = $(sel);
  if (!el) return;
  el.textContent = text;
  el.className = "signup-msg " + (cls || "");
}

// ── BOOT ──────────────────────────────────────────────────────────────
loadStats();
setInterval(loadStats, 30_000);
