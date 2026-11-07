WORDGROVE 3.1 — ANDROID PWA

WHAT'S NEW
- Real crossword-style intersecting word layouts.
- Swipe continuously across wheel tiles to form puzzle words; repeated letters have the required number of tiles.
- The letter wheel starts with 4 tiles at Level 1, grows to 5 tiles at Level 2, 6 tiles at Level 941, and 7 tiles at Level 2,809. Maximum answer length is seven letters; every crossword answer remains spellable from its wheel, which can also include bonus letters.
- Three hint types: reveal one letter (25 coins), show the selected word's definition (15 coins), or reveal two random letters (40 coins). Tap a crossword square to select a word before using a definition hint.
- Words list: solved puzzle words with definitions. Definitions are bundled for the opening level and can be fetched from the free Dictionary API for other words when online, then cached on the device.
- Extra words list: valid English words not in the current crossword earn 1 coin for 2 letters, 2 for 3, 3 for 4, 4 for 5, and 5 for 6–7 letters.
- Ambient original synthesized background music and gentle nature-inspired sound effects. Music and sound effects have separate controls. Browsers require a tap before audio can begin.
- Main menu shows current level, coin balance, and total puzzle words solved.
- Portrait layout is designed to fit the phone screen without page scrolling.
- 5,000 levels, with common short words early and longer words later.

INSTALL / UPDATE
1. Upload the CONTENTS of this folder to the root of your existing public GitHub repository, overwriting files with the same names. Keep the existing GitHub workflow and README.md.
2. Commit the changes.
3. Wait for the GitHub Pages workflow to show a green success check.
4. Close Wordgrove on the phone and reopen it while online. The service worker cache is now wordgrove-v6. If the old version remains, reload in Chrome, close the app, and reopen it.
5. Version 4 uses a new local save key because the opening and fifth puzzles were reordered to make the 4-tile introduction work. It starts with 50 coins at Level 1.

GAME ECONOMY
- Correct crossword answer: +5 coins.
- Completed level: +20 coins.
- Extra words: 1–5 coins depending on length.
- Single-letter hint: 25 coins. Definition hint: 15 coins. Two-letter reveal: 40 coins.

DEFINITIONS AND OFFLINE USE
- Definitions for the first level are bundled. Other definitions are fetched from dictionaryapi.dev while online and cached locally after retrieval. A definition not previously cached may not be available offline.
- Puzzle play, progress, coin balances, and cached definitions are stored locally.
- Audio is synthesized in the browser; no music files or copyrighted recordings are included.

HOSTING
Wordgrove is an installable Progressive Web App (PWA), not a native APK. GitHub Pages serves it over HTTPS.


WORDGROVE 3.1 UPDATE
- Redesigned translucent meadow interface with square crossword cells and no puzzle frame.
- Removed the top title/progress bar and Clear button; moved Words, Bonus words, Hints, and Shuffle around the wheel.
- Added stage selection in groups of 25 levels, a game menu, and sound settings.
- Definition hints no longer reveal the answer word; solved words are rejected with a clear message.
- Single-letter hints now ask the player to tap the exact crossword square to reveal.
- Bonus-word definitions use the same online lookup and local cache as puzzle words.
- Music pauses when the app is hidden or backgrounded and resumes when it returns.
- Stage-specific colour atmospheres are applied; stage audio themes can be expanded in a later pass.


WORDGROVE 3.1 UPDATE
- Redesigned translucent meadow interface with square crossword cells and no puzzle frame.
- Removed the top title/progress bar and Clear button; moved Words, Bonus words, Hints, and Shuffle around the wheel.
- Added stage selection in groups of 25 levels, a game menu, and sound settings.
- Definition hints no longer reveal the answer word; solved words are rejected with a clear message.
- Single-letter hints now ask the player to tap the exact crossword square to reveal.
- Bonus-word definitions use the same online lookup and local cache as puzzle words.
- Music pauses when the app is hidden or backgrounded and resumes when it returns.
- Stage-specific colour atmospheres are applied; stage audio themes can be expanded in a later pass.

Wordgrove 3.2: stage SVG backgrounds are stored beside index.html so they can be uploaded individually using the GitHub mobile app.
