import { harvestBoards } from "../../lib/whales/hof.js";

// Vercel Cron target (registered in vercel.json). Forces a roster harvest on a
// schedule so the Hall of Fame keeps accumulating even with zero organic
// traffic. Safe to hit manually too. No-ops cleanly until KV is connected.
export default async function handler(req, res) {
  try {
    const result = await harvestBoards();
    res.status(200).json({ ok: true, ...result, ran_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
