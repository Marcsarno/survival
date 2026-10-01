# Current state

Last updated 2026-09-30. The project is **opening pass 2**, built to Marc's direction after he stopped pass 1:
- **Marc:** his own Tripo model.
- **Look:** his five style images as the visual target, with real assets, textures and Blender.
- **Route:** a varied walk ending at a locked gate he climbs, then the house, angled top-right.
- **Pace:** no mud route and no sprint.
- **Lines:** text only, no AI voice.

Builds:
- **Pass 1 (rejected):** a log, a mud split, graybox. Never committed.
- **Slice v1 (the long route):** at tag `baseline-opening-route-2026-09-30`. It is still what the live site <https://sarno-survive.vercel.app> runs.
- **The sandbox:** at tag `baseline-sandbox-2026-09-30`.

The visual record is `hub/` (`npm run hub`), **Opening redesign** tab.

## What works (agent-tested; see PLAYTEST.md)

- **The walk:** the seawall promenade → the pump house → east into the park → her prints in the playground sand → north up a leafy lane → the bunny → a locked gate → over it → the house, angled top-right with its front facing south-west → "Stay there." → end card.
  - An agent takes about 94 s.
  - A beat comes every 8–15 s, except park → bunny (about 23 s).
- **Marc:** the Tripo model with its rig.
  - Walk plays at its own pace (about 1.25 m/s, slower on sand). There is no run.
  - Idle is a held neutral pose with breathing.
  - His head turns toward the swing, the prints, the bunny and the house.
  - At the gate he kicks the latch (the Frustrated clip), then climbs it (the Climb clip, scaled to the gate) and drops down the far side.
- **Story:** one-time triggers and one text queue (no overlapping lines). Speaker-labeled lines plus italic sound captions. Restart resets everything.
- **Look:**
  - **Blender kit** (`blender/build_kit.py`): trees, palms, shrubs and palmettos from generated leaf textures; four houses with clay-tile or flat roofs; fences, the gate and the playground; dock, cooler, bunny and branch.
  - **Poly Haven:** textures, HDRI and props.
  - **Poly Pizza:** vehicles and the rowboat.
  - **Ground:** splat-mapped (grass, leaf litter, sand, dirt).
  - **Water:** animated, with sky reflections.
  - **Light:** golden-hour sun that sinks along the walk, candle-lit windows.
  - **Ambience:** swaying foliage, a swing that keeps moving, a bobbing boat, drifting dust and leaves, birds now and then.
- **Sound (procedural placeholders):** wind, insects, water by the seawall, the swing creak, footsteps by surface, the gate rattle, the door, a tension drone.
- **Size:** about 11 MB of assets.
  - Emulated phone, 4× CPU throttle, desktop GPU: 60 fps at every checkpoint.
  - 230–320k triangles and 200–285 draw calls on screen.

## Known issues / limitations

- **No human playtest yet, and no physical phone.**
- **The look:** much closer to the references but not there yet.
  - Open ground (the park) reads flat.
  - No ambient occlusion or contact shadows.
  - Foliage is generated leaf cards, not painted art.
- **The climb** reuses a ledge-climb clip, then a dropped landing; it reads at game distance but is not a true over-the-gate animation.
- **No idle clip:** idle is a held pose.
- **Placeholders:**
  - The argument and "Stay there." are placeholder lines.
  - All sound is a procedural placeholder.
- **The pharmacy strip** (reference 8) is not in this route.

## Next steps (suggested)

1. Marc plays it and says what is wrong.
2. Then the next visual pass (ground clutter, contact shadows, a better landing, an idle clip) or the door confrontation.
3. Deploy when Marc wants it live.

## Deployment

- **Vercel project:** `sarno-survive` on the **Marc Sarno** team (`marcsarno`), account marc731@gmail.com. Live URL: <https://sarno-survive.vercel.app> (opening pass 2 since 2026-10-01).
- **Redeploy:**
  - Run `npx vercel whoami`; it should print `marc731-6361`.
  - Then run `npm run deploy`.
  - `.vercel/project.json` is gitignored. A fresh clone needs `npx vercel link --yes --project sarno-survive --scope marcsarno` once.

## How to continue

- **Read first:** `README.md`, then `docs/DESIGN.md` (**Opening, pass 2**), then the hub.
- **Assets pipeline:**
  - `node tools/fetch-polyhaven.mjs` and `node tools/fetch-assets.mjs` download the sources.
  - Blender builds the models (Blender 5.2 path in package.json):
    - `blender --background --factory-startup --python blender/build_kit.py -- [foliage|buildings|props]`
    - `blender --background --factory-startup --python blender/build_marc.py -- <fbx> public/assets/models/marc.glb`
  - `node tools/optimize-assets.mjs` makes the WebP textures and compressed models.
- **After a change:**
  - `npm run playtest` (13 checks).
  - `node tools/walkthrough.mjs` (screenshots every few seconds plus beat times).
  - `node tools/hub-timings.mjs`, then update `hub/data.js`.
- **Dev aids:**
  - `node tools/smoke.mjs --marks=<dir>` shoots every checkpoint.
  - `?cam=fov,dist,pitch,lead` gives a test camera.
  - `?dev=1` lets keys 1–7 jump to checkpoints; `?debug=1` shows an overlay.
