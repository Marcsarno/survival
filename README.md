# Sarno Survive

A story-first survival game for phones, set in a snowbound South Florida after the power is gone. You play Marc, a father trying to reach his daughter.

This build is the **opening-route test**: a compact, linear, playable approach. Marc leaves the family's shelter, passes the last houses of a small neighborhood, opens a backyard gate into the woods, follows a deeper snowy trail, and reaches the house where Arianna is being held. The confrontation at the door and everything after it are later work. It is graybox: stand-in character, simple geometry, lighting and layout first.

It is built with Three.js and Vite and runs in a desktop or phone browser, designed for portrait phones.

> The earlier sandbox build (nine areas, inventory, crafting, combat) is preserved at git tag `baseline-sandbox-2026-09-30`. The live site https://sarno-survive.vercel.app still shows that sandbox until the slice is deployed.

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
| Walk | WASD / arrows. W is north, up-screen | Put a thumb down anywhere on the left side and drag (floating stick) |
| Jog (a modest step up) | hold Shift | 🏃 on/off |
| Interact (the gate) | E | E (lights up when something is in reach) |
| Lantern | L | 🏮 |
| Pause / help | Esc or H | II |
| Restart the route | R, or the button on the pause and end cards | Pause → Restart route |

The camera never rotates. It looks north from a fixed isometric angle and leads toward where you are going.

## The route

About 350 m. An agent walking straight between waypoints takes about 2 min 20 s; a first exploratory walk will take longer.

| Section | What's there | Feel |
|---|---|---|
| Shelter | Tile-roof pavilion, fire pit, lantern, low stucco walls. The only exit is a gap in the north wall. | Warmth and fragile safety |
| Neighborhood edge | A dead-end street: four stucco houses, cars, dead power lines, a snowman, a swing set. Backyard fences close it in. | Ordinary family life, abandoned |
| The gate | A wooden gate in the back fence at the cul-de-sac. E to open. | Leaving the last safe-looking place |
| Woods | A packed trail between tree-covered banks, a frozen pond, an old woodshed, rail-fence remnants, deer and rabbits | Isolation, narrower views |
| Deeper snowy trail | Deep snow slows you; drifts, dead pines, a fallen log; the fog closes in | Effort, darkness |
| The house | A lone stucco house in a clearing, warm light in the windows and on the porch. Reaching the porch shows the end card. | A small warm light that feels wrong |

The light is authored by progress along the route, not by a clock: blue hour at the shelter, full dark at the house.

## URL options

- `?autostart=1`: skip the start card.
- `?debug=1`: fps / position / ground type / draw-call overlay.
- `?dev=1`: keys 1–8 jump to route checkpoints (testing only).
- `?at=x,z`: start position. `?t=20`: fix the hour instead of the authored light.
- `?quality=low` / `?quality=high`: phones default to low.
- `?cam=fov,dist,pitch,lead`: camera tuning aid (not for players).

## Project hub

`hub/` is the visual production record: plan, route diagram, references, assets, stand-in characters, motion-test clips and before/after captures. Open `hub/index.html` directly, or run `npm run hub`, which serves it at <http://localhost:5173/hub/>. It is not part of the game build. The concept art stays outside the repo; `node tools/hub-refs.mjs` copies it into the gitignored `hub/refs-local/`.

## Project layout

```
src/               game code (main.js wires the systems together)
  core/            input, assets, collision, see-through occlusion
  world/           route.js (the level), procedural builders, ground, textures
  systems/         player (locomotion), camera, day/night light, footprints, snowfall, wildlife, interactions, audio
  ui/              HUD, CSS
hub/               visual project hub (not shipped)
public/assets/models/   game-ready GLB files (built by Blender)
assets/source/     original downloaded models + license manifest
assets/blend/      editable .blend sources for every built model
blender/           build_assets.py (repeatable build), inspect_glb.py, render_sheet.py
tools/             playtest, capture (hub screenshots and clips), montage, frames, webm-duration, hub-refs, asset tools
docs/              STATE (current state), DESIGN (decisions and numbers), PLAYTEST, screenshots
```

## Rebuilding assets

```bash
npm run fetch-assets
npm run assets
```

`npm run assets` rebuilds every GLB with Blender 5.2 in the background; append `-- pine-1 palm-2` to rebuild only named models. The script expects Blender at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`. No models changed in the opening-route revision.

## Automated playtest

```bash
npm run playtest
```

Starts a dev server on port 5199 and drives the game in Chromium with real keyboard and pointer input. It covers the start card, the fixed camera, acceleration and stopping, collisions, the route boundaries, the gate, footprints, the full walk to the house, the end card, restart, and an emulated portrait touch phone. Results go to `playtest-output/results.json`; screenshots go to `docs/screenshots/`. Use `--headed` to watch, or `--only=move,route,touch` to run part of it.

For hub captures: `node tools/capture.mjs --set=<name>` writes phone and desktop screenshots and motion clips to `hub/media/<name>/`.

See `docs/STATE.md` for what works, known issues and next steps, and `docs/DESIGN.md` for the decisions behind the design.
