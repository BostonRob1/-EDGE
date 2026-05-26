# $EDGE — 2-Hour Handle Reservation Sprint

> **Goal:** Reserve every P0 + P1 social handle, lock all primary domains, and stand up a custom-domain email loop in **120 minutes flat.** Run end-to-end without context switches. Two people max — one driver, one verifier.
>
> **Pre-flight (do these 24h before sprint):**
> 1. Create 1Password vault `EDGE-Launch`. Share with Tye.
> 2. Buy a fresh SIM or Google Voice number reserved for the brand (`+1-XXX-XXX-XXXX`). Many platforms now require SMS at signup.
> 3. Generate a 24-char password in 1Password as the **default password** for every account in this sprint. Field: `EDGE_DEFAULT_PWD`. (You'll rotate per-platform later; speed matters today.)
> 4. Decide on the founders' Gmail as a **temporary** signup address: `edgeterminal.launch@gmail.com`. Switch all aliases to `hello@edgeterminal.xyz` once the domain is live in step 8.

---

## BLOCK 1 — DOMAINS + EMAIL FOUNDATION  (0:00–0:20)

### Step 1 — Cloudflare Registrar account + buy domains  (0:00–0:08)
- **URL:** https://dash.cloudflare.com/sign-up
- **Email:** `edgeterminal.launch@gmail.com`
- **Password:** `EDGE_DEFAULT_PWD` from vault
- **Action:** Sign up → enable 2FA via authenticator (NOT SMS, for the org account) → Domains → Register → buy in one cart:
  - `edgeterminal.xyz` (primary)
  - `edgeterminal.io`
  - `edge.markets`
  - `getedge.xyz`
  - `theedge.xyz`
  - Add `edgeterminal.com` if not premium-priced; otherwise queue manual sniping later
- **Gotcha:** Cloudflare Registrar passes through ICANN price at cost — cheaper than Namecheap. But `.markets` is third-party-resold; expect ~$50/yr.

### Step 2 — Cloudflare Email Routing on edgeterminal.xyz  (0:08–0:14)
- **URL:** https://dash.cloudflare.com → edgeterminal.xyz → Email → Email Routing
- **Action:** Enable. Add destination addresses: Robert's personal Gmail + Tye's personal Gmail. Verify both. Then create routing rules:
  - `hello@` → both founders
  - `founders@`, `press@`, `partnerships@`, `legal@`, `security@`, `abuse@`, `dmca@`, `careers@`, `support@` → both founders (split later)
  - Catch-all → Robert
- **Gotcha:** Routing rules require MX + TXT verification records (auto-set by Cloudflare since you bought the domain there). Takes ~2 min to propagate.

### Step 3 — Resend account + verify domain  (0:14–0:20)
- **URL:** https://resend.com/signup
- **Email:** `hello@edgeterminal.xyz` (now live from step 2)
- **Action:** Add domain `edgeterminal.xyz`. Copy the SPF, DKIM, DMARC records → paste into Cloudflare DNS. Use subdomain `mail.edgeterminal.xyz` for sending so the apex stays clean.
- **Gotcha:** DMARC requires `p=none` for the first 7 days to avoid mass-bouncing your early sends. Bump to `quarantine` later.

---

## BLOCK 2 — SOCIAL P0  (0:20–1:10)

### Step 4 — X / Twitter  (0:20–0:28)
- **URL:** https://x.com/i/flow/signup
- **Email:** `hello@edgeterminal.xyz`
- **Phone:** burner SIM or Google Voice
- **Handle:** try `@edgeterminal` → fallback `@edgemarkets` → `@edge_terminal` → `@theedgeterminal` (in order, do NOT skip)
- **Display name:** `$EDGE` (the dollar sign + caps — X allows this)
- **Bio:** placeholder from `bios-master.md` 160-char variant 1
- **Action:** Confirm email. Enable 2FA via authenticator. Apply for X Premium (Robert pays; reimburse from treasury) — unlocks 4K char + analytics + edit.
- **Gotcha:** X aggressively bans new signups on shared IP. If banned at first signup, file an appeal AND try from a different IP (mobile hotspot works). Do not retry-spam.

### Step 5 — Telegram Announce + Community  (0:28–0:38)
- **URL:** Telegram app → New Channel
- **Action — Announce Channel:**
  - Name: `$EDGE — Announce`
  - Username: `@edgeterminal`
  - Type: Public broadcast (subscribers can't write)
  - Description: 160-char bio variant
  - Photo: PFP from `03-social-assets/`
- **Action — Community Group:**
  - Name: `$EDGE — Chat`
  - Username: `@edgeterminal_chat`
  - Type: Public group
  - Permissions: media off for first 48h, slowmode 5s, link previews off
  - Add **Rose** or **Combot** for anti-scam (auto-ban known scam phrases like "DM the admin")
- **Pin in announce:** "We will NEVER DM you first. Verify the gold checkmark."
- **Gotcha:** Telegram requires a phone number per account. Use the burner SIM. The phone number is hidden from public, but the account is bound to it forever — losing the SIM = losing the account. Photograph the SIM card + back up SMS to a second device.

### Step 6 — Discord  (0:38–0:46)
- **URL:** https://discord.com/register
- **Email:** `hello@edgeterminal.xyz`
- **Username:** `edgeterminal`
- **Action:**
  - Create server "$EDGE Terminal"
  - Roles: `founder` (admin) · `mod` · `holder` · `whale` (gated later) · `bot`
  - Channels: `#announce` (read-only) · `#general` · `#signals` · `#whales` · `#dev` · `#bugs`
  - Vanity URL: claim `discord.gg/edgeterminal` (requires Boost level 3, queue this)
  - Verification: phone-verify required for new joiners; lowest spam tier
  - Add **MEE6** or **Wick** for raid protection from day one
- **Gotcha:** Vanity URLs need server boosts. Until then, generate a permanent invite link `discord.gg/<random>` and 301 from your site.

### Step 7 — Farcaster / Warpcast  (0:46–0:52)
- **URL:** Warpcast iOS / Android app → Sign up
- **Action:** Sign up with email `hello@edgeterminal.xyz`. Pay $7 onboarding fee (one-time). Claim handle `@edgeterminal`. Connect Solana + ETH wallets (use the marketing wallet, NOT cold storage).
- **Bio:** 80-char variant
- **Gotcha:** Farcaster handles are tied to a "FID" on-chain. Recover only via the recovery wallet — set this to a multisig you control, NOT a hot wallet.

### Step 8 — GitHub Org  (0:52–0:58)
- **URL:** https://github.com/organizations/new
- **Email:** `hello@edgeterminal.xyz`
- **Action:**
  - Free plan to start
  - Org name: `edgeterminal`
  - Invite Robert (owner) + Tye (owner)
  - Enforce 2FA org-wide (Settings → Authentication security)
  - Transfer `BostonRob1/-EDGE` repo → `edgeterminal` org, rename to `app`
  - Set up `CODEOWNERS` and branch protection on `main`
- **Gotcha:** Transferring a repo breaks any incoming links — set up `BostonRob1/-EDGE` as a permanent redirect (GitHub auto-redirects, but verify Vercel still deploys from the new path).

### Step 9 — Vercel Team  (0:58–1:02)
- **URL:** https://vercel.com/teams/create
- **Email:** existing Vercel account (Robert's)
- **Action:** Create Team named `edgeterminal`. Transfer the `edge-two-psi` project into the team. Add Tye as Member. Connect custom domain `edgeterminal.xyz` once DNS propagates. Set production branch to `main`.
- **Gotcha:** Free tier teams cap at 1 production deployment per project. Fine for launch; upgrade to Pro at week 2 for previews + analytics.

### Step 10 — pump.fun  (1:02–1:06)
- **URL:** https://pump.fun
- **Action:** Connect the **marketing** Phantom wallet (NOT cold). Edit profile: handle `edgeterminal`, PFP, banner, bio with site URL + X + TG. **Do not mint yet** — this is reservation only.
- **Gotcha:** pump.fun profile is wallet-derived. Whichever wallet mints the token becomes the visible creator. Make sure the marketing wallet has SOL but is NOT funded from your cold storage directly (use a fresh wallet, fund from a CEX).

### Step 11 — Dexscreener · Birdeye · Solscan  (1:06–1:10)
- **URLs:** dexscreener.com · birdeye.so · solscan.io
- **Action:** Create accounts (email `hello@edgeterminal.xyz`). Each will show "Update Token Info" once your contract is live — bookmark the forms now. Pre-stage logo + social URLs + audit URL in a doc so you can paste in seconds at T+0.
- **Gotcha:** Dexscreener charges $300 for "Enhanced Token Info." Budget for it at T+0; visibility delta is real.

---

## BLOCK 3 — SOCIAL P1  (1:10–1:40)

### Step 12 — Substack + Medium  (1:10–1:16)
- Substack: https://substack.com/signup → publication name "Edge Brief" at `edgeterminal.substack.com`. Custom domain `read.edgeterminal.xyz` post-DNS.
- Medium: https://medium.com → sign up → publication "Edge Terminal" → reserve `@edgeterminal` handle.
- **Gotcha:** Substack custom domain is $50 one-time. Worth it.

### Step 13 — Dune  (1:16–1:20)
- **URL:** https://dune.com/auth/register
- **Action:** Sign up with GitHub (use the new org account). Reserve username `edgeterminal`. Create 1 stub dashboard called `$EDGE Whale Index` so the profile isn't empty.

### Step 14 — DefiLlama, CoinGecko, CoinMarketCap  (1:20–1:24)
- These are submission **forms**, not accounts in the classic sense. Bookmark each:
  - https://github.com/DefiLlama/yield-server (PR-based)
  - https://www.coingecko.com/en/coins/new
  - https://coinmarketcap.com/request
- Do NOT submit yet — wait until you have liquidity + holders. Just stage the data: contract, LP address, logo, socials, audit, team KYC.

### Step 15 — Reddit  (1:24–1:30)
- **URL:** https://reddit.com/register
- **User account:** `u/edgeterminal` → confirm email → build 10 karma over a week (this is why you start early)
- **Then:** https://reddit.com/subreddits/create → `r/EdgeTerminal` (requires 30d account + karma; if blocked, use Robert's existing high-karma account to create, transfer mod)
- **Gotcha:** Reddit shadowbans new accounts that post crypto links from day one. Lurk + comment for 48h before posting.

### Step 16 — YouTube + TikTok + Instagram  (1:30–1:36)
- **YouTube:** sign in with `hello@` Google → create channel → handle `@edgeterminal` → verify (10-min wait for handle ownership).
- **TikTok:** https://tiktok.com/signup → email signup → handle `@edgeterminal` → bio + link (TikTok requires 1k followers for link in bio; use Bento URL in posts meanwhile).
- **Instagram:** https://instagram.com → handle `@edgeterminal` → switch to Business account → connect to a Facebook Page (required for ads).
- **Gotcha:** TikTok will geo-throttle accounts that look like financial-advice spam. Lead with the data viz, not the ticker, in the first 5 videos.

### Step 17 — LinkedIn Company + Bento  (1:36–1:40)
- **LinkedIn:** https://linkedin.com/company/setup/new → name "Edge Terminal" → handle `edge-terminal` → tagline = bio 80-char variant.
- **Bento:** https://bento.me → handle `edgeterminal` → add links: site, X, TG, Discord, pump.fun, GitHub, Substack.

---

## BLOCK 4 — P2 SQUATS + VERIFICATION  (1:40–2:00)

### Step 18 — Defensive squats (rapid-fire, 5min)  (1:40–1:45)
- Threads (via Instagram), Bluesky, Mastodon, ProductHunt, Wellfound, Crunchbase. Email each with `hello@`. Same handle. PFP + 1-line bio. No content.

### Step 19 — Web3 squats  (1:45–1:52)
- **ENS:** https://app.ens.domains → search `edgeterminal.eth` → register 5y → set as primary on the marketing wallet.
- **SNS:** https://www.sns.id → `edgeterminal.sol` → register on marketing wallet.
- **Lens:** https://hey.xyz → claim `@edgeterminal.lens` (requires Polygon gas + an invite; if no invite, queue for week 2).
- **Mirror:** https://mirror.xyz/dashboard → connect wallet with `edgeterminal.eth` → publication appears at `mirror.xyz/edgeterminal.eth`.

### Step 20 — Lock down 2FA + recovery codes  (1:52–1:58)
- For every account created today: enable 2FA via authenticator app (NOT SMS, except where required like Telegram).
- Download recovery codes for: X, Discord, GitHub, Google, Cloudflare, Resend, Vercel, Substack.
- Save each set as a **separate** Secure Note in 1Password named `<platform> — recovery codes`.

### Step 21 — Verification pass  (1:58–2:00)
- Open https://bento.me/edgeterminal and click every link.
- For each link, confirm:
  - Profile photo loads
  - Bio is set
  - Handle matches `@edgeterminal` (or documented fallback)
  - 1Password vault has the entry with login + recovery codes
- Mark a green check in the playbook (`/marketing/02-account-playbook/index.html`) Status column for each completed row.
- Post a single test tweet from `@edgeterminal`: `Watch the action. Before you bet.` and pin it. Reply with the contract address once minted.

---

## SPRINT COMPLETE CHECKLIST

- [ ] 6 domains owned, all DNS in Cloudflare
- [ ] 10 email aliases routing to founders
- [ ] All 10 P0 accounts created + 2FA on
- [ ] All 12 P1 accounts created (form-only listings staged, not submitted)
- [ ] All 10 P2 squats reserved with a PFP
- [ ] ENS + SNS owned on marketing wallet
- [ ] Test tweet pinned at `@edgeterminal`
- [ ] 1Password vault `EDGE-Launch` has ≥ 40 entries
- [ ] Bento.me page lists every public surface

If any P0 row is incomplete after 120 minutes — **stop, do not launch the token.** Reschedule mint, fix the gap, re-run verification.
