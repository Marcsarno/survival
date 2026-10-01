# Sarno Survive

A story-first survival game for phones, set in South Florida after the power is gone. You play Marc, a father trying to reach his daughter.

This build is the **opening, neighborhood pass**. Marc is already searching an abandoned neighborhood when the game starts:
- **The street:** a boarded-up house behind a broken gate, a car left on a flat tire with a suitcase spilled beside it, and her small prints in the mud.
- **The backyards:** round the house and through the backyards; a locked gate he climbs; a park where a swing is still moving.
- **Her bunny:** by a broken fence. Then her call. He runs: through the mud, or around on firm ground.
- **The house:** a figure leaves the window, and he is told "Stay there."

The confrontation at the door, and everything after it, is later work. Lines are text only for now.

It is built with Three.js and Vite and runs in a desktop or phone browser, designed for portrait phones.

**Live site:** <https://sarno-survive.vercel.app> still runs the previous build (pass 2, the seawall walk) until this one is deployed.

> Earlier builds: pass 2 is at git tag `baseline-opening-pass2-2026-10-01`; the long-route slice at `baseline-opening-route-2026-09-30`; the sandbox (nine areas, inventory, crafting, combat) at `baseline-sandbox-2026-09-30`.

## Run it

Requires Node 20+ (tested with Node 24.19).

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Press **Start**. On a phone on the same network, open the `Network:` address that Vite prints.

For a production build: `npm run build`, then `npm run preview` serves `dist/` at <http://localhost:4173>. `npm run deploy` publishes it to Vercel (see `docs/STATE.md` → Deployment).

## Controls

| | Keyboard | Touch (portrait) |
|---|---|---|
| Walk (a methodical search pace) | WASD / arrows (W is up-screen) | Put a thumb down anywhere on the left side and drag |
| Run (after Arianna calls) | the same keys | the same drag |
| Interact: try and climb the gate, pick up | E | E (lights up when something is in reach) |
| Sound on/off | | 🔊 |
| Pause / help | Esc or H | II |
| Restart | R, or the button on the pause and end cards | Pause → Restart |

The camera never rotates. It looks north from a fixed angle, closer and lower than before, and frames what is ahead.

## The opening

About 75 m; an agent reaches the end card in about 75 s. Each beat is a one-time trigger, never a timer. See `docs/DESIGN.md` → Opening, neighborhood pass.

| Place | What happens |
|---|---|
| The street | "Arianna?" The boarded house, the broken gate, the car on a flat tire, the suitcase, the copper oak. Through the gate, her prints: "She was here." |
| The side passage | "Arianna!" Leaves drifted against the walls between the house and the neighbor's fence. |
| The backyard | A swing creaks somewhere ahead. The gate: E, locked. E again: Marc climbs it. |
| The park | The swing still moving. Her bunny by the broken fence: E, "She wouldn't leave this." Then "Daddy!" and he runs. |
| Mud or firm ground | Straight on through a short muddy passage, or around the walled garden on concrete. |
| The house | Top-right, angled; a figure leaves the lit window; voices inside; "Stay there." |

## URL options

- `?autostart=1`: skip the start card.
- `?debug=1`: fps / position / ground / beats / draw-call overlay.
- `?dev=1`: number keys jump to the checkpoints (testing only; jumping fires the beats on the way).
- `?at=x,z`: start position.
- `?quality=low` / `?quality=high`: phones default to low.
- `?camset=a|b|pass2`: the camera candidates (A is the default). `?cam=fov,dist,pitch,lead`: camera tuning aid (not for players).

## Project hub

`hub/` is the visual production record:
- the plan and route diagram
- references and assets
- stand-in characters and motion-test clips
- before/after captures
- for this pass: the camera comparison, the findings and two short clips

Open `hub/index.html` directly, or run `npm run hub`, which serves it at <http://localhost:5173/hub/>. It is not part of the game build. The concept art stays outside the repo; `node tools/hub-refs.mjs` copies it into the gitignored `hub/refs-local/`.

## Project layout

```
src/               game code (main.js wires the systems together)
  core/            input, assets, collision, see-through occlusion
  world/           level.js (the opening), materials.js (the texture library); older builders kept for reference
  systems/         story (the beat sequence), player (Marc), camera, ambience (dust, leaves, birds), footprints, interactions, audio
  ui/              HUD, CSS
hub/               visual project hub (not shipped)
public/assets/models/   game-ready GLB files (built by Blender)
assets/source/     original downloaded models, the generated foliage PNGs, license manifest
assets/blend/      editable .blend sources for the older models
blender/           build_kit.py + kit/ (the opening's assets), build_marc.py (Marc), build_assets.py (older models), inspection helpers
tools/             playtest, walkthrough, camera-compare, smoke, fetch-polyhaven, fetch-assets, optimize-assets, hub-timings, hub-refs, perf-mobile-sim, montage, capture
docs/              STATE (current state), DESIGN (decisions and numbers), PLAYTEST, screenshots
```

## Rebuilding assets

```bash
node tools/fetch-polyhaven.mjs
node tools/fetch-assets.mjs
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/build_kit.py -- --textures
node tools/optimize-assets.mjs
```

- **Downloads:** Poly Haven textures, the HDRI and props, and Poly Pizza vehicles. All are credited in `CREDITS.md`.
- **`build_kit.py`:** builds the trees, buildings and props into `public/assets/models/kit/`. Pass `foliage`, `buildings`, `props` or `neighborhood` (this pass's additions) to rebuild one group, and `--textures` to regenerate the leaf textures.
- **`blender/build_marc.py`:** builds Marc (Walk, Run, Climb, Frustrated) from his Tripo FBX in `assets/source/marc/`. Pass absolute paths.
- **`optimize-assets.mjs`:** makes the WebP textures, including calmer `diff_soft` variants for stucco, roofs and asphalt, and compresses the models (the opening downloads about 7.6 MB).

## Automated playtest

```bash
npm run playtest
```

17 checks with real keyboard and pointer input, in Chromium:
- the start card and audio
- the fixed camera
- Marc's searching walk
- collisions
- the locked gate, the climb, and climbing back
- the run and mud against firm ground
- the swing and the tree sway still moving
- a full play-through to the end card, with beat times and walk-then-run speeds
- restart
- muted play
- desktop performance
- an emulated portrait phone

Results go to `playtest-output/results.json`.
- `node tools/walkthrough.mjs` plays it on an emulated phone, taking screenshots every few seconds. `--firm` takes the other way at the fork; `--clips` records two short canvas clips.
- `node tools/camera-compare.mjs` shoots the same views with each camera candidate.

See `docs/STATE.md` for what works, known issues and next steps, and `docs/DESIGN.md` for the decisions behind the design.
