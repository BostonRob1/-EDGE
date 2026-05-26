# Medium — First Article

The first article is the publication's mission statement. Medium readers expect long-form essays, not pitch decks. The thesis is the product; the product is mentioned at the end.

---

## Article 1 — Pinned to the publication

**Title:**
> Money, Mouth, and the Edge Between Them

**Subtitle / standfirst:**
> Why prediction markets out-call the pollsters, and how the gap between price and sentiment became the cleanest trade signal we have.

**Tags:**
`prediction markets · polymarket · kalshi · trading · finance · politics · data · web3`

**Cover image:**
`banner.svg` (1500×750)

**Reading time target:** 9–12 minutes (~2200 words).

---

## Abstract (the opening hook — also used as Medium's preview)

```
In November 2024, Polymarket's Trump-Harris price moved hours before the networks called the race. By the time CNN ran the chyron, $4M had already crossed the book on the outcome the polls said was a coin flip.

This was not a fluke. It was a phase shift. Prediction markets — for the first time in their thirty-year flirtation with the mainstream — became the source.

We've spent the last six months building the terminal we wanted to use for these markets. What follows is the thesis behind it.
```

---

## Outline

### I. The pollsters lost the network
- A short history: Iowa Electronic Markets → PredictIt → Polymarket → Kalshi
- The 2024 case study: timeline of Polymarket movement vs network calls
- Why incentivized capital beats sampled survey opinion
- Why the volume curve is now self-reinforcing

### II. What "Money" means in a prediction market
- The Polymarket order book mechanics
- Kalshi's CFTC-regulated event contracts
- Wallets and whales: the FX-desk-tape analogy
- Why wallet-level transparency is structurally different from equities

### III. What "Mouth" means
- Aggregated sentiment scoring (X, Farcaster, Reddit)
- The lag between mouth and money
- Why "the crowd" on social media is systematically less informed than the wallets on Polymarket
- Method: how we score sentiment-divergence (high-level, not the trade-secret bit)

### IV. The Edge — divergence as signal
- Defining divergence: |price_money − price_mouth|
- Historical hit-rate of high-divergence + whale-aligned setups
- Worked example: Trump-Powell, divergence +0.72, whale flow +$640K, outcome
- The picker algorithm in plain English
- Why the track record is immutable

### V. What we built (the product mention — keep this short)
- The terminal: Polymarket + Kalshi grid, whale tape, divergence radar, picker
- Token: $EDGE on Solana — gates real-time webhooks and push, not the basic terminal
- Where to start: edge-two-psi.vercel.app

### VI. What we're not (defensive paragraph)
- Not a brokerage. Not a custodian. Not an advisor.
- The terminal is intelligence; the trade is yours.

### Closing
> The pollster era ended in 2024. We don't yet have the Bloomberg for what replaced it. We're going to build it. Field notes here every two weeks.
>
> — Robert Noejr + Tye

---

## Subscriber CTA (Medium's native subscribe widget)

```
Subscribe to $EDGE / Notes for field notes from the edge of prediction markets — every other Tuesday.
```

---

## Follow-up article slate (next 5)

| # | Working title | Format | Length |
|---|---|---|---|
| 2 | Anatomy of a Polymarket whale: 0xA3F2 and the Trump-Powell trade | Dossier | ~1800w |
| 3 | Sentiment divergence: a worked playbook | Tutorial | ~2200w |
| 4 | Kalshi vs Polymarket: how to read cross-venue arbitrage | Reference | ~1500w |
| 5 | Devlog 001: shipping the divergence radar | Founder log | ~1200w |
| 6 | What prediction markets get wrong (and why that's the trade) | Essay | ~2400w |

Publish cadence: every other Tuesday. 06:00 ET (US morning + UK lunch window).
