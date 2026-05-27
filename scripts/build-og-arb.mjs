// Build og-arb.png locally via Satori + Resvg.
// Edge runtime (@vercel/og + WASM resvg) returns 0 bytes for this card,
// so we render once locally and ship as a static PNG. Same pattern as
// the animated GIF in build-og-gif.mjs.

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(__filename), "..");

async function getFont(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await fetch(cssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120 Safari/537.36" },
  }).then((r) => r.text());
  const m = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  return Buffer.from(await fetch(m[1]).then((r) => r.arrayBuffer()));
}

const C = {
  void: "#050507", void2: "#0C0C10", void3: "#141418",
  lime: "#C4FF00", magenta: "#FF006E", green: "#00FF85",
  white: "#F5F5F0", muted: "#6B6B73",
  border: "rgba(245,245,240,0.12)", borderBright: "rgba(196,255,0,0.28)",
  borderGreen: "rgba(0,255,133,0.32)",
};

const el = (type, props, ...children) => ({
  type,
  props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  key: null,
});

const Mark = (size = 32) => el("svg",
  { width: size, height: size, viewBox: "0 0 64 64", style: { display: "flex" } },
  el("path", { d: "M20 10 L50 32 L20 54", fill: "none", stroke: C.lime, strokeWidth: 6, strokeLinecap: "square", strokeLinejoin: "miter" })
);

const BgGrid = () => el("div", {
  style: {
    position: "absolute", inset: 0, display: "flex",
    backgroundImage: "linear-gradient(rgba(0,255,133,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,133,0.045) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
  },
});

const CornerBrackets = () => {
  const arm = 36, t = 2, off = 24;
  const make = (corner) => {
    const styles = { tl:{top:off,left:off}, tr:{top:off,right:off}, bl:{bottom:off,left:off}, br:{bottom:off,right:off} }[corner];
    return el("div", { style: { position: "absolute", width: arm, height: arm, display: "flex", ...styles } },
      el("div", { style: { position: "absolute", width: arm, height: t, backgroundColor: C.green, [corner.includes("t")?"top":"bottom"]: 0, [corner.includes("l")?"left":"right"]: 0 } }),
      el("div", { style: { position: "absolute", width: t, height: arm, backgroundColor: C.green, [corner.includes("t")?"top":"bottom"]: 0, [corner.includes("l")?"left":"right"]: 0 } }),
    );
  };
  return el("div", { style: { position: "absolute", inset: 0, display: "flex" } }, make("tl"), make("tr"), make("bl"), make("br"));
};

const TopBar = (rightText) => el("div", {
  style: { display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, paddingLeft: 48, paddingRight: 48, borderBottom: `1px solid ${C.borderGreen}` },
},
  el("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
    Mark(28),
    el("div", { style: { display: "flex", fontFamily: "Anton", fontSize: 30, letterSpacing: "-1px" } },
      el("div", { style: { color: C.lime, display: "flex" } }, "$"),
      el("div", { style: { color: C.white, display: "flex" } }, "EDGE"),
    ),
  ),
  el("div", {
    style: { display: "flex", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5, border: `1px solid ${C.borderGreen}`, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 12, letterSpacing: "4px", color: C.green, textTransform: "uppercase" },
  },
    el("div", { style: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.green, display: "flex" } }),
    el("div", { style: { display: "flex" } }, rightText),
  ),
);

function ArbCard() {
  return el("div", {
    style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: C.void, color: C.white, position: "relative" },
  },
    BgGrid(), CornerBrackets(),
    TopBar("ARB · v0 · LIVE"),
    el("div", {
      style: { display: "flex", flexDirection: "column", padding: "44px 56px 32px 56px", flex: 1, position: "relative" },
    },
      // Eyebrow
      el("div", {
        style: { display: "flex", alignItems: "center", gap: 12, fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 22, letterSpacing: "6px", color: C.green, textTransform: "uppercase" },
      },
        el("div", { style: { width: 10, height: 10, borderRadius: 999, backgroundColor: C.green, display: "flex" } }),
        el("div", { style: { display: "flex" } }, "CROSS-PLATFORM · POLY ↔ KAL"),
      ),
      // Headline line 1
      el("div", {
        style: { display: "flex", fontFamily: "Anton", fontSize: 124, lineHeight: 0.92, letterSpacing: "-4px", marginTop: 22 },
      },
        el("div", { style: { color: C.white, display: "flex" } }, "ARBITRAGE"),
      ),
      // Headline line 2
      el("div", {
        style: { display: "flex", fontFamily: "Anton", fontSize: 124, lineHeight: 0.92, letterSpacing: "-4px" },
      },
        el("div", { style: { color: C.green, display: "flex" } }, "RADAR."),
      ),
      // Tagline
      el("div", {
        style: { display: "flex", fontFamily: "DM Sans", fontWeight: 400, fontSize: 28, lineHeight: 1.3, color: C.white, opacity: 0.85, marginTop: 22 },
      }, "Same event. Different prices. The edge is in the spread."),
      // Chart card
      el("div", {
        style: { display: "flex", marginTop: 24, border: `1px solid ${C.borderGreen}`, background: C.void2, padding: 16, flexDirection: "column", gap: 10 },
      },
        el("div", {
          style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 13, letterSpacing: "3px", color: C.muted, textTransform: "uppercase" },
        },
          el("div", { style: { display: "flex", gap: 14 } },
            el("div", { style: { display: "flex", color: C.lime, fontWeight: 700 } }, "POLY 0.62"),
            el("div", { style: { display: "flex" } }, "·"),
            el("div", { style: { display: "flex", color: C.magenta, fontWeight: 700 } }, "KAL 0.58"),
          ),
          el("div", { style: { display: "flex", color: C.green, fontWeight: 700 } }, "EDGE +4.2pp · HIGH"),
        ),
        el("svg", { width: 1088, height: 56, viewBox: "0 0 1088 56", style: { display: "flex" } },
          el("path", { d: "M 0 14 L 90 20 L 180 16 L 270 24 L 360 20 L 450 28 L 540 24 L 630 30 L 720 26 L 810 32 L 900 28 L 990 34 L 1088 30 L 1088 46 L 990 42 L 900 38 L 810 42 L 720 36 L 630 40 L 540 34 L 450 38 L 360 32 L 270 36 L 180 30 L 90 34 L 0 32 Z", fill: "rgba(0,255,133,0.20)" }),
          el("path", { d: "M 0 14 L 90 20 L 180 16 L 270 24 L 360 20 L 450 28 L 540 24 L 630 30 L 720 26 L 810 32 L 900 28 L 990 34 L 1088 30", fill: "none", stroke: C.lime, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }),
          el("path", { d: "M 0 32 L 90 34 L 180 30 L 270 36 L 360 32 L 450 38 L 540 34 L 630 40 L 720 36 L 810 42 L 900 38 L 990 42 L 1088 46", fill: "none", stroke: C.magenta, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", opacity: 0.9 }),
        ),
      ),
      // Bottom row: stats + CTA
      el("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 18, fontFamily: "JetBrains Mono", fontWeight: 500, fontSize: 16, letterSpacing: "5px", textTransform: "uppercase" },
      },
        el("div", { style: { display: "flex", gap: 24, color: C.muted } },
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.white, marginRight: 8, fontWeight: 700 } }, "1,420"),
            el("div", { style: { display: "flex" } }, "SCANNED"),
          ),
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.green, marginRight: 8, fontWeight: 700 } }, "14"),
            el("div", { style: { display: "flex" } }, "LIVE OPPS"),
          ),
          el("div", { style: { display: "flex" } },
            el("div", { style: { display: "flex", color: C.green, marginRight: 8, fontWeight: 700 } }, "+4.2pp"),
            el("div", { style: { display: "flex" } }, "BIGGEST"),
          ),
        ),
        el("div", { style: { display: "flex", color: C.green, fontWeight: 700 } }, "EDGETERMINAL.XYZ/ARB →"),
      ),
    ),
  );
}

console.log("→ fetching fonts…");
const [anton, dmSans, mono, monoBold] = await Promise.all([
  getFont("Anton", 400),
  getFont("DM Sans", 400),
  getFont("JetBrains Mono", 500),
  getFont("JetBrains Mono", 700),
]);
const fonts = [
  { name: "Anton", data: anton, weight: 400, style: "normal" },
  { name: "DM Sans", data: dmSans, weight: 400, style: "normal" },
  { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
  { name: "JetBrains Mono", data: monoBold, weight: 700, style: "normal" },
];

console.log("→ rendering ARB OG card via Satori + Resvg…");
const svg = await satori(ArbCard(), { width: 1200, height: 630, fonts });
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render();
const out = resolve(projectRoot, "og-arb.png");
writeFileSync(out, png.asPng());
const sizeKB = (png.asPng().byteLength / 1024).toFixed(1);
console.log(`✓ wrote ${out} (${sizeKB} KB)`);
