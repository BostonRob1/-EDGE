// RugCheck.xyz — Solana-specific rug detection. Public endpoint, no auth.
const REPORT_URL = (mint) =>
  `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report/summary`;

export async function fetchRugCheck(mint) {
  const r = await fetch(REPORT_URL(mint), {
    headers: { "User-Agent": "edge-tracker/1.0", Accept: "application/json" },
  });
  if (!r.ok) {
    if (r.status === 404) return { found: false, status: 404 };
    throw new Error(`rugcheck ${r.status}`);
  }
  const data = await r.json();
  return {
    found: true,
    score: typeof data.score === "number" ? data.score : null,
    score_normalised:
      typeof data.score_normalised === "number" ? data.score_normalised : null,
    risks: Array.isArray(data.risks) ? data.risks : [],
    raw: data,
  };
}
