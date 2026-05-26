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
// canvas after windowing. Each frame slices a 120-char window starting at
// progressively later positions (and wraps via doubled string).
const TICKER_SRC =
  "TRUMP-2028 0.42→0.51 +21.4% · FED-PIVOT 0.18→0.14 -22.2% · CPI-JUN 0.62→0.71 +14.5% · BTC-200K 0.31→0.36 +16.1% · ETH-FLIP 0.07→0.04 -42.8% · NVDA-Q3 0.55→0.61 +10.9% · ";
const TICKER_WINDOW = 96;
function tickerSlice(f) {
  const src = TICKER_SRC + TICKER_SRC; // doubled so the wrap is seamless
  const start = (f * 4) % TICKER_SRC.length; // 4 chars per frame
  return src.slice(start, start + TICKER_WINDOW);
}

// Lerp helper
const lerp = (a, b, t) => a + (b - a) * t;

// Easing
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
          height: 38,
          backgroundColor: C.void2,
          borderTop: `1px solid ${C.borderBright}`,
          paddingLeft: 24,
          paddingRight: 24,
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
          fontSize: 14,
          letterSpacing: "2px",
          color: C.muted,
          overflow: "hidden",
          whiteSpace: "nowrap",
        },
      },
      tape,
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
