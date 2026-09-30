# Sarno Survive — agent notes (Codex / other agents; same as CLAUDE.md)

Start with `README.md` (run, controls, layout), `docs/STATE.md` (what works, issues, next steps) and `docs/DESIGN.md` (decisions and tuning numbers). Keep those three up to date when you change things.

- **Run:** `npm run dev`. **Verify:** `npm run playtest`. All checks should pass. Look at the screenshots, not only the JSON.
- **Models:** edit `blender/build_assets.py`, then `npm run assets`, which runs Blender 5.2 in the background and then meshopt-compresses the output. Don't hand-edit files in `public/assets/models/`. Record any new downloaded model in `CREDITS.md`, with its license and your changes.
- **Names the code depends on:** bones `WristL` / `WristR` / `UpperArmL`… (three.js strips the dots) and materials `CarPaint`, `LanternGlow`, `Fire`.
- **Style:** faceted flat-shaded forms, snow on upward faces, normal human proportions, warm light against blue snow. The concept art is outside the repo (see `DESIGN.md`) and should not be committed.
- **Git:** push to `github.com/Marcsarno/survival`. **Deploy:** Vercel account marc731@gmail.com (team "Marc Sarno"), never the hornerxpress account.
