# $EDGE — FREQUENTLY ASKED QUESTIONS

> Marketing OS · 06.07 · Launch Playbook
> Drop-in answers for Discord, Telegram, X replies, and the docs site.
> Voice: degen-confident, data-grounded. Never "to the moon." Never hype without receipts.
> Last updated: 2026-05-26

---

## PRODUCT

### 1. What is $EDGE?
$EDGE is the terminal for prediction markets. It pulls live Polymarket and Kalshi market data into one screen, tracks on-chain whale positions, and surfaces a proprietary divergence score that flags when public sentiment disagrees with where the actual capital is sitting. The product is live, free, and requires no signup. The token is the optional second layer that unlocks premium features.

### 2. Is it free to use?
Yes. The core terminal — markets hub and whale tracker — is free, requires no signup, and requires no wallet connection. We believe the base layer should be open so traders can actually see what we built before they decide if they want the premium signal layer. Premium features (whale alerts, divergence radar, raw API, insider channel) are gated by $EDGE token holdings.

### 3. Do I need a wallet to use it?
Not for the free terminal. You can hit thepolyedge.com right now and see live Polymarket + Kalshi data, whale wallet positions, and recent flow without connecting anything. A wallet is only needed once you want to hold $EDGE for premium tier unlocks — and even then, we read your balance, we never request signatures or move funds.

### 4. What's the difference between $EDGE and Polymarket itself?
Polymarket is a venue — you place trades there. $EDGE is a terminal that sits *above* Polymarket (and Kalshi, and on-chain whales, and public sentiment) and gives you the cross-platform view none of the individual venues provide. We don't compete with Polymarket. We make Polymarket users smarter before they bet.

### 5. What's the Arbitrage Radar?
The Arbitrage Radar is a live cross-platform scanner that compares every active Polymarket market against every active Kalshi market, finds same-event pairs via token-overlap matching, and computes whether **YES on one side + NO on the other** clears $1.00 after a 2% fee buffer. If it does, an arbitrage exists. Opportunities are ranked by fee-adjusted edge and badged HIGH (≤5pp), MEDIUM (5-8pp), or VERIFY (8-12pp). Anything above 12pp is filtered as a likely matching error. Real arbs in liquid markets are typically 1-5% — verify titles match before executing, and remember that slippage on $500+ stakes is real. Live at `/arb.html`, unlocks at the Analyst (1M) tier.

### 6. What's the divergence score?
It's our proprietary metric for "the public is saying one thing, but the smart money is doing another." We normalize market price action, whale flow, and sentiment velocity from X / Reddit / forums, then surface the gap as a ranked score per market. When the score blows out, the radar fires. Every fire is logged publicly so the track record is auditable forever.

### 7. Where does the sentiment data come from?
X, Reddit, and prediction-market-adjacent forums today, with more sources rolling in over time. We normalize for volume, polarity, and velocity per market before scoring. The pipeline is built on public data only — we don't scrape paywalled or DM content, and we don't pretend to read minds. We read what people are saying loudly and visibly.

### 8. Will you support more markets beyond Polymarket and Kalshi?
Yes — that's the roadmap. Polymarket and Kalshi are the two largest English-language venues, so they're the obvious first wedge. Next up: smaller liquid venues, sports-specific contracts, and eventually B2B feeds where institutions want our aggregated view as a primary source. Holders vote on priority through governance signals.

### 9. Is there a mobile app?
Not yet. The web product is mobile-responsive and works in a phone browser today. A native app is on the roadmap post-launch, prioritized by holder demand. We'd rather ship a brilliant web terminal first and a native app second than do both half-right.

---

## TOKEN

### 10. Why a token?
Two reasons. First, gated utility — premium features (alerts, radar, API, insider channel) need a way to allocate scarce attention and infra cost, and a token-balance check is cleaner than email signups or subscriptions. Second, alignment — the people who use the product own a piece of it, and we accrue value to them rather than to a venture-fund waterfall. The token is the contract between us and our users.

### 11. What's the supply?
1,000,000,000 (one billion) $EDGE total. Fixed. No inflation, no minting key, no future printer. **100% enters the open market via the pump.fun bonding curve** — no presale, no private round, no team allocation. When the curve reaches ~$69K market cap, liquidity migrates automatically to Raydium with $12K of LP burned permanently at migration.

### 12. What does holding $EDGE unlock?
Tiered utility on the terminal: **Free (0)** gives you the public dashboard, hot markets, buzz heat, delayed whale firehose, and Rug Radar basic. **Trader (100K)** unlocks real-time whale alerts, custom firehose thresholds, watchlists, Rug Radar deep, and Buzz market drilldown. **Analyst (1M)** unlocks the Divergence Radar, the **Arbitrage Radar**, the public track-record dashboard, larger watchlists, API access, and push + webhook alerts. **Desk (5M)** unlocks custom backtesting, unlimited priority API, unlimited watchlists, affiliate revenue share, and governance vote weight. Tiers map to real cost-to-serve.

### 13. How do I buy?
On launch day, $EDGE goes live on pump.fun on Solana. You'll need a Solana wallet (Phantom, Backpack, etc.) and some SOL. We'll publish the contract address from our official X and Discord at launch — never trust any address from a DM or a reply. Confirm against the pinned post on @edgeterminal before you swap.

### 14. What's the launch venue?
pump.fun on Solana. We chose pump.fun because it's the cleanest path to a true fairlaunch — no allowlists, no presale, no team-priority allocations, and the bonding-curve mechanic means the same buy at the same time gets the same price for everyone. Once we graduate to a Raydium pool, that LP is timelocked for 12 months on-chain.

### 15. Is there a presale or private round?
No. No presale, no private round, no allowlist, no team-priority allocation. 100% of supply enters the open market on the pump.fun bonding curve. Anyone associated with the project who wants tokens buys them on the same curve at the same prices at the same time as you.

### 16. Is liquidity locked?
At the migration point (~$69K market cap), the bonding curve graduates to a Raydium pool with **$12K of liquidity burned permanently** — sent to a verifiable burn address, irrecoverable forever. This is a stronger guarantee than a timelock: timelocks unlock; burns don't.

### 17. Is there a team allocation?
**No.** 0% of supply is allocated to the team. 100% of supply enters the open market via the pump.fun bonding curve. Anyone associated with the project who wants tokens buys them on the same curve as everyone else. No vesting, no cliff, no insider terms.

### 18. What if pump.fun goes down?
The token doesn't depend on pump.fun's UI to exist — once it's deployed on Solana, the contract lives on-chain forever and trades anywhere with a market. If pump.fun has an outage on launch day, you can still interact with the contract directly through Jupiter, Phantom, or any Solana DEX aggregator. We publish the contract address through multiple channels at launch precisely to avoid single-point-of-failure dependence.

### 19. Will $EDGE be listed on a CEX?
Tier-1 listings are an explicit post-launch goal, not a day-one promise. We won't pay a CEX for a listing — the path is organic volume + holder count + product traction earning the listing on merit. We're in conversations with several top-10 venues already. When a listing is confirmed, we announce; until then, assume the answer is "in progress, no ETA."

---

## SECURITY

### 20. Is my wallet safe using $EDGE?
Yes. The terminal is read-only — we never request signatures, never request transactions, never request seed phrases. The base product works without a wallet at all. If you do connect a wallet for tier features, we only read your public token balance. Anyone asking you to "verify your wallet" or "claim a bonus" via DM is a scammer. We never DM first.

### 21. Is there a multisig?
Any post-launch operational wallet — for paying service providers, hosting infrastructure, or funding KOL campaigns — is held in a Solana multisig requiring multiple signers. Single-signer custody on project funds is unacceptable and we don't do it. Multisig addresses are published when funded.

### 22. Is the smart contract audited?
The $EDGE token contract is the standard pump.fun token contract — there is no custom smart contract logic written by us. That standard contract is widely deployed, widely reviewed, and used by every token on the platform. We did not introduce any custom on-chain logic that could carry novel risk. The vesting and lock contracts we use are also industry-standard third-party tooling.

### 23. How do I report a security vulnerability?
Email **cashbridgehomes@gmail.com** with details. We respond within 24 hours and credit responsible disclosure publicly (with your consent). For critical issues — anything that could affect funds, tokens, or user data — please do not post publicly until we've confirmed receipt and shipped a fix.

---

## LEGAL

### 24. Is $EDGE a gambling product?
No. $EDGE is an information terminal. We aggregate publicly available market data, on-chain data, and public sentiment data. We do not operate a betting venue, we do not custody bets, and we do not facilitate wagers. Users place trades on Polymarket or Kalshi directly through those venues, which carry their own licenses and jurisdictional rules.

### 25. Is the $EDGE token a security?
We have structured the token explicitly as a utility token — it unlocks tiered access to terminal features, with no profit-sharing claim, no dividend, no equity right, and no promise of investment return. The fairlaunch mechanic with no presale and no priority team allocation aligns with utility-token norms. That said, securities law is fact-specific and jurisdiction-specific, and nothing here is legal advice — consult your own counsel for your own situation.

### 26. What jurisdictions are restricted?
The terminal is geo-blocked from US-sanctioned jurisdictions (OFAC list) and from any jurisdiction where prediction-market aggregation tooling is explicitly prohibited. We do not market or offer the token to residents of jurisdictions where the offering would be unlawful — including any jurisdiction that classifies utility tokens as securities without explicit exemption. Check your local rules.

### 27. Are you SEC-registered?
No. We are not registered with the SEC, FINRA, CFTC, or any other financial regulator, and we do not provide investment advice. The terminal provides market data and analytics; the token is utility-only. Any decision to use the product, hold the token, or trade on the venues we link to is your own. Do your own research. Talk to your own lawyer and tax advisor for your situation.

---

## NOT IN THE FAQ?

If your question isn't covered:
- General: cashbridgehomes@gmail.com
- Press: cashbridgehomes@gmail.com
- Partnerships: cashbridgehomes@gmail.com
- Security: cashbridgehomes@gmail.com
- Community: Discord — discord.gg/edgeterminal

###
