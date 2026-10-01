# Sarno Survive — agent notes

Start with `README.md` (run, controls, layout), `docs/STATE.md` (what works, issues, next steps) and `docs/DESIGN.md` (decisions and tuning numbers). Keep those three up to date when you change things.

- **Current build:** opening pass 2 (Marc's direction of 2026-09-30): his Tripo model of Marc walks seawall → park → lane (the bunny) → a locked gate he climbs → the house (top-right, front facing south-west). Text only, no voices, no run. Level: `src/world/level.js`; sequence: `src/systems/story.js`. Earlier: tag `baseline-opening-route-2026-09-30` (slice v1, the live site) and `baseline-sandbox-2026-09-30`. The story bible is `master-story-design-brief-2026-09-30.txt` in the Codex outputs folder. Don't invent story canon; Marc decides story beats; the dialogue lines are placeholders.
- **Work rhythm:** get Marc a playable build early and let him judge it before long automated test, capture or doc passes.
- **Hub:** `hub/` is the visual production record (`npm run hub`). Update `hub/data.js`; take screenshots with `node tools/walkthrough.mjs` and refresh timings with `node tools/hub-timings.mjs`. (`tools/capture.mjs` still drives pass 1 and needs updating before it can record pass-2 clips.) Only Marc approves anything.
- **Run:** `npm run dev`. **Verify:** `npm run playtest` (13 checks), `node tools/walkthrough.mjs` for screenshots. Look at the screenshots, not only the JSON.
- **Models:** the opening's assets come from `blender/build_kit.py` (modules in `blender/kit/`; materials are named from `src/world/materials.js`), Marc from `blender/build_marc.py`, then `node tools/optimize-assets.mjs`. Don't hand-edit files in `public/assets/models/`. Record any downloaded asset in `CREDITS.md` with its license.
- **Names the code depends on:** Marc's bones `mixamorigHips` / `mixamorigLeftHand` / `mixamorigHead`… and clips `Walk`, `Climb`, `Frustrated`; kit material names (`Stucco`, `RoofTile`, `Leaves`, `WindowGlow`…); `house_hostage_glow*` objects.
- **Style:** Marc's pass-2 images: textured, painterly-realistic, golden-hour light, dense foliage masses, clean readable paths; Florida canal neighborhood. The concept art is outside the repo (`hub/refs-local/` is gitignored) and should not be committed.
- **Git:** push to `github.com/Marcsarno/survival`.
- **Deploy:** run npm run deploy. It publishes to https://sarno-survive.vercel.app (Vercel project sarno-survive, team "Marc Sarno", account marc731@gmail.com). Never use the hornerxpress account. Check npx vercel whoami first; it should print marc731-6361.
