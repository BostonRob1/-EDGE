# $EDGE — Marketing OS

The complete enterprise-grade launch arsenal for $EDGE. Brand, accounts, social, hype, motion, runbook, conversion, paid, press — all production-grade, all in one tree.

**Start here:** open [`00-master/index.html`](00-master/index.html) in a browser. That page is the navigable index for everything.

## Folder map

| # | Folder | What's in it |
|---|---|---|
| 00 | `00-master/` | Top-level navigation, ship checklist, phase strip |
| 01 | `01-brand-foundation/` | Logo system (SVG), color palette, typography, voice rules |
| 02 | `02-account-playbook/` | Every account to register, login vault CSV, handle-reservation script, bios in 6 length tiers |
| 03 | `03-social-assets/` | Per-platform packs (PFP + banner + bio + pinned content) — 13 platforms |
| 04 | `04-launch-graphics/` | Teasers, announcements, tokenomics card, roadmap, feature cards, meme templates |
| 05 | `05-video-content/` | 60s / 30s / 15s scripts, storyboards, working CSS-animated teasers, production notes |
| 06 | `06-launch-playbook/` | 30-day content calendar, launch-day runbook, KOL kit, press release, one-pager, pitch deck, FAQ |
| 07 | `07-website-conversion/` | Coming-soon page, waitlist confirmation, token launch modal, 8 OG image templates |
| 08 | `08-paid-media/` | X promoted post creative, display ads, YouTube pre-roll scripts, influencer brief, spend plan |
| 09 | `09-press-kit/` | Fact sheet, embargo policy, spec sheet, quote bank, brand asset downloads |

## Design tokens (frozen — change requires versioning)

```css
--void: #050507        /* primary bg */
--void-2: #0c0c10      /* card bg */
--void-3: #141418      /* row hover */
--lime: #C4FF00        /* primary accent */
--magenta: #FF006E     /* divergence only */
--green: #00FF85       /* positive */
--amber: #FFB800       /* caution */
--red: #FF3344         /* negative */
--white: #F5F5F0       /* text */
--muted: #6B6B73       /* secondary text */
```

Fonts (Google Fonts, all pages preconnect + display=swap):
- **Anton** — display caps, ls -0.02em
- **DM Sans** — body, 400/500/700
- **JetBrains Mono** — data values, labels, addresses

## Voice (one rule overrides everything)

> Degen-confident. Data-grounded. Never "to the moon." Never rocket emojis. Never purple gradients. Never Inter as a display face.

Money / Mouth / Edge is the vocabulary. Use it across every surface.

## How to use this

1. **Open `00-master/index.html`** to navigate. It's the front door.
2. **Reserve handles first** — run `02-account-playbook/handle-reservation-script.md` end-to-end in one 2-hour sprint.
3. **Upload visual assets** to each platform from `03-social-assets/{platform}/`.
4. **Wire the coming-soon page** — `07-website-conversion/landing-pages/coming-soon.html` — to a real email endpoint (Resend / MailerLite). Point the primary domain at it.
5. **Schedule the 30-day calendar** — copy from `06-launch-playbook/30-day-content-calendar.html` into Buffer / Hypefury / Typefully.
6. **Run the launch-day runbook** at T-72h — `06-launch-playbook/launch-day-runbook.html`.

## Tagline

**Watch the action. Before you bet.**

---

`v1.0` — built 2026-05-26 — $EDGE Marketing OS
