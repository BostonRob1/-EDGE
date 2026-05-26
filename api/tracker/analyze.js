import { detectChain } from "../../lib/tracker/chain-detect.js";
import { fetchDexScreener } from "../../lib/tracker/dexscreener.js";
import { fetchGoPlus } from "../../lib/tracker/goplus.js";
import { fetchRugCheck } from "../../lib/tracker/rugcheck.js";
import { fetchHoneypot } from "../../lib/tracker/honeypot.js";
import { fetchSolanaMintInfo, fetchSolanaTopHolders } from "../../lib/tracker/solana-rpc.js";
import { analyze } from "../../lib/tracker/analyze-flags.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const address = (url.searchParams.get("address") || "").trim();
  const chainOverride = url.searchParams.get("chain");

  if (!address) {
    res.status(400).json({ error: "address_required", detail: "Pass ?address=<token-address>" });
    return;
  }

  const chain = chainOverride || detectChain(address);
  if (!chain || (chain !== "solana" && chain !== "ethereum")) {
    res.status(400).json({
      error: "invalid_address",
      detail: "Could not detect chain. Address must be Solana base58 or Ethereum 0x… (40 hex).",
    });
    return;
  }

  // Fan out to every source in parallel; capture per-source errors so a single
  // upstream failure doesn't blow up the whole analysis.
  const tasks = [
    ["dexscreener", fetchDexScreener(address)],
    ["goplus", fetchGoPlus(address, chain)],
  ];
  if (chain === "solana") {
    tasks.push(["rugcheck", fetchRugCheck(address)]);
    tasks.push(["solanaMint", fetchSolanaMintInfo(address)]);
    tasks.push(["solanaHolders", fetchSolanaTopHolders(address)]);
  } else {
    tasks.push(["honeypot", fetchHoneypot(address)]);
  }

  const sources = {};
  const errors = {};
  const settled = await Promise.allSettled(tasks.map(([, p]) => p));
  settled.forEach((s, i) => {
    const [name] = tasks[i];
    if (s.status === "fulfilled") sources[name] = s.value;
    else errors[name] = String(s.reason?.message || s.reason);
  });

  const risk = analyze({
    dexscreener: sources.dexscreener,
    goplus: sources.goplus,
    rugcheck: sources.rugcheck,
    honeypot: sources.honeypot,
    solanaMint: sources.solanaMint,
    solanaHolders: sources.solanaHolders,
    chain,
  });

  const dex = sources.dexscreener;
  const token = {
    address,
    chain,
    name: dex?.name || null,
    symbol: dex?.symbol || null,
    explorer_url:
      chain === "solana"
        ? `https://solscan.io/token/${address}`
        : `https://etherscan.io/token/${address}`,
    image: dex?.info?.imageUrl || null,
  };

  const market = dex?.found
    ? {
        price_usd: dex.price_usd,
        liquidity_usd: dex.liquidity_usd,
        volume_24h: dex.volume_24h,
        volume_1h: dex.volume_1h,
        volume_5m: dex.volume_5m,
        price_change_24h: dex.price_change_24h,
        price_change_1h: dex.price_change_1h,
        price_change_5m: dex.price_change_5m,
        txns_24h_buys: dex.txns_24h_buys,
        txns_24h_sells: dex.txns_24h_sells,
        txns_1h_buys: dex.txns_1h_buys,
        txns_1h_sells: dex.txns_1h_sells,
        fdv: dex.fdv,
        market_cap: dex.market_cap,
        dex: dex.dex,
        pair_url: dex.pair_url,
        pair_address: dex.pair_address,
        pair_created_at: dex.pair_created_at,
        pair_age_hours: dex.pair_created_at ? (Date.now() - dex.pair_created_at) / 3_600_000 : null,
        pair_count: dex.pair_count,
      }
    : null;

  // Normalize holder list across chains
  let holders = null;
  if (chain === "ethereum" && sources.goplus?.found) {
    holders = (sources.goplus.holders || []).map((h) => ({
      address: h.address,
      percent: parseFloat(h.percent || 0),
      balance: h.balance || null,
      tag: h.tag || null,
      is_locked: h.is_locked === 1 || h.is_locked === "1",
      is_contract: h.is_contract === 1 || h.is_contract === "1",
    }));
  } else if (chain === "solana" && sources.solanaHolders && sources.solanaMint) {
    const decimals = sources.solanaMint.decimals || 0;
    const supply = parseFloat(sources.solanaMint.supply) / Math.pow(10, decimals);
    holders = sources.solanaHolders.slice(0, 10).map((h) => {
      const amount = parseFloat(
        h.uiAmountString != null
          ? h.uiAmountString
          : (parseFloat(h.amount || 0) / Math.pow(10, decimals)).toString()
      );
      return {
        address: h.address,
        amount,
        percent: supply > 0 ? amount / supply : 0,
      };
    });
  }

  // Chain-specific on-chain summary
  const onchain =
    chain === "solana" && sources.solanaMint
      ? {
          decimals: sources.solanaMint.decimals,
          supply_raw: sources.solanaMint.supply,
          mint_authority: sources.solanaMint.mint_authority,
          freeze_authority: sources.solanaMint.freeze_authority,
        }
      : chain === "ethereum" && sources.goplus?.found
      ? {
          owner_address: sources.goplus.owner_address,
          creator_address: sources.goplus.creator_address,
          total_supply: sources.goplus.total_supply,
          holder_count: sources.goplus.holder_count,
          lp_holder_count: sources.goplus.lp_holder_count,
        }
      : null;

  res.status(200).json({
    token,
    market,
    onchain,
    risk,
    holders,
    sources_ok: Object.keys(sources),
    errors: Object.keys(errors).length ? errors : undefined,
    fetched_at: new Date().toISOString(),
  });
}
