# r/EdgeTerminal — Welcome Post + Megathread Slate

Reddit values community-first language. Don't shill. Establish the room, set the rules, and let the megathreads be the conversion engine.

---

## Welcome post — pinned

**Title:** Welcome to r/EdgeTerminal — read this first

**Body:**

```
Welcome.

r/EdgeTerminal is the discussion forum for the $EDGE terminal — a real-time aggregator and intelligence layer for Polymarket and Kalshi.

This sub is for people who take prediction markets seriously: traders, researchers, election forecasters, sports-betting quants, anyone who's wired into the markets and wants a higher-signal room than the existing /r/PredictIt /r/PredictionMarkets crossover.

────────────────────────────────────

## WHAT WE DISCUSS

✓ Market analysis (Polymarket + Kalshi, all topics)
✓ Whale-flow observations — surface a wallet that just moved $50K, we'll dig in
✓ Divergence between price and sentiment (X / Reddit / Farcaster)
✓ Picker strategy + back-tests
✓ Tooling, APIs, scrapers, automation
✓ The $EDGE terminal itself — bug reports, feature requests, design crits

✗ Token shilling that isn't $EDGE
✗ Generic crypto pump posts
✗ "Wen lambo" or rocket emojis
✗ Posts without receipts (link the market, drop the chart, name the wallet)

────────────────────────────────────

## RULES

1. **Receipts in every post.** Link the market. Include a screenshot. Cite the wallet. "I think Trump-2028 is mispriced" is not a post. "Polymarket 0.51, Kalshi 0.42, whale 0xA3F2 +$640K, here's why" is.

2. **No DM scams.** Mods will never DM you about access, claims, or wallet verification. Anyone who does is impersonating us. Report and block.

3. **No off-topic shilling.** If your post is about a different token, project, or service unrelated to prediction markets, it gets removed. Repeat: ban.

4. **The picker track record is immutable.** Don't ask us to edit a bad call. The track record being public and uneditable is the point of the project.

5. **Mark resolved markets.** When a market settles, edit your post title with [RESOLVED — YES/NO] and the outcome.

6. **Be civil.** Disagree with the data, not the person.

────────────────────────────────────

## TOOLS

- Terminal: https://www.thepolyedge.com/
- Discord: discord.gg/edge
- X: @edgeterminal
- Token: $EDGE on Solana (CA drops at launch)

────────────────────────────────────

## FOUNDERS

- u/edgeterminal — an Trader (product, frontend)
- u/edgeterminal — an Trader (data, infra)

Brand-account flair on the mod account. AMA on the last Friday of every month.

Welcome aboard.
```

---

## Megathread slate — first 5

Pin each as it goes live. Keep one always-on (the "Daily" megathread); rotate the other four weekly.

### MEGA 1 — Daily Discussion Thread

**Title:** Daily Discussion Thread — what are you watching today?

**Body:**

```
The everyday conversation thread for r/EdgeTerminal.

Drop:
— Markets you're watching
— Whales you spotted on the tape
— Sentiment divergence you noticed
— Questions about the terminal, the picker, the data

Standalone posts are still encouraged for high-effort dossiers. This is for the small stuff.

(New thread auto-posted at 09:00 ET daily.)
```

### MEGA 2 — Picker Track Record (week of {date})

**Title:** Picker Track Record — Week of {date}

**Body:**

```
This week's calls from the public picker algorithm:

| Market | Direction | Entry | Resolution | Hit |
|---|---|---|---|---|
| TRUMP-2028 | YES | 0.51 | TBD | ⏳ |
| ... | | | | |

Methodology:
1. The algo flags every market where divergence ≥0.15 AND whale flow ≥$25K in the same direction.
2. Entry is recorded at the moment of flag. No edits.
3. Resolution is the market's settled outcome.

All historical picks are publicly viewable on the terminal at www.thepolyedge.com/picker.

Discuss this week's calls below. If you think the algo got something wrong, explain — we revise the model in the open.
```

### MEGA 3 — Whale Spotting

**Title:** Whale Spotting — drop wallets you've been watching

**Body:**

```
Post wallets that have shown unusual size or accuracy on Polymarket or Kalshi.

Format:
> Wallet: 0x...
> Venue: Polymarket / Kalshi
> Notable moves: [link to market + entry + size]
> Hit rate observation:
> What you think they know:

We add highly-cited wallets to the @edgeterminal watchlist for full-coverage alerts.
```

### MEGA 4 — Data, Tooling, API

**Title:** Data / Tooling / API — share what you're building

**Body:**

```
For anyone building on top of Polymarket / Kalshi / on-chain prediction-market data.

Drop:
— Datasets you've assembled
— Scrapers / APIs you're maintaining
— Notebooks you're publishing
— Issues with public endpoints (especially Polymarket's)

The $EDGE team will share what we use internally — including the divergence scoring methodology — as we open-source pieces. Watch this thread.
```

### MEGA 5 — Suggest a Market to Cover

**Title:** Suggest a Market — what should the terminal cover next?

**Body:**

```
The terminal's bot coverage is prioritized by community demand.

Post markets you'd like full coverage on:
— Whale-tape monitoring (≥$10K entries)
— Sentiment scoring (X + Reddit + Farcaster)
— Divergence alerts via webhook

Upvote others' requests. Top requests each week get added to coverage.

Currently covered: TRUMP-2028, FED-CUT-DEC, BTC-100K, NBA-CHAMP-2026, plus 200+ more on the live grid.
```

---

## Subreddit flair set

- **Market Analysis** — lime
- **Whale Spotted** — amber
- **Divergence** — magenta (rare!)
- **Picker Call** — green
- **Devlog** — muted
- **Resolved** — bone/white


## Post-flair requirements
- All posts must have a flair.
- "Market Analysis" requires a market link + screenshot.
- "Whale Spotted" requires a wallet address.
- "Divergence" requires both venue prices + a sentiment data point.
