# Current state

Last updated 2026-10-01. The project is the **opening, neighborhood pass**, built to Marc's visual revision of 2026-10-01 (`claude-neighborhood-visual-revision.txt`):
- **Start:** Marc already searching inside an abandoned South Florida neighborhood.
- **Camera:** closer and a little lower.
- **Look:** restrained autumn color, worn ground, selective raised grass.
- **Route:** a purposeful route among houses, side yards and a small park.
- **Pace:** her call turns the search into a run.
- **Choice:** a short muddy passage or firm ground.

Live: <https://sarno-survive.vercel.app> runs this pass (deployed 2026-10-01 at Marc's request; playtest 17/17 against it).

Builds:
- **Pass 2 (the seawall walk):** at tag `baseline-opening-pass2-2026-10-01`.
- **Slice v1 (the long route):** at tag `baseline-opening-route-2026-09-30`.
- **The sandbox:** at tag `baseline-sandbox-2026-09-30`.
- **Pass 1:** rejected and never committed.

The visual record is `hub/` (`npm run hub`), **Opening redesign** tab. It has:
- before and after captures
- the camera comparison
- the route map
- beats and timings
- the findings and fixes
- two short clips

## What works (agent-tested; see PLAYTEST.md)

- **The walk** (the street → round the boarded house → the side passage → the neglected backyard → the locked gate → the park and the swing → the bunny → "Daddy!" and the run → mud or firm ground → the house, top-right → "Stay there." → end card):
  - An agent takes about 75 s either way.
  - Both ways at the fork are tested.
  - Backtracking over the gate works.
- **First screen:**
  - the boarded windows and porch
  - the low wall and the broken gate with her prints through it
  - the car down on a flat tire with its nose in the broken fence, a suitcase dropped open, a box
  - the copper oak framing the left
- **Marc:**
  - Walks at 1.25–1.3 m/s while searching (unchanged).
  - After her call he runs (the Run clip, 3.6 m/s, played at 0.8× so the feet hold).
  - Mud drags him to 1.15 m/s.
  - Gate: he tries it, then climbs it (and can climb back).
- **Camera:** candidate A (fov 42°, 14 m, 43°). The pass-2 camera and candidate B are captured on the same views; `?camset=` switches.
- **Look:**
  - One calm stucco tinted per house (cream, sand, pale teal), with broad weathering; softer roofs.
  - Copper and rust canopies with green palms and shrubs.
  - Leaf drifts as decals.
  - Raised grass clusters at wall and fence bases.
  - Worn ground with mud and puddles; broken paving.
  - The tree sway and the moving swing are kept (and checked).
- **Foliage fixes:** the black NaN texels in every generated leaf texture, the back-face normal flip, and the striped dither (see DESIGN.md).
- **Performance:**
  - Emulated phone (4× CPU throttle, desktop GPU): 55–60 fps at all nine checkpoints.
  - 7.6 MB download.

## Known issues / limitations

- **No human playtest, no physical phone.**
- **First screen:** the copper canopy partly hides the gate post on a narrow portrait screen; the boarded windows sit near the top edge.
- **Mud:** the passage is in shadow; the puddles read best in motion. The choice of way is legible but subtle.
- **Pacing:**
  - About 14 s with no beat between the passage call and the swing creak.
  - The firm way is a little quicker than the mud.
- **Argument:** usually cut short by "Stay there." (placeholder lines).
- **Placeholders:**
  - The climb is the ledge clip scaled to the gate.
  - Idle is a held pose.
  - The flat tire is a tilt, not a modeled flat.
  - All sound is procedural.

## Next steps (suggested)

1. Marc plays it on his phone and says what is wrong.
2. Then what he asks for: a modeled flat tire and open trunk, more to find on the backyard stretch, an idle clip and a better landing, sound for the run and the mud, or the door confrontation.

## Deployment

- **Vercel project:** `sarno-survive` on the **Marc Sarno** team (`marcsarno`), account marc731@gmail.com. Live URL: <https://sarno-survive.vercel.app> (the neighborhood pass since 2026-10-01).
- **Redeploy (only when Marc asks):**
  - Run `npx vercel whoami`; it should print `marc731-6361`.
  - Then run `npm run deploy`.
  - `.vercel/project.json` is gitignored. A fresh clone needs `npx vercel link --yes --project sarno-survive --scope marcsarno` once.

## How to continue

- **Read first:** `README.md`, then `docs/DESIGN.md` (**Opening, neighborhood pass**), then the hub.
- **Assets pipeline:**
  - `node tools/fetch-polyhaven.mjs` and `node tools/fetch-assets.mjs` download the sources (no new downloads this pass).
  - Blender builds the models (Blender 5.2):
    - `blender --background --factory-startup --python blender/build_kit.py -- [foliage|buildings|props|neighborhood] [--textures]`
    - `neighborhood` rebuilds only this pass's additions and its textures.
    - `blender --background --factory-startup --python blender/build_marc.py -- <abs fbx> <abs out.glb>` (absolute paths).
  - `node tools/optimize-assets.mjs` makes the WebP textures (with `diff_soft` variants) and compresses the models.
- **After a change:**
  - `npm run playtest` (17 checks).
  - `node tools/walkthrough.mjs --clips`, and again with `--firm` and another `--out`.
  - `node tools/camera-compare.mjs`.
  - `node tools/hub-timings.mjs`, then update `hub/data.js`.
- **Dev aids:**
  - `node tools/smoke.mjs --marks=<dir>` shoots every checkpoint.
  - `?camset=a|b|pass2` and `?cam=fov,dist,pitch,lead` set the camera.
  - `?dev=1` lets keys 1–9 jump to checkpoints; `?debug=1` shows an overlay.
