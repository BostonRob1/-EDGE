// Real-time list engine — the "live ticking terminal" feel.
//
// liveList() does a KEYED diff against what's already in the DOM: it updates
// only the rows whose data changed (and flashes them), slides new rows in,
// removes gone ones, and reorders in place — all WITHOUT resetting scroll or
// dropping hover. Polling the API every few seconds then becomes seamless:
// prices tick and flash instead of the whole panel flickering.
//
// liveLoop() runs a fetch on an interval but pauses while the tab is hidden
// (no point hammering the API in a background tab) and refreshes the instant
// the trader returns to the tab.

export function liveList(container, items, { key, render, max = Infinity, flash = true } = {}) {
  if (!container || typeof key !== "function" || typeof render !== "function") return;
  const next = items.slice(0, max);
  const existing = new Map();
  for (const el of Array.from(container.children)) {
    if (el.dataset && el.dataset.k) existing.set(el.dataset.k, el);
    else el.remove(); // drop skeletons / stray nodes on first paint
  }

  const seen = new Set();
  let prev = null;
  for (const item of next) {
    const k = String(key(item));
    seen.add(k);
    const html = render(item);
    let el = existing.get(k);

    if (!el) {
      el = htmlToEl(html);
      if (!el) continue;
      el.dataset.k = k;
      el.dataset.h = html;
      if (flash) el.classList.add("live-in");
    } else if (el.dataset.h !== html) {
      // Data changed → swap in a fresh node so the flash animation restarts.
      const fresh = htmlToEl(html);
      if (fresh) {
        fresh.dataset.k = k;
        fresh.dataset.h = html;
        if (flash) fresh.classList.add(directionClass(el.dataset.h, html));
        el.replaceWith(fresh);
        el = fresh;
        existing.set(k, fresh);
      }
    }

    // Place in correct order (moving an existing node preserves its state).
    const ref = prev ? prev.nextSibling : container.firstChild;
    if (el !== ref) container.insertBefore(el, ref);
    prev = el;
  }

  for (const [k, el] of existing) if (!seen.has(k)) el.remove();
}

// Flash green/red when the leading number moved up/down, neutral otherwise.
function directionClass(oldHtml, newHtml) {
  const o = firstNum(oldHtml);
  const n = firstNum(newHtml);
  if (o != null && n != null && n !== o) return n > o ? "live-flash-up" : "live-flash-dn";
  return "live-flash";
}
function firstNum(html) {
  const m = String(html).replace(/<[^>]+>/g, " ").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function htmlToEl(html) {
  const t = document.createElement("template");
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

export function liveLoop(fn, ms) {
  let timer = null;
  const tick = () => { if (!document.hidden) fn(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) fn(); });
  fn();
  timer = setInterval(tick, ms);
  return () => clearInterval(timer);
}
