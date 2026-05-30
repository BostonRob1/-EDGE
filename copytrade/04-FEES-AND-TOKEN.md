# 04 — Fees & the $EDGE Flywheel

How the suite makes money, and how that money makes $EDGE scarcer. This is where
copy-trading becomes the **demand engine for the token** — far bigger than the
current affiliate model.

## Fee models (use a combo)

| Model | Mechanism | Pros | Cons |
|-------|-----------|------|------|
| **A. Per-trade bps** | Skim e.g. **0.5–1.0%** of each copied/traded notional | Scales with volume; "free to start" | Needs the managed/router flow to capture (doc 01) |
| **B. Subscription / token-gate** | Pay in $EDGE (or fiat) to unlock auto-copy, more follows, higher caps | Recurring; zero contracts; works with non-custodial | Caps upside vs. volume fees |
| **C. Performance fee** | X% of *profits* on auto-copy (high-water mark) | Aligned; lucrative on winners | Custodial/vault; heaviest regulatory |

**Recommended launch:** **A + B.** A small per-trade fee on every execution (the
volume engine) **plus** a token-gated tier ladder (the recurring + token-demand
engine). Add C only if/when a custodial vault product is greenlit.

## How the fee is captured

- **Managed / Telegram (Model B custody):** trivial — the bot controls the wallet,
  so it deducts the fee from the trade notional at execution and routes it to the
  treasury. No extra contract needed.
- **Web connect-wallet (Model A):** can't skim a CLOB trade directly. Either (a)
  gate the feature behind a $EDGE subscription (no per-trade fee), or (b) route the
  user's trade USDC through a thin **EDGE router contract** that takes the fee then
  funds the order. Router = one small audited contract.

## The buy-and-burn loop (ties into the existing deflationary design)

This plugs straight into `reference_edge_deflationary_design` — **50% of affiliate
revenue already buys + burns $EDGE.** Copy-trading fees become a far larger inflow
to the *same* mechanism:

```
copy/trade volume → fee (USDC) → treasury
                                   ├─ 50% market-buy $EDGE → BURN (on-chain, public tracker)
                                   └─ 50% operations
```

Every trade anyone copies makes $EDGE rarer. The more the product is used, the
faster the burn. Publish it on the existing burns tracker (`burns.html`) — the
copy-fee burn becomes the headline number.

## The tier ladder (token utility — reuse the existing tokenomics)

Hold $EDGE → better terms. Maps onto the tier thresholds already in the tokenomics
(`project_edge_marketing_os` / token.html). Illustrative:

| Tier | Hold | Auto-copy slots | Per-trade fee | Caps |
|------|------|-----------------|---------------|------|
| Free | 0 | 0 (manual one-click only) | 1.0% | low daily cap |
| Holder | 100K | 1 follow | 0.6% | medium |
| Analyst | 1M | 5 follows | 0.4% | high |
| Desk | 5M | unlimited follows + priority keeper | 0.2% | custom |

So $EDGE buys **lower fees + more auto-copy + higher caps + priority execution**.
That's hard token utility tied to real revenue — the strongest demand driver the
project has.

## Revenue math (illustrative, to size the prize)

```
copied volume / day      fee 0.7%      monthly fee
   $250k                  $1,750        ~$52k
   $1M                    $7,000        ~$210k
   $5M                    $35,000       ~$1.05M
```
Telegram bots in hot categories routinely clear seven figures/yr in fees on
comparable volume. Half of every dollar burns $EDGE. (Numbers illustrative — model
real assumptions in Phase 0.)

## Notes

- Always show the fee **inline before confirm** ("fee $0.20") — trust > hidden bps.
- Keep a **fee ledger** in Postgres (per trade, per user) reconciled to on-chain
  buy+burn txs for the public tracker.
- Free tier should still feel great (manual one-click copy) so the funnel is wide;
  auto-copy is the paid wedge.
