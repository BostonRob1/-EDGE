// Solana JSON-RPC client — uses the public mainnet endpoint.
// Rate-limited; if a paid RPC URL is set in SOLANA_RPC_URL, it'll be used instead.
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

function rpcEndpoint() {
  return process.env.SOLANA_RPC_URL || DEFAULT_RPC;
}

async function rpcCall(method, params) {
  const r = await fetch(rpcEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`solana-rpc ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`solana-rpc: ${data.error.message || JSON.stringify(data.error)}`);
  return data.result;
}

export async function fetchSolanaMintInfo(mint) {
  const result = await rpcCall("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const info = result?.value?.data?.parsed?.info;
  if (!info) return null;
  return {
    decimals: typeof info.decimals === "number" ? info.decimals : 0,
    supply: info.supply || "0",
    mint_authority: info.mintAuthority || null,
    freeze_authority: info.freezeAuthority || null,
    is_initialized: info.isInitialized === true,
  };
}

export async function fetchSolanaTopHolders(mint) {
  const result = await rpcCall("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  return Array.isArray(result?.value) ? result.value : [];
}
