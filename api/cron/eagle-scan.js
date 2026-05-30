import { scanSharpsToKV, activeSharps, etherscanEnabled } from "../../lib/onchain/eagle.js";

// Vercel Cron (see vercel.json). Sweeps the active sharps' on-chain moves and
// writes fresh off-Polymarket events into the persistent EAGLE EYE feed. Scans
// fewer wallets without an Etherscan key (the public-RPC fallback is slower).
// No-ops cleanly until KV is connected.
export default async function handler(req, res) {
  try {
    const n = etherscanEnabled ? 15 : 6;
    const sharps = await activeSharps(n);
    const result = await scanSharpsToKV(sharps);
    res.status(200).json({ ok: true, etherscan: etherscanEnabled, ...result, ran_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
