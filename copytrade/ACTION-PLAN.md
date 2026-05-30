# $EDGE — Trading & Copy-Trading Platform
## Implementation Action Plan (team brief)

**Prepared for:** the build team · **Owner:** Rob · **Status:** approved to plan, gated on the Day-0 decisions below
**Companion specs:** [`README`](README.md) · [`01-EXECUTION-ENGINE`](01-EXECUTION-ENGINE.md) · [`02-COPY-ENGINE`](02-COPY-ENGINE.md) · [`03-TELEGRAM-BOT`](03-TELEGRAM-BOT.md) · [`04-FEES-AND-TOKEN`](04-FEES-AND-TOKEN.md) · [`05-INFRA-SECURITY-ROADMAP`](05-INFRA-SECURITY-ROADMAP.md)

---

## 0. The play (TL;DR)

We are building the **best Polymarket copy-trading platform in the world**: trade
Polymarket from EDGE, one-click copy a proven sharp, auto-mirror a wallet, and do
all of it from a Telegram bot — with a fee on every trade that buys + burns $EDGE.

**Why we win, and fast:** the hard part — *the signal* (who's profitable, what
they're betting, the second they bet) — **is already built and live in production**
(Smart Money, Hall of Fame, Sharp Alerts, Eagle Eye). Competitors would need a year
to build the intelligence layer. We're adding the **execution + monetization layer**
on top of a moat that already exists.

**Headline launch = One-Click Copy → Telegram Bot → Auto-Copy.** Everything else is
plumbing underneath those three.

---

## 1. Scope — what we're shipping

| # | Product | Definition of done |
|---|---------|--------------------|
| P1 | **One-Click Trade** | Place a real Polymarket order from EDGE (web). |
| P2 | **One-Click Copy** | "Mirror this bet," pre-filled from a detected sharp trade. |
| P3 | **Telegram Bot** | Managed wallet, deposit, live alerts with inline **[Copy]**, `/follow`, positions, PnL. |
| P4 | **Auto-Copy** | Follow a wallet → every trade auto-mirrors within risk caps, incl. exits. |
| P5 | **Fee + Token Layer** | bps fee per trade → buy + burn $EDGE; $EDGE tiers = lower fees / more follows / higher caps. |

Out of scope for v1 (later/stretch): EDGE-native venue & liquidity (own DEX).

---

## 2. The squad (roles → ownership)

Lean elite team. One person can wear two hats early; these are *responsibilities*, not headcount mandates.

| Role | Owns | Workstreams |
|------|------|-------------|
| **Tech Lead / Protocol Eng** | Execution engine, Polymarket CLOB integration, copy keeper | A, C |
| **Backend Eng** | API, copy-rules engine, positions/PnL, fee ledger, queue | C, F |
| **Smart-Contract Eng** (contract/PT early) | Fee router, ERC-4337 session keys / Safe module, audit liaison | F, B(late) |
| **Bot Eng** | Telegram bot (grammY), inline-copy UX, notifications | D |
| **Frontend Eng** | Web trading/copy/auto-copy UI on the existing app | E |
| **DevOps / Security** | Backend service, Postgres, custody integration, monitoring, kill switch | G |
| **Design** (existing/contract) | Trading UI, bot UX, the elite polish | E, D |
| **Legal / Compliance** (counsel) | Regulatory, geo-fencing, KYC/AML, Polymarket ToS | H |
| **PM = Rob** | Decisions, vendor selection, sequencing, partnerships | all |

**Minimum to start moving: 1 Tech Lead + 1 Backend + 1 Frontend/Bot + DevOps (shared) + counsel engaged.**

---

## 3. Tech stack (decided)

- **Backend service:** Node + TypeScript, always-on (Railway / Render / Fly.io). *(Replaces nothing — the web app stays on Vercel as the UI and calls this.)*
- **Polymarket:** `@polymarket/clob-client`, Polygon RPC via **Alchemy** (already our Eagle-Eye provider).
- **Database:** **Postgres** (Neon/Supabase/RDS) = system of record for money. Existing **Vercel KV** stays for the fast intelligence feeds.
- **Custody:** **MPC / embedded-wallet provider** (Turnkey or Privy) with a policy engine → later **ERC-4337 session keys** for non-custodial endgame.
- **Queue/keeper:** BullMQ + Redis (durable signals → copies, retries, idempotency).
- **Bot:** grammY (webhook mode), shares the backend.
- **Monitoring:** logs + metrics + alerting + on-chain reconciliation + global kill switch.

---

## 4. Workstreams (parallel tracks)

```
A  Execution Engine     CLOB orders, approvals, positions      (Tech Lead)
B  Custody / Wallets     MPC wallets, policy, withdrawals       (DevOps + Tech Lead)
C  Copy Engine           signal → rules → keeper → exits        (Tech Lead + Backend)
D  Telegram Bot          managed-wallet bot + inline copy       (Bot Eng)
E  Web UI                trade/copy/auto-copy surfaces          (Frontend + Design)
F  Fees + Token          router/skim, ledger, buy-burn, tiers   (Backend + Contract)
G  Infra + Security      service, DB, monitoring, audit         (DevOps/Security)
H  Legal / Compliance    geo, KYC, ToS  ← runs alongside ALL    (Counsel + Rob)
```
H (legal) is **continuous and gating** — it starts Day 0 and never stops.

---

## 5. Phased delivery (≈16-week path to headline launch, hardening to ~22)

> Aggressive but credible for a focused team. Phases overlap. Each has a hard
> **exit gate** — we don't advance until it's met. Weeks are relative to kickoff.

### Phase 0 — Foundation & Spike · **Wks 1–3** · owners: Tech Lead, DevOps, Rob, Counsel
- Make the **Day-0 decisions** (section 7).
- Stand up the backend service + Postgres + CI/CD + secrets vault.
- **CLOB spike:** place + fill a **real $1 order** on a live market from the backend.
- Stand up **one managed MPC wallet**, deposit USDC, place a **policy-signed** order.
- Pin exact contract addresses, fees, min sizes, geo rules. Engage counsel.
- **EXIT:** real order placed + filled from our infra (both connect-wallet *and* MPC); custody vendor selected; legal engaged. ← *de-risks the entire program.*

### Phase 1 — Execution Engine + One-Click Trade · **Wks 3–7** · owners: Tech Lead, Frontend
- Production execution engine (build/sign/submit/cancel/positions, approvals, slippage).
- Web: connect Polygon wallet → **one-click trade ticket** on any market.
- **EXIT:** a user can place a real Polymarket trade from EDGE web, see the fill + position.

### Phase 2 — One-Click Copy · **Wks 6–9** (overlaps P1) · owners: Backend, Frontend
- Normalize the **copy signal** off the existing sharp feed.
- "Copy" on every Sharp Alert → pre-filled ticket (sizing defaults) → execute.
- **EXIT:** tap Copy on a sharp's live bet → it executes for the user. ← *the bridge.*

### Phase 3 — Telegram Bot v1 · **Wks 7–12** · owners: Bot Eng, DevOps
- `/start` → MPC wallet + deposit; `/wallet`, `/trade`, `/positions`, `/pnl`, `/withdraw`.
- Live sharp alerts → inline **[Copy $50] [Copy $100] [Custom]**; one-tap fills.
- **EXIT:** full manual + one-tap-copy trading from Telegram, funded by the bot wallet.

### Phase 4 — Auto-Copy Engine · **Wks 11–16** · owners: Tech Lead, Backend, Bot, Frontend
- Follow-rules (sizing, filters, risk caps) + the **keeper** (idempotent, retries, caps, kill switch).
- **Exit-mirroring** (copy reductions, not just entries) — built in, not bolted on.
- Surfaces on web + `/follow` in Telegram.
- **EXIT:** follow a wallet → its trades auto-mirror within caps, including exits. ← **flagship + launch.**

### Phase 5 — Fees + Token · **Wks 15–18** (overlaps P4) · owners: Backend, Contract
- bps fee skim + **fee ledger**; treasury → **buy + burn $EDGE**; publish on burns tracker.
- $EDGE **tier ladder** (lower fees / more follows / higher caps) + feature gating.
- **EXIT:** revenue live, fees burning $EDGE on-chain, tiers enforced.

### Phase 6 — Low-Latency + Hardening · **Wks 17–22** · owners: Tech Lead, Contract, Security
- **Low-latency signal push** (Polymarket WS + Alchemy webhook) → copies fill near the sharp's price.
- **ERC-4337 session keys** → non-custodial endgame (user keeps custody/withdrawal).
- **Security audit** (router + AA module + custody review), bug bounty, scale hardening.
- **EXIT:** audited, fast, production-grade.

---

## 6. Critical path & dependencies

```
Day-0 decisions ─► Phase 0 spike ─► Execution Engine ─┬─► One-Click Trade ─► One-Click Copy ─┐
   (custody +                       (A)                │                                      ├─► AUTO-COPY ─► Fees/Token ─► Hardening
    legal)                          Custody/MPC (B) ───┴─► Telegram Bot ────────────────────┘     (launch)
Legal/compliance (H) ───────────────────── runs in parallel, gates public launch ──────────────────────────►
```
**The two things that block everything: the custody decision and legal sign-off.**
Start both Day 0. Engineering can build to an abstraction (`signer` interface,
doc 01) so the custody vendor can be finalized in parallel with Phase 1.

---

## 7. Day-0 decisions (owner: Rob + Counsel — these unblock the team)

| # | Decision | Why it's blocking |
|---|----------|-------------------|
| 1 | **Custody model** — non-custodial (connect-wallet) / managed-MPC / AA session keys | Telegram + auto-copy *require* managed or AA. Drives security + legal scope. |
| 2 | **Regulatory & geo** — US strategy, geo-fence, which jurisdictions | Polymarket is CFTC-settled + US-geoblocked. Gates public launch. |
| 3 | **KYC/AML** — provider + thresholds | Triggered by custodial flows. |
| 4 | **Polymarket relationship** — ToS / builder program / relayer access | Affects fees + gasless UX + whether 3rd-party order flow is allowed. |
| 5 | **Vendors** — custody (Turnkey/Privy), host, DB, audit firm | Procurement lead time. |
| 6 | **Fee + tier numbers** — bps, $EDGE thresholds, burn split | Needed for Phase 5; model in Phase 0. |

---

## 8. Success metrics (what "winning" looks like)

- **Phase 0:** real order filled from our infra. (Binary.)
- **Launch (Phase 4):** copied volume/day, # active copiers, # auto-follow rules, fill quality (avg slippage vs sharp price), uptime.
- **Growth:** weekly copied volume, fee revenue, **$EDGE burned**, retained copiers (W2/W4), Telegram MAU, avg follower PnL vs benchmark.
- **North-star:** **$ copied volume/day** → it drives fees, burns, and token demand all at once.

---

## 9. Risk register (top)

| Risk | Owner | Mitigation |
|------|-------|-----------|
| Custody breach / key theft | DevOps/Security | MPC/TEE + policy engine + spend caps + withdrawal allowlist; no raw keys; audit |
| Regulatory action | Counsel/Rob | Counsel-led geo-fence + KYC; phase custodial features carefully |
| Keeper bug overtrades/drains | Tech Lead | Idempotency, caps, circuit breakers, dry-run mode, **kill switch** |
| Bad copy fills / slippage | Backend | FOK orders, slippage caps, skip-don't-chase, exit-mirroring |
| Polymarket ToS/API change | Tech Lead | Builder agreement; venue behind engine abstraction; monitor |
| Contract bug (router/AA) | Contract Eng | Audit + bug bounty + staged limits before real funds |

---

## 10. Immediate next actions (Week 1)

1. **Rob + Counsel:** kick off the Day-0 decisions — **custody model** and **geo/legal** first (they gate everything).
2. **Rob:** select + start procurement on custody vendor (Turnkey/Privy) + audit firm.
3. **Tech Lead + DevOps:** stand up the backend service repo, Postgres, CI/CD, secrets vault.
4. **Tech Lead:** begin the **CLOB spike** — place a real $1 order from a backend process this week.
5. **All eng:** read the companion specs (`01`–`05`); align on the `signer`/engine abstraction so custody can finalize in parallel.
6. **Backend:** define the Postgres schema (users, wallets, follow-rules, positions, trades, fee ledger).

---

## 11. Milestone calendar (summary)

| Milestone | ~Week | Proof |
|-----------|-------|-------|
| 🟢 Real order from our infra | 3 | $1 fill on live market (connect-wallet + MPC) |
| 🟢 One-click trade live (web) | 7 | trade Polymarket from EDGE |
| 🟢 One-click copy live | 9 | tap Copy on a sharp's bet → fills |
| 🟢 Telegram bot v1 | 12 | trade + one-tap copy from chat |
| 🚀 **Auto-copy — HEADLINE LAUNCH** | 16 | follow a wallet → auto-mirrors w/ exits |
| 🟢 Fees + $EDGE burn live | 18 | revenue + on-chain burns |
| 🟢 Audited + low-latency | 22 | session keys, WS fills, audit passed |

---

*The signal is the moat, and it's already live. This plan is how we turn it into the
most elite copy-trading platform in prediction markets. Let's build.* 🦅
