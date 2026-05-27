// Edge function that returns 1200x630 PNGs for OG / Twitter card / iMessage previews.
//
// Surfaces (?surface=…):
//   coming-soon  (default)  — the pre-launch waitlist hero
//   launch                  — "$EDGE IS LIVE" post-launch card
//   token                   — tokenomics snapshot
//   press                   — press / partnerships contact card
//
// Cached at the edge for 24h once warm. First render after deploy is a cold
// fetch of Anton + JetBrains Mono from Google Fonts (~200ms). Subsequent
// shares are instant.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const C = {
  void: "#050507",
  void2: "#0C0C10",
  void3: "#141418",
  lime: "#C4FF00",
  magenta: "#FF006E",
  white: "#F5F5F0",
  muted: "#6B6B73",
  border: "rgba(245,245,240,0.12)",
  borderBright: "rgba(196,255,0,0.28)",
};

// JSX-free helper — Satori accepts these element-shaped objects.
const el = (type, props, ...children) => ({
  type,
  props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  key: null,
});

// --- Font loader ------------------------------------------------------------
// Pulls the actual font binary from Google Fonts so the OG image renders in
// the real brand typefaces. Caches across invocations by holding promises at
// module scope.
let fontsPromise = null;
async function loadFonts() {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    async function getFont(family, weight) {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
      const css = await fetch(cssUrl, {
        // Google serves a different file based on UA — pick a static modern Chrome string.
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36" },
      }).then((r) => r.text());
      const match = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
      if (!match) throw new Error(`Font URL not found for ${family} ${weight}`);
      return fetch(match[1]).then((r) => r.arrayBuffer());
    }
    const [anton, dmSans, dmSansBold, mono, monoBold] = await Promise.all([
      getFont("Anton", 400),
      getFont("DM Sans", 400),
      getFont("DM Sans", 700),
      getFont("JetBrains Mono", 500),
      getFont("JetBrains Mono", 700),
    ]);
    return [
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "DM Sans", data: dmSans, weight: 400, style: "normal" },
      { name: "DM Sans", data: dmSansBold, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
      { name: "JetBrains Mono", data: monoBold, weight: 700, style: "normal" },
    ];
  })();
  return fontsPromise;
}

// --- Lime chevron mark, inline SVG -------------------------------------------
const Mark = (size = 32) =>
  el(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 64 64",
      style: { display: "flex" },
    },
    el("path", {
      d: "M20 10 L50 32 L20 54",
      fill: "none",
      stroke: C.lime,
      strokeWidth: 6,
      strokeLinecap: "square",
      strokeLinejoin: "miter",
    }),
  );

// Tiny shared atoms ----------------------------------------------------------
const Eyebrow = (text, color = C.lime) =>
  el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontFamily: "JetBrains Mono",
        fontWeight: 500,
        fontSize: 22,
        letterSpacing: "6px",
        color,
        textTransform: "uppercase",
      },
    },
    el("div", {
      style: { width: 10, height: 10, borderRadius: 999, backgroundColor: color },
    }),
    el("div", { style: { display: "flex" } }, text),
  );

const Hairline = () =>
  el("div", {
    style: {
      display: "flex",
      width: "100%",
      height: 1,
      backgroundColor: C.border,
      marginTop: 32,
      marginBottom: 24,
    },
  });

// --- Top bar (shared) -------------------------------------------------------
const TopBar = (rightText) =>
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
      },
    },
    el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 14 } },
      Mark(28),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 30,
            letterSpacing: "-1px",
            color: C.white,
          },
        },
        el("div", { style: { color: C.lime, display: "flex" } }, "$"),
        el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
      ),
    ),
    el(
      "div",
      {
        style: {
          fontFamily: "JetBrains Mono",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "5px",
          color: C.muted,
          textTransform: "uppercase",
        },
      },
      rightText,
    ),
  );

// --- Background grid + corner brackets atmosphere --------------------------
const BgGrid = () =>
  el(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        backgroundImage:
          "linear-gradient(rgba(196,255,0,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(196,255,0,0.045) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      },
    },
  );

const CornerBrackets = () => {
  const arm = 36;
  const t = 2;
  const off = 24;
  const make = (corner) => {
    const styles = {
      tl: { top: off, left: off },
      tr: { top: off, right: off },
      bl: { bottom: off, left: off },
      br: { bottom: off, right: off },
    }[corner];
    return el(
      "div",
      {
        style: {
          position: "absolute",
          width: arm,
          height: arm,
          display: "flex",
          ...styles,
        },
      },
      el("div", {
        style: {
          position: "absolute",
          width: arm,
          height: t,
          backgroundColor: C.lime,
          [corner.includes("t") ? "top" : "bottom"]: 0,
          [corner.includes("l") ? "left" : "right"]: 0,
        },
      }),
      el("div", {
        style: {
          position: "absolute",
          width: t,
          height: arm,
          backgroundColor: C.lime,
          [corner.includes("t") ? "top" : "bottom"]: 0,
          [corner.includes("l") ? "left" : "right"]: 0,
        },
      }),
    );
  };
  return el(
    "div",
    { style: { position: "absolute", inset: 0, display: "flex" } },
    make("tl"),
    make("tr"),
    make("bl"),
    make("br"),
  );
};

// --- Coming-soon card -------------------------------------------------------
function ComingSoonCard() {
  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.void,
        color: C.white,
        position: "relative",
      },
    },
    BgGrid(),
    CornerBrackets(),
    TopBar("PRE-LAUNCH · v1"),
    // Body
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "44px 56px 36px 56px",
          flex: 1,
          position: "relative",
        },
      },
      Eyebrow("T-MINUS 14 DAYS · FAIRLAUNCH JUN 09 · 13:00 UTC"),
      // Headline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 188,
            lineHeight: 0.92,
            letterSpacing: "-6px",
            marginTop: 28,
          },
        },
        el("div", { style: { color: C.lime, display: "flex" } }, "$"),
        el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
        el(
          "div",
          {
            style: {
              color: C.muted,
              display: "flex",
              marginLeft: 22,
              marginRight: 22,
            },
          },
          "/",
        ),
        el("div", { style: { color: C.white, display: "flex" } }, "DROPS"),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 160,
            lineHeight: 0.92,
            letterSpacing: "-5px",
            marginTop: 6,
          },
        },
        el("div", { style: { color: C.white, display: "flex" } }, "JUN "),
        el("div", { style: { color: C.lime, display: "flex" } }, "09"),
        el("div", { style: { color: C.muted, display: "flex" } }, "."),
      ),
      // Tagline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "DM Sans",
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.3,
            color: C.white,
            opacity: 0.78,
            marginTop: 28,
          },
        },
        "Watch the action. Before you bet.",
      ),
      Hairline(),
      // Bottom row
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: "5px",
            textTransform: "uppercase",
          },
        },
        el(
          "div",
          { style: { display: "flex", gap: 18, color: C.muted } },
          el("div", { style: { display: "flex", color: C.lime } }, "MONEY"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex", color: C.white } }, "MOUTH"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex", color: C.lime } }, "EDGE"),
        ),
        el(
          "div",
          { style: { display: "flex", color: C.muted, gap: 14 } },
          el("div", { style: { display: "flex", color: C.white } }, "PUMP.FUN"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex" } }, "NO PRESALE"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex", color: C.lime } }, "JOIN WAITLIST →"),
        ),
      ),
    ),
  );
}

// --- Launch (LIVE) card -----------------------------------------------------
function LaunchCard() {
  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.void,
        color: C.white,
        position: "relative",
      },
    },
    BgGrid(),
    CornerBrackets(),
    TopBar("LIVE NOW · PUMP.FUN"),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "44px 56px 36px 56px",
          flex: 1,
        },
      },
      Eyebrow("LIVE NOW · CONTRACT VERIFIED · LP LOCKED 12MO", C.lime),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 220,
            lineHeight: 0.9,
            letterSpacing: "-7px",
            marginTop: 28,
          },
        },
        el("div", { style: { color: C.lime, display: "flex" } }, "$"),
        el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 140,
            letterSpacing: "-4px",
            marginTop: 4,
          },
        },
        el("div", { style: { color: C.white, display: "flex" } }, "IS "),
        el("div", { style: { color: C.lime, display: "flex" } }, "LIVE."),
      ),
      Hairline(),
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: "5px",
          },
        },
        el(
          "div",
          { style: { display: "flex", gap: 14, color: C.muted } },
          el("div", { style: { display: "flex", color: C.white } }, "BUY"),
          el("div", { style: { display: "flex", color: C.lime } }, "→ PUMP.FUN"),
        ),
        el(
          "div",
          { style: { display: "flex", color: C.muted } },
          "MONEY · MOUTH · EDGE",
        ),
      ),
    ),
  );
}

// --- Edge (Divergence Radar promo) card -------------------------------------
function EdgeCard() {
  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.void,
        color: C.white,
        position: "relative",
      },
    },
    BgGrid(),
    CornerBrackets(),
    TopBar("LIVE PICKER · v0"),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "44px 56px 36px 56px",
          flex: 1,
        },
      },
      Eyebrow("MONEY MEETS MOUTH · WHERE THEY DISAGREE", C.magenta),
      // Headline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 168,
            lineHeight: 0.9,
            letterSpacing: "-5px",
            marginTop: 28,
          },
        },
        el("div", { style: { color: C.white, display: "flex" } }, "DIVERGENCE"),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 168,
            lineHeight: 0.9,
            letterSpacing: "-5px",
            marginTop: 4,
          },
        },
        el("div", { style: { color: C.lime, display: "flex" } }, "RADAR"),
        el("div", { style: { color: C.muted, display: "flex", marginLeft: 22 } }, "."),
      ),
      // Tagline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "DM Sans",
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.35,
            color: C.white,
            opacity: 0.78,
            marginTop: 26,
            maxWidth: 940,
          },
        },
        "Live picker. Every Polymarket + Kalshi market scored on money vs mouth. When they disagree, the call surfaces.",
      ),
      Hairline(),
      // Bottom row — three pillars
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: "5px",
            textTransform: "uppercase",
          },
        },
        el(
          "div",
          { style: { display: "flex", gap: 20, color: C.muted } },
          el("div", { style: { display: "flex", color: C.lime } }, "MONEY"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex", color: C.magenta } }, "MOUTH"),
          el("div", { style: { display: "flex" } }, "·"),
          el("div", { style: { display: "flex", color: C.lime } }, "EDGE"),
        ),
        el(
          "div",
          { style: { display: "flex", color: C.muted, gap: 14 } },
          el("div", { style: { display: "flex", color: C.white } }, "edge.html"),
          el("div", { style: { display: "flex", color: C.lime } }, " →"),
        ),
      ),
    ),
  );
}

// --- ARB (Arbitrage Radar promo) card ---------------------------------------
function ArbCard() {
  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.void,
        color: C.white,
        position: "relative",
      },
    },
    BgGrid(),
    CornerBrackets(),
    TopBar("ARB · v0 · LIVE"),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "44px 56px 32px 56px",
          flex: 1,
          position: "relative",
        },
      },
      // Eyebrow w/ green dot (arb = green territory)
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: "6px",
            color: C.green,
            textTransform: "uppercase",
          },
        },
        el("div", {
          style: { width: 10, height: 10, borderRadius: 999, backgroundColor: C.green },
        }),
        el("div", { style: { display: "flex" } }, "CROSS-PLATFORM · POLY ↔ KAL"),
      ),
      // Headline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 124,
            lineHeight: 0.92,
            letterSpacing: "-4px",
            marginTop: 24,
          },
        },
        el("div", { style: { color: C.white, display: "flex" } }, "ARBITRAGE"),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Anton",
            fontSize: 124,
            lineHeight: 0.92,
            letterSpacing: "-4px",
            marginTop: 0,
          },
        },
        el("div", { style: { color: C.green, display: "flex" } }, "RADAR."),
      ),
      // Tagline
      el(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "DM Sans",
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.3,
            color: C.white,
            opacity: 0.85,
            marginTop: 22,
          },
        },
        "Same event. Different prices. The edge is in the spread.",
      ),
      // Mini chart band — two-curve divergence (lime vs magenta) with green shaded spread
      el(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 24,
            border: `1px solid ${C.border}`,
            background: C.void2,
            padding: 16,
            flexDirection: "column",
            gap: 10,
          },
        },
        el(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "JetBrains Mono",
              fontWeight: 500,
              fontSize: 12,
              letterSpacing: "3px",
              color: C.muted,
              textTransform: "uppercase",
            },
          },
          el(
            "div",
            { style: { display: "flex", gap: 14 } },
            el("div", { style: { display: "flex", color: C.lime } }, "POLY 0.62"),
            el("div", { style: { display: "flex" } }, "·"),
            el("div", { style: { display: "flex", color: C.magenta } }, "KAL 0.58"),
          ),
          el("div", { style: { display: "flex", color: C.green, fontWeight: 700 } }, "EDGE +4.2pp · HIGH"),
        ),
        el(
          "svg",
          { width: 1088, height: 48, viewBox: "0 0 1088 48", style: { display: "flex" } },
          // shaded spread between the two curves (green)
          el("path", {
            d: "M 0 12 L 90 18 L 180 14 L 270 22 L 360 18 L 450 26 L 540 22 L 630 28 L 720 24 L 810 30 L 900 26 L 990 32 L 1088 28 L 1088 40 L 990 38 L 900 34 L 810 38 L 720 32 L 630 36 L 540 30 L 450 34 L 360 28 L 270 32 L 180 26 L 90 30 L 0 28 Z",
            fill: "rgba(0,255,133,0.18)",
            stroke: "none",
          }),
          // POLY line (lime)
          el("path", {
            d: "M 0 12 L 90 18 L 180 14 L 270 22 L 360 18 L 450 26 L 540 22 L 630 28 L 720 24 L 810 30 L 900 26 L 990 32 L 1088 28",
            fill: "none", stroke: C.lime, strokeWidth: 2,
            strokeLinecap: "round", strokeLinejoin: "round",
          }),
          // KAL line (magenta)
          el("path", {
            d: "M 0 28 L 90 30 L 180 26 L 270 32 L 360 28 L 450 34 L 540 30 L 630 36 L 720 32 L 810 38 L 900 34 L 990 38 L 1088 40",
            fill: "none", stroke: C.magenta, strokeWidth: 1.8,
            strokeLinecap: "round", strokeLinejoin: "round", opacity: 0.85,
          }),
        ),
      ),
      // Bottom row — stats + CTA
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 18,
            fontFamily: "JetBrains Mono",
            fontWeight: 500,
            fontSize: 16,
            letterSpacing: "5px",
            textTransform: "uppercase",
          },
        },
        el(
          "div",
          { style: { display: "flex", gap: 22, color: C.muted } },
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.white, marginRight: 6 } }, "1,420"),
            el("div", { style: { display: "flex" } }, "SCANNED"),
          ),
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.green, marginRight: 6 } }, "14"),
            el("div", { style: { display: "flex" } }, "LIVE OPPS"),
          ),
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.green, marginRight: 6 } }, "+4.2pp"),
            el("div", { style: { display: "flex" } }, "BIGGEST"),
          ),
        ),
        el(
          "div",
          { style: { display: "flex", color: C.green } },
          "EDGETERMINAL.XYZ/ARB →",
        ),
      ),
    ),
  );
}

// Map of surfaces → renderers ------------------------------------------------
const cards = {
  "coming-soon": ComingSoonCard,
  launch: LaunchCard,
  edge: EdgeCard,
  arb: ArbCard,
};

export default async function handler(req) {
  const url = new URL(req.url);
  const surface = (url.searchParams.get("surface") || "coming-soon").toLowerCase();
  const render = cards[surface] || cards["coming-soon"];

  const fonts = await loadFonts();

  return new ImageResponse(render(), {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      "Cache-Control":
        "public, immutable, no-transform, max-age=3600, s-maxage=86400",
    },
  });
}
