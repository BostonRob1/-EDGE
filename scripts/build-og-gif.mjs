// Build an animated GIF used as the og:image / twitter:image / iMessage preview
// for the $EDGE coming-soon page.
//
// Pipeline: Satori (real Anton + JetBrains Mono + DM Sans → SVG)
//        → @resvg/resvg-js (SVG → raw RGBA pixels)
//        → gifenc (RGBA frames → optimized animated GIF)
//
// Output: og-coming-soon.gif at the project root, served by Vercel as a
// static asset and referenced from the coming-soon page meta tags.
//
// Run: `npm run build:og`

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import pkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

const W = 1200;
const H = 630;
const FRAMES = 24;
const DELAY_MS = 100; // 24 × 100ms = 2.4s loop, 10fps

const C = {
  void: "#050507",
  void2: "#0C0C10",
  lime: "#C4FF00",
  limeDim: "#3F5300",
  magenta: "#FF006E",
  white: "#F5F5F0",
  muted: "#6B6B73",
  border: "#1f1f24",
  borderBright: "#3a4a00",
};

// ---------------------------------------------------------------------------
// Font loader — fetch the real brand typefaces from Google Fonts.
// ---------------------------------------------------------------------------
async function fetchGoogleFont(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await fetch(cssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36" },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  if (!match) throw new Error(`No font URL in CSS for ${family} ${weight}`);
  const buf = await fetch(match[1]).then((r) => r.arrayBuffer());
  return Buffer.from(buf);
}

console.log("→ fetching fonts…");
const [anton, dmSans, dmSansBold, mono, monoBold] = await Promise.all([
  fetchGoogleFont("Anton", 400),
  fetchGoogleFont("DM Sans", 400),
  fetchGoogleFont("DM Sans", 700),
  fetchGoogleFont("JetBrains Mono", 500),
  fetchGoogleFont("JetBrains Mono", 700),
]);
const fonts = [
  { name: "Anton", data: anton, weight: 400, style: "normal" },
  { name: "DM Sans", data: dmSans, weight: 400, style: "normal" },
  { name: "DM Sans", data: dmSansBold, weight: 700, style: "normal" },
  { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
  { name: "JetBrains Mono", data: monoBold, weight: 700, style: "normal" },
];

// ---------------------------------------------------------------------------
// Frame builder — returns a Satori element tree for frame index `f` (0..FRAMES-1).
// ---------------------------------------------------------------------------
const el = (type, props, ...children) => ({
  type,
  props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  key: null,
});

// Tape source — long enough to feel "live", short enough to fit in the
// canvas after windowing. Each frame slices a window starting at
// progressively later positions (and wraps via doubled string).
const TICKER_SRC =
  "TRUMP-2028 0.42→0.51 +21.4% · FED-PIVOT 0.18→0.14 -22.2% · CPI-JUN 0.62→0.71 +14.5% · BTC-200K 0.31→0.36 +16.1% · ETH-FLIP 0.07→0.04 -42.8% · NVDA-Q3 0.55→0.61 +10.9% · ";
const TICKER_WINDOW = 110;
function tickerSlice(f) {
  const src = TICKER_SRC + TICKER_SRC; // doubled so the wrap is seamless
  const start = (f * 4) % TICKER_SRC.length; // 4 chars per frame
  return src.slice(start, start + TICKER_WINDOW);
}

// Lerp / easing helpers
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ── Divergence chart: line shapes (1200x56 canvas, y=0 is top) ─────────────
// MONEY climbs from y=42 to y=6 — bullish trend (UP visually).
// MOUTH stays flat / drifts down from y=46 to y=44 — public sentiment slipping.
// As frames advance, both lines draw progressively from left to right; the
// magenta gap between them widens and labels "EDGE 0.72" appears near the end.
const MONEY_PTS = [
  [0, 42], [80, 40], [160, 38], [240, 32], [320, 30], [400, 26],
  [480, 22], [560, 20], [640, 16], [720, 14], [800, 12], [880, 10],
  [960, 8],  [1040, 6], [1120, 6], [1200, 4],
];
const MOUTH_PTS = [
  [0, 46], [80, 44], [160, 46], [240, 42], [320, 44], [400, 42],
  [480, 44], [560, 42], [640, 44], [720, 42], [800, 44], [880, 42],
  [960, 44], [1040, 44], [1120, 46], [1200, 44],
];
const ptsToPath = (pts) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
function chartPaths(progress) {
  const N = MONEY_PTS.length;
  const visible = Math.max(2, Math.floor(N * progress + 0.001));
  const money = MONEY_PTS.slice(0, visible);
  const mouth = MOUTH_PTS.slice(0, visible);
  const moneyPath = ptsToPath(money);
  const mouthPath = ptsToPath(mouth);
  const gapPath =
    ptsToPath(money) +
    " " +
    mouth.slice().reverse().map((p) => `L ${p[0]} ${p[1]}`).join(" ") +
    " Z";
  const endX = money[money.length - 1][0];
  const endY = money[money.length - 1][1];
  const endYMouth = mouth[mouth.length - 1][1];
  return { moneyPath, mouthPath, gapPath, endX, endY, endYMouth };
}

function buildFrame(f) {
  const t = f / FRAMES; // 0..1 progress through loop

  // ── Animated values ──────────────────────────────────────────────────────
  // $ symbol opacity heartbeat
  const pulsePhase = Math.sin(t * Math.PI * 2);
  const dollarOpacity = 0.92 + pulsePhase * 0.08;

  // "09" opacity pulses out of phase with the dollar
  const ninePulse = Math.sin((t + 0.5) * Math.PI * 2);
  const nineOpacity = 0.94 + ninePulse * 0.06;

  // Top-right LIVE dot blinks
  const liveOn = (f % 8) < 7;

  // Ticker text content shifts per frame (no translateX)
  const tape = tickerSlice(f);

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.void,
        position: "relative",
        color: C.white,
        fontFamily: "DM Sans",
      },
    },

    // ── CORNER BRACKETS ────────────────────────────────────────────────────
    ...corners(),

    // ── TOP BAR ─────────────────────────────────────────────────────────────
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          paddingLeft: 48,
          paddingRight: 48,
          borderBottom: `1px solid ${C.borderBright}`,
          position: "relative",
        },
      },
      // brand
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14 } },
        markSVG(28),
        el(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: "Anton",
              fontSize: 30,
              letterSpacing: "-1px",
            },
          },
          el("div", { style: { color: C.lime, display: "flex" } }, "$"),
          el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
        ),
      ),
      // live pill
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 6,
            paddingBottom: 6,
            border: `1px solid ${C.borderBright}`,
            fontFamily: "JetBrains Mono",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "4px",
            color: C.lime,
          },
        },
        el("div", {
          style: {
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: liveOn ? C.lime : C.limeDim,
            display: "flex",
          },
        }),
        el("div", { style: { display: "flex" } }, "PRE-LAUNCH · V1"),
      ),
    ),

    // ── BODY (centered safe-zone composition) ───────────────────────────────
    // Everything critical lives inside the center 800px so iMessage/LinkedIn
    // popup crops (which cut ~150-200px off the sides) don't kill the message.
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          paddingLeft: 56,
          paddingRight: 56,
          paddingTop: 32,
          paddingBottom: 32,
          position: "relative",
        },
      },
      // Eyebrow
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 20,
            letterSpacing: "5px",
            color: C.lime,
            textAlign: "center",
          },
        },
        el("div", {
          style: {
            width: 9,
            height: 9,
            borderRadius: 999,
            backgroundColor: liveOn ? C.lime : C.limeDim,
            display: "flex",
          },
        }),
        el(
          "div",
          { style: { display: "flex" } },
          "T-MINUS 14 DAYS · FAIRLAUNCH JUN 09",
        ),
      ),

      // HERO — single massive centered $EDGE (the focal point)
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            fontFamily: "Anton",
            fontSize: 248,
            lineHeight: 0.9,
            letterSpacing: "-8px",
            marginTop: 14,
          },
        },
        el(
          "div",
          { style: { color: C.lime, display: "flex", opacity: dollarOpacity } },
          "$",
        ),
        el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
      ),

      // Subtitle — DROPS JUN 09. (smaller, still confident)
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            fontFamily: "Anton",
            fontSize: 86,
            lineHeight: 1,
            letterSpacing: "-2px",
            marginTop: 10,
          },
        },
        el("div", { style: { color: C.white, display: "flex" } }, "DROPS JUN "),
        el(
          "div",
          { style: { color: C.lime, display: "flex", opacity: nineOpacity } },
          "09",
        ),
        el("div", { style: { color: C.muted, display: "flex" } }, "."),
      ),

      // Tagline — centered
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            fontFamily: "DM Sans",
            fontWeight: 400,
            fontSize: 26,
            color: C.white,
            opacity: 0.78,
            marginTop: 22,
            textAlign: "center",
          },
        },
        "Watch the action. Before you bet.",
      ),

      // Bottom ribbon — centered, single line
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            marginTop: 22,
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 16,
            letterSpacing: "4px",
            color: C.muted,
          },
        },
        el("div", { style: { display: "flex", color: C.lime } }, "MONEY"),
        el("div", { style: { display: "flex" } }, "·"),
        el("div", { style: { display: "flex", color: C.white } }, "MOUTH"),
        el("div", { style: { display: "flex" } }, "·"),
        el("div", { style: { display: "flex", color: C.lime } }, "EDGE"),
      ),
    ),

    // ── BLOOMBERG-STYLE LIVE TICKER (character-window scroll) ──────────────
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: 30,
          backgroundColor: C.void2,
          borderTop: `1px solid ${C.borderBright}`,
          paddingLeft: 24,
          paddingRight: 24,
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "2px",
          color: C.muted,
          overflow: "hidden",
          whiteSpace: "nowrap",
        },
      },
      tape,
    ),

    // ── DIVERGENCE CHART BAND — money vs mouth, draws across frames ────────
    chartBand(f),
  );
}

// ── Chart band element: 1200×56 SVG showing money/mouth divergence ─────────
// Both lines are ALWAYS fully drawn (so static-frame viewers see the full
// composition). Animation: a scan column sweeps left → right pulsing the end
// marker, and the "EDGE +0.72" label blinks subtly.
function chartBand(f) {
  const { moneyPath, mouthPath, gapPath, endX, endY, endYMouth } = chartPaths(1);

  // Scan-column position eases across the chart in a slow sweep
  const t = f / FRAMES;
  const scanX = lerp(40, 1160, easeInOutCubic(t));

  // Pulsing marker scale
  const markerR = 3 + Math.sin(t * Math.PI * 4) * 0.6;

  // Label opacity blink (in for most of the loop, brief dip at one moment)
  const labelOpacity = (f % 12) < 10 ? 1 : 0.45;

  return el(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: 56,
        backgroundColor: C.void,
        position: "relative",
      },
    },
    el(
      "svg",
      {
        width: 1200, height: 56,
        viewBox: "0 0 1200 56",
        preserveAspectRatio: "none",
        style: { display: "flex" },
      },
      // gridlines
      el("line", { x1: 0, y1: 28, x2: 1200, y2: 28, stroke: "rgba(245,245,240,0.05)", strokeWidth: 1 }),
      el("line", { x1: 0, y1: 8,  x2: 1200, y2: 8,  stroke: "rgba(245,245,240,0.04)", strokeWidth: 1 }),
      el("line", { x1: 0, y1: 48, x2: 1200, y2: 48, stroke: "rgba(245,245,240,0.04)", strokeWidth: 1 }),
      // gap fill
      el("path", { d: gapPath, fill: "rgba(255,0,110,0.18)", stroke: "none" }),
      // mouth line
      el("path", {
        d: mouthPath, fill: "none", stroke: "#F5F5F0", strokeWidth: 1.6,
        strokeLinecap: "round", strokeLinejoin: "round", opacity: 0.78,
      }),
      // money line
      el("path", {
        d: moneyPath, fill: "none", stroke: "#C4FF00", strokeWidth: 2,
        strokeLinecap: "round", strokeLinejoin: "round",
      }),
      // scan column — subtle vertical highlight
      el("rect", { x: scanX, y: 0, width: 1.2, height: 56, fill: "rgba(196,255,0,0.45)" }),
      el("rect", { x: scanX - 16, y: 0, width: 32, height: 56, fill: "rgba(196,255,0,0.04)" }),
      // end markers
      el("circle", { cx: endX, cy: endY, r: markerR, fill: "#C4FF00" }),
      el("circle", { cx: endX, cy: endYMouth, r: markerR, fill: "#F5F5F0", opacity: 0.78 }),
      // magenta connector
      el("line", {
        x1: endX, y1: endY, x2: endX, y2: endYMouth,
        stroke: "#FF006E", strokeWidth: 1, strokeDasharray: "2 2", opacity: 0.85,
      }),
    ),
    // EDGE +0.72 label, top-left of chart band
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: 6,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "JetBrains Mono",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "3px",
          color: C.magenta,
          textTransform: "uppercase",
          opacity: labelOpacity,
        },
      },
      el("div", { style: { display: "flex" } }, "EDGE"),
      el("div", { style: { display: "flex", color: C.muted } }, "·"),
      el("div", { style: { display: "flex" } }, "+0.72"),
    ),
    // Right-side caption
    el(
      "div",
      {
        style: {
          position: "absolute",
          top: 6,
          right: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: "3px",
          color: C.muted,
          textTransform: "uppercase",
        },
      },
      el("div", { style: { display: "flex" } }, "MONEY"),
      el("div", { style: { display: "flex" } }, "VS"),
      el("div", { style: { display: "flex" } }, "MOUTH · 24H"),
    ),
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function corners() {
  const arm = 32;
  const t = 2;
  const off = 24;
  const make = (vEdge, hEdge) => [
    el("div", {
      style: {
        position: "absolute",
        [vEdge]: off,
        [hEdge]: off,
        width: arm,
        height: t,
        backgroundColor: C.lime,
        display: "flex",
      },
    }),
    el("div", {
      style: {
        position: "absolute",
        [vEdge]: off,
        [hEdge]: off,
        width: t,
        height: arm,
        backgroundColor: C.lime,
        display: "flex",
      },
    }),
  ];
  return [
    ...make("top", "left"),
    ...make("top", "right"),
    ...make("bottom", "left"),
    ...make("bottom", "right"),
  ];
}

function markSVG(size) {
  // Satori supports inline SVG fragments wrapped as an element.
  return el(
    "svg",
    { width: size, height: size, viewBox: "0 0 64 64", style: { display: "flex" } },
    el("path", {
      d: "M20 10 L50 32 L20 54",
      fill: "none",
      stroke: C.lime,
      strokeWidth: 6,
      strokeLinecap: "square",
      strokeLinejoin: "miter",
    }),
  );
}

// ---------------------------------------------------------------------------
// Render each frame: Satori → SVG → Resvg → RGBA pixels → gifenc
// ---------------------------------------------------------------------------
const gif = GIFEncoder();

console.log(`→ rendering ${FRAMES} frames @ ${1000 / DELAY_MS}fps…`);
for (let f = 0; f < FRAMES; f++) {
  const svg = await satori(buildFrame(f), { width: W, height: H, fonts });
  if (f === 0) writeFileSync(resolve(projectRoot, "scripts/_frame0.svg"), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render();
  const rgba = png.pixels; // Uint8Array length = W*H*4

  // Quantize this frame to a palette (256 colors max — brand has few enough colors that this is lossless-ish)
  const palette = quantize(rgba, 256, { format: "rgba4444" });
  const index = applyPalette(rgba, palette, "rgba4444");
  gif.writeFrame(index, W, H, { palette, delay: DELAY_MS });
  process.stdout.write(`  · frame ${String(f + 1).padStart(2, "0")}/${FRAMES}\n`);
}
gif.finish();

const out = resolve(projectRoot, "og-coming-soon.gif");
writeFileSync(out, gif.bytes());
const sizeKB = (gif.bytes().byteLength / 1024).toFixed(1);
console.log(`✓ wrote ${out} (${sizeKB} KB, ${FRAMES} frames, ${(FRAMES * DELAY_MS) / 1000}s loop)`);
