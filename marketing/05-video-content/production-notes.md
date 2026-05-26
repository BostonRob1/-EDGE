# $EDGE — VIDEO PRODUCTION NOTES

The playbook for actually shipping the videos described in this folder. Read this once. Then keep it open while you cut.

---

## 01 · TOOLS

### Editor
**DaVinci Resolve (free)** — Use this for everything that matters. The free tier is more than enough for color, mixing, motion graphics, and 4K masters. The brand demands editorial polish; Premiere/Final Cut work but Resolve's color page is the right tool for the Bloomberg-meets-Phantom look.

**CapCut** — Use ONLY for fast TikTok / Reels cutdowns where you need to land an edit in under an hour. Apply burn-in captions, lock the aspect ratio, ship. Do NOT use CapCut's stock transitions or auto-captions for hero pieces — they look like every other crypto video.

**After Effects** — Optional. Only worth opening if you're animating type that exceeds what the CSS teasers can do. Otherwise, screen-record the CSS teasers in this folder; they are the canonical motion treatments.

### Screen recording
- **macOS native** (Cmd+Shift+5) for the CSS teasers. Use "Record Selected Portion." Always set the marquee to the exact pixel dimensions (1080×1080, 1920×120, 1080×1920).
- **CleanShot X** ($29) if you need a custom cursor and a moveable selection that snaps to exact dimensions.
- **OBS Studio** if you need to record multiple sources at once (e.g. screen + face cam for founder content).

### Audio
- **DaVinci Resolve Fairlight** page — sufficient for VO clean-up, EQ, levels.
- **Audacity** — if all you need is to clip a VO take.
- **iZotope RX (Elements, $99)** — worth it for de-essing and breath removal on founder VO.

---

## 02 · VOICE-OVER

### Option A — ElevenLabs voice clone (recommended for scale)
1. Record a 20-minute clean read from Robert (or whoever) in a quiet room, lav mic, no music.
2. Upload to ElevenLabs ($22/mo Starter or $99 Creator for commercial rights).
3. Use **Eleven Multilingual v2** or **Eleven Turbo v2.5** for the voice model.
4. **Settings:** Stability 45–55, Similarity 70–80, Style 0–15. Default voice modulation OFF.
5. For brand reads, paste the VO from the script `.md` files. Render. Check for weird inflections — re-render the offending sentence with a comma or hyphen inserted.

### Option B — Real recording
- Equipment: **Shure MV7+** ($279) or **RØDE PodMic USB** ($199) plugged into a Mac.
- Treat the room: blanket fort, closet with clothes, or a $79 Aston Halo on the mic.
- Read at conversational volume, 6–8 inches from the mic, slightly off-axis.
- Record 3 takes of every line. Pick the second one. (First is too cold; third is too rehearsed.)
- Roll 5 seconds of room tone before and after each take for noise-floor matching.

### Voice direction notes
- **Pace:** slow. ~140 words per minute. Crypto VO is almost always too fast.
- **Tone:** dry, certain. Robert is not selling — he's stating the case.
- **Mouth noises:** kill clicks and pops in post. They scream amateur.
- **The brand tagline** ("Watch the action. Before you bet.") is always the last line. Always slowed. Always landed.

---

## 03 · MUSIC

### Where to source
- **Artlist** ($16.60/mo annual, $29 monthly) — best curation for editorial work. Filter: instrumental + cinematic + tech.
- **Musicbed** ($25/mo personal, custom enterprise) — broader catalog, higher price. Use if Artlist doesn't have it.
- **Epidemic Sound** ($15/mo personal, $49 commercial) — start with the free 30-day trial. Wide library, some of it generic.
- **Soundstripe** — fine for placement, but library is shallower than Artlist.

### What to look for
- **Ambient industrial.** Think: low sub bass, sparse mechanical percussion, evolving pads, slight glitch.
- **Bloomberg-terminal-meets-Phantom-wallet.** Cold, expensive, not hostile.
- **Reference tracks to match the vibe (not the exact song, just the feel):**
  - Burial — "Archangel" (slowed)
  - Floating Points — "LesAlpx" (the calm parts)
  - Nils Frahm — "All Melody" instrumentals
  - Bicep — "Atlas" (held pads)
  - The Social Network OST — Trent Reznor / Atticus Ross
- **Search terms that work on Artlist:** "industrial ambient," "minimal techno cinematic," "modular synth tension."

### What to NEVER use
- Trap beats. No.
- Generic synthwave with the 80s arp. No.
- Lo-fi hip hop. Absolutely no.
- "Inspiring corporate" piano + claps. We will fire you.
- Any track that has a "drop" in the conventional EDM sense.

### Sound design
- **Bell ticks** for data prints (Splice "Foley UI"): a 200ms metallic ping at –24 LUFS.
- **Sub-bass whump** on hard cuts (Splice "Cinematic FX"): low frequency hit, no high-end.
- **Mechanical key clicks** for type-on captions: a Cherry MX recording works.
- **Room tone:** always lay a continuous bed of -50 dB room tone under everything to glue cuts.

---

## 04 · SUBTITLES

**Rule: always burn in.** 80% of vertical-video watch time is muted. The captions ARE the message.

### Settings (across all aspect ratios)
- **Font:** JetBrains Mono Regular (matches brand)
- **Size:** 32px (vertical) / 28px (1:1) / 24px (16:9)
- **Color:** #F5F5F0 (bone) on a 65% void rectangle (#050507 at 0.65 alpha) with 6px padding
- **Position:** lower-third center, 12% safe area from bottom edge for TikTok / 18% for IG Reels
- **Max line length:** 32 characters. Break to a second line earlier rather than later.
- **Timing:** caption appears 100ms BEFORE the word is spoken, exits 200ms AFTER.

### Brand caption variants
- **Hero callout:** ANTON 80px caps, lime + bone two-color, no background. Used for the "WHALES JUST MOVED $2.4M" stoppers.
- **Data label:** JetBrains Mono 20px, lime, 0.2em letter-spacing, uppercase. Used for `WHALE ALERT · 14M AGO` style overlays.
- **Eyebrow / scene label:** JetBrains Mono 14px, muted, uppercase, top-left corner persistent.

### Platform-specific
- **TikTok:** also add the platform's native captions layer on top of burn-ins — the algorithm rewards native captions.
- **IG Reels:** same as TikTok. Use Meta's "Captions" sticker.
- **X / YouTube:** upload an `.srt` file in addition to burn-ins. (Both also rank captioned video higher.)
- **LinkedIn:** captions are required for autoplay-on-feed; burn-in is the easiest path.

---

## 05 · B-ROLL REQUIREMENTS

### Required source footage (record these once, reuse forever)
1. **30s of $EDGE markets grid** — slow cursor scroll, ~30fps, 1920×1080
2. **30s of whale alerts feed printing** — rows appearing live, ~30fps
3. **30s of divergence radar** — outlier pulsing, cursor hovering tooltip
4. **30s of market detail drill-down** — chart with overlay lines, two-line divergence
5. **30s of route-to-market CTA hover** — affiliate URL preview in status bar
6. **30s of token gate modal** — wallet connect flow
7. **15s of $EDGE mark + wordmark animation** (already exists as the CSS teaser)
8. **15s of pure void with subtle grain** — for cold opens and end cards

### Capture rules
- macOS recording at **1920×1080, 60fps, ProRes 422** if disk space allows (it's huge but cuts cleanly).
- Cursor: use a **custom 24px lime cursor** (the OS arrow disappears against dark backgrounds). Mousecape (free) lets you swap cursors temporarily.
- Smooth scroll only (`scroll-behavior: smooth` in CSS, or trackpad scrolls).
- Add a **1-frame lime flash on every click** in post for click clarity.

### What NOT to film
- Stock footage of trading floors, Bloomberg terminals, or "people looking at charts."
- Phone cam footage of someone holding their phone.
- Drone shots of a city skyline.
- Anything that smells like a 2017 ICO video.

---

## 06 · ASPECT RATIO MATRIX

| Aspect | Pixels | Use case | Hero asset master |
|---|---|---|---|
| **16:9** | 1920×1080 | YouTube · in-feed X video · Vimeo · presentations | Master cut |
| **1:1** | 1080×1080 | Instagram feed · X feed video · LinkedIn feed · OG fallback | Center-crop of 16:9 |
| **9:16** | 1080×1920 | TikTok · IG Reels · YouTube Shorts · IG Stories · X Stories | Re-frame, not crop |
| **4:5** | 1080×1350 | LinkedIn feed (preferred) · IG feed (alt) | Center-crop of 9:16 |
| **9:16 + 16:9 split** | 1080×1920 (top: 16:9 letterboxed, bottom: caption block) | TikTok-native style with explicit lower-third | Compose in editor |

### Reframe rules
- **16:9 → 1:1:** crop to center 1080px width. The hero element must be in the center column of the 16:9 master — if it's in the left or right third, reframe deliberately.
- **16:9 → 9:16:** never crop. **Reframe.** That means: re-position the hero element to vertical center, fill negative space with captions or data HUD. Treat 9:16 as a different edit, not a crop.
- **End cards** in every aspect ratio use the SAME mark + wordmark + URL structure, just laid out for the canvas.

---

## 07 · EXPORT SETTINGS (RESOLVE)

### Master export
- **Codec:** H.264 (broad compatibility) or ProRes 422 HQ (if going to a finishing house)
- **Resolution:** native aspect
- **Frame rate:** 60fps for vertical / 30fps for 16:9 longform
- **Bitrate:** 16 Mbps (1080p) / 32 Mbps (1080p 60fps) / 50 Mbps (4K)
- **Color space:** Rec.709 / Gamma 2.4 (standard delivery)
- **Audio:** AAC 48kHz 256kbps stereo. Loudness: **−14 LUFS integrated** (the social-media standard). True peak ≤ −1 dBTP.

### Platform-specific delivery
- **X:** max 512MB, max 2:20 length, H.264, AAC. Use 1920×1080 master for 16:9.
- **TikTok:** max 287MB upload, H.264, max 60s for in-feed (10min for long-form). Use 1080×1920.
- **IG Reels:** max 4GB, max 90s for Reels (15min for long-form). Use 1080×1920.
- **YouTube:** unlimited (within reason), H.264, max 12 hours. Upload at full master quality.

---

## 08 · POST CHECKLIST (PER VIDEO)

- [ ] Edit locked
- [ ] Color graded (lift shadows toward teal, gain whites toward bone, lime accents protected)
- [ ] Audio mixed to −14 LUFS
- [ ] Captions burned in (and platform-native captions added on top for TikTok/IG)
- [ ] End card includes correct CA (post-launch) or placeholder (pre-launch)
- [ ] Aspect ratio reframes exported (16:9 + 1:1 + 9:16 minimum)
- [ ] Filename: `edge_[scriptname]_[aspect]_[date]_v[N].mp4` (e.g. `edge_60s-trailer_16x9_2026-05-26_v1.mp4`)
- [ ] Uploaded to project archive (Drive or Dropbox)
- [ ] Posted with platform-correct copy, hashtags, captions

---

## 09 · WHO OWNS WHAT

- **Scripts** — Robert writes. Tye reviews for product accuracy.
- **Edit** — Whoever's on the cut for the week. Default: Robert.
- **VO** — Robert (or Robert's ElevenLabs clone after the first 5 videos).
- **Color + final mix** — DaVinci-fluent contractor if hero piece. Self if cutdown.
- **Post + caption** — whoever drafted the script also drafts the social copy.

---

## 10 · WHAT TO AVOID

- "AI voice that sounds like AI." Tune ElevenLabs settings or re-record.
- Stock footage of "guy looking at multiple monitors."
- Any music with a beat-drop.
- Any animation that uses a purple-to-pink gradient.
- Inter, Roboto, Arial, or Helvetica as a display face.
- Emoji in burn-in captions.
- "🚀" anywhere, ever, including thumbnails.
- A founder talking head longer than 90 seconds without a product cutaway.
- A countdown that doesn't actually count down (use the real `teaser-countdown.html`).

This is the brand. Don't drift.
