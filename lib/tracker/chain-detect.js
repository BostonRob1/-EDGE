// Detect chain from a raw token address string.
// Ethereum: 0x-prefixed, 40 hex chars.
// Solana: base58 (no 0/O/I/l), typically 32-44 chars (mints are 32-byte → ~43-44 chars encoded).
export function detectChain(address) {
  if (!address || typeof address !== "string") return null;
  const a = address.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "ethereum";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "solana";
  return null;
}

export function normalizeAddress(address, chain) {
  const a = String(address || "").trim();
  return chain === "ethereum" ? a.toLowerCase() : a;
}
