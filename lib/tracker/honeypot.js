// Honeypot.is — Ethereum honeypot detection. Public endpoint, no auth.
// Simulates a buy and a sell to detect sells being blocked / taxed to oblivion.
const URL_FN = (addr) =>
  `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(addr)}&chainID=1`;

export async function fetchHoneypot(address) {
  const r = await fetch(URL_FN(address), {
    headers: { "User-Agent": "edge-tracker/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`honeypot ${r.status}`);
  const data = await r.json();
  return {
    found: true,
    is_honeypot: data.honeypotResult?.isHoneypot === true,
    honeypot_reason: data.honeypotResult?.honeypotReason || null,
    buy_tax: typeof data.simulationResult?.buyTax === "number" ? data.simulationResult.buyTax : null,
    sell_tax: typeof data.simulationResult?.sellTax === "number" ? data.simulationResult.sellTax : null,
    transfer_tax: typeof data.simulationResult?.transferTax === "number" ? data.simulationResult.transferTax : null,
    buy_gas: data.simulationResult?.buyGas || null,
    sell_gas: data.simulationResult?.sellGas || null,
    flags: Array.isArray(data.flags) ? data.flags : [],
    holders: data.holderAnalysis?.holders || null,
    successful_txs: data.holderAnalysis?.successful || null,
    failed_txs: data.holderAnalysis?.failed || null,
    siphoned: data.holderAnalysis?.siphoned || null,
    average_tax: data.holderAnalysis?.averageTax || null,
    raw: data,
  };
}
