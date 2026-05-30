import { kvEnabled, kvCmd, kvPipe } from "../store/kv.js";

// EAGLE EYE — track what the smart-money wallets do OFF Polymarket, on-chain.
//
// Polymarket trading is internal (ERC-1155 position tokens + exchange-held
// USDC), so a wallet's *interesting* moves — cashing out, swapping, bridging,
// funding a fresh wallet — show up as ordinary chain activity. The clean way to
// read all of that per address, across chains, is an indexer:
//   • PRIMARY: Etherscan V2 multichain API — ONE free key covers Polygon,
//     Ethereum, Base, Arbitrum… via a chainid param. Set ETHERSCAN_API_KEY.
//   • FALLBACK (no key): a public Polygon RPC scan of USDC.e Transfer logs,
//     which still catches deposits / cash-outs in a ~5h window. Limited, but
//     real, and key-free so the feature is live the day it ships.
//
// Classified events are persisted to KV (`eagle:feed`) by a cron so the global
// feed + history survive across requests.

const ES_BASE = "https://api.etherscan.io/v2/api";
const ES_KEY = process.env.ETHERSCAN_API_KEY || process.env.POLYGONSCAN_API_KEY || "";
export const etherscanEnabled = !!ES_KEY;

// Chains we sweep for "everywhere on-chain" coverage. Polygon first (home turf).
export const CHAINS = [
  { id: 137, name: "polygon", sym: "POL" },
  { id: 1, name: "ethereum", sym: "ETH" },
  { id: 8453, name: "base", sym: "BASE" },
  { id: 42161, name: "arbitrum", sym: "ARB" },
];

// ── known-contract classification ─────────────────────────────────────
const lc = (s) => (s || "").toLowerCase();
// Polymarket's Polygon contracts — interactions here are ON-poly, so we tag
// them and the EAGLE EYE feed filters them out (the firehose already has them).
const POLYMARKET = new Set([
  "0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e", // CTF Exchange
  "0xc5d563a36ae78145c45a50134d48a1215220f80a", // NegRisk CTF Exchange
  "0xd91e80cf2e7be2e162c6513ced06f1dd0da35296", // NegRisk Adapter
  "0x4d97dcd97ec945f40cf65f87097ace5ea0476045", // Conditional Tokens (CTF)
  "0x56c79347e95530c01a2fc76e732f9566da16e113", // CTF collateral helper
].map(lc));
const DEX = new Map([
  ["0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap"],
  ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap"],
  ["0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff", "QuickSwap"],
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
  ["0xdef1c0ded9bec7f1a1670819833240f027b25eff", "0x"],
  ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "USDC"],
].map(([a, v]) => [lc(a), v]));
const BRIDGE = new Set([
  "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf", // Polygon PoS ERC20 bridge
  "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // (placeholder common)
  "0x9d1b1669c73b033dfe47ae5a0164ab96df25b944", // Stargate-ish
].map(lc));
const STABLES = new Set(["usdc", "usdc.e", "usdt", "dai"].map(lc));

export function classifyCounterparty(addr) {
  const a = lc(addr);
  if (POLYMARKET.has(a)) return { venue: "polymarket", label: "Polymarket", onpoly: true };
  if (DEX.has(a)) return { venue: "swap", label: DEX.get(a), onpoly: false };
  if (BRIDGE.has(a)) return { venue: "bridge", label: "Bridge", onpoly: false };
  return { venue: "transfer", label: null, onpoly: false };
}

// Fetch with a hard timeout — on-chain endpoints must never hang a request.
async function fetchT(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Etherscan V2 ──────────────────────────────────────────────────────
async function esCall(chainid, params) {
  const qs = new URLSearchParams({ ...params, chainid: String(chainid), apikey: ES_KEY });
  try {
    const r = await fetchT(`${ES_BASE}?${qs}`, { headers: { "User-Agent": "edge-eagle-eye/1.0" } });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.result) ? d.result : [];
  } catch {
    return [];
  }
}

function esTokenEvent(chain, address, t) {
  const dec = Number(t.tokenDecimal) || 18;
  const amount = Number(t.value) / 10 ** dec;
  const out = lc(t.from) === lc(address);
  const counterparty = out ? t.to : t.from;
  const c = classifyCounterparty(counterparty);
  return {
    chain: chain.name,
    chain_sym: chain.sym,
    kind: "token",
    direction: out ? "out" : "in",
    token: t.tokenSymbol || "?",
    amount,
    usd_ish: STABLES.has(lc(t.tokenSymbol)) ? amount : null,
    counterparty: lc(counterparty),
    venue: c.venue,
    venue_label: c.label,
    onpoly: c.onpoly || POLYMARKET.has(lc(t.contractAddress)),
    hash: t.hash,
    timestamp: Number(t.timeStamp) || 0,
  };
}

// All recent moves for one wallet across chains, classified, newest first.
export async function walletMoves(address, { perChain = 25, includeOnPoly = false } = {}) {
  const addr = lc(address);
  if (etherscanEnabled) {
    const events = [];
    for (const chain of CHAINS) {
      const toks = await esCall(chain.id, { module: "account", action: "tokentx", address: addr, page: 1, offset: perChain, sort: "desc" });
      for (const t of toks) events.push(esTokenEvent(chain, addr, t));
    }
    const filtered = includeOnPoly ? events : events.filter((e) => !e.onpoly);
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    return { source: "etherscan", events: filtered };
  }
  // key-free fallback: Polygon USDC.e deposits / cash-outs
  const events = await usdcFallback(addr);
  return { source: "fallback", events };
}

// ── public-RPC fallback (no key): USDC.e in/out on Polygon ────────────
const RPC = "https://polygon-bor-rpc.publicnode.com";
const USDCE = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpc(method, params) {
  const r = await fetchT(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "edge-eagle-eye/1.0" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  return r.json();
}

async function usdcFallback(address) {
  try {
    const latest = parseInt((await rpc("eth_blockNumber", [])).result, 16);
    const from = "0x" + (latest - 9500).toString(16); // publicnode caps ~10k blocks
    const pad = "0x" + "0".repeat(24) + lc(address).slice(2);
    const events = [];
    for (const [dir, topics] of [["in", [TRANSFER_TOPIC, null, pad]], ["out", [TRANSFER_TOPIC, pad, null]]]) {
      const r = await rpc("eth_getLogs", [{ fromBlock: from, toBlock: "latest", address: USDCE, topics }]);
      for (const l of r.result || []) {
        const amount = parseInt(l.data, 16) / 1e6;
        const counterparty = "0x" + (dir === "in" ? l.topics[1] : l.topics[2]).slice(-40);
        events.push({
          chain: "polygon", chain_sym: "POL", kind: "token", direction: dir,
          token: "USDC.e", amount, usd_ish: amount, counterparty: lc(counterparty),
          venue: "transfer", venue_label: dir === "in" ? "deposit / inflow" : "withdrawal / cash-out",
          onpoly: false, hash: l.transactionHash, timestamp: 0, block: parseInt(l.blockNumber, 16),
        });
      }
    }
    return events;
  } catch {
    return [];
  }
}

// ── persistent global feed (KV) ───────────────────────────────────────
const FEED = "eagle:feed";
const MAX_AGE_MS = 60 * 24 * 3600 * 1000;

function feedMember(addr, name, e) {
  return JSON.stringify({
    w: addr, n: name || "", c: e.chain, cs: e.chain_sym, d: e.direction, tk: e.token,
    a: e.amount, u: e.usd_ish, cp: e.counterparty, v: e.venue, vl: e.venue_label,
    h: e.hash, ts: e.timestamp || 0,
  });
}
export function parseEagle(m) {
  try {
    const t = JSON.parse(m);
    return {
      wallet: t.w, name: t.n || null, chain: t.c, chain_sym: t.cs, direction: t.d,
      token: t.tk, amount: t.a, usd_ish: t.u, counterparty: t.cp, venue: t.v,
      venue_label: t.vl, hash: t.h, timestamp: t.ts,
    };
  } catch {
    return null;
  }
}

// Sweep a batch of sharp wallets and store their fresh off-poly moves.
export async function scanSharpsToKV(wallets) {
  if (!kvEnabled || !Array.isArray(wallets) || !wallets.length) return { stored: 0, enabled: false };
  let stored = 0;
  const cmds = [];
  for (const w of wallets) {
    const { events } = await walletMoves(w.wallet, { perChain: 15 });
    for (const e of events) {
      const ts = (e.timestamp || Math.floor((Date.now() - (e.block ? 0 : 0)) / 1000)) * 1000 || Date.now();
      cmds.push(["ZADD", FEED, String(ts), feedMember(w.wallet, w.name, e)]);
      stored++;
    }
  }
  if (cmds.length) {
    cmds.push(["ZREMRANGEBYSCORE", FEED, "0", String(Date.now() - MAX_AGE_MS)]);
    cmds.push(["ZREMRANGEBYRANK", FEED, "0", "-6001"]);
    try { await kvPipe(cmds); } catch { /* best-effort */ }
  }
  return { stored, enabled: true, scanned: wallets.length };
}

export async function readEagleFeed(windowMs, limit = 200) {
  if (!kvEnabled) return null;
  const min = Date.now() - windowMs;
  const flat = (await kvCmd(["ZREVRANGEBYSCORE", FEED, "+inf", String(min), "LIMIT", "0", String(limit)])) || [];
  return flat.map(parseEagle).filter(Boolean);
}

// The wallets we watch on-chain = the actively-profitable sharps (24h board).
const LB = "https://lb-api.polymarket.com";
export async function activeSharps(n = 15) {
  try {
    const r = await fetch(`${LB}/profit?window=1d&limit=${n}`, { headers: { "User-Agent": "edge-aggregator/1.0", Accept: "application/json" } });
    const d = await r.json();
    return (Array.isArray(d) ? d : []).map((x) => ({ wallet: lc(x.proxyWallet), name: x.name || x.pseudonym || null })).filter((w) => w.wallet);
  } catch {
    return [];
  }
}
