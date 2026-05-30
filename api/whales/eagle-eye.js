import { kvEnabled } from "../../lib/store/kv.js";
import { walletMoves, readEagleFeed, etherscanEnabled } from "../../lib/onchain/eagle.js";

// EAGLE EYE — off-Polymarket on-chain moves of the smart-money wallets.
//   ?wallet=0x…        → that wallet's recent moves across chains (on demand)
//   (default) ?window= → the global feed of all tracked sharps' moves
//
// With an Etherscan key it's full multichain (Polygon/Ethereum/Base/Arbitrum);
// without one it runs a key-free Polygon USDC.e fallback (deposits/cash-outs).
// With KV the global feed is the persistent, cron-fed log; without KV it does a
// small bounded live scan so the panel still shows real activity.
const HOURS = { "6h": 6, "12h": 12, "24h": 24, "7d": 168, "30d": 720, "60d": 1440 };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const wallet = (url.searchParams.get("wallet") || "").trim().toLowerCase();
  const windowKey = url.searchParams.get("window") || "24h";
  const windowMs = (HOURS[windowKey] || 24) * 3600 * 1000;

  try {
    // ── per-wallet, on demand ──
    if (/^0x[a-f0-9]{40}$/.test(wallet)) {
      const { source, events } = await walletMoves(wallet, { perChain: 25 });
      res.setHeader("Cache-Control", "public, s-maxage=45, stale-while-revalidate=180");
      return res.status(200).json({
        mode: "wallet", wallet, source, etherscan: etherscanEnabled,
        count: events.length, events: events.slice(0, 60), fetched_at: new Date().toISOString(),
      });
    }

    // ── global feed from the persistent store ──
    if (kvEnabled) {
      const events = (await readEagleFeed(windowMs, 200)) || [];
      res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=90");
      return res.status(200).json({
        mode: "feed", persistent: true, etherscan: etherscanEnabled,
        window: windowKey, count: events.length, events, fetched_at: new Date().toISOString(),
      });
    }

    // ── no KV → return instantly in "armed" state. The persistent global feed
    // fills in once KV + the scan cron run; meanwhile the per-wallet panel
    // (wallet detail) shows live on-chain moves on demand without blocking here.
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({
      mode: "feed-armed", persistent: false, etherscan: etherscanEnabled, window: windowKey,
      count: 0, events: [],
      note: "Global feed activates with Vercel KV + the scan cron. Open any wallet to see its live off-Polymarket moves right now.",
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: "eagle_eye_failed", detail: String(err?.message || err) });
  }
}
