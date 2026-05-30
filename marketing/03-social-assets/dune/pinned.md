# Dune — First 5 Public Dashboards

Dune is a credibility surface. Don't post one giant kitchen-sink dashboard — post five focused ones. Each pins a specific question; each has open SQL the reader can audit; each links back to the terminal.

---

## 01 — Polymarket Whale Leaderboard

**Slug:** `dune.com/edge/polymarket-whales`

**One-liner:**
> Top wallets on Polymarket by 24h / 7d / 30d notional volume, with historical hit-rate.

**Charts (left → right, top → bottom):**
1. Top 20 wallets by 24h notional (horizontal bar)
2. Top 20 wallets by 7d notional (horizontal bar)
3. Cumulative volume of top 20 vs everyone else (stacked area, time series)
4. Hit-rate distribution of top 100 wallets (histogram)
5. Wallet-level resolution accuracy: for each top wallet, % of their entries that resolved in their direction (table)
6. Time-series for selected wallets: cumulative PnL over the last 90d (multi-line chart)

**Filter controls:**
- Wallet address (single-select)
- Market (multi-select)
- Date range
- Minimum entry size

**Cross-link:** "Watch these wallets in real time on $EDGE → www.thepolyedge.com/whales"

---

## 02 — Kalshi Flow Tape

**Slug:** `dune.com/edge/kalshi-flow`

**One-liner:**
> Real-time tape of Kalshi event-contract trades, grouped by market category (politics / macro / climate / sports).

**Charts:**
1. 24h volume by category (treemap)
2. Top 10 markets by 24h volume (bar)
3. Top 10 markets by 7d volume change (bar, color = direction)
4. Per-market price chart: last 30 days, with annotated >$50K entries (multi-line + markers)
5. Volume vs open-interest ratio per market (scatter)

**Filter controls:**
- Category
- Specific market
- Date range
- Minimum trade size

**Note:** Kalshi doesn't expose chain data; this dashboard pulls from Kalshi's public REST API into a Dune-uploaded table, refreshed every 5 minutes.

**Cross-link:** "Get Kalshi alerts via $EDGE → www.thepolyedge.com/kalshi"

---

## 03 — Divergence Leaderboard

**Slug:** `dune.com/edge/divergence-leaderboard`

**One-liner:**
> Cross-venue + sentiment divergence for every overlapping Polymarket × Kalshi market.

**Charts:**
1. Top 20 markets by current cross-venue price gap (Polymarket − Kalshi)
2. Top 20 markets by Money/Mouth divergence — defined as |price_Polymarket − sentiment_X|
3. Combined divergence × volume scatter — markets in the top-right quadrant are the highest-conviction signals
4. Time-series of divergence on a selected market (line chart with both venues + sentiment overlay)
5. Resolution table: of markets that crossed divergence ≥0.15 in the last 30 days, what % resolved in the "money" direction (the picker's empirical hit rate)

**Filter controls:**
- Market
- Divergence threshold
- Whale-flow filter (only show markets with ≥$25K whale entry in last 24h)

**Cross-link:** "Live divergence radar → www.thepolyedge.com/divergence"

---

## 04 — Election Markets Aggregate

**Slug:** `dune.com/edge/election-2028`

**One-liner:**
> Every 2028 US election market (Polymarket + Kalshi), normalized to comparable units, with rolling cross-venue arbitrage and historical event-driven moves.

**Charts:**
1. Big-board snapshot: each market shown as a card with Polymarket price, Kalshi price, divergence, 24h change, volume
2. Trump-2028 timeline (multi-line, last 180 days) with whale-entry markers
3. Top 5 election sub-markets by volume (treemap)
4. Sentiment heat over time: X / Farcaster / Reddit sentiment vs price (overlaid)
5. Cross-venue arbitrage table: rows = market, cols = max gap last 7d, time since gap >0.05, current gap

**Cross-link:** "Open the live grid → www.thepolyedge.com/election-2028"

---

## 05 — $EDGE Token & Holder Metrics

**Slug:** `dune.com/edge/edge-token`

**One-liner:**
> Real-time holder count, distribution, and on-chain activity for the $EDGE token on Solana.

**Charts:**
1. Total holders over time (area)
2. Top 100 holders (table with wallet, balance, % of supply, first-seen date)
3. Holder concentration: Gini coefficient + top-10 / top-100 / rest split (pie)
4. Daily on-chain transfer volume (bar)
5. New holders per day vs net token outflow from the LP (dual-axis line)
6. Holder cohort retention: % of wallets that held N days after first acquisition (cohort chart)

**Cross-link:** "Token page → www.thepolyedge.com/token"

---

## Publishing notes
- Each dashboard's first chart should be the headline chart — Dune previews the first chart in social embeds.
- Each dashboard description ends with: "All queries public. Fork at will. Methodology: github.com/edgeterminal/dune-queries."
- Pin the divergence leaderboard (#03) to the profile — it's the most differentiated dashboard and the strongest conversion to the terminal.

## Cross-promo cadence
- Post a Dune chart screenshot to X every Friday with the dashboard link.
- Embed the divergence leaderboard live on the $EDGE site's "research" page.
- Submit each dashboard to Dune's curated "Featured" track within 24h of publishing.
