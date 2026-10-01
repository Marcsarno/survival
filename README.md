# Sarno Survive

A story-first survival game for phones, set in a snowbound South Florida after the power is gone. You play Marc, a father trying to reach his daughter.

This build is **opening pass 2**. Marc (his own model) is already searching for his daughter when the game starts:
- He walks the seawall of a Florida canal at golden hour, then crosses a park where a swing is still moving.
- He finds Arianna's prints in the playground sand, then her stuffed bunny in a leafy lane.
- He hears her call, finds a gate locked, and climbs it.
- He reaches a house where a figure leaves the window, and is told "Stay there."

The confrontation at the door, and everything after it, is later work. Lines are text only for now.

It is built with Three.js and Vite and runs in a desktop or phone browser, designed for portrait phones.

**Live site:** <https://sarno-survive.vercel.app> still runs the previous build (slice v1, the long route) until this one is deployed.

> Earlier builds: the long-route slice is at git tag `baseline-opening-route-2026-09-30`; the sandbox (nine areas, inventory, crafting, combat) is at `baseline-sandbox-2026-09-30`.

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
| Walk (one methodical pace, no run) | WASD / arrows (W is up-screen) | Put a thumb down anywhere on the left side and drag |
| Interact: pick up, open, climb | E | E (lights up when something is in reach) |
| Sound on/off | | 🔊 |
| Pause / help | Esc or H | II |
| Restart | R, or the button on the pause and end cards | Pause → Restart |

The camera never rotates. It looks north from a fixed angle and frames what is ahead.

## The opening

About 110 m; an agent reaches the end card in about 94 s. Each beat is a one-time trigger, never a timer. See `docs/DESIGN.md` → Opening, pass 2.

| Place | What happens |
|---|---|
| The seawall | "Arianna?" The canal, a dock and rowboat, a toppled chair and cooler, a fallen street lamp. |
| The park | A swing creaks ahead; her small prints cross the playground sand: "She was here." |
| The lane | Her bunny by a broken fence: E, "She wouldn't leave this." Then "Daddy!" from ahead. |
| The gate | E: locked. E again: Marc climbs it. |
| The house | Top-right, angled; a figure leaves the lit window; voices inside; "Stay there." |

## URL options

- `?autostart=1`: skip the start card.
- `?debug=1`: fps / position / ground / beats / draw-call overlay.
- `?dev=1`: keys 1–7 jump to the checkpoints (testing only; jumping fires the beats on the way).
- `?at=x,z`: start position. `?t=20`: fix the hour instead of the authored light.
- `?quality=low` / `?quality=high`: phones default to low.
- `?cam=fov,dist,pitch,lead`: camera tuning aid (not for players).

## Project hub

`hub/` is the visual production record: plan, route diagram, references, assets, stand-in characters, motion-test clips and before/after captures. Open `hub/index.html` directly, or run `npm run hub`, which serves it at <http://localhost:5173/hub/>. It is not part of the game build. The concept art stays outside the repo; `node tools/hub-refs.mjs` copies it into the gitignored `hub/refs-local/`.

## Project layout

```
src/               game code (main.js wires the systems together)
  core/            input, assets, collision, see-through occlusion
  world/           level.js (the opening), materials.js (the texture library); older builders kept for reference
  systems/         story (the beat sequence), player (Marc), camera, ambience (dust, leaves, birds), footprints, interactions, audio
  ui/              HUD, CSS
hub/               visual project hub (not shipped)
public/assets/models/   game-ready GLB files (built by Blender)
assets/source/     original downloaded models + license manifest
assets/blend/      editable .blend sources for every built model
blender/           build_kit.py + kit/ (the opening's assets), build_marc.py (Marc), build_assets.py (older models), inspection helpers
tools/             playtest, walkthrough, smoke, fetch-polyhaven, fetch-assets, optimize-assets, hub-timings, hub-refs, perf-mobile-sim, montage, capture
docs/              STATE (current state), DESIGN (decisions and numbers), PLAYTEST, screenshots
```

## Rebuilding assets

```bash
node tools/fetch-polyhaven.mjs
node tools/fetch-assets.mjs
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/build_kit.py
node tools/optimize-assets.mjs
```

- **Downloads:** Poly Haven textures, the HDRI and props, and Poly Pizza vehicles. All are credited in `CREDITS.md`.
- **`build_kit.py`:** builds the trees, buildings and props into `public/assets/models/kit/`. Pass `foliage`, `buildings` or `props` to rebuild one group.
- **`blender/build_marc.py`:** builds Marc from his Tripo FBX in `assets/source/marc/`.
- **`optimize-assets.mjs`:** makes the WebP textures and compresses the models (about 11 MB in all).

## Automated playtest

```bash
npm run playtest
```

13 checks with real keyboard and pointer input, in Chromium:
- the start card and audio
- the fixed camera
- Marc's walk (no run)
- collisions
- the locked gate and the climb
- a full play-through to the end card, with beat times
- restart
- muted play
- an emulated portrait phone

Results go to `playtest-output/results.json`. `node tools/walkthrough.mjs` plays it on an emulated phone, taking screenshots every few seconds.

See `docs/STATE.md` for what works, known issues and next steps, and `docs/DESIGN.md` for the decisions behind the design.
