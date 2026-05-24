// Edge function that returns a 1200x630 PNG og-image.
// Renders on the fly with @vercel/og (satori under the hood).
// Used by Open Graph meta tags so iMessage / Twitter / Discord / Slack / Linear / etc
// all show a beautiful preview when the URL is shared.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// JSX-free element factory so we don't need a build step
const h = (type, props, ...children) => ({
  type,
  props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  key: null,
});

const C = {
  ink: "#0A0A0B",
  ink2: "#14141A",
  ink3: "#1F1F26",
  paper: "#F1EFEA",
  paperMute: "#7C7C82",
  paperDeep: "#4A4A52",
  money: "#E5B83D",
  moneyBright: "#FFC940",
  edge: "#FF3E5C",
  green: "#2EBD7A",
  // direction palette dots
  og: "#C4FF00",
  a: "#E5B83D",
  b: "#8B6BFF",
  c: "#00FFC8",
  d: "#FF6B1A",
};

async function loadFont(weight) {
  // Fraunces variable, picked weight 500 / 700 to keep file size small
  const url =
    weight >= 600
      ? "https://fonts.gstatic.com/s/fraunces/v32/6NUu8FaJWzu1Yb4eY7cKLR5d7C-bLuk5cssWcQ.woff2"
      : "https://fonts.gstatic.com/s/fraunces/v32/6NUu8FaJWzu1Yb4eY7cKLR5d7C-bLuk5GcsWcQ.woff2";
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadMono() {
  try {
    const res = await fetch(
      "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKw.woff2",
      { cache: "force-cache" },
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function handler() {
  const [serif, serifBold, mono] = await Promise.all([
    loadFont(400),
    loadFont(700),
    loadMono(),
  ]);

  const swatch = (label, color) =>
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "12px" } },
      h("div", {
        style: {
          width: "46px",
          height: "46px",
          backgroundColor: color,
        },
      }),
      h(
        "div",
        {
          style: {
            fontFamily: "Mono",
            fontSize: "16px",
            color: C.paperMute,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          },
        },
        label,
      ),
    );

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: C.ink,
          backgroundImage: `radial-gradient(ellipse 60% 50% at 50% -10%, ${C.ink3} 0%, ${C.ink} 60%)`,
          padding: "60px 64px",
          color: C.paper,
          fontFamily: "Serif",
          position: "relative",
        },
      },

      // subtle hairline grid overlay (top-left accent line)
      h("div", {
        style: {
          position: "absolute",
          top: "0",
          left: "60px",
          width: "84px",
          height: "1px",
          backgroundColor: C.money,
        },
      }),

      // top kicker row
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontFamily: "Mono",
            fontSize: "18px",
            letterSpacing: "0.22em",
            color: C.paperMute,
            textTransform: "uppercase",
          },
        },
        h("div", {
          style: {
            width: "10px",
            height: "10px",
            borderRadius: "999px",
            backgroundColor: C.money,
          },
        }),
        h("div", {}, "Edge Terminal · Internal review"),
      ),

      // big headline
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginTop: "48px",
          },
        },
        // $EDGE
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "baseline",
              gap: "2px",
              fontSize: "120px",
              fontFamily: "SerifBold",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
            },
          },
          h(
            "div",
            {
              style: {
                color: C.money,
                fontStyle: "italic",
                fontFamily: "Serif",
                fontWeight: 400,
                marginRight: "-6px",
              },
            },
            "$",
          ),
          h("div", { style: { color: C.paper } }, "EDGE"),
        ),

        // tagline
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              fontSize: "72px",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              marginTop: "16px",
              lineHeight: 1,
            },
          },
          h("div", { style: { color: C.paper } }, "Five"),
          h(
            "div",
            {
              style: {
                fontStyle: "italic",
                color: C.money,
                fontFamily: "Serif",
                fontWeight: 400,
              },
            },
            "brand directions.",
          ),
        ),

        h(
          "div",
          {
            style: {
              fontFamily: "Mono",
              fontSize: "22px",
              letterSpacing: "0.1em",
              color: C.paperMute,
              textTransform: "uppercase",
              marginTop: "18px",
            },
          },
          "One winner ships ·  Money meets mouth ·  Token-gated",
        ),
      ),

      // 5 color swatches row
      h(
        "div",
        {
          style: {
            display: "flex",
            gap: "26px",
            marginTop: "auto",
            paddingTop: "32px",
            borderTop: `1px solid ${C.ink3}`,
            alignItems: "center",
          },
        },
        swatch("OG", C.og),
        swatch("A · Onyx", C.a),
        swatch("B · Glass", C.b),
        swatch("C · Tape", C.c),
        swatch("D · Flare", C.d),
      ),

      // bottom URL strip
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "28px",
            fontFamily: "Mono",
            fontSize: "20px",
            letterSpacing: "0.06em",
            color: C.paperMute,
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px" } },
          h("div", {
            style: {
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              backgroundColor: C.green,
            },
          }),
          h(
            "div",
            { style: { color: C.paper } },
            "edge-two-psi.vercel.app/options",
          ),
        ),
        h(
          "div",
          { style: { textTransform: "uppercase", letterSpacing: "0.18em" } },
          "Polymarket + Kalshi · Solana",
        ),
      ),
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        serif && {
          name: "Serif",
          data: serif,
          style: "normal",
          weight: 400,
        },
        serifBold && {
          name: "SerifBold",
          data: serifBold,
          style: "normal",
          weight: 700,
        },
        mono && {
          name: "Mono",
          data: mono,
          style: "normal",
          weight: 400,
        },
      ].filter(Boolean),
      headers: {
        "Cache-Control":
          "public, immutable, no-transform, max-age=3600, s-maxage=86400",
      },
    },
  );
}
