# Sarno Survive — agent notes

Start with `README.md` (run, controls, layout), `docs/STATE.md` (what works, issues, next steps) and `docs/DESIGN.md` (decisions and tuning numbers). Keep those three up to date when you change things.

- **Current build:** the opening-route slice (shelter → street → gate → woods → deep trail → the house). The old sandbox is at tag `baseline-sandbox-2026-09-30`. The story bible is `master-story-design-brief-2026-09-30.txt` in the Codex outputs folder (see `DESIGN.md`). Don't invent story canon; Marc decides story beats.
- **Hub:** `hub/` is the visual production record (`npm run hub`). Update `hub/data.js` and capture a new set with `node tools/capture.mjs --set=<name>` when things change. Only Marc approves anything.
- **Run:** `npm run dev`. **Verify:** `npm run playtest`. All checks should pass. Look at the screenshots, not only the JSON.
- **Models:** edit `blender/build_assets.py`, then `npm run assets`, which runs Blender 5.2 in the background and then meshopt-compresses the output. Don't hand-edit files in `public/assets/models/`. Record any new downloaded model in `CREDITS.md`, with its license and your changes.
- **Names the code depends on:** bones `WristL` / `WristR` / `FootL` / `FootR` (gait measurement and footprints) / `UpperArmL`… (three.js strips the dots) and materials `CarPaint`, `LanternGlow`, `Fire`.
- **Style:** faceted flat-shaded forms, snow on upward faces, normal human proportions, warm light against blue snow. The concept art is outside the repo (see `DESIGN.md`) and should not be committed.
- **Git:** push to `github.com/Marcsarno/survival`.
- **Deploy:** run npm run deploy. It publishes to https://sarno-survive.vercel.app (Vercel project sarno-survive, team "Marc Sarno", account marc731@gmail.com). Never use the hornerxpress account. Check npx vercel whoami first; it should print marc731-6361.
