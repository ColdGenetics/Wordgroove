# Wordgrove

AI-created word puzzle game — swipe letters on a wheel, solve crossword-style boards, earn coins from bonus words, and explore themed stages.

**Current version: 3.5.28**

Play: [coldgenetics.github.io/Wordgrove](https://coldgenetics.github.io/Wordgrove/)

---

## How to play

1. Swipe across the letter wheel to spell words.
2. Crossword answers fill the board; crossings share letters.
3. Bonus English words (not on the board) earn coins.
4. Use hints: reveal a letter, show a definition, or reveal two random letters.
5. Clear every crossword word to finish the level and unlock the next.

---

## Changelog

### 3.5.28
- Letter wheel angle-based selection (fixes off-by-one highlight)
- Swipe path drawing fixed
- Translucent crossword cells and level-complete modal restored
- Haptic feedback on solve (supported devices only)
- Features list shows latest 4 versions only

### 3.5.28
- Max 2 uses of any crossword word per stage


### 3.5.18
- Hybrid audio (Option B): optional real beds in `audio/`, procedural fallback + stage-tuned SFX.

### 3.5.18
- Photoreal stage backgrounds with light CSS drift.
- Canvas particles (leaves/pollen/mist) react to wheel swipes and taps.

### 3.5.16
- Home **Words found** browses Stage → Level → words; definitions load only for the opened level.

### 3.5.15
- Version updates without clearing site data (network-first SW, versioned registration, one-time reload on new build).
- Home **Words found** button + clickable stat open the full word log with level tags.
- Stricter bonus filter: large name/place/slang blocklist; online definitions that are proper-noun-only are rejected.
- Stage music/SFX redesigned around real-world themes (birds, crickets, owls, waterfall, leaves, wind, droplets) instead of pitch-shifted clones.

### 3.5.14
- In-level **Words** list shows only words solved on that level.
- Home **Words found** lists every solved puzzle/bonus word with the level it was found on.
- **Features & fixes** button in Sound settings and the game menu (version history).
- Service worker is **network-first** for `index.html` / `app.js` so reopening the link loads the latest build without clearing site data; progress remains in `localStorage`.

### 3.5.13
- README and project docs brought up to date with current version and history.
- Coin pill and coin numbers outlined (dark fill, gold border, text stroke/shadow) so they stay readable on every stage background.
- Audio settings labels: **Music** and **Sounds** (no longer “Nature sounds”).
- Music and sounds default **On** for new players; preferences persist in the browser.
- Music and sound effects are unique per stage (distinct chord sets, waveforms, tempo, and SFX timbre).

### 3.5.12
- Level navigation fix: choosing a level jumps to that level only (no accidental skip to a previous or next cleared level).
- Stage picker opens a **level summary** for that stage (cleared / in progress / locked) before play.
- Testing tools (`?dev=1`): auto-solve, unlock first 20/50/all, jump to level, add coins, reset level or all progress.

### 3.5.11
- Reject bonus words that are acronyms, initialisms, abbreviations, place names, surnames, obsolete terms, or slang.
- Bonus coins: **0** for 2–3 letter words; then **1 coin per letter after 3** (4→1, 5→2, …).
- Larger letter-wheel tiles scaled by letter count to avoid overlap.

### 3.5.10
- Definition hint reliability fix.

### 3.4 – 3.5.x (summary)
- Crossword layouts, swipe wheel, hints, definitions, extras, ambient audio, stages, PWA/service worker, layout/paint reliability, level-complete screen.

---

## Project layout

| File | Role |
|------|------|
| `index.html` | Shell, styles, home + game screens |
| `app.js` | Game logic, audio, menus, progress |
| `levels.json` | Puzzle data |
| `dictionary.json` | Local word list for bonus validation |
| `definitions.json` | Bundled definitions |
| `sw.js` | Service worker (offline cache) |
| `manifest.webmanifest` | PWA manifest |
| `*.svg` | Stage backgrounds + icon |

---

## Local testing

Serve the folder over HTTP (required for service worker and some browsers):

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/?dev=1` for **Testing tools** in the ☰ menu (auto-solve, unlock levels, jump, etc.).

---

## Save data

Progress is stored in `localStorage` under `wordgrove-v4-save`. Audio prefs use `wordgrove-audio`. Dev mode flag: `wordgrove-dev`.
