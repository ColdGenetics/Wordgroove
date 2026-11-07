WORDGROVE — ANDROID INSTALL PACKAGE

WHAT THIS IS
Wordgrove is an installable Progressive Web App (PWA), not a native APK. It is designed for portrait play on Android phones, including the Google Pixel 7 Pro. It contains 5,000 generated levels. The answer words are selected from the CMU Pronouncing Dictionary (an English pronunciation lexicon), with a small exclusion list for obvious abbreviations and internet shorthand. This is a broad lexicon, so a few uncommon or regional dictionary entries may appear.

INSTALL ON A PIXEL 7 PRO
A PWA must be served from a secure HTTPS website before Chrome can install it and cache it for offline play. Opening index.html directly from the ZIP is not enough to enable installation/offline support.

Simple hosting option (GitHub Pages):
1. Extract this ZIP on a computer.
2. Create a new public GitHub repository, for example "wordgrove".
3. Upload the CONTENTS of the wordgrove folder (index.html, app.js, levels.json, manifest.webmanifest, sw.js, icon.svg, dictionary.json, README.txt) to the repository's root.
4. In the repository, open Settings → Pages.
5. Under Build and deployment, choose "Deploy from a branch", select the main branch and /(root), then Save.
6. Wait for GitHub Pages to publish the site. Open the published HTTPS address in Chrome on your Pixel.
7. In Chrome, open the three-dot menu and choose "Install app" or "Add to Home screen" (wording can vary), then confirm.
8. Launch Wordgrove from the new home-screen icon. After the first successful load, the game assets are cached for offline use.

GAMEPLAY
Tap letters around the wheel to spell a word, then press Enter. Clear removes the current selection; Shuffle rearranges the wheel. Find all displayed words to complete a level. Progress is stored in the browser on that device.

NOTES
- This ZIP is a PWA website bundle, not an APK. No Android app signing/build step is required for PWA installation.
- Progress is stored locally in Chrome. Clearing site data or uninstalling/clearing browser storage can erase progress.
- The dictionary is bundled locally; gameplay does not need a network connection after the first successful load and cache.
