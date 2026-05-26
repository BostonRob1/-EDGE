// Shared client-side formatting helpers — imported by whales.js, buzz.js,
// tracker.js. Single source of truth for currency, percent, time, and
// truncation formatting so all surfaces look consistent.

// ── currency ──────────────────────────────────────────────────────────
// Compact USD ("$1.2M", "$3.4K", "$45.67"). For sub-dollar prices, falls back
// to exponential for the truly tiny so memecoin sub-$0.000001 still readable.
export const fmtUsd = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 0.000001) return sign + "$" + a.toExponential(2);
  if (a < 0.01) return sign + "$" + a.toFixed(6);
  if (a < 1) return sign + "$" + a.toFixed(4);
  if (a >= 1e9) return sign + "$" + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return sign + "$" + (a / 1e3).toFixed(1) + "K";
  if (a >= 100) return sign + "$" + Math.round(a).toString();
  return sign + "$" + a.toFixed(2);
};

// Full-precision USD ("$1,234.56") — for detail views where the exact figure
// matters and the column has room.
export const fmtUsdExact = (n) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

// ── numeric ───────────────────────────────────────────────────────────
// Compact integer ("1.2M", "3.4K", "127"). Use when the unit is implicit
// (counts, holders, trades).
export const fmtNum = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return sign + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return sign + (a / 1e3).toFixed(1) + "K";
  return sign + Math.round(a).toString();
};

// ── percent ───────────────────────────────────────────────────────────
// Signed percent ("+12.34%", "-5.67%"). Auto-detects: 0..1 treated as fraction
// (multiplied by 100); otherwise treated as already-scaled percent.
export const fmtPct = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.abs(n) <= 1 ? n * 100 : n;
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
};

// ── time ──────────────────────────────────────────────────────────────
// Relative-time-ago, compact ("3m", "5h", "2d"). Input is unix seconds.
export const fmtAgo = (tsSeconds) => {
  if (!tsSeconds) return "—";
  const now = Date.now() / 1000;
  const d = now - tsSeconds;
  if (d < 60) return Math.max(0, Math.round(d)) + "s";
  if (d < 3600) return Math.round(d / 60) + "m";
  if (d < 86400) return Math.round(d / 3600) + "h";
  if (d < 86400 * 30) return Math.round(d / 86400) + "d";
  return Math.round(d / 86400 / 30) + "mo";
};

// Pair age, compact ("45m", "30.6mo", etc). Input is hours.
export const fmtAge = (hours) => {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return Math.round(hours * 60) + "m";
  if (hours < 48) return hours.toFixed(1) + "h";
  if (hours < 24 * 30) return (hours / 24).toFixed(1) + "d";
  return (hours / 24 / 30).toFixed(1) + "mo";
};

// ── strings ───────────────────────────────────────────────────────────
// Address truncation ("0x6770…45fb"). Defaults to 6 chars on each side.
export const short = (a, n = 6) =>
  !a ? "" : a.length <= 2 * n + 2 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;

// HTML-escape a string for safe insertion into innerHTML.
export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Attribute-safe variant — also escapes backtick to avoid template injection.
export const escapeAttr = (s) => escapeHtml(s).replace(/`/g, "&#96;");
