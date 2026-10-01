# Playtest report

- **Last run:** 2026-10-01, opening pass 2, local Vite dev server.
- **Harness:** `tools/playtest.mjs`, Playwright Chromium with the GPU (ANGLE/D3D11), Windows 11. Desktop 1280×720 plus an emulated 390×844 touch phone. Agent-driven with real keyboard and pointer input. Not a human, not a physical phone.
- **Result:** 13 passed, 0 failed. Raw JSON: `playtest-output/results.json`.

| Check | Result | Observed |
|---|---|---|
| load-and-start-card | pass | loadWallMs: 2221; gameLoadMs: 2016 |
| audio-starts-on-start-click | pass | audio: running |
| starts-on-the-seawall-mid-search | pass | subtitle: Marc: Arianna?; ground: concrete |
| camera-fixed-angle | pass | before: [0,15.476]; after: [0,15.476] |
| methodical-walk-no-run | pass | walkSpeed: 1.3; withShift: 1.3; clipNaturalSpeed: 1.25 |
| collisions-hold | pass | parapetX: -2.43; fenceX: 4.13 |
| gate-locked-then-climb | pass | againstGateZ: -69.78; promptAfterTry: <kbd>E</kbd> Climb over; afterClimb: [23.2,-71.05]; y: 0 |
| play-through-to-the-end | pass | failAt: null; endTime: 93.6; beats: search@0.6 call2@15 creak@24.4 park@32.7 prints@41.1 lane@56.5 bunny@64.3 urgency@68.2 locked@73.9 over@79.7 reveal@79.7 argument@82.3 stay@86.8 end@92.2; missing: []; overlap: false |
| restart-resets | pass | pos: [-0.6,9.5]; beats: ["search"] |
| muted-play-has-text | pass | muted: true; lines: 1 |
| performance-desktop | pass | fps: 60; worstFrameMs: 58.7; drawCalls: 248; tris: 243380; note: desktop GPU, headless Chromium |
| no-console-errors | pass | errors: [] |
| touch-walk-and-interact | pass | moved: 3.05; eLitAtBunny: true; carrying: true; note: emulated 390x844, not a physical phone |

**Throttled phone emulation** (`tools/perf-mobile-sim.mjs`: 390×844, 4× CPU throttle, desktop GPU): 60 fps at all seven checkpoints. Worst frame 18–66 ms, 222–285 draw calls, 234–319k triangles.

## Not covered

- A physical phone (iOS Safari, Android Chrome): load time over a mobile network (about 11 MB), heat, frame rate, touch feel.
- A person playing it: the rhythm, whether the clues read, whether the gate and the house land.
