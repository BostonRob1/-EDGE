import { savePredictions, isPersistent } from "../../lib/waitlist/storage.js";

// POST /api/waitlist/predict — { wallet, predictions: [{ market_slug, side: 'YES'|'NO', confidence }] }
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
  if (!wallet) {
    res.status(400).json({ error: "wallet_required" });
    return;
  }
  if (!Array.isArray(body?.predictions)) {
    res.status(400).json({ error: "predictions_array_required" });
    return;
  }

  // Sanitize each prediction — only keep what we know how to score
  const cleaned = body.predictions
    .filter(
      (p) =>
        p &&
        typeof p.market_slug === "string" &&
        (p.side === "YES" || p.side === "NO") &&
        Number.isFinite(Number(p.confidence))
    )
    .map((p) => ({
      market_slug: p.market_slug,
      market_title: typeof p.market_title === "string" ? p.market_title.slice(0, 200) : null,
      side: p.side,
      confidence: Math.max(0, Math.min(1, Number(p.confidence))),
    }))
    .slice(0, 20); // cap to prevent abuse

  if (!cleaned.length) {
    res.status(400).json({ error: "no_valid_predictions" });
    return;
  }

  try {
    const rec = await savePredictions(wallet, cleaned);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      wallet,
      predictions_saved: cleaned.length,
      projected_score: rec.projected_score,
      persistence: isPersistent() ? "kv" : "memory",
    });
  } catch (err) {
    const code = err?.message === "not_on_waitlist" ? 404 : 500;
    res.status(code).json({ error: err?.message || "predict_failed" });
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
