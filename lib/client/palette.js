// $EDGE Command Palette.
//
// Cmd+K (Ctrl+K on Windows/Linux) opens a modal overlay with a search input
// that fuzzy-matches against:
//   - All 8 product pages
//   - Top markets (from /api/markets)
//   - Active whales (from /api/whales/leaderboard)
//
// Arrow keys to navigate · Enter to jump · Escape closes.
// Auto-injected by every page just like ticker.js / elite.js drawer.

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Static index — always available
  const PAGES = [
    { type: "page", title: "Dashboard", subtitle: "4-panel live command center", href: "/dashboard.html", icon: "▤" },
    { type: "page", title: "Divergence Radar", subtitle: "The Edge product — money meets mouth", href: "/edge.html", icon: "▲" },
    { type: "page", title: "Arbitrage Radar", subtitle: "Cross-platform Poly ↔ Kalshi edge detection", href: "/arb.html", icon: "⇄" },
    { type: "page", title: "Buzz", subtitle: "Real-time market chatter aggregator", href: "/buzz.html", icon: "◆" },
    { type: "page", title: "Whales", subtitle: "Polymarket whale tracker + leaderboard", href: "/whales.html", icon: "◉" },
    { type: "page", title: "Rug Radar", subtitle: "Solana + Ethereum token risk analyzer", href: "/tracker.html", icon: "⚠" },
    { type: "page", title: "Token", subtitle: "$EDGE tokenomics + utility tiers", href: "/token.html", icon: "$" },
    { type: "page", title: "Waitlist", subtitle: "Join the early ops — claim Day-Zero", href: "/waitlist.html", icon: "✦" },
  ];

  function init() {
    if (document.querySelector(".elite-palette")) return;

    // ── Build overlay + modal ─────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.className = "elite-palette-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="elite-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="elite-palette-search">
          <span class="elite-palette-search-icon">⌕</span>
          <input
            type="text"
            class="elite-palette-input"
            placeholder="Jump to anything — pages, markets, whales…"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          />
          <kbd class="elite-palette-kbd">ESC</kbd>
        </div>
        <div class="elite-palette-results" id="elitePaletteResults"></div>
        <div class="elite-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> jump</span>
          <span><kbd>ESC</kbd> close</span>
          <span class="elite-palette-brand">$EDGE</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".elite-palette-input");
    const resultsEl = overlay.querySelector(".elite-palette-results");

    let allItems = [...PAGES];
    let filteredItems = allItems;
    let selectedIndex = 0;
    let dataLoaded = false;

    function open() {
      overlay.classList.add("show");
      document.documentElement.classList.add("elite-palette-open");
      overlay.setAttribute("aria-hidden", "false");
      input.value = "";
      filterAndRender("");
      if (!dataLoaded) loadDynamicData(); // lazy-load markets+whales on first open
      setTimeout(() => input.focus(), 30);
    }

    function close() {
      overlay.classList.remove("show");
      document.documentElement.classList.remove("elite-palette-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    // Lazy-fetch dynamic data on first palette open — keeps initial page
    // load fast (no extra API calls until the user actually wants the palette)
    async function loadDynamicData() {
      try {
        const [marketsR, whalesR] = await Promise.allSettled([
          fetch("/api/markets").then((r) => r.json()),
          fetch("/api/whales/leaderboard?limit=20").then((r) => r.json()),
        ]);

        const marketItems =
          marketsR.status === "fulfilled" && Array.isArray(marketsR.value?.markets)
            ? marketsR.value.markets.slice(0, 50).map((m) => ({
                type: "market",
                title: m.title || "(untitled)",
                subtitle: `${(m.source || "").toUpperCase()} · ${m.category || ""} · vol ${fmtUsd(m.volume_24h)}`,
                href: m.link || "#",
                external: true,
                icon: m.source === "polymarket" ? "P" : "K",
                iconColor: m.source === "polymarket" ? "magenta" : "lime",
              }))
            : [];

        const whaleItems =
          whalesR.status === "fulfilled" && Array.isArray(whalesR.value?.whales)
            ? whalesR.value.whales.slice(0, 20).map((w) => ({
                type: "whale",
                title: w.name || shortWallet(w.wallet),
                subtitle: `${shortWallet(w.wallet)} · ${fmtUsd(w.total_usd)} vol · ${fmtUsd(w.portfolio_usd)} portfolio`,
                href: `/whales.html?wallet=${encodeURIComponent(w.wallet)}`,
                icon: "◉",
                iconColor: "lime",
              }))
            : [];

        allItems = [...PAGES, ...marketItems, ...whaleItems];
        dataLoaded = true;
        // Re-render with current input
        filterAndRender(input.value);
      } catch {
        // Silent — palette still works with the static pages list
      }
    }

    function filterAndRender(query) {
      const q = (query || "").trim().toLowerCase();
      if (!q) {
        filteredItems = allItems.slice(0, 30);
      } else {
        // Score each item by:
        //   - title startsWith q → +100
        //   - title contains q → +50
        //   - subtitle contains q → +20
        //   - fuzzy character-sequence match in title → +10 base
        filteredItems = allItems
          .map((item) => {
            const t = (item.title || "").toLowerCase();
            const s = (item.subtitle || "").toLowerCase();
            let score = 0;
            if (t.startsWith(q)) score += 100;
            else if (t.includes(q)) score += 50;
            if (s.includes(q)) score += 20;
            if (score === 0) {
              // fuzzy fallback — letters of q appear in order in t
              let i = 0;
              for (const ch of t) {
                if (i < q.length && ch === q[i]) i++;
              }
              if (i === q.length) score = 5;
            }
            return { item, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 30)
          .map((x) => x.item);
      }
      selectedIndex = 0;
      renderResults();
    }

    function renderResults() {
      if (!filteredItems.length) {
        resultsEl.innerHTML = `
          <div class="elite-palette-empty">
            No matches. Try a market name, a wallet address, or a feature.
          </div>`;
        return;
      }

      // Group by type for clean section headers
      const groups = {
        page: { label: "Pages", items: [] },
        market: { label: "Markets", items: [] },
        whale: { label: "Whales", items: [] },
      };
      filteredItems.forEach((it, idx) => groups[it.type]?.items.push({ ...it, idx }));

      const html = Object.values(groups)
        .filter((g) => g.items.length > 0)
        .map((g) => `
          <div class="elite-palette-group">
            <div class="elite-palette-group-label">${g.label}</div>
            ${g.items.map((it) => `
              <button
                class="elite-palette-item ${it.idx === selectedIndex ? "selected" : ""}"
                data-idx="${it.idx}"
                data-href="${escapeAttr(it.href)}"
                data-external="${it.external ? "1" : "0"}"
                type="button"
              >
                <span class="elite-palette-item-icon ${it.iconColor ? "icon-" + it.iconColor : ""}">${escapeHtml(it.icon || "·")}</span>
                <span class="elite-palette-item-body">
                  <span class="elite-palette-item-title">${escapeHtml(it.title)}</span>
                  ${it.subtitle ? `<span class="elite-palette-item-sub">${escapeHtml(it.subtitle)}</span>` : ""}
                </span>
                <span class="elite-palette-item-arrow">↗</span>
              </button>
            `).join("")}
          </div>
        `)
        .join("");

      resultsEl.innerHTML = html;

      // Hook click handlers
      resultsEl.querySelectorAll(".elite-palette-item").forEach((btn) => {
        btn.addEventListener("click", () => navigateTo(btn));
        btn.addEventListener("mouseenter", () => {
          selectedIndex = Number(btn.dataset.idx) || 0;
          updateSelection();
        });
      });
    }

    function updateSelection() {
      resultsEl.querySelectorAll(".elite-palette-item").forEach((btn) => {
        btn.classList.toggle("selected", Number(btn.dataset.idx) === selectedIndex);
      });
      // Scroll selected into view
      const sel = resultsEl.querySelector(".elite-palette-item.selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    }

    function navigateTo(btn) {
      const href = btn?.dataset?.href || filteredItems[selectedIndex]?.href;
      const external = btn?.dataset?.external === "1" || filteredItems[selectedIndex]?.external;
      if (!href || href === "#") return;
      close();
      if (external) {
        window.open(href, "_blank", "noopener");
      } else {
        window.location.href = href;
      }
    }

    // ── Keyboard handling ─────────────────────────────────────────────
    input.addEventListener("input", (e) => filterAndRender(e.target.value));

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (e.key === "Enter") {
        e.preventDefault();
        navigateTo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    // Global Cmd+K / Ctrl+K trigger
    document.addEventListener("keydown", (e) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const triggerKey = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (triggerKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (overlay.classList.contains("show")) close();
        else open();
      } else if (e.key === "Escape" && overlay.classList.contains("show")) {
        close();
      }
    });

    // Click outside the modal → close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  function shortWallet(w) {
    if (!w) return "?";
    return w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
  }
  function fmtUsd(n) {
    if (!n || !Number.isFinite(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e9) return "$" + (a / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return "$" + (a / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return "$" + (a / 1e3).toFixed(1) + "K";
    return "$" + Math.round(a);
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, "&#96;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
