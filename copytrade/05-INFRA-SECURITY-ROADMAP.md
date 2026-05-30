# 05 — Infra, Security, Roadmap & Decisions

## The architectural shift

The intelligence product (this repo) is static pages on Vercel + serverless +
Vercel KV. **The copy-trading suite cannot live there.** It needs:

- An **always-on backend service** — long-running watchers, the copy keeper, the
  Telegram webhook, the signing flow. Serverless functions time out and can't hold
  state. Host on **Railway / Render / Fly.io / AWS** (a normal Node service).
- A **relational database (Postgres)** — users, wallets, follow-rules, positions,
  trades, fee ledger, audit log. (Vercel Postgres / Neon / Supabase / RDS.) KV
  stays for the fast intelligence feeds; Postgres is the system of record for money.
- A **custody/key provider** — see below. The single most important vendor choice.

The web app (Vercel) stays the front-end; it calls the new backend's API. Clean
split: **Vercel = read/UI, backend service = money.**

```
Vercel (web UI) ─┐
                 ├─►  EDGE backend service (Node, always-on)  ─►  Postgres
Telegram  ───────┘     · signal watcher   · copy keeper            (system of record)
                       · execution engine · TG webhook        ─►  Custody provider (MPC)
                       · fee router/ledger                    ─►  Polymarket CLOB / Polygon
```

## Key custody & security (the part that must be bulletproof)

**Never store raw private keys.** Use an MPC / TEE / embedded-wallet provider with
a **policy engine**:

- **Candidates:** Turnkey, Privy, Web3Auth/Lit, Fireblocks, Coinbase MPC.
- **Policy per managed wallet:** can only call **Polymarket contracts + USDC.e**,
  per-tx spend cap, daily cap, **no arbitrary transfers** except withdrawals to a
  user-allowlisted address.
- **Withdrawals:** confirm step + allowlist + optional time-delay/2FA. The only path
  funds leave; lock it down hardest.
- **Endgame (Model C, Phase 6):** ERC-4337 smart accounts / Safe + session keys so
  the **user keeps custody and withdrawal**, and EDGE only holds a session key that
  can *only* place Polymarket orders within limits. Best trust story; eliminates the
  "EDGE holds your funds" risk.

**Operational security:** global kill switch; per-user + global exposure caps;
circuit breakers (daily loss limits); anomaly detection on order flow; full audit
log; on-chain reconciliation job (positions/balances vs. our DB); secrets in a
vault; least-privilege keeper. **Audit** any custom contract (router, AA module)
before it touches real funds. Bug bounty before scale.

## Stack summary

| Layer | Choice |
|-------|--------|
| Backend service | Node + TypeScript (Railway/Render/Fly) |
| Bot | grammY/Telegraf, webhook |
| DB | Postgres (Neon/Supabase/RDS) + the existing KV for feeds |
| Custody | MPC provider (Turnkey/Privy) → later ERC-4337 session keys |
| Polymarket | `@polymarket/clob-client`, Polygon RPC (Alchemy — also powers Eagle Eye) |
| Queue/keeper | a durable queue (BullMQ/Redis) for signals→copies with retries |
| Web | existing Vercel app calls the backend API |

## Phased roadmap

| Phase | Deliverable | Gate to start | Rough effort* |
|-------|-------------|---------------|---------------|
| **0 — Foundations** | Backend service + Postgres + **custody decision** + CLOB spike (place/fill/read a real $1 order; one MPC wallet) | decisions below | 2–3 wks |
| **1 — One-click trade** | Web: connect wallet → place a real order from EDGE | Phase 0 | 2–4 wks |
| **2 — One-click copy** | "Copy this bet" pre-filled from a sharp signal (human-confirmed) | Phase 1 | 1–2 wks |
| **3 — Telegram v1** | Managed wallet, deposit, manual trade, alerts + inline **[Copy]** | Phase 0 custody + 2 | 3–5 wks |
| **4 — Auto-copy** | Rules engine + keeper + **exit-mirroring** (web + TG) | Phase 2/3 | 3–5 wks |
| **5 — Fees + token** | bps skim + ledger → buy+burn $EDGE; tier ladder; gating | Phase 4 | 2–3 wks |
| **6 — Low-latency + AA** | WS/webhook signal push (fill at sharp's price) + ERC-4337 session keys | Phase 4 | 3–6 wks |
| **7 — Own venue (stretch)** | EDGE-native markets + liquidity + own fees | separate raise | 6–12 mo |

\* *Engineering effort for a focused team, excluding audit + legal lead time.
Phases 1–5 overlap; the headline launch is **2 → 3 → 4** with 1 + 5 underneath.*

## Decisions (must answer before Phase 0) {#decisions}

1. **Custody model** — non-custodial only (A), or managed MPC (B), or AA session
   keys (C)? Telegram + auto-copy require B or C. **This unblocks everything.**
2. **Regulatory & geo** — US strategy (Polymarket is CFTC-settled + US-geoblocked);
   is the product geo-fenced? Does auto-copy/managed funds trigger money-transmitter
   / CTA / broker considerations? **Counsel before launch, not after.**
3. **KYC/AML** — required at custodial thresholds; which provider; what limits.
4. **Polymarket relationship** — is third-party order flow allowed under ToS; is
   there a builder/fee-share program; relayer access for gasless UX?
5. **Fee + tier numbers** — bps, the $EDGE tier thresholds, burn split.
6. **Where it's hosted + which custody vendor** — drives security + cost.

## Risk register

| Risk | Mitigation |
|------|-----------|
| Custody breach / key theft | MPC/TEE + policy engine + caps + withdrawal allowlist; no raw keys; audits |
| Regulatory action | Counsel-led geo-fencing + KYC; phase custodial features carefully |
| Polymarket ToS / API change | Builder agreement; abstract the venue behind engine 01; monitor |
| Copy slippage / bad fills | Slippage caps, FOK orders, skip-don't-chase, exit-mirroring |
| Keeper bug drains/overtrades | Idempotency, caps, circuit breakers, kill switch, dry-run mode |
| Liquidity thin on a market | Min-size + max-slippage guards; skip + notify |
| Smart-contract bug (router/AA) | Audit + bug bounty + staged limits |

## What we already have that this reuses

- **Signal:** the entire smart-money / sharp-feed / Hall-of-Fame stack → the copy
  signal + the curated wallet universe. (Built.)
- **Eagle Eye / Alchemy on-chain:** same Polygon data provider powers the
  low-latency watcher (Phase 6).
- **$EDGE token + burns tracker + tier ladder:** the fee → buy+burn → utility loop.
- **The audience + brand:** distribution for launch.

The moat is the signal, and it's done. This plan is the execution + monetization
layer on top of it.
