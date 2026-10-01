# Playtest report

- **Last run:** 2026-10-01, opening, neighborhood pass, local Vite dev server.
- **Harness:** `tools/playtest.mjs`, Playwright Chromium with the GPU (ANGLE/D3D11), Windows 11. Desktop 1280×720 plus an emulated 390×844 touch phone. Agent-driven with real keyboard and pointer input. Not a human, not a physical phone.
- **Result:** 17 passed, 0 failed. Raw JSON: `playtest-output/results.json`.

| Check | Result | Observed |
|---|---|---|
| load-and-start-card | pass | loadWallMs: 1914; gameLoadMs: 1739 |
| audio-starts-on-start-click | pass | audio: running |
| starts-in-the-neighborhood-mid-search | pass | subtitle: Marc: Arianna?; section: street; ground: grass |
| camera-fixed-angle | pass | before: [0,14.736]; after: [0,14.736] |
| methodical-walk-while-searching | pass | walkSpeed: 1.3; withShift: 1.3; clipNaturalSpeed: 1.25 |
| collisions-hold | pass | houseWallX: 1.42; fenceX: 3.58; carX: 2.02 |
| gate-locked-then-climb | pass | againstGateZ: -33.58; prompt after the try: Climb over; afterClimb: [1.03,-34.85]; y: 0 |
| backtrack-over-the-gate | pass | afterClimbBack: [1.03,-33.15] |
| run-and-mud | pass | firmSpeed: 3.6; firmGround: concrete; mudSpeed: 1.15; mudGround: mud; runClipSpeed: 4.48 |
| swing-and-trees-still-move | pass | swing rotation 0.096 → -0.088 in 0.6 s; 91 leaf materials, all with the wind shader |
| play-through-to-the-end | pass | endTime: 76.6; beats: search@0.6 prints@2.1 call2@10.6 creak@24.5 locked@31.4 over@37.7 park@38.3 lane@45.5 bunny@47.7 urgency@51.6 fork@52.8 reveal@60.4 argument@62.6 stay@69.6 end@75.2; missing: []; overlap: false |
| searching-walk-then-run | pass | maxSpeedWhileSearching: 1.22; maxSpeedAfterHerCall: 3.6; way: mud |
| restart-resets | pass | pos: [0.8,-0.3]; beats: ["search"]; running: false |
| muted-play-has-text | pass | muted: true; lines: 1 |
| performance-desktop | pass | fps: 53; worstFrameMs: 50.5; drawCalls: 345; tris: 244937 (desktop GPU, headless Chromium) |
| no-console-errors | pass | errors: [] |
| touch-walk-and-interact | pass | moved: 2.89; eLitAtBunny: true; carrying: true (emulated 390×844, not a physical phone) |

**Phone walk-throughs** (`tools/walkthrough.mjs`, emulated 390×844, keyboard input):

| Way | End card | Fork → the house |
|---|---|---|
| Mud | 75.2 s | 7.7 s |
| Firm | 74.7 s | 4.0 s |

Both reach the end card with no errors.

**Throttled phone emulation** (`tools/perf-mobile-sim.mjs`: 390×844, 4× CPU throttle, desktop GPU):
- 55–60 fps at all nine checkpoints.
- Worst frame 20–37 ms.
- 287–325 draw calls, 205–238k triangles.
- 7.6 MB of assets downloaded on load (models 2.9 MB, textures 3.3 MB, HDRI and other 1.4 MB).

**Notes:**
- The desktop fps check dropped to 38–41 in two runs while my own browser pane was also rendering the game on the same GPU. It was 53–59 with that pane parked.
- During the walk-through that records canvas clips, the in-game fps reads about 45 (MediaRecorder is encoding at the same time).

## Not covered

- A physical phone (iOS Safari, Android Chrome): load over a mobile network, heat, real frame rate, touch feel.
- A person playing it: whether the first screen reads, the closer camera, the walk and the run, the mud-or-firm choice, the rhythm of the quiet backyard stretch.
