# 02 — Copy Engine

Turns a sharp's trade into a follower's trade. This is where our existing
intelligence stack becomes the product.

```
SHARP TRADES  →  SIGNAL  →  match to FOLLOW-RULES  →  SIZE  →  RISK CHECK  →  EXECUTE  →  notify
 (Polymarket)   (detect)     (per follower)         (per rule)  (caps)       (engine 01)  (web/TG)
```

## 1. Signal — detecting the sharp's trade

We already detect sharp trades by cross-referencing the firehose against the KV
roster (`api/whales/smart-money` + `lib/whales/sharp.js`). For *watching* that's
fine. **For copy trading, latency is money** — the faster we see the sharp's
trade, the closer our copy fills to their price. Two upgrades, in order:

- **Now:** reuse the existing poll (≈4s). Acceptable for v1 (markets rarely move
  in 4s on the events sharps trade).
- **Phase 6:** a dedicated **low-latency watcher** — Polymarket's trade WebSocket
  and/or an Alchemy address webhook on the tracked wallets — emits a signal in
  ~1s. This is the "fill at the sharp's price" upgrade and the real edge.

A signal is normalized to:
```ts
{ sharpWallet, sharpName, credRank, credPnl, tokenId, marketSlug, marketTitle,
  side: 'BUY'|'SELL', outcome, sharpPrice, sharpSizeUsd, ts, txHash }
```

## 2. Follow-rules — what a user wants to copy

Stored per `(user, target)` in Postgres. The control surface for both web + TG:

```ts
FollowRule {
  user, targetWallet,                  // who to copy (one of our tracked sharps)
  enabled,
  sizing: { mode: 'fixed'|'pctOfSharp'|'pctOfBankroll', value },  // $50 | 10% of their bet | 2% of my balance
  filters: {
    minSharpPnl?, markets?: ('politics'|'crypto'|'sports'|…)[],   // only copy certain categories
    minTradeUsd?, maxTradeUsd?,         // ignore dust / cap whales' size
    sides?: ('BUY'|'SELL')[],           // copy entries only, exits only, or both
    priceCeiling?,                      // don't chase if odds already > X¢
  },
  risk: {
    maxPerTradeUsd, maxDailyUsd, maxOpenExposureUsd,
    maxSlippageBps, stopLossPct?, dailyLossLimitUsd?,
  },
}
```

## 3. Sizing

Given a signal + rule:
- `fixed` → `sizeUsd = rule.value` (e.g. always $50).
- `pctOfSharp` → `sizeUsd = sharpSizeUsd * value` (mirror proportionally, capped).
- `pctOfBankroll` → `sizeUsd = followerBalance * value`.
Then clamp by `min/maxTradeUsd`, `maxPerTradeUsd`, remaining `maxDailyUsd`, and
remaining `maxOpenExposureUsd`. If the clamped size is below Polymarket's
min order, **skip + notify** ("too small after caps").

## 4. Risk gate (before every execution)

Hard checks; any failure → skip + notify, never silently swallow:
- balance ≥ sizeUsd (+ fee)
- daily spent + sizeUsd ≤ maxDailyUsd
- open exposure + sizeUsd ≤ maxOpenExposureUsd
- slippage: marketable price within `maxSlippageBps` of `sharpPrice` — **else skip**
  (don't chase a moved market)
- global kill switch off; market not in user blacklist; not a duplicate copy
- daily PnL ≥ -dailyLossLimit (circuit breaker)

## 5. Keeper

An always-on worker that consumes signals and fans them out to followers.

```
for each signal:
  rules = followRulesForTarget(signal.targetWallet, enabled=true)
  for each rule (in parallel, bounded):
     size = sizing(signal, rule)
     if !riskGate(rule, size, signal) → log+notify skip; continue
     order = engine.placeOrder({ user: rule.user, tokenId: signal.tokenId,
                                 side: signal.side, sizeUsd: size,
                                 maxSlippageBps: rule.risk.maxSlippageBps })
     record(order); notify(rule.user, order)   // web push + TG message
```
Requirements: **idempotent** per `(signalId, user)`, retries with backoff on
transient CLOB errors, partial-fill handling, and a **global pause** flag the ops
team can flip instantly.

## 6. One-click copy (manual)

The non-auto path. The UI (web) or bot (TG) shows a detected sharp trade with a
**Copy** action → opens a pre-filled ticket (market, side, suggested size from the
user's default sizing) → user confirms → `engine.placeOrder`. Same sizing/risk
helpers, just human-in-the-loop. This is Phase 2 and the lowest-risk way to prove
the whole bridge before turning on the keeper.

## 7. Exits (the part copy products get wrong)

Copying entries is easy; **copying exits is the alpha.** When a followed sharp
**sells/reduces** a position the follower also holds, mirror the exit (sell the
same %). Track which follower positions originated from which sharp so exits map
cleanly. Without this, followers ride winners up and never take profit. Build exit-
mirroring into Auto-Copy from day one (Phase 4), not as an afterthought.

## Surfaces this powers

- **Web:** a "Copy" button on every Sharp Alert row + tape; an Auto-Copy settings
  panel (the FollowRule form); a "Following" dashboard with live copied positions.
- **Telegram:** inline `[Copy $50] [Copy $100] [Custom]` on every alert; `/follow`
  to set a rule; `/positions`, `/pnl`. See doc 03.
