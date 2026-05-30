# 03 — Telegram Trading Bot

The whole suite, in a chat. This is the genre that mints money (Banana Gun,
Maestro, BONKbot do millions/mo in fees) and **nobody has built the good one for
Polymarket.** Standard for the genre = **managed wallet** (Model B/C, doc 01): the
bot signs on the user's behalf so every action is one tap.

## UX spine

```
/start → bot creates a managed (MPC) wallet → shows Polygon USDC deposit address
       → user funds → instantly: alerts + one-tap trading + auto-copy
```

The magic moment: a sharp bets, the bot pushes a message, the user taps **[Copy $100]**,
done — funded from their bot wallet, no app, no signing, no gas. That's the product.

## The live alert → inline copy (the killer loop)

Every tracked sharp trade (from the copy-engine signal) becomes a push:

```
🦅  swisstony  ·  #4 all-time · +$9.2M
    BUY  YES  ·  $42,000  @ 31¢
    "Will the Fed cut rates in June 2026?"

   [ Copy $50 ]  [ Copy $100 ]  [ Copy $250 ]
   [ Custom $ ]  [ Auto-follow swisstony ]  [ Ignore ]
```

Tap a Copy button → keeper sizes/risk-checks/executes from the user's wallet →
reply: `✅ Filled YES $100 @ 31¢ · fee $0.20 · /positions`. Tap **Auto-follow** →
creates a FollowRule so all of swisstony's future trades auto-copy.

## Commands

| Command | Does |
|---------|------|
| `/start` | Onboard, create wallet, show deposit |
| `/wallet` | Balance, deposit address, **/withdraw** (allowlist + confirm) |
| `/follow <name\|0x> [size]` | Auto-copy a sharp (opens the rule editor) |
| `/unfollow <name>` | Stop auto-copying |
| `/following` | List active follows + their PnL |
| `/settings` | Default sizing, risk caps, slippage, alert filters |
| `/positions` | Open positions + live PnL |
| `/pnl` | Realized/unrealized, today + all-time |
| `/trade` | Manual: search market → BUY/SELL → size → confirm |
| `/alerts on\|off` | Toggle sharp-alert pushes (+ min size / category filters) |
| `/leaderboard` | The Hall of Fame, in chat — tap a wallet to follow |

## Auto-copy from chat

`/follow swisstony` → inline editor: sizing (`$50` / `10% of his bet` / `2% of bankroll`),
max per trade, daily cap, slippage, categories. Confirm → live. Every future
swisstony trade: keeper executes, bot notifies. `/following` shows each rule's
running PnL so users prune losers.

## Architecture

- **Framework:** Node + **grammY** (or Telegraf), **webhook** mode (not long-poll)
  behind the backend service.
- **Shares everything with the web app:** same execution engine (01), copy engine
  (02), Postgres, custody provider. Telegram is just another client — a user row
  can have a `telegramId` and/or a web session; same wallet, same follows.
- **Managed wallets:** created via the MPC/embedded provider on `/start`; policy
  engine caps each to Polymarket contracts + per-tx spend limits (doc 01/05).
- **Withdrawals:** the one sensitive action — require a confirm step, an
  allowlisted address, and optionally a small time-delay / 2FA. Never one-tap.
- **Notifications:** the keeper emits copy fills + the signal stream pushes alerts;
  rate-limit per user; respect `/alerts` filters.

## Anti-abuse / safety

- Per-user rate limits; CAPTCHA-style gate on `/start` to deter bot farms.
- Hard per-wallet + global exposure caps enforced server-side (never trust the
  client).
- Clear, persistent disclaimers (not financial advice; you can lose funds; geo).
- Kill switch that disables new orders bot-wide instantly.

## Why it compounds the web product

Same backend, two front-doors. Telegram brings the degen distribution + virality
(share an alert, "look what swisstony just did → copy it"); the web app brings the
depth (Hall of Fame, Eagle Eye, analytics). Both feed the same fee engine (doc 04).
