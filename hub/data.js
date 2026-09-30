// Hub content. Edit this file to update the hub; hub.js renders it. Paths are relative to hub/.
// Status values: reference | planned | implemented | agent-tested | approved | unverified | superseded.
// "approved" means Marc said so in chat. Never set it on anything else.
const B = 'media/baseline/', S = 'media/slice-v1/', R = 'refs-local/';
const REF_MISSING = 'Concept art is kept outside the repo. Run `node tools/hub-refs.mjs` on Marc\'s machine to copy it into hub/refs-local/.';
const ref = (file, label, note) => ({ status: 'reference', file: R + file, label, note, missing: REF_MISSING });
const base = (file, label, note) => ({ status: 'superseded', file: B + file, label, note });
const v1 = (file, label, note) => ({ status: 'agent-tested', file: S + file, label, note });

window.HUB = {
  updated: '2026-09-30 (pass 4: slice v1 playtested by the agent)',

  overview: {
    intro: 'Working record for the opening-slice revision. Everything here is a local file; another agent can continue from this folder, docs/STATE.md and docs/DESIGN.md.',
    goal: 'A compact, linear opening route for portrait phones: Shelter → small neighborhood edge → woods → deeper snowy trail → the house where Arianna is being held. Fixed isometric camera, grounded stand-in movement, visible footprints. No inventory, combat, dialogue or cinematics in this slice. It should feel like a worried father moving from fragile safety toward a dangerous house.',
    builds: [
      { status: 'agent-tested', label: 'Local dev build: http://localhost:5173/', href: 'http://localhost:5173/', note: 'Run `npm run dev` in the project folder first. ?debug=1 shows fps, position and ground type; ?dev=1 adds keys 1–8 to jump to checkpoints.' },
      { status: 'agent-tested', label: 'Live site: https://sarno-survive.vercel.app', href: 'https://sarno-survive.vercel.app', note: 'The slice, deployed 2026-09-30 at Marc’s request. The playtest passed 20 of 20 against it.' },
      { status: 'reference', label: 'Baseline source: git tag baseline-sandbox-2026-09-30', note: 'The sandbox before this revision (commit 176d7a5). `git checkout baseline-sandbox-2026-09-30` restores it.' },
    ],
    controls: [
      { action: 'Walk', keys: 'WASD / arrows (W = north = up-screen)', touch: 'Thumb down anywhere on the left side, drag (floating stick)' },
      { action: 'Jog (modest)', keys: 'Hold Shift', touch: '🏃 on/off' },
      { action: 'Interact (the gate)', keys: 'E', touch: 'E (lights up when something is in reach)' },
      { action: 'Lantern', keys: 'L', touch: '🏮' },
      { action: 'Pause / help', keys: 'Esc or H', touch: 'II' },
      { action: 'Restart the route', keys: 'R, or the button on the pause and end cards', touch: 'Pause → Restart route' },
    ],
    progress: [
      { status: 'implemented', item: 'Visual project hub', note: 'This page. Baseline captures were taken from the old build before any gameplay change.' },
      { status: 'implemented', item: 'Recoverable baseline', note: 'Git tag baseline-sandbox-2026-09-30.' },
      { status: 'agent-tested', item: 'Fixed isometric tracking camera', note: 'Always looks north. No rotation, zoom keys or cinematic mode. Look-ahead toward north and the direction of motion. Distance is authored per section: wider on the street and at the house, tighter in the woods.' },
      { status: 'agent-tested', item: 'Compact authored route (347 m centerline)', note: 'Shelter, four-house dead-end street, backyard gate, woods with the pond and an old woodshed, deeper trail, the house clearing.' },
      { status: 'agent-tested', item: 'Inventory and survival UI removed', note: 'Also removed: stash, upgrades, hunger, goals, map, combat and the infected. The code is recoverable from the baseline tag.' },
      { status: 'agent-tested', item: 'Movement feel', note: 'Acceleration and deceleration, turn weight, speed by ground, collision slide, walk/run blend at the measured stride. Fixed: the stand-in walked backwards in the baseline.' },
      { status: 'agent-tested', item: 'Footprints', note: 'Placed at the foot bone when the gait passes a foot contact. Bounded pool of 700, long fade. None while standing.' },
      { status: 'agent-tested', item: 'Gate interaction, arrival card, restart', note: 'The gate blocks until opened (E). An automatic arrival trigger at the porch shows the end card and walk time.' },
      { status: 'agent-tested', item: 'Automated playtest: 20 of 20 checks pass', note: '`npm run playtest`. Covers desktop keyboard and an emulated portrait touch phone.' },
    ],
    checks: [
      ['load-and-start-card', 'Loads (≈4.3 s) and shows the start card'], ['no-inventory-or-survival-ui', 'No inventory, meters, map, goals or zoom buttons'],
      ['camera-fixed-angle', 'Rotation/zoom keys and the wheel do nothing; the camera never rotates'], ['movement-accelerates', '0.38 m/s after 90 ms, 2.54 m/s after 1.2 s'],
      ['movement-stops-reliably', 'Stops in ≈0.5 s, sliding 0.28 m'], ['no-footprints-while-standing', 'Print count unchanged over 2 s idle'],
      ['collision-shelter-wall', 'Pushing into the stucco wall stops cleanly'], ['turning-has-weight', 'Reversing slows to 1.8 m/s while turning'],
      ['gate-blocks-then-opens', 'Blocked at z −89.5 until E, then opens'], ['route-walkable-to-house', 'Shelter → house with keyboard steering: 140 s agent walk (355 m)'],
      ['footprints-follow-steps', 'About 0.96 m per print at route pace, prints on the ground (0 m float)'], ['route-boundaries-hold', 'Pushing sideways in the woods and deep trail stays inside'],
      ['restart-resets-route', 'Position, gate, prints and timer reset'], ['performance-desktop', '60 fps on the desktop GPU (headless Chromium)'],
      ['touch-joystick-walks-north', 'Emulated touch drag walks north'], ['no-page-scroll-or-zoom', 'The page never scrolls or zooms'], ['touch-interact-button', 'E lights up at the gate and opens it'],
    ],
    next: [
      'Marc plays it on a real phone and judges pacing, camera distance and the character size. The character is about 4–5% of screen height in portrait.',
      'Decide the story beats for the approach (for example "DAD!" in the distance, a voice from the house). None were added: this slice tells the route through layout and light only.',
      'Import a final Marc model, then tune rigging, the walk/jog blend and true foot-contact events against it.',
    ],
    unverified: [
      'The Mr. Mak Workspace repository (github.com/witnesstodark/mr-mak-workspace) was NOT inspected: the web fetch was declined this session. This hub borrows only the general idea: one browsable place for plan, references, assets and captures.',
      'No physical phone. Phone results come from Chromium emulating a 390×844 touch viewport, driven by scripted input. Real iOS Safari and Android Chrome performance and touch feel are unknown.',
      'Walk time was measured with an agent steering straight between waypoints (2:19–2:20). A person exploring for the first time will take longer; not measured.',
      'Nothing in this hub is approved by Marc yet.',
    ],
    howto: [
      'Open hub/index.html directly in a browser, or run `npm run hub`, which serves it at http://localhost:5173/hub/.',
      'Content is in hub/data.js. Captures are in hub/media/<set>/, written by `node tools/capture.mjs --set=<name>`. Each set\'s capture.json records the test conditions.',
      'Review helpers: `node tools/montage.mjs out.png a.png b.png …` (contact sheet) and `node tools/frames.mjs clip.webm out.png` (frames from a clip).',
      'Concept references go in hub/refs-local/ (gitignored) via `node tools/hub-refs.mjs`.',
      'The hub is not part of the game build: Vite bundles only the root index.html.',
    ],
  },

  route: {
    intro: 'One linear route. General travel is north (up-screen). Bends, openings and terrain change the composition. Boundaries are walls, fences, houses, a dense tree band on banks that rise either side of the trail, rocks and drifts. A corridor limit exists only as a safety net behind those boundaries.',
    legend: 'Dashed purple: the plan from pass 1. Solid blue: the implemented centerline. Meters; north is up.',
    planned: [[0, 12], [0, -10], [3, -24], [8, -50], [6, -72], [2, -88], [-4, -100], [-16, -122], [-12, -146], [4, -166], [10, -188], [2, -210], [-12, -232], [-14, -254], [-2, -274], [8, -292], [10, -310]],
    implemented: [[-1, 14], [-1, 2], [0, -10], [0, -12], [1, -24], [2, -50], [3, -78], [3, -89], [3, -93], [-3, -102], [-14, -122], [-15, -140], [-4, -160], [8, -180], [6, -202], [-6, -222], [-13, -242], [-9, -262], [2, -280], [9, -293], [10, -304], [10, -312]],
    markers: [{ x: -2.4, z: 13.2, label: 'Start (fire)' }, { x: 3, z: -90, label: 'Gate', color: '#2f7fc1' }, { x: -23.5, z: -140, label: 'Pond', color: '#6f95b6' }, { x: 13, z: -176, label: 'Woodshed', color: '#8a6547' }, { x: 10, z: -321, label: 'The house', color: '#b23b3b' }],
    sections: [
      { id: 'shelter', name: 'Shelter', band: [22, -12], color: '#f2c57c', status: 'agent-tested', time: '≈10 s', feel: 'A small pocket of warmth and fragile safety.',
        detail: 'Tile-roof pavilion with crates and a hanging lantern, the fire pit with log benches, low stucco walls. The fire and the lantern are the only warm light until the house. The only way out is a gap in the north wall, so you walk around the pavilion first.',
        shots: [{ title: 'Shelter', versions: [ref('11-home-pavilion.png', 'Reference: 11 home pavilion'), base('phone-start.png', 'Baseline sandbox (phone)'), v1('phone-shelter.png', 'Slice v1 (phone)'), v1('desktop-start.png', 'Slice v1 (desktop)')] }] },
      { id: 'street', name: 'Neighborhood edge', band: [-12, -90], color: '#e7d3c3', status: 'agent-tested', time: '≈25 s', feel: 'Traces of ordinary family life, abandoned.',
        detail: 'A short dead-end street: four stucco houses with barrel-tile roofs and boarded windows, cars, mailboxes, dead utility lines, a snowman, a swing set, a bicycle and two lawn flamingos. Backyard fences close it in. At the cul-de-sac a wooden gate in the back fence is the way into the woods (E to open).',
        shots: [{ title: 'Street', versions: [ref('12-gameplay-two-routes.png', 'Reference: 12 two routes'), base('phone-street.png', 'Baseline sandbox street'), v1('phone-street.png', 'Slice v1 street')] },
          { title: 'The gate', versions: [v1('phone-gate.png', 'Slice v1: gate closed, E prompt')] }] },
      { id: 'woods', name: 'Woods', band: [-90, -206], color: '#b9cbb8', status: 'agent-tested', time: '≈45 s', feel: 'Greater isolation, narrower views, fewer signs of safety.',
        detail: 'A packed trail between banks of pines and firs, bending west then east. It skirts a frozen pond (the view opens, and you can step onto the ice) and passes an old unlit woodshed. There are split-rail fence remnants, fallen logs and stumps. Deer, rabbits and a fox flee if you get close.',
        shots: [{ title: 'Woods', versions: [ref('06-snowy-woodland.png', 'Reference: 06 snowy woodland'), base('phone-woods.png', 'Baseline sandbox woods'), v1('phone-woods.png', 'Slice v1 woods'), v1('phone-pond.png', 'Slice v1 pond')] }] },
      { id: 'deep', name: 'Deeper snowy trail', band: [-206, -288], color: '#a8b8cc', status: 'agent-tested', time: '≈40 s', feel: 'Harder going: deep snow slows you, the light fades, heavier snowfall.',
        detail: 'A narrower trail with deep snow (2.3 m/s on the trail, 1.95 m/s off it), bumpier ground, drifts, dead pines and a fallen log that half-blocks the way. Fog closes in and the camera sits a little closer. Near the end, a warm window first shows at the top of the frame.',
        shots: [{ title: 'Deep trail', versions: [v1('phone-deep.png', 'Slice v1 deep trail'), v1('phone-glimpse.png', 'Slice v1: first glimpse (warm light, top right)')] }] },
      { id: 'house', name: 'The house', band: [-288, -335], color: '#d7a7a0', status: 'agent-tested', time: '≈15 s', feel: 'A framed destination; a small warm light that feels unsettling.',
        detail: 'An isolated stucco house in a clearing, facing you: warm light in the windows, two lanterns on the porch, a paved path, a yard fence with a broken front rail, a dark pickup-like SUV and crates. Reaching the porch steps triggers the end card. No interior and no confrontation.',
        shots: [{ title: 'The house', versions: [ref('01-rescue-approach.png', 'Reference: 01 rescue approach'), v1('phone-house.png', 'Slice v1 approach'), v1('phone-arrival.png', 'Slice v1 at the porch (arrival)')] }] },
    ],
    assumptions: [
      'Starting at the shelter is for this test only; it does not decide how the episode opens.',
      'The light follows your progress along the route, not a clock: blue hour at the shelter, full dark at the house (hour 19.3 → 20.35). Reversible.',
      'No dialogue, captions or story text. The route reads through layout and light. The start card says only "Leave the shelter and walk north to the house in the woods."',
      'No infected or combat. Harmless deer, rabbits and a fox add life and scale in the woods.',
      'The pond, the woodshed, the swing set, the snowman and the pickup-like SUV at the house are reversible set dressing, not story decisions.',
      'The house uses the existing procedural stucco house with a porch; it faces south so the camera frames its lit windows.',
    ],
  },

  art: {
    intro: 'The visual target is simplified faceted 3D with believable proportions: cool blue snow against small warm lantern light. This pass is graybox: composition, scale, spacing and atmosphere come before materials.',
    refsNote: REF_MISSING,
    refs: [
      { status: 'reference', file: R + '01-rescue-approach.png', title: '01 Rescue approach', note: 'Primary target for the house: porch lanterns, warm window, fence, pickup, footprints leading in.', missing: REF_MISSING },
      { status: 'reference', file: R + '06-snowy-woodland.png', title: '06 Snowy woodland', note: 'Woods target: rail fences, stumps, trail footprints, dusk blue with one warm lantern.', missing: REF_MISSING },
      { status: 'reference', file: R + '11-home-pavilion.png', title: '11 Home pavilion', note: 'Shelter target: tile-roof pavilion, stucco walls, warm interior.', missing: REF_MISSING },
      { status: 'reference', file: R + '12-gameplay-two-routes.png', title: '12 Gameplay: two routes', note: 'Neighborhood target: pavers, stucco, fences, a side path along the fence.', missing: REF_MISSING },
      { status: 'reference', file: R + '05-residential-street.png', title: 'Residential street study', note: 'Street layout, barrel-tile roofs, boarded windows.', missing: REF_MISSING },
      { status: 'reference', file: R + '03-night-lantern.png', title: 'Night lantern study', note: 'Night lighting with a hand lantern.', missing: REF_MISSING },
      { status: 'reference', file: R + '01-morning-pond.png', title: 'Morning pond study', note: 'Frozen pond in the woods.', missing: REF_MISSING },
      { status: 'reference', file: R + '01-wood-shelter.png', title: 'Wood shelter reference', note: 'Woodshed, log ends, faceted pines.', missing: REF_MISSING },
      { status: 'reference', file: R + '09-home-woodland.png', title: '09 Home woodland', note: 'Alternative shelter option (not chosen for this slice).', missing: REF_MISSING },
      { status: 'reference', file: R + '10-home-house.png', title: '10 Home house', note: 'Alternative shelter option (not chosen).', missing: REF_MISSING },
      { status: 'reference', file: R + '02-family-homecoming.png', title: '02 Family homecoming', note: 'Future: the reunion (not in this slice).', missing: REF_MISSING },
      { status: 'reference', file: R + '03-supply-route.png', title: '03 Supply route', note: 'Future: the supply mission (not in this slice).', missing: REF_MISSING },
    ],
    sheets: [
      { status: 'implemented', file: '../docs/renders/built-sheet.png', title: 'Built game models', note: 'Every GLB in public/assets/models, rendered by blender/render_sheet.py (before this revision; the models are unchanged).' },
      { status: 'implemented', file: '../docs/renders/trees-v2.png', title: 'Blender-built trees', note: 'Pines, firs and palms with snow on the upward faces.' },
      { status: 'implemented', file: '../docs/renders/florida-details.png', title: 'Florida details', note: 'Iguana, flamingo, snowman.' },
      { status: 'reference', file: '../docs/renders/source-sheet.png', title: 'Downloaded source models', note: 'Originals before the Blender changes.' },
    ],
    models: [
      { status: 'agent-tested', file: 'player.glb', source: 'Adventurer, Quaternius (poly.pizza/m/5EGWBMpuXq)', license: 'CC0 1.0', use: 'Marc stand-in (Idle, Walk, Run in use)' },
      { status: 'agent-tested', file: 'pine-1..3, fir-1..2, snag, stump, fallen-log, rock-1..3, shrub-*, snow-mound-*', source: 'Built by blender/build_assets.py; stump and log from Quaternius', license: 'Project / CC0 1.0', use: 'Woods, deep trail and route boundaries' },
      { status: 'agent-tested', file: 'palm-1..3, agave, croton, palmetto', source: 'Built by blender/build_assets.py', license: 'Project', use: 'Shelter and street planting' },
      { status: 'agent-tested', file: 'car-sedan, car-suv', source: 'Built by blender/build_assets.py', license: 'Project', use: 'Street cars; the dark SUV at the house stands in for the concept pickup' },
      { status: 'agent-tested', file: 'lantern, campfire', source: 'Lantern built in Blender; Bonfire by Quaternius', license: 'Project / CC0 1.0', use: 'Warm light at the shelter and the house porch' },
      { status: 'agent-tested', file: 'snowman, flamingo', source: 'Built by blender/build_assets.py', license: 'Project', use: 'Traces of the kids who lived on the street' },
      { status: 'agent-tested', file: 'deer, fox, rabbit', source: 'Quaternius (CC0); rabbit by Poly by Google', license: 'CC0 1.0 / CC BY 3.0', use: 'Harmless wildlife in the woods' },
      { status: 'superseded', file: 'zombie-a/b, pistol, axe, medkit, food-can, matchbox, water-bottle, backpack, radio, wolf, dog, duck, owl, iguana, hedge, wood-bundle', source: 'See CREDITS.md', license: 'CC0 1.0 / CC BY 3.0 / Project', use: 'Not loaded in this slice (files kept)' },
    ],
    code: [
      { status: 'agent-tested', what: 'Stucco houses with barrel-tile roofs, garages, porches', where: 'src/world/builders.js house()', use: 'Four street houses; the destination house' },
      { status: 'agent-tested', what: 'Pavilion, stucco walls, wood and rail fences, swing set, woodshed', where: 'src/world/builders.js', use: 'Shelter, boundaries, set dressing' },
      { status: 'agent-tested', what: 'Route layout, banks, trail ribbon, gate', where: 'src/world/route.js', use: 'The whole slice' },
      { status: 'agent-tested', what: 'Faceted snow terrain, footprints, snowfall', where: 'src/world/ground.js, src/systems/footprints.js, snowfall.js', use: 'Everywhere' },
    ],
  },

  characters: {
    intro: 'Marc is the only character on screen in this slice. The stand-in is a recolored low-poly Adventurer. Final models, rigging and animation are deferred.',
    standins: [
      { status: 'agent-tested', file: S + 'phone-gait-close.png', title: 'Marc stand-in (test close-up)', note: 'Quaternius Adventurer, recolored: olive jacket, jeans, winter sleeves, backpack; 1.8 m tall. Close test camera, not the game camera.' },
      { status: 'agent-tested', file: S + 'phone-shelter.png', title: 'Marc stand-in at game scale (portrait)', note: 'About 4–5% of screen height on a phone. To be judged by Marc on a real phone.' },
      { status: 'reference', file: '../docs/renders/characters-source.png', title: 'Source character bases', note: 'Adventurer (C13) and Hooded Adventurer (C14), the two bases Marc selected for the prototype.' },
    ],
    futureNote: 'No final models are chosen yet. The brief says Marc plans to try Tripo for character models after testing Meshy. Nothing below is in the game.',
    future: [
      { status: 'reference', file: R + '01-rescue-approach.png', title: 'Marc, Arianna and the woman at the door (concept)', note: 'Target proportions and clothing read for Marc and Arianna. Concept only.', missing: REF_MISSING },
      { status: 'reference', file: R + '11-home-pavilion.png', title: 'Family at the shelter (concept)', note: 'Yola and the girls, concept only; not in this slice.', missing: REF_MISSING },
      { status: 'reference', file: R + 'characters.jpg', title: 'Character reference sheet', note: 'Poly.pizza character candidates reviewed earlier. Block-headed or chibi styles were rejected.', missing: REF_MISSING },
      { status: 'planned', title: 'Final Marc model', note: 'Planned: a generated or modeled asset (Tripo was mentioned), then rigging, and the walk/jog blend and contact events tuned to it.', missing: 'Not started' },
    ],
    roles: [
      { name: 'Marc', role: 'Player character: husband and father, not an action hero', slice: 'Playable stand-in' },
      { name: 'Arianna (7)', role: 'Older daughter, held at the house', slice: 'Not shown: the house is the destination' },
      { name: 'Yola', role: 'Wife, medical knowledge', slice: 'Not in this slice' },
      { name: 'Lilah (2)', role: 'Younger daughter', slice: 'Not in this slice' },
      { name: 'The husband and wife at the house', role: 'Desperate people, not villains', slice: 'Not shown; the confrontation is later work' },
    ],
  },

  motion: {
    deferred: 'Final rigging and animation are deferred until a final character model exists. These tests check stand-in locomotion: responsiveness, turning, stopping, ground contact and footprints.',
    intro: 'The standard test (tools/capture.mjs motionTest) is W for 3 s, release and wait 1.3 s, then D, S, A, W for 1.1 s each. Clips are recorded from the game canvas, so they show no HUD. Input is scripted keyboard input, not a human thumb on a joystick. The clips play in the hub; use the controls to scrub.',
    tests: [
      {
        status: 'superseded', title: 'M0: baseline locomotion (old sandbox build)', date: '2026-09-30', build: '176d7a5 (baseline-sandbox-2026-09-30)',
        conditions: 'Chromium, emulated 390×844 phone viewport (deviceScaleFactor 2, touch), phone quality preset, keyboard input. Camera at the default 45° yaw, so W moves north-west.',
        clips: [
          { status: 'superseded', file: B + 'clip-walk-stop.webm', title: 'Walk, stop, turn square', note: 'Baseline.' },
          { status: 'superseded', file: B + 'phone-after-motion.png', title: 'Prints after the test', note: 'Distance-based prints from the old build.' },
        ],
        findings: [
          'Velocity jumps straight to full speed and stops dead: no acceleration or deceleration.',
          'The walk clip rate follows stick deflection, not ground speed, so the feet slide.',
          'Marc walked backwards. The Adventurer rig faces −z but the code faced +z along the direction of travel, so the legs cycled in reverse. Found and confirmed in the new build with a close camera; the baseline uses the same code and model, so the same fault applied there. This likely contributed to the reported gliding feel.',
          'The camera sits close and at 45°, so in portrait "up-screen" is north-west and the view ahead is short. The HUD (five meters, goals, five touch buttons, zoom, inventory) covers about a third of the screen.',
        ],
      },
      {
        status: 'agent-tested', title: 'M1: slice v1 stand-in locomotion', date: '2026-09-30', build: 'c98a538',
        conditions: 'Same viewport and input as M0. Fixed camera looking north. Ground: shelter snow (2.6 m/s target). The close-up clip uses a test-only camera (?cam=34,7,0.6,0).',
        clips: [
          { status: 'agent-tested', file: S + 'clip-walk-stop.webm', title: 'Standard motion test (game camera)' },
          { status: 'agent-tested', file: S + 'clip-gait-close.webm', title: 'Gait close-up: walk, jog, stop, turn' },
          { status: 'agent-tested', file: S + 'phone-gait-close.png', title: 'Prints after the close-up', note: 'One print per foot contact, placed at the foot bone.' },
          { status: 'agent-tested', file: S + 'phone-after-motion.png', title: 'Prints after the standard test' },
          { status: 'agent-tested', file: S + 'clip-route-a.webm', title: 'Route walk, part A (shelter → woods)', note: 'Agent steering between waypoints.' },
          { status: 'agent-tested', file: S + 'clip-route-b.webm', title: 'Route walk, part B (woods → house)', note: 'Agent steering between waypoints.' },
        ],
        findings: [
          'Acceleration: 0.38 m/s after 90 ms, 2.54 m/s after 1.2 s. Stopping: about 0.5 s and 0.28 m of slide after release.',
          'Measured from the foot bones: the Walk clip covers 1.70 m per loop at 1.27 m/s; the Run clip 2.29 m per loop at 2.89 m/s. Between 2.2 and 3.4 m/s the two blend, phase-locked, so at the 2.6 m/s snow pace the gait is about a quarter run.',
          'Prints land under the feet at about 0.96 m apart along the route, flat on the ground (measured 0 m float). The stand-in\'s stance is narrow, so the two feet leave an almost single-file track.',
          'Reversing direction slows to about 1.8 m/s while turning instead of snapping.',
          'Open: at 2.6–3.2 m/s the blend can read as a brisk power-walk. Judge it on a phone; a slower walk would lengthen the route time.',
        ],
        revisions: [
          'R1: inner 180° pivot so the model faces its direction of travel.',
          'R2: stride measured as the median planted-foot speed. The first version averaged across foot swaps and under-read by about 30%.',
          'R3: Idle / Walk / Run weights driven by speed, with Walk and Run on one shared phase.',
          'R4: footprints come from gait-phase contact points at the foot-bone position; the distance stepper is kept as a fallback.',
        ],
      },
    ],
  },

  compare: {
    intro: 'Comparable captures under similar conditions: the same emulated 390×844 viewport and the same scripted input. Baseline = the old sandbox at tag baseline-sandbox-2026-09-30; after = slice v1.',
    items: [
      { title: 'Start view on a phone', before: { status: 'superseded', file: B + 'phone-start.png', title: 'Baseline' }, after: { status: 'agent-tested', file: S + 'phone-start.png', title: 'Slice v1' },
        note: 'The camera no longer rotates and looks north, the direction of travel. The HUD is down to the prompt, pause and sound; the meters, goals, inventory and zoom are gone. Blue-hour light replaces the daytime start.' },
      { title: 'Footprints after the same motion test', before: { status: 'superseded', file: B + 'phone-after-motion.png', title: 'Baseline' }, after: { status: 'agent-tested', file: S + 'phone-after-motion.png', title: 'Slice v1' },
        note: 'Prints now come from foot contacts at the foot bones and are spaced by the measured stride. The baseline placed them by distance while the model walked backwards.' },
      { title: 'Motion test clip', before: { status: 'superseded', file: B + 'clip-walk-stop.webm', title: 'Baseline' }, after: { status: 'agent-tested', file: S + 'clip-walk-stop.webm', title: 'Slice v1' },
        note: 'Acceleration, turn weight and a short stop replace instant start/stop. Marc faces the way he walks.' },
      { title: 'Street', before: { status: 'superseded', file: B + 'phone-street.png', title: 'Baseline: Coral Palm Drive' }, after: { status: 'agent-tested', file: S + 'phone-street.png', title: 'Slice v1: dead-end street' },
        note: 'A 150 m boulevard with side streets became a 65 m dead-end with four houses, closed in by backyard fences and ending at the gate.' },
      { title: 'Woods', before: { status: 'superseded', file: B + 'phone-woods.png', title: 'Baseline: open pine woods' }, after: { status: 'agent-tested', file: S + 'phone-woods.png', title: 'Slice v1: trail between banks' },
        note: 'An open wood you could wander became a packed trail between rising, tree-covered banks, sized to the narrow portrait frame.' },
      { title: 'Desktop start', before: { status: 'superseded', file: B + 'desktop-start.png', title: 'Baseline' }, after: { status: 'agent-tested', file: S + 'desktop-start.png', title: 'Slice v1' },
        note: 'Landscape uses a narrower FOV and slightly larger distance; same fixed north-facing angle.' },
    ],
  },
};
