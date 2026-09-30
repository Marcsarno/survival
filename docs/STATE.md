# Current state

Last updated 2026-09-30. The project is now the **opening-route slice** (commit after `c98a538` on `main`). It is live at https://sarno-survive.vercel.app (deployed 2026-09-30; the playtest passed 20 of 20 against the live site). The sandbox that preceded it is at git tag `baseline-sandbox-2026-09-30`.

The visual production record is in `hub/` (open `hub/index.html` or run `npm run hub`). Keep it updated as work lands; see `hub/README.md`.

## What works (agent-tested; see PLAYTEST.md)

- **Route:** shelter → dead-end street with four houses → backyard gate (E to open) → woods (pond, woodshed) → deeper snowy trail → the house. About 350 m. An agent walking straight took about 2 min 20 s.
- **Camera:** fixed isometric angle looking north, tracking with a look-ahead. Distance is authored per section (wider on the street and at the house, tighter in the woods). No rotation, zoom keys or cinematic mode.
- **Movement:**
  - Acceleration and deceleration, turn weight, and speed by ground (pavement 3.2, trail 2.95, snow 2.6, deep trail 2.3, deep off-trail 1.95 m/s). Jog is ×1.42 (×1.25 in deep snow).
  - Collisions slide.
  - The route corridor is a safety net that sits behind visible boundaries.
- **Animation (stand-in):** Idle, Walk and Run blend by speed. Walk and Run are phase-locked at the stride measured from the foot bones. The model now faces its direction of travel: the baseline walked backwards.
- **Footprints:**
  - Placed at the foot bone at each foot contact of the gait phase.
  - Bounded pool of 700 with a 15-minute fade, so the whole walk stays visible.
  - Deeper, darker prints in deep snow; faint prints on pavement.
- **Atmosphere:**
  - Light is authored by route progress, from blue hour to dark.
  - Snowfall and fog tighten in the deep trail.
  - The warm fire and lantern at the shelter are the only warm light until the house windows and porch lanterns.
- **End and restart:** an automatic arrival trigger at the porch fades to an end card with the walk time. "Walk it again", R, or Pause → Restart route resets position, gate, prints, timer and light.
- **Phone:** floating joystick on the left, E / jog / lantern buttons on the right, and the E button lights up when something is in reach. No page scroll or zoom.
- **Removed from this slice:** inventory and its UI, stash, shelter upgrades, hunger, warmth and health meters, goals, map, combat, the infected, the stray dog, weather squalls and saving. The code is in the baseline tag.

## Known issues / limitations

- **No physical phone test.** The touch checks ran in Chromium emulating a 390×844 viewport, with scripted input.
- **Character size on phones:** Marc is about 4–5% of screen height in portrait. That trades against the narrow portrait width, which is about 10 m across at the player. Needs Marc's judgment on a real phone.
- **Gait:** at 2.6–3.2 m/s the walk/run blend can read as a brisk power-walk. Slower walking would lengthen the route. Final animation is deferred until a final model exists.
- **Narrow stance:** the stand-in's feet leave an almost single-file track.
- **Trees near the camera** render as large dark canopies at the bottom of the frame at night. The see-through circle only clears the area around the player.
- **The first glimpse** of the house's warm light appears only at the top edge of the frame near the end of the deep trail. It could be stronger.
- **Walk time with exploration** has not been measured with a person.
- **Clips in `hub/media`** are canvas recordings: no HUD, 43–60 fps while recording.

## Next steps (suggested)

1. Marc plays on a phone and judges camera distance, character size, pacing and the house reveal.
2. Marc decides the approach's story beats (for example the distant "DAD!", or a voice from the house). None were added on purpose.
3. Bring in a final Marc model (Tripo was mentioned), then retune the gait blend and use true contact events from the new rig (`Player.onFootfall` is the hook).

## Deployment

- **Vercel project:** `sarno-survive` on the **Marc Sarno** team (`marcsarno`), account marc731@gmail.com. The live URL is <https://sarno-survive.vercel.app>.
- **Linking:** `.vercel/project.json` links this folder to the project. It is gitignored, so a fresh clone needs `npx vercel link --yes --project sarno-survive --scope marcsarno` once.
- **Redeploy:** run `npx vercel whoami` first; it should print `marc731-6361`. Then run `npm run deploy`. Vercel builds with `vercel.json` (`npm run build`, output in `dist/`). `.vercelignore` keeps the Blender, source-asset and hub folders out of the upload.
- **Verify live:** `node tools/playtest.mjs --url=https://sarno-survive.vercel.app/`

## Starting a new chat

Open this folder in Claude Code and say something like: "Read CLAUDE.md and docs/STATE.md, then let's improve X." Before any Vercel command, confirm the account is marc731, not hornerxpress.

## How to continue

Read `README.md`, then `docs/DESIGN.md`, then the hub. Run `npm run dev` while working. After a change, run `npm run playtest` (all checks should pass), look at the screenshots, capture a new hub set with `node tools/capture.mjs --set=<name>`, and update `hub/data.js`.
