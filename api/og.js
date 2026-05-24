// Edge function that returns a 1200x630 PNG og-image.
// Used by Open Graph meta tags so iMessage / Twitter / Discord / Slack
// all show a beautiful preview when the URL is shared.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// JSX-free helper: builds a React-element-shaped object that satori accepts
const e = (type, props, ...children) => ({
  type,
  props: {
    ...(props || {}),
    children: children.length <= 1 ? children[0] : children,
  },
  key: null,
});

export default async function handler() {
  const C = {
    ink: "#0A0A0B",
    paper: "#F1EFEA",
    mute: "#7C7C82",
    money: "#E5B83D",
    green: "#2EBD7A",
    og: "#C4FF00",
    a: "#E5B83D",
    b: "#8B6BFF",
    c: "#00FFC8",
    d: "#FF6B1A",
  };

  const swatch = (label, color) =>
    e(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px" } },
      e("div", {
        style: { width: "40px", height: "40px", backgroundColor: color },
      }),
      e(
        "div",
        {
          style: {
            fontSize: "14px",
            color: C.mute,
            letterSpacing: "3px",
            textTransform: "uppercase",
          },
        },
        label,
      ),
    );

  const root = e(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.ink,
        color: C.paper,
        padding: "60px",
        fontFamily: "sans-serif",
      },
    },
    // kicker
    e(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "16px",
          letterSpacing: "4px",
          color: C.mute,
          textTransform: "uppercase",
        },
      },
      e("div", {
        style: {
          width: "10px",
          height: "10px",
          borderRadius: "999px",
          backgroundColor: C.money,
        },
      }),
      e("div", {}, "Edge Terminal · Internal review"),
    ),
    // $EDGE wordmark
    e(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          fontSize: "140px",
          fontWeight: 800,
          letterSpacing: "-6px",
          lineHeight: 1,
          marginTop: "44px",
        },
      },
      e("div", { style: { color: C.money } }, "$"),
      e("div", { style: { color: C.paper } }, "EDGE"),
    ),
    // tagline
    e(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          fontSize: "72px",
          fontWeight: 500,
          letterSpacing: "-2px",
          marginTop: "12px",
          lineHeight: 1,
        },
      },
      e("div", { style: { color: C.paper, marginRight: "16px" } }, "Five"),
      e(
        "div",
        { style: { color: C.money, fontStyle: "italic" } },
        "brand directions.",
      ),
    ),
    e(
      "div",
      {
        style: {
          fontSize: "22px",
          color: C.mute,
          letterSpacing: "4px",
          textTransform: "uppercase",
          marginTop: "16px",
        },
      },
      "One winner ships · Money meets mouth · Token-gated",
    ),
    // 5 swatches
    e(
      "div",
      {
        style: {
          display: "flex",
          gap: "30px",
          marginTop: "auto",
          paddingTop: "32px",
          borderTop: `1px solid #1F1F26`,
        },
      },
      swatch("OG", C.og),
      swatch("A · Onyx", C.a),
      swatch("B · Glass", C.b),
      swatch("C · Tape", C.c),
      swatch("D · Flare", C.d),
    ),
    // bottom strip
    e(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "24px",
          fontSize: "18px",
          letterSpacing: "1px",
          color: C.mute,
        },
      },
      e(
        "div",
        {
          style: { display: "flex", alignItems: "center", gap: "10px" },
        },
        e("div", {
          style: {
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            backgroundColor: C.green,
          },
        }),
        e(
          "div",
          { style: { color: C.paper } },
          "edge-two-psi.vercel.app/options",
        ),
      ),
      e(
        "div",
        { style: { textTransform: "uppercase", letterSpacing: "4px" } },
        "Polymarket + Kalshi · Solana",
      ),
    ),
  );

  return new ImageResponse(root, {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control":
        "public, immutable, no-transform, max-age=3600, s-maxage=86400",
    },
  });
}
