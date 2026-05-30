# 01 — Execution Engine

The core service that turns "buy YES on market X for $100" into a settled
Polymarket position. Every other product (one-click, copy, auto-copy, Telegram)
is a caller of this.

## How Polymarket actually works (the constraints we build to)

- **Not an AMM.** Polymarket is a **central limit order book (CLOB)**. You don't
  swap against a pool — you place a signed order that matches against resting
  orders. We route into *their* liquidity.
- **Off-chain orders, on-chain settlement.** An order is an **EIP-712 signed
  message** posted to the CLOB API. Placing/cancelling costs **no gas**. When it
  matches, Polymarket's operator settles it on Polygon. Users only pay gas once,
  for token **approvals**.
- **Collateral:** USDC.e on Polygon (`0x2791…84174`). **Outcome tokens:** ERC-1155
  conditional tokens (CTF). **Resolution:** UMA optimistic oracle.
- **Contracts to approve (one-time, per wallet):** CTF Exchange `0x4bFb…982E`,
  Neg-Risk Exchange `0xC5d5…f80a`, Neg-Risk Adapter `0xd91E…5296` — for USDC.e and
  the CTF (`setApprovalForAll`). Without these, orders can't settle.
- **SDK:** `@polymarket/clob-client` (TypeScript). Handles order construction,
  EIP-712 hashing, the L1→L2 auth handshake, submit/cancel, and reads.

> ⚠️ Verify-before-build: exact contract addresses, current fee schedule, geo
> rules, and whether Polymarket offers a **builder/order-flow program** can change.
> A one-week integration spike (Phase 0) pins these down against live mainnet.

## Order lifecycle

```
quote market  →  build order  →  sign (EIP-712)  →  submit to CLOB  →  poll fill  →  update positions
   /book          side, size,      by wallet/         REST POST          status        ERC-1155 balance
                  price, type      custody model                         FOK/partial   + PnL via data-api
```

- **For copy trades use marketable orders** — `FOK` (fill-or-kill) or `FAK`
  (fill-and-kill) **taker** orders at/through the book — so a copy fills *now*,
  near the sharp's price, or not at all. Slippage cap = max ticks through book
  (doc 02). Limit/GTC is a later "pro trade" feature.
- **Idempotency:** every order carries our own `clientOrderId`; the keeper never
  double-submits a copy for the same `(signal, follower)`.

## The wallet / custody models (the central decision)

| Model | Who holds keys | UX | Auto-copy? | Fee capture | Regulatory weight |
|-------|----------------|----|-----------|------------|-------------------|
| **A. Connect-wallet** (non-custodial) | User (their EOA) | User signs every order | ❌ (must sign each) | Subscription / token-gate only | Lightest |
| **B. Managed wallet** (custodial-via-MPC) | EDGE policy-signs (MPC/TEE) | One-tap; deposit once | ✅ | Per-trade bps skim | Heaviest (custody) |
| **C. Smart account** (delegated AA) | User custodies; EDGE is a **limited** delegate | One-tap after setup | ✅ within limits | Per-trade via module | Middle |

**Recommendation:**
- **Web one-click → Model A** (connect Polygon wallet, user signs). Fast to ship,
  no custody. Monetize via token-gate.
- **Telegram + auto-copy → Model B or C.** A Telegram trading bot *must* be one-tap,
  which means EDGE signs on the user's behalf. Use an **MPC / embedded-wallet
  provider with a policy engine** (Turnkey, Privy, Web3Auth/Lit, Fireblocks) — keys
  are sharded/TEE-held, never raw on our servers, and every signature is gated by
  per-wallet policy (spend caps, allowlisted contracts = only Polymarket + USDC).
- **Model C (ERC-4337 / Safe module)** is the elegant endgame: user keeps custody
  + withdrawal rights, EDGE holds a *session key* that can only place
  Polymarket orders up to limits. Best trust story; most contract work. Plan it as
  the Phase 6 upgrade to B.

> The custody model is the #1 fork. It drives security scope, regulatory exposure,
> and which products are even possible. Decide it in Phase 0.

## Module shape (server-side, TypeScript)

```
lib/exec/
  clob.ts          // thin wrapper over @polymarket/clob-client (build/submit/cancel/reads)
  markets.ts       // resolve EDGE market → Polymarket tokenId(s) + tick/min-size
  pricing.ts       // book → marketable price + slippage check
  approvals.ts     // check/queue USDC.e + CTF approvals per wallet
  positions.ts     // wallet positions + realized/unrealized PnL (reuse data-api)
lib/custody/
  signer.ts        // interface: sign(order) — impl A (client), B (MPC), C (session key)
  provider-turnkey.ts (or privy/…)   // MPC/embedded wallet create + policy-signed orders
```

Public surface the rest of the suite calls:
```ts
placeOrder({ user, tokenId, side, sizeUsd, maxSlippageBps }): { orderId, fillStatus, avgPrice }
cancelOrder({ user, orderId })
getPositions(user) / getBalance(user)
ensureApprovals(user)         // idempotent
```

## What Phase 0 must prove (the spike)

1. Place + fill a real $1 order on a live market via the SDK from a server process.
2. Confirm the approval set + that a fresh EOA can trade after approvals.
3. Stand up one **managed (MPC) wallet**, deposit USDC, place a policy-signed order.
4. Read positions + PnL back. Pin exact contract addresses, fees, min sizes, geo.
