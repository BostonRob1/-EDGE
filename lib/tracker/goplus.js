// GoPlus Security — free public endpoints, no auth required for basic queries.
// Ethereum: /api/v1/token_security/{chain_id}?contract_addresses=...
// Solana:   /api/v1/solana/token_security?contract_addresses=...
const ETH_URL = (addr) =>
  `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${encodeURIComponent(addr)}`;
const SOL_URL = (addr) =>
  `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(addr)}`;

export async function fetchGoPlus(address, chain) {
  const url = chain === "solana" ? SOL_URL(address) : ETH_URL(address);
  const r = await fetch(url, {
    headers: { "User-Agent": "edge-tracker/1.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`goplus ${r.status}`);
  const data = await r.json();
  if (String(data?.code) !== "1") {
    return { found: false, raw: data };
  }
  const result = data.result || {};
  const key = Object.keys(result).find(
    (k) => k.toLowerCase() === String(address).toLowerCase()
  ) || Object.keys(result)[0];
  const info = key ? result[key] : null;
  if (!info) return { found: false, raw: data };

  if (chain === "solana") {
    return {
      found: true,
      chain: "solana",
      mintable: bool(info.mintable?.status),
      freezable: bool(info.freezable?.status),
      closable: bool(info.closable?.status),
      transfer_fee_upgradable: bool(info.transfer_fee_upgradable?.status),
      transfer_hook_upgradable: bool(info.transfer_hook_upgradable?.status),
      transfer_fee: parseFloat(info.transfer_fee?.transfer_fee_percent || 0),
      default_account_state: info.default_account_state || null,
      non_transferable: bool(info.non_transferable),
      trusted_token: bool(info.trusted_token),
      balance_mutable_authority: info.balance_mutable_authority || null,
      metadata_mutable: bool(info.metadata_mutable?.status),
      raw: info,
    };
  }
  return {
    found: true,
    chain: "ethereum",
    is_open_source: bool(info.is_open_source),
    is_proxy: bool(info.is_proxy),
    is_mintable: bool(info.is_mintable),
    is_honeypot: bool(info.is_honeypot),
    transfer_pausable: bool(info.transfer_pausable),
    can_take_back_ownership: bool(info.can_take_back_ownership),
    owner_change_balance: bool(info.owner_change_balance),
    hidden_owner: bool(info.hidden_owner),
    selfdestruct: bool(info.selfdestruct),
    external_call: bool(info.external_call),
    cannot_buy: bool(info.cannot_buy),
    cannot_sell_all: bool(info.cannot_sell_all),
    trading_cooldown: bool(info.trading_cooldown),
    is_anti_whale: bool(info.is_anti_whale),
    is_blacklisted: bool(info.is_blacklisted),
    is_whitelisted: bool(info.is_whitelisted),
    is_in_dex: bool(info.is_in_dex),
    is_airdrop_scam: bool(info.is_airdrop_scam),
    buy_tax: parseFloat(info.buy_tax || 0),
    sell_tax: parseFloat(info.sell_tax || 0),
    holder_count: parseInt(info.holder_count || "0", 10),
    lp_holder_count: parseInt(info.lp_holder_count || "0", 10),
    lp_total_supply: parseFloat(info.lp_total_supply || 0),
    total_supply: parseFloat(info.total_supply || 0),
    owner_address: info.owner_address || null,
    creator_address: info.creator_address || null,
    creator_percent: parseFloat(info.creator_percent || 0),
    owner_percent: parseFloat(info.owner_percent || 0),
    holders: Array.isArray(info.holders) ? info.holders.slice(0, 10) : [],
    lp_holders: Array.isArray(info.lp_holders) ? info.lp_holders.slice(0, 10) : [],
    raw: info,
  };
}

function bool(v) {
  if (v === undefined || v === null) return null;
  const s = String(v);
  if (s === "1" || s.toLowerCase() === "true") return true;
  if (s === "0" || s.toLowerCase() === "false") return false;
  return null;
}
