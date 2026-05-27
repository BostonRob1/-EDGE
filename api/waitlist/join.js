import { joinWaitlist, isPersistent } from "../../lib/waitlist/storage.js";

const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/waitlist/join — { wallet, email?, referredBy? } → { position }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    res.status(400).json({ error: "invalid_json", detail: String(err?.message || err) });
    return;
  }

  const wallet = String(body?.wallet || "").trim();
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const referredBy = body?.referredBy ? String(body.referredBy).trim() : null;

  if (!wallet) {
    res.status(400).json({ error: "wallet_required", detail: "Solana wallet address required." });
    return;
  }
  if (!SOL_RE.test(wallet) && !ETH_RE.test(wallet)) {
    res.status(400).json({ error: "invalid_wallet", detail: "Wallet must be a Solana (base58) or Ethereum (0x…) address." });
    return;
  }
  if (email && !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "invalid_email", detail: "Email format invalid." });
    return;
  }

  try {
    const { position, alreadyJoined } = await joinWaitlist({ wallet, email, referredBy });
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      wallet,
      position,
      already_joined: alreadyJoined,
      persistence: isPersistent() ? "kv" : "memory",
    });
  } catch (err) {
    res.status(500).json({ error: "join_failed", detail: String(err?.message || err) });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
