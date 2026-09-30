# Playtest report

- **Last full run:** 2026-09-30, against a fresh clone of `github.com/Marcsarno/survival`, built with `npm install && npm run build` and served with `vite preview`.
- **Harness:** `tools/playtest.mjs`, Playwright Chromium with the GPU (ANGLE/D3D11), 1280×720, Windows 11.
- **Result:** 29 passed, 0 failed (the zombie pathfinding check was added later). The raw JSON is written to `playtest-output/results.json`; screenshots go to `docs/screenshots/`.

All movement, gathering, searching, combat and UI actions went through real keyboard, mouse and pointer input. Two test shortcuts were used, and both are labelled in the results:
1. Teleports that only place the player next to a wall for the collision test.
2. `player.hurt(999)` to trigger the death-and-recovery path.

Everything else was reached by walking.

## Route and checks

| # | Check | Observed |
|---|---|---|
| 1 | Fresh start (load + Start button) | Loaded in 2.8 s (local). Started in Pavilion Park, fire lit, no console errors. |
| 2 | Footprints on snow | 9 prints in about 3 s of walking; visible in `02-footprints.png` |
| 3 | Collision | Walking into the park's stucco wall stopped at x = −44.59 (wall at −44). Walking into a house front stopped at z = −12.06 (wall at −12.3 minus the player's radius). |
| 4 | Park → woods trail → woodshed | Reached on foot through the west gate |
| 5 | Gather wood | 0 → 4 split firewood (hold E) |
| 6 | Take the axe | Axe flag set |
| 7 | Woodshed → shelter | Walked back |
| 8 | Store in the stash | Stash wood went 2 → 6 and the pack emptied (`04-stash-panel.png`) |
| 9 | Feed the fire | Fuel 44.9 → 66.8 |
| 10 | Shelter → Coral Palm Dr → Hibiscus Ln → police cruiser | Walked, passing 3 areas |
| 11 | Search the cruiser | Got the pistol and 5 rounds |
| 12 | Combat at the pharmacy lot | Aimed with right mouse and fired with a click. The frozen went down; the player kept full health in this run. |
| 13 | Pharmacy aisles | Got 2 medkits, 2 food, 1 water |
| 14 | Pharmacy → service road → camp → woods → shelter | A full loop on foot. On the way the walker shot or swung at chasing zombies 26 times, as a player would. |
| 15 | Shelter → canal walk → beach | Walked |
| 16 | Driftwood | Got 2 wood (with the axe) |
| 17 | Beach → Coral Palm Dr → shelter | Walked back without getting trapped |
| 18 | Areas visited | park, cpd, woods, hibiscus, pharmacy, service, camp, canal, beach (9) |
| 19 | Day / night / lantern | Luminance around the player: day 203, night with the lantern off 86, night with it on 206 (`10-day.png`, `11-night-lantern.png`) |
| 20 | Camera | The wheel raised the camera a level; X rotated it 45° |
| 21 | Death and recovery | Woke at the shelter with 61 hp; the dropped pack appeared on the map |
| 22 | Recover the pack | Walked back and got the dropped items |
| 23 | Performance | 60 fps (vsync-capped) at the end of the desktop run |
| 24 | Console | No errors |
| 25 | Touch layout | Simulated 390×844 touch viewport: touch controls shown, joystick drag moved the player 3.9 m. This was **not** a physical phone. |

## Visual comparison against the concept anchors

The anchor list is in `DESIGN.md`. Screenshots are in `docs/screenshots/`.

**Matching**
- Stucco houses with snow-laden barrel-tile roofs, boarded windows and garages, paver driveways, mailboxes and palms, and asphalt showing through packed snow (anchor 05).
- The faceted pines and woodshed with stacked log ends and a lantern (01).
- The pink-stucco pharmacy with its canopy, boarded windows and parking lot (03).
- The playground set: swings, slide tower, arch, rubber tiles, metal fence (06).
- Bollards, dune fence and lifeguard stand (07).
- Seawall, docks and patios (08).
- The tile-roof pavilion with tarps, crates and lantern (11).
- Warm lantern and fire light against blue snow at night, footprints behind the player, and normal human proportions.

**Remaining differences**
- The concept views are more densely dressed: potted plants, more hedges, bikes, arched entries.
- Canal ice floes are simple polygons.
- The frozen read as pale, weathered people rather than obviously decayed.
- Roof snow is a repeating texture, not modelled drifts.
- The default camera sits a little higher than most concept frames. C gives a low cinematic view, and the wheel or +/− adjust the height.

## Performance notes

- **Desktop** (this machine, Chromium with the GPU): 60 fps capped, about 600–800 draw calls and about 500k triangles including the shadow pass. Frame-time spikes of about 110 ms showed up during automated runs; they coincide with Playwright screenshot capture, but the cause isn't confirmed.
- **Download:** 3.8 MB of meshopt-compressed models plus 218 KB of gzipped JavaScript.
- **Phones:** not measured on a real device. Phones get `quality=low` automatically: 1.25× pixel ratio, 1024 px shadows, half the snow particles, no antialiasing.
- **Phone approximation** (`tools/perf-mobile-sim.mjs`): a 390×844 touch viewport at 3× device scale, with the CPU throttled 4× through Chrome DevTools, on this PC's GPU. This approximates a mid-range phone's CPU, not its GPU.

  | Change | Frame rate | Draw calls |
  |---|---|---|
  | Before optimizing | 28–33 fps | 500–850 |
  | Plain materials baked into vertex colors | 30–33 fps | 440–570 |
  | Characters and animals beyond 55 m not drawn or animated | 43–54 fps | 280–370 |
  | Character meshes joined, one material each, in Blender | **58–60 fps** | 200–330 |

  Load time under the 4× CPU throttle was 5.7–6 s (local server).
