import { kvEnabled, kvCmd, kvPipe } from "../store/kv.js";

// HALL OF FAME — the persistent, ever-growing roster of profitable Polymarket
// wallets. Polymarket's leaderboard only exposes the top 50 per window, but
// those windows ROTATE: harvest them on a schedule and the union accumulates
// far past 50 over days/weeks. We store that union in Vercel KV:
//   • sorted set  hof:pnl:all   — member=wallet, score=best-known PnL (ranking)
//   • hash        hof:meta:<w>  — name, image, pnl, win, firstSeen, lastSeen
// Without KV connected, readHallOfFame() returns the live top-50 so the page
// still works — it just can't grow or remember until the store is wired.
const LB = "https://lb-api.polymarket.com";
const H = { headers: { "User-Agent": "edge-aggregator/1.0", Accept: "application/json" } };
const Z_ALL = "hof:pnl:all";
const LASTH = "hof:lastharvest";
const META = (w) => `hof:meta:${w}`;
const lc = (s) => (s || "").toLowerCase();

async function profit(window) {
  try {
    const r = await fetch(`${LB}/profit?window=${window}&limit=50`, H);
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

// Fold the 4 profit boards into a best-known-PnL map. The all-time number wins
// when a wallet has one; otherwise the largest short-window PnL stands in.
async function boardsBest() {
  const [w1, w7, w30, wall] = await Promise.all(["1d", "7d", "30d", "all"].map(profit));
  const best = new Map();
  const add = (arr, win) =>
    arr.forEach((x, i) => {
      const w = lc(x.proxyWallet);
      if (!w) return;
      const pnl = Number(x.amount) || 0;
      const cur = best.get(w);
      const better = !cur || win === "all" || (cur.win !== "all" && pnl > cur.pnl);
      if (better)
        best.set(w, {
          pnl,
          win,
          name: x.name || x.pseudonym || "",
          image: x.profileImageOptimized || x.profileImage || "",
        });
    });
  add(w1, "1d");
  add(w7, "7d");
  add(w30, "30d");
  add(wall, "all"); // added last so all-time wins ties
  return { best, allTime: wall };
}

// Upsert every currently-ranked wallet into the persistent roster. No-op
// without KV. Returns a small summary for observability.
export async function harvestBoards() {
  const { best } = await boardsBest();
  if (!kvEnabled) return { enabled: false, scanned: best.size, stored: 0 };
  const now = Date.now();
  const cmds = [];
  for (const [w, m] of best) {
    cmds.push(["ZADD", Z_ALL, String(Math.round(m.pnl)), w]);
    cmds.push(["HSET", META(w), "name", m.name, "image", m.image, "pnl", String(Math.round(m.pnl)), "win", m.win, "lastSeen", String(now)]);
    cmds.push(["HSETNX", META(w), "firstSeen", String(now)]);
  }
  await kvPipe(cmds);
  await kvCmd(["SET", LASTH, String(now)]);
  const total = Number(await kvCmd(["ZCARD", Z_ALL])) || 0;
  return { enabled: true, scanned: best.size, stored: best.size, total_tracked: total };
}

export async function lastHarvestMs() {
  if (!kvEnabled) return 0;
  return Number(await kvCmd(["GET", LASTH])) || 0;
}

// Read the ranked Hall of Fame. KV → full accumulated roster (can exceed 50).
// No KV → live top-50 fallback.
export async function readHallOfFame(limit = 200) {
  if (!kvEnabled) {
    const { allTime } = await boardsBest();
    const wallets = allTime.map((x, i) => ({
      rank: i + 1,
      wallet: lc(x.proxyWallet),
      name: x.name || x.pseudonym || null,
      image: x.profileImageOptimized || x.profileImage || null,
      pnl_usd: Number(x.amount) || 0,
      first_seen: null,
    }));
    return { persistent: false, total_tracked: wallets.length, wallets };
  }
  const total = Number(await kvCmd(["ZCARD", Z_ALL])) || 0;
  const flat = (await kvCmd(["ZREVRANGE", Z_ALL, "0", String(limit - 1), "WITHSCORES"])) || [];
  const wallets = [];
  for (let i = 0; i < flat.length; i += 2) wallets.push({ wallet: flat[i], pnl_usd: Number(flat[i + 1]) || 0 });
  const metas = await kvPipe(wallets.map((w) => ["HGETALL", META(w.wallet)]));
  wallets.forEach((w, i) => {
    const m = arrObj(metas[i]);
    w.name = m.name || null;
    w.image = m.image || null;
    w.first_seen = Number(m.firstSeen) || null;
    w.rank = i + 1;
  });
  return { persistent: true, total_tracked: total, wallets };
}

function arrObj(a) {
  const o = {};
  if (Array.isArray(a)) for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1];
  return o;
}
