# Playtest report

- **Last full run:** 2026-09-30, opening-route slice, local Vite dev server.
- **Harness:** `tools/playtest.mjs`, Playwright Chromium with the GPU (ANGLE/D3D11), Windows 11. It runs desktop 1280×720 plus an emulated 390×844 touch phone (deviceScaleFactor 2). The phone is emulated in Chromium, not a physical device.
- **Result:** 20 passed, 0 failed. The raw JSON is in `playtest-output/results.json`; screenshots are in `docs/screenshots/`.

Movement, the gate, the route, the end card and restart all went through real keyboard and pointer input. Test shortcuts, all labelled: teleports place the player for the collision, boundary and touch-gate checks, and `resetRoute()` is called before the full walk.

| Check | Observed |
|---|---|
| Load and start card | ≈4.3 s to load locally; the start card shows Start and Restart route |
| No inventory or survival UI | No inventory, meters, map, goals, stash panel, reticle or zoom buttons in the page |
| Camera fixed | Z, X, C, Q, E and the mouse wheel change nothing; the camera's offset from its focus never gains an x part |
| Acceleration | 0.38 m/s after 90 ms, 2.54 m/s after 1.2 s (snow) |
| Stopping | Stops about 0.5 s after release, sliding 0.28 m |
| W walks north | 2.5 m north in 1.2 s with no sideways drift |
| No prints while standing | Count unchanged over 2 s |
| Collision | Pushing west into the shelter's stucco wall stops at x = −12.41 (wall at −13) |
| Turning weight | Reversing drops to 1.8 m/s while he turns |
| Gate | Pushing north against the closed gate stays at z = −89.54; E opens it |
| Full route | Shelter → street → woods → deep trail → house. Walk time 2:20 (agent steering straight between waypoints) over 355 m walked |
| End card | Shown with the walk time |
| Footprints | 371 prints over 355 m (0.96 m per print), 0 m above the ground, largest same-foot gap within the run stride |
| Restart | Position, gate, prints, timer and modal all reset |
| Route boundaries | Pushing sideways at three points in the woods and deep trail stays within the corridor |
| Performance (desktop GPU) | 60 fps. Worst frame 181 ms, a one-off spike; screenshot capture is the likely cause but this was not isolated |
| Console errors | None |
| Touch joystick | A drag on the left side walks 4.1 m north |
| No page scroll or zoom | scrollY 0, visualViewport scale 1 after a tap and a wheel |
| Touch E button | Lights up at the gate and opens it |

## Not covered

- A physical phone (iOS Safari, Android Chrome): performance, safe areas and how the touch controls feel.
- A human first-time walk: exploration time and whether the route reads without help.
- Long sessions. The slice is two to three minutes.
