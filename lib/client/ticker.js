// $EDGE Live Activity Ticker.
//
// Auto-injects a Bloomberg-style scrolling tape directly below the page header
// on every page. Pulls from /api/ticker (which aggregates whale trades, news
// drops, and Edge calls) and renders them as a single seamless marquee.
//
// Strategy:
//   - Render the items once, duplicate them for seamless loop
//   - Animate translateX from 0 to -50% (since duplicated, the loop is exact)
//   - Pause on hover so users can read + click
//   - Refresh every 60s; merge new items in without breaking the animation
//
// Each item is a clickable link drilling into the relevant surface.

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  function init() {
    // Don't double-inject
    if (document.querySelector(".elite-ticker")) return;
    const header = document.querySelector("header");
    if (!header) return;

    // Build the ticker shell
    const ticker = document.createElement("div");
    ticker.className = "elite-ticker";
    ticker.setAttribute("aria-label", "Live activity feed");
    ticker.innerHTML = `
      <div class="elite-ticker-label">
        <span class="elite-ticker-dot"></span>
        <span class="elite-ticker-label-text">LIVE</span>
      </div>
      <div class="elite-ticker-viewport">
        <div class="elite-ticker-track" id="eliteTickerTrack">
          <span class="elite-ticker-placeholder">Loading the action…</span>
        </div>
      </div>
    `;
    // Insert immediately after the header so it sits between header and main
    header.insertAdjacentElement("afterend", ticker);

    // Publish ticker height to CSS so viewport-fit layouts (e.g. dashboard)
    // can subtract it from their height calc. Pages that don't read this
    // var just ignore it.
    document.documentElement.style.setProperty("--elite-ticker-h", "36px");

    let lastTopId = null;

    async function load() {
      try {
        const r = await fetch("/api/ticker");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const events = data.events || [];
        if (!events.length) return;
        renderEvents(events);
      } catch (err) {
        // Silent failure — better to keep the page clean than splash an error
        const track = document.getElementById("eliteTickerTrack");
        if (track && !track.dataset.everRendered) {
          track.innerHTML = `<span class="elite-ticker-placeholder">Feed quiet right now.</span>`;
        }
      }
    }

    function renderEvents(events) {
      const track = document.getElementById("eliteTickerTrack");
      if (!track) return;

      // Stable ordering — keep the latest at the front of the strip
      const items = events.map(renderItem).join("");
      // Duplicate the rendered items so the marquee loop is seamless
      track.innerHTML = items + items;
      track.dataset.everRendered = "1";

      // Re-start animation based on content width — duration scales with
      // number of items so density doesn't make it scroll too fast/slow
      const itemCount = events.length;
      const duration = Math.max(40, itemCount * 4); // seconds
      track.style.animationDuration = duration + "s";

      lastTopId = events[0]?.text?.slice(0, 20) || null;
    }

    function renderItem(e) {
      const cls = "elite-ticker-item elite-ticker-" + e.type;
      const icon = e.type === "WHALE_TRADE"
        ? "◆"
        : e.type === "NEWS_DROP"
        ? "▣"
        : e.type === "EDGE_CALL"
        ? "▲"
        : "·";
      const amount = e.amount
        ? `<span class="elite-ticker-amount">${fmtUsd(e.amount)}</span>`
        : "";
      const text = escapeHtml(e.text || "");
      return `
        <a class="${cls}" href="${escapeAttr(e.href || "#")}">
          <span class="elite-ticker-icon">${icon}</span>
          ${amount}
          <span class="elite-ticker-text">${text}</span>
        </a>
      `;
    }

    function fmtUsd(n) {
      if (!n || !Number.isFinite(n)) return "";
      const a = Math.abs(n);
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

    load();
    setInterval(load, 60_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
