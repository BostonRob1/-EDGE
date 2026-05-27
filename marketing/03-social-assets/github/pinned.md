# GitHub — Org Profile README

Lives at `edgeterminal/.github/profile/README.md`. Renders as the landing page at `github.com/edgeterminal`.

---

```markdown
<div align="center">

<img src="https://raw.githubusercontent.com/edgeterminal/.github/main/assets/mark.svg" width="120" alt="$EDGE mark" />

# $EDGE

### The terminal for prediction markets.

Money. Mouth. Edge.

[**Site →**](https://edge-two-psi.vercel.app/) · [**X →**](https://x.com/edgeterminal) · [**Discord →**](https://discord.gg/edge) · [**Dune →**](https://dune.com/edge)

</div>

---

## What lives here

Open-source tooling for prediction-market builders. SDKs, scrapers, scoring libraries, Farcaster frames, and the SQL behind every $EDGE Dune dashboard.

The closed-source web terminal lives at [edge-two-psi.vercel.app](https://edge-two-psi.vercel.app/). The data plumbing under it is here.

## Pinned repositories

| Repo | What it is |
|---|---|
| [poly-tape](https://github.com/edgeterminal/poly-tape) | Streaming Polymarket whale-flow listener (TS). Subscribes to the public order-book stream, normalizes, emits typed events. |
| [kalshi-rest](https://github.com/edgeterminal/kalshi-rest) | Typed Kalshi REST client + reconnecting WebSocket wrapper (TS). |
| [divergence-kit](https://github.com/edgeterminal/divergence-kit) | Cross-venue + sentiment divergence scorer (Python core, TS bindings). |
| [dune-queries](https://github.com/edgeterminal/dune-queries) | SQL for every public [$EDGE Dune dashboard](https://dune.com/edge). |
| [frames](https://github.com/edgeterminal/frames) | Farcaster frames: divergence-of-the-day, whale-of-the-hour, holder-gated alpha. |
| [terminal](https://github.com/edgeterminal/terminal) | Public roadmap + issue tracker for the closed-source web app. PRs not accepted; issues + discussions are. |

## How we work

- **Open SQL, open scorers, open clients.** The closed bits are the web app, the picker weights, and the realtime delivery infrastructure.
- **Receipts in every issue.** Bug reports without a reproducer get closed politely.
- **Master is always green.** CI on every PR. No merges without a passing pipeline.
- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`. We auto-generate changelogs.

## Contributing

1. Read the relevant repo's `CONTRIBUTING.md` first.
2. Open an issue before a non-trivial PR.
3. Keep PRs under 400 lines unless coordinated.
4. Tests required for `divergence-kit`, `poly-tape`, `kalshi-rest`. Optional but appreciated elsewhere.


- **an $EDGE Trader** — [@edgeterminal](https://github.com/robertnoejr) — product, frontend


## License

MIT across all public repos unless explicitly stated otherwise. Issues, ideas, and PRs welcome.

---

<div align="center">

**Watch the action. Before you bet.**

[edge-two-psi.vercel.app](https://edge-two-psi.vercel.app/)

</div>
```

---

## Asset hosting note

The README references `https://raw.githubusercontent.com/edgeterminal/.github/main/assets/mark.svg`. Drop the mark + favicon into `edgeterminal/.github/assets/` so the README renders identically on GitHub.com and on social-card unfurls.

## Social preview note

Upload `banner.svg` (exported to 1280×640 PNG) as the org's social preview under Settings → Social Preview. This is what shows when github.com/edgeterminal is shared on X, Slack, Discord.

## Repository social previews

Each pinned repo should also have its own social preview using the same template — same chevron, same grid, swap the headline to the repo name. Reuse `banner.svg` as the source and swap the eyebrow text for "REPO / poly-tape" etc.
