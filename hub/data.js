// Hub content. Edit this file to update the hub; hub.js renders it. Paths are relative to hub/.
// Status values: reference | planned | implemented | agent-tested | approved | unverified | superseded.
// "approved" means Marc said so in chat. Never set it on anything else.
const B = 'media/baseline/', S = 'media/slice/', R = 'refs-local/';
const REF_MISSING = 'Concept art is kept outside the repo. Run `node tools/hub-refs.mjs` on Marc\'s machine to copy it into hub/refs-local/.';

window.HUB = {
  updated: '2026-09-30 (pass 1: hub and baseline)',

  overview: {
    intro: 'Working record for the opening-slice revision. Everything here is a local file; another agent can continue from this folder and docs/STATE.md.',
    goal: 'Turn the sandbox prototype into a compact, linear opening route for portrait phones: Shelter → small neighborhood edge → woods → deeper snowy trail → the house where Arianna is being held. It uses a fixed isometric camera, grounded stand-in movement and visible footprints. No inventory, combat or cinematics in this slice.',
    builds: [
      { status: 'implemented', label: 'Local dev build: http://localhost:5173/', href: 'http://localhost:5173/', note: 'Run `npm run dev` in the project folder first. Add ?debug=1 for an fps overlay.' },
      { status: 'superseded', label: 'Live site: https://sarno-survive.vercel.app', href: 'https://sarno-survive.vercel.app', note: 'Still the old sandbox build until someone runs `npm run deploy`.' },
      { status: 'reference', label: 'Baseline source: git tag baseline-sandbox-2026-09-30', note: 'The sandbox before this revision. Restore it with `git checkout baseline-sandbox-2026-09-30`.' },
    ],
    controls: [
      { action: 'Move', keys: 'WASD / arrows (W = north, up-screen)', touch: 'Left joystick' },
      { action: 'Jog', keys: 'Hold Shift', touch: '🏃 toggle' },
      { action: 'Interact (gate, arrival)', keys: 'E', touch: 'E button' },
      { action: 'Lantern', keys: 'L', touch: '🏮' },
      { action: 'Pause / help', keys: 'Esc or H', touch: '?' },
    ],
    progress: [
      { status: 'implemented', item: 'Visual project hub', note: 'This page. Baseline captures taken from the old build before any gameplay change.' },
      { status: 'implemented', item: 'Recoverable baseline', note: 'Git tag baseline-sandbox-2026-09-30 on commit 176d7a5.' },
      { status: 'planned', item: 'Fixed isometric tracking camera', note: 'Remove rotation, zoom levels and the cinematic mode. Lock one angle and add a look-ahead toward north.' },
      { status: 'planned', item: 'Compact authored route', note: 'Replace the nine-area neighborhood with one route of about 350 m.' },
      { status: 'planned', item: 'Remove inventory and survival UI', note: 'Remove pack, stash, upgrades, hunger, goals, map, combat and the infected from this slice.' },
      { status: 'planned', item: 'Movement feel', note: 'Acceleration, turning, speed set by terrain, animation rate matched to ground speed, reliable stopping.' },
      { status: 'planned', item: 'Footprints', note: 'Alternating distance-based prints, a bounded count and a hook for true footfall events later.' },
      { status: 'planned', item: 'Gate interaction + arrival + restart', note: 'One inexpensive route interaction, then an end-of-slice card at the house.' },
    ],
    next: [
      'Pass 2: camera, reduced world, complete traversable route.',
      'Pass 3: movement, footprints, phone usability, visual guidance.',
      'Pass 4: playtest, fix, update this hub with honest results.',
    ],
    unverified: [
      'The Mr. Mak Workspace repository (github.com/witnesstodark/mr-mak-workspace) was NOT inspected; the web fetch was declined this session. This hub borrows only the general idea: one browsable place for plan, references, assets and captures.',
      'No physical phone test. Phone captures come from a Chromium 390×844 emulated touch viewport, driven with keyboard input.',
      'Nothing in this hub is approved by Marc yet.',
    ],
    howto: [
      'Open hub/index.html directly in a browser, or run `npm run hub`, which serves it at http://localhost:5173/hub/.',
      'Content is in hub/data.js. Captures are in hub/media/<set>/ and come from `node tools/capture.mjs --set=<name>`. The file capture.json in each folder records the test conditions.',
      'Concept references go in hub/refs-local/ (gitignored) via `node tools/hub-refs.mjs`.',
      'The hub is not part of the game build: Vite only bundles the root index.html.',
    ],
  },

  route: {
    intro: 'One linear route. General travel is north (up-screen). Bends, openings and terrain change the composition; boundaries are fences, houses, tree walls, rocks and snow banks.',
    legend: 'Dashed purple: planned centerline. Solid blue: implemented route (after pass 2). Coordinates are meters; north is up.',
    planned: [[0, 12], [0, -10], [3, -24], [8, -50], [6, -72], [2, -88], [-4, -100], [-16, -122], [-12, -146], [4, -166], [10, -188], [2, -210], [-12, -232], [-14, -254], [-2, -274], [8, -292], [10, -310]],
    markers: [{ x: 0, z: 12, label: 'Shelter (start)' }, { x: 2, z: -88, label: 'Gate', color: '#2f7fc1' }, { x: 10, z: -318, label: 'The house', color: '#b23b3b' }],
    sections: [
      { id: 'shelter', name: 'Shelter', band: [22, -12], color: '#f2c57c', status: 'planned', time: '~10 s', feel: 'A small pocket of warmth and fragile safety.', detail: 'Reuse the tile-roof pavilion, fire pit and low stucco walls. Warm fire and lantern light, the only warm light until the destination. You leave through a gap in the north wall.', shots: [] },
      { id: 'street', name: 'Neighborhood edge', band: [-12, -90], color: '#e7d3c3', status: 'planned', time: '~25 s', feel: 'Traces of ordinary family life, abandoned.', detail: 'A short dead-end street with three or four existing stucco houses, parked cars, mailboxes and palms. It ends at a cul-de-sac and a backyard fence line, with a wooden gate into the woods (the route interaction).', shots: [] },
      { id: 'woods', name: 'Woods', band: [-90, -205], color: '#b9cbb8', status: 'planned', time: '~45 s', feel: 'Greater isolation, narrower views, fewer signs of safety.', detail: 'A trail through pines and firs, bending west, then east. Fallen logs, stumps and a frozen pond glimpsed through the trees. The trees rise on low banks either side.', shots: [] },
      { id: 'deep', name: 'Deeper snowy trail', band: [-205, -290], color: '#a8b8cc', status: 'planned', time: '~40 s', feel: 'Harder going: deep snow slows you, the light fades.', detail: 'A narrower trail with deep snow (slower walking), drifts, rocks and dead pines. It gets darker as you go north. A small warm light appears ahead through a gap before the house is fully in view.', shots: [] },
      { id: 'house', name: 'The house', band: [-290, -340], color: '#d7a7a0', status: 'planned', time: '~15 s', feel: 'A carefully framed destination; a small warm light that feels unsettling.', detail: 'An isolated stucco house in a clearing: warm light in the windows, a porch lantern, a fence and a pickup in the yard (after concept 01-rescue-approach). The arrival trigger is at the porch steps and shows the end-of-slice card and restart. No interior and no confrontation.', shots: [] },
    ],
    assumptions: [
      'Starting at the shelter is for this test only; it does not decide how the episode opens.',
      'Time of day is authored by position, not a running clock: late dusk at the shelter, darker toward the house. This is reversible.',
      'No dialogue, captions or story explanation. The route has to read through layout and light alone.',
      'No infected, wildlife threats or combat. Harmless deer and rabbits may appear in the woods for life and scale.',
    ],
  },

  art: {
    intro: 'The visual target is simplified faceted 3D with believable proportions: cool blue snow against small warm lantern light. This pass is graybox: composition, scale, spacing and atmosphere come before materials.',
    refsNote: REF_MISSING,
    refs: [
      { status: 'reference', file: R + '01-rescue-approach.png', title: '01 Rescue approach', note: 'Primary target for the house: porch lanterns, warm window, fence, pickup, footprints leading in.', missing: REF_MISSING },
      { status: 'reference', file: R + '06-snowy-woodland.png', title: '06 Snowy woodland', note: 'Woods target: rail fences, stumps, trail footprints, dusk blue with one warm lantern.', missing: REF_MISSING },
      { status: 'reference', file: R + '11-home-pavilion.png', title: '11 Home pavilion', note: 'Shelter target: tile-roof pavilion, stucco walls, warm interior.', missing: REF_MISSING },
      { status: 'reference', file: R + '12-gameplay-two-routes.png', title: '12 Gameplay: two routes', note: 'Neighborhood target: pavers, stucco, fences and a side path along the fence.', missing: REF_MISSING },
      { status: 'reference', file: R + '05-residential-street.png', title: 'Residential street study', note: 'Street layout, barrel-tile roofs, boarded windows.', missing: REF_MISSING },
      { status: 'reference', file: R + '03-night-lantern.png', title: 'Night lantern study', note: 'Night lighting with a hand lantern.', missing: REF_MISSING },
      { status: 'reference', file: R + '09-home-woodland.png', title: '09 Home woodland', note: 'Alternative shelter option (not chosen for this slice).', missing: REF_MISSING },
      { status: 'reference', file: R + '10-home-house.png', title: '10 Home house', note: 'Alternative shelter option (not chosen).', missing: REF_MISSING },
      { status: 'reference', file: R + '01-morning-pond.png', title: 'Morning pond study', note: 'Frozen pond in the woods.', missing: REF_MISSING },
      { status: 'reference', file: R + '01-wood-shelter.png', title: 'Wood shelter reference', note: 'Woodshed, log ends, faceted pines.', missing: REF_MISSING },
      { status: 'reference', file: R + '02-family-homecoming.png', title: '02 Family homecoming', note: 'Future: the reunion (not in this slice).', missing: REF_MISSING },
      { status: 'reference', file: R + '03-supply-route.png', title: '03 Supply route', note: 'Future: the supply mission (not in this slice).', missing: REF_MISSING },
    ],
    sheets: [
      { status: 'implemented', file: '../docs/renders/built-sheet.png', title: 'Built game models', note: 'Every GLB in public/assets/models, rendered by blender/render_sheet.py.' },
      { status: 'implemented', file: '../docs/renders/trees-v2.png', title: 'Blender-built trees', note: 'Pines, firs and palms with snow on the upward faces.' },
      { status: 'implemented', file: '../docs/renders/florida-details.png', title: 'Florida details', note: 'Iguana, flamingo, snowman.' },
      { status: 'reference', file: '../docs/renders/source-sheet.png', title: 'Downloaded source models', note: 'Originals before the Blender changes.' },
    ],
    models: [
      { status: 'implemented', file: 'player.glb', source: 'Adventurer, Quaternius (poly.pizza/m/5EGWBMpuXq)', license: 'CC0 1.0', use: 'Marc stand-in' },
      { status: 'implemented', file: 'pine-1..3, fir-1..2, snag, stump, fallen-log, rock-1..3, shrub-*, snow-mound-*', source: 'Built by blender/build_assets.py; stump and log from Quaternius', license: 'Project / CC0 1.0', use: 'Woods, deep trail and route boundaries' },
      { status: 'implemented', file: 'palm-1..3, agave, croton, palmetto, hedge', source: 'Built by blender/build_assets.py', license: 'Project', use: 'Shelter and street planting' },
      { status: 'implemented', file: 'car-sedan, car-suv', source: 'Built by blender/build_assets.py', license: 'Project', use: 'Parked cars on the street; the pickup stand-in at the house' },
      { status: 'implemented', file: 'lantern, campfire', source: 'Lantern built in Blender; Bonfire by Quaternius', license: 'Project / CC0 1.0', use: 'Warm light at the shelter and the house' },
      { status: 'implemented', file: 'deer, rabbit, fox, owl', source: 'Quaternius (CC0); rabbit and owl by Poly by Google', license: 'CC0 1.0 / CC BY 3.0', use: 'Harmless ambient wildlife in the woods (optional)' },
      { status: 'superseded', file: 'zombie-a, zombie-b, pistol, axe, medkit, food-can, matchbox, water-bottle, backpack, radio, wolf, dog, duck, iguana, flamingo, snowman', source: 'See CREDITS.md', license: 'CC0 1.0 / CC BY 3.0 / Project', use: 'Not used in this slice (files kept)' },
    ],
    code: [
      { status: 'implemented', what: 'Stucco houses with barrel-tile roofs, garages, porches', where: 'src/world/builders.js house()', use: 'Three or four houses at the neighborhood edge; the destination house' },
      { status: 'implemented', what: 'Pavilion, stucco walls, wood and rail fences', where: 'src/world/builders.js', use: 'Shelter; route boundaries; the gate' },
      { status: 'implemented', what: 'Faceted snow terrain, footprints, snowfall', where: 'src/world/ground.js, src/systems/footprints.js, snowfall.js', use: 'Everywhere' },
    ],
  },

  characters: {
    intro: 'Marc is the only character on screen in this slice. The stand-in is a recolored low-poly Adventurer. Final models, rigging and animation are deferred.',
    standins: [
      { status: 'implemented', file: B + 'phone-start.png', title: 'Marc stand-in (baseline framing)', note: 'Quaternius Adventurer, recolored: olive jacket, jeans, winter sleeves, backpack. 1.8 m tall. Animations: Idle, Walk, Run, Interact and others.' },
      { status: 'reference', file: '../docs/renders/characters-source.png', title: 'Source character bases', note: 'Adventurer (C13) and Hooded Adventurer (C14), the two bases Marc selected for the prototype.' },
    ],
    futureNote: 'Future final models are not chosen. The brief says Marc plans to try Tripo for character models after testing Meshy. Nothing below is in the game.',
    future: [
      { status: 'reference', file: R + '01-rescue-approach.png', title: 'Marc, Arianna and the woman at the door (concept)', note: 'Target proportions and clothing read for Marc and Arianna. Concept only.', missing: REF_MISSING },
      { status: 'reference', file: R + '11-home-pavilion.png', title: 'Family at the shelter (concept)', note: 'Yola and the girls, concept only; not in this slice.', missing: REF_MISSING },
      { status: 'reference', file: R + 'characters.jpg', title: 'Character reference sheet', note: 'Poly.pizza character candidates reviewed earlier. Block-headed or chibi styles were rejected.', missing: REF_MISSING },
      { status: 'planned', title: 'Final Marc model', note: 'Planned: generated or modeled asset (Tripo was mentioned), then rigging and walk/jog tuned to it.', missing: 'Not started' },
    ],
    roles: [
      { name: 'Marc', role: 'Player character: husband and father, not an action hero', slice: 'Playable stand-in' },
      { name: 'Arianna (7)', role: 'Older daughter, held at the house', slice: 'Not shown: the house is the destination' },
      { name: 'Yola', role: 'Wife, medical knowledge', slice: 'Not in this slice' },
      { name: 'Lilah (2)', role: 'Younger daughter', slice: 'Not in this slice' },
      { name: 'The husband and wife at the house', role: 'Desperate people, not villains', slice: 'Not shown; confrontation is later work' },
    ],
  },

  motion: {
    deferred: 'Final rigging and animation are deferred until a final character model exists. These tests check stand-in locomotion: responsiveness, turning, stopping, ground contact and footprints.',
    intro: 'Each test uses the same scripted input (tools/capture.mjs motionTest): W for 3 s, release and wait 1.3 s, then D, S, A, W for 1.1 s each. Clips are recorded from the game canvas, so they show no HUD. The input is automated keyboard input, not a human thumb on a joystick.',
    tests: [
      {
        status: 'agent-tested', title: 'M0: baseline locomotion (old sandbox build)', date: '2026-09-30', build: '176d7a5 (baseline-sandbox-2026-09-30)',
        conditions: 'Chromium, emulated 390×844 phone viewport (deviceScaleFactor 2, touch), phone quality preset, keyboard input. Camera at the default 45° yaw, so W moves north-west.',
        clips: [
          { status: 'agent-tested', file: B + 'clip-walk-stop.webm', title: 'Walk, stop, turn square', note: 'Baseline.' },
          { status: 'agent-tested', file: B + 'phone-after-motion.png', title: 'Prints after the test', note: 'Distance-based prints from the old build.' },
        ],
        findings: [
          'Velocity jumps straight to full speed and stops dead: there is no acceleration or deceleration.',
          'Walk speed is 2.7 m/s. The walk animation time scale depends on stick deflection, not ground speed, so the feet can slide.',
          'The camera sits close and at 45°, so in portrait "up-screen" is north-west and the view ahead is short. The pavilion roof covers much of the frame at the start.',
          'The HUD (5 meters, goals, 5 touch buttons, zoom buttons, inventory) covers about a third of the portrait screen.',
        ],
        revisions: [],
      },
    ],
  },

  compare: {
    intro: 'Comparable captures under similar framing: the same emulated 390×844 viewport and the same scripted input. "After" slots fill in as passes land.',
    items: [
      { title: 'Start view on a phone', before: { status: 'agent-tested', file: B + 'phone-start.png', title: 'Baseline', note: 'Old sandbox build.' }, after: { status: 'planned', title: 'Slice', missing: 'Pending pass 2' }, note: 'Pending.' },
      { title: 'Footprints after the motion test', before: { status: 'agent-tested', file: B + 'phone-after-motion.png', title: 'Baseline' }, after: { status: 'planned', title: 'Slice', missing: 'Pending pass 3' }, note: 'Pending.' },
      { title: 'Desktop start view', before: { status: 'agent-tested', file: B + 'desktop-start.png', title: 'Baseline' }, after: { status: 'planned', title: 'Slice', missing: 'Pending pass 2' }, note: 'Pending.' },
    ],
  },
};
