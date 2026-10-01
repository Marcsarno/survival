// Hub content. Edit this file to update the hub; hub.js renders it. Paths are relative to hub/.
// Status values: reference | planned | implemented | agent-tested | approved | unverified | superseded.
// "approved" means Marc said so in chat. Never set it on anything else.
const B = 'media/baseline/', S = 'media/slice-v1/', R = 'refs-local/';
const REF_MISSING = 'Concept art is kept outside the repo. Run `node tools/hub-refs.mjs` on Marc\'s machine to copy it into hub/refs-local/.';
const ref = (file, label, note) => ({ status: 'reference', file: R + file, label, note, missing: REF_MISSING });
const base = (file, label, note) => ({ status: 'superseded', file: B + file, label, note });
const v1 = (file, label, note) => ({ status: 'agent-tested', file: S + file, label, note });
const O = 'media/opening-v3/';
const v2 = (file, title, note, status = 'agent-tested') => ({ status, file: O + file, title, note });
const was = (file, title, note) => ({ status: 'superseded', file: S + file, title, note });

const T = window.HUB_TIMINGS || { runs: [] };
const tOf = (label, id) => { const r = T.runs.find((x) => x.label === label); return r && r.beats[id] != null ? `${r.beats[id]} s` : '—'; };
const beat = (id, b) => ({ ...b, id, mud: tOf('Agent · mud', id), sidewalk: tOf('Agent · sidewalk', id) });

window.HUB = {
  updated: '2026-09-30 (opening pass 2: Marc model, Blender kit, Poly Haven textures)',

  redesign: {
    updated: '2026-09-30, pass 2',
    intro: 'Pass 2 of the opening, after Marc stopped pass 1 ("the path sucks… the whole thing is bad"). This pass follows his direction: his Tripo model of Marc, his five new style images, real art assets, textures and Blender, a varied walk, a locked gate Marc climbs instead of a log, no mud route, no sprint, no AI voice, and the house angled top-right with its front facing south-west. Rough but playable. Nothing here is approved by Marc; "agent-tested" means an automated run with normal controls, not a person.',
    launch: [
      'Local: <code>npm run dev</code>, then open <a href="http://localhost:5173/">http://localhost:5173/</a> and press Start. On a phone on the same Wi-Fi, open the <code>Network:</code> address Vite prints.',
      'Controls: <b>WASD / arrows</b> or the left-thumb joystick to walk (one methodical pace, no run) · <b>E</b> (or the E button) to pick up, open and climb · <b>Esc</b> pause · <b>R</b> restart.',
      'Checks: <code>npm run playtest</code> (13 checks). Then <code>node tools/hub-timings.mjs</code>.',
      'Live: https://sarno-survive.vercel.app runs pass 2 (deployed 2026-10-01 at Marc’s request; playtest 13/13 against it).',
    ],
    diagnosis: [
      'Pass 1 (agent-tested, rejected by Marc): a straight path with a trunk to step over, a mud route you could simply walk around, an abandoned car in a poor spot, and visuals far worse than before (snow off, flat brown ground, props made of code primitives, no Blender, no asset work).',
      'Marc\u2019s direction for pass 2: push much harder on the look (find and use art assets, make textures, use Blender), his Marc model, a varied walk, the house top-right and angled, a locked gate instead of a log, no mud, no sprint, a methodical walk with weight, text instead of AI voice. The game itself is a character.',
      'Process note: the agent will hand Marc a playable build earlier instead of running long test passes first.',
    ],
    before: [
      { status: 'superseded', file: 'media/opening-v2/phone-search.jpg', title: 'Pass 1: start', note: 'Graybox: snow off, flat brown ground.' },
      { status: 'superseded', file: 'media/opening-v2/phone-split.jpg', title: 'Pass 1: the mud split', note: 'You could just walk around the mud.' },
      { status: 'superseded', file: 'media/opening-v2/phone-figure.jpg', title: 'Pass 1: car and house', note: 'The car placement and the house angle Marc did not like.' },
    ],
    refsNote: 'Marc\u2019s five style images for pass 2 (concept art, kept outside the repo in hub/refs-local/). They set the target: textured, painterly-realistic, warm low light, dense foliage masses, clean readable paths.',
    refs: [
      { status: 'reference', file: R + 'pass2-ref-4.webp', title: 'Bunny by the broken fence', note: 'Big trunk on the left, the house corner, prints leading on.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass2-ref-5.webp', title: 'The seawall walk', note: 'Canal, dock and rowboat, cooler and toppled chair, fallen street lamp, a small building with a door.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass2-ref-6.webp', title: 'Camp, seawall road, carport house', note: 'Palette and density; the carport with a station wagon.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass2-ref-7.webp', title: 'The playground', note: 'Swing set, slide, tire tunnel, bench, rail fence, dirt path.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass2-ref-8.webp', title: 'The pharmacy strip', note: 'Not in this route yet.', missing: REF_MISSING },
    ],
    map: {
      legend: 'Solid blue: the walk. Meters; north is up. About 110 m from the seawall to the door.',
      lines: [
        { pts: [[-0.6, 9.5], [1.9, -5], [3.3, -12], [4.4, -19], [4.2, -24.4], [8.6, -27], [12.6, -30.2], [14.6, -35.2], [13.9, -41], [15.3, -47], [17.8, -52.4], [19.1, -56.5], [20.3, -60.4], [22.2, -66], [23.2, -70.2], [24.2, -72.6], [28.2, -78.6]], color: '#2f7fc1' },
        { pts: [[-3.6, 30], [-3.8, 16], [-3.4, 6], [-2.3, -4], [-0.4, -12], [1.2, -20], [1.8, -30]], color: '#3d6f80', width: 6 },
      ],
      bands: [
        { z: [30, -24], name: 'Seawall', color: '#c9d6d9' }, { z: [-24, -54.5], name: 'Park', color: '#d6d1a8' },
        { z: [-54.5, -70.2], name: 'Lane', color: '#d6c7b0' }, { z: [-70.2, -92], name: 'The house', color: '#e3b9a6' },
      ],
      markers: [
        { x: -0.6, z: 9.5, label: 'Start: “Arianna?”' }, { x: 2.6, z: -30.2, label: 'Pump house', color: '#8a8a8a', left: true }, { x: 19.6, z: -38, label: 'Playground, her prints' },
        { x: 21.6, z: -61.9, label: 'Bunny' }, { x: 23.2, z: -70.2, label: 'Locked gate', left: true }, { x: 33.6, z: -84.6, label: 'The house', color: '#b23b3b' },
      ],
    },
    beatNote: 'One-time triggers by place or action, never timers; one text queue, so lines never overlap; restart clears everything. Times are from the agent run.',
    beatNames: { search: '“Arianna?”', call2: '“Arianna!”', creak: 'swing', park: 'park', prints: '“She was here.”', bunny: 'bunny', urgency: '“Daddy!”', locked: 'locked', over: 'over', reveal: 'house', argument: 'voices', stay: '“Stay there.”', end: 'end' },
    beats: [
      beat('search', { status: 'agent-tested', beat: 'Search on the seawall', purpose: 'Start mid-search; place and mood.', trigger: 'Start.', behavior: '“Arianna?” The canal, the dock and rowboat, a toppled chair and cooler, a fallen street lamp. A second call along the walk.' }),
      beat('creak', { status: 'agent-tested', beat: 'A swing creaks ahead', purpose: 'Pull Marc on with sound.', trigger: 'Near the end of the promenade.', behavior: 'Caption: “A swing creaks, somewhere ahead.” The swing creaks (procedural sound) and keeps swaying on its own.' }),
      beat('prints', { status: 'agent-tested', beat: 'Her prints in the sand', purpose: 'The first sign she was here.', trigger: 'Near the prints under the swing.', behavior: '“She was here.” Small prints lead from the swing toward the path north; Marc\u2019s head turns to them.' }),
      beat('bunny', { status: 'agent-tested', beat: 'The bunny', purpose: 'The personal clue.', trigger: 'E at the bunny (or walking onto / past it).', behavior: '“She wouldn\u2019t leave this.” Marc stops, picks it up and carries it.' }),
      beat('urgency', { status: 'agent-tested', beat: '“Daddy!”', purpose: 'Urgency, without a sprint.', trigger: '1.6 s after the bunny line.', behavior: '“Daddy!” from ahead, “Arianna!” A low drone begins. Marc keeps his methodical walk; his head turns toward the house.' }),
      beat('over', { status: 'agent-tested', beat: 'The locked gate', purpose: 'A physical obstacle that makes sense.', trigger: 'E: try it. E again: climb.', behavior: 'He tries the gate, kicks at the latch (the Frustrated clip), the gate rattles: “Locked.” Then he climbs it (the Climb clip, scaled to the gate) and drops down the far side.' }),
      beat('reveal', { status: 'agent-tested', beat: 'The house', purpose: 'The destination, framed.', trigger: 'Landing over the gate.', behavior: 'The house top-right of the screen, its front facing south-west, candle-lit windows. A figure leaves the window; “A door shuts inside the house.”' }),
      beat('stay', { status: 'agent-tested', beat: '“Stay there.”', purpose: 'The turn to confrontation.', trigger: 'Near the door once the voices end (or right at it).', behavior: 'Two adults argue inside (placeholder lines). “Stay there.” Marc stops, the door opens a crack, the end card shows each beat\u2019s time.' }),
    ],
    timingNote: 'One agent play-through with normal controls (keyboard, straight-line steering, Marc\u2019s single walking pace). A person will be slower. Pass 1 took 49–53 s; slice v1 took 140 s.',
    runs: T.runs.length ? T.runs : [{ label: 'No runs yet', end: 1, beats: {}, gaps: 'Run npm run playtest, then node tools/hub-timings.mjs', note: '' }],
    afterNote: 'Pass 2 on an emulated 390×844 phone during an agent play-through (screenshots with HUD and text). Media: hub/media/opening-v3/. No new clips this pass.',
    after: [
      { status: 'agent-tested', file: 'media/opening-v3/phone-seawall.jpg', title: 'The seawall', note: 'Start: canal, dock, cooler and chair.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-pumphouse.jpg', title: 'The pump house', note: 'The end of the promenade; the path turns east.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-prints.jpg', title: 'Her prints', note: '“She was here.”' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-lane.jpg', title: 'The lane', note: 'The big oak, the broken fence, the bunny ahead.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-bunny.jpg', title: 'The bunny', note: '“She wouldn\u2019t leave this.”' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-locked.jpg', title: 'Locked', note: 'The gate in the privacy fence.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-reveal.jpg', title: 'Over the gate', note: 'The house top-right.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-argument.jpg', title: 'Voices', note: 'The yard approach.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-stay.jpg', title: '“Stay there.”', note: 'The end of the slice.' },
      { status: 'agent-tested', file: 'media/opening-v3/phone-end.jpg', title: 'End card', note: 'Each beat\u2019s time.' },
      { status: 'agent-tested', file: 'media/opening-v3/gate-climb.jpg', title: 'The gate climb (test camera)', note: 'Frames from trying the gate and climbing it, from a low test camera.' },
    ],
    clips: [{ status: 'planned', title: 'No clips yet for pass 2', missing: 'Clips come after Marc has played it.' }],
    compare: [
      { title: 'The start', before: { status: 'superseded', file: 'media/opening-v2/phone-search.jpg', title: 'Pass 1' }, after: { status: 'agent-tested', file: 'media/opening-v3/phone-seawall.jpg', title: 'Pass 2' }, note: 'From a graybox yard to a textured canal promenade with Marc\u2019s own model.' },
      { title: 'The house', before: { status: 'superseded', file: 'media/opening-v2/phone-figure.jpg', title: 'Pass 1' }, after: { status: 'agent-tested', file: 'media/opening-v3/phone-reveal.jpg', title: 'Pass 2' }, note: 'The house now sits top-right, angled with its front to the south-west, reached over a locked gate.' },
    ],
    problems: [
      'No human has played it. Marc is the next test.',
      'The look is far closer to the references but not there yet: the ground reads flat in open areas (the park), the foliage is generated leaf cards rather than painted art, and there is no ambient occlusion.',
      'The climb is the Tripo Climb clip (made for a ledge) scaled to the gate, then a dropped landing; it reads as a climb from the game camera but is not a true over-the-gate animation.',
      'Idle is a held pose (the first frame of Frustrated) with breathing; there is no idle animation.',
      'The argument lines and “Stay there.” are placeholders for Marc to rewrite. Text only, no voices.',
      'The swing creak, the gate rattle and every other sound are procedural placeholders.',
      'About 11 MB to download and 230–320k triangles on screen; a phone may load slowly or run warm.',
    ],
    unverified: [
      'A physical phone (only emulated: 60 fps at 4× CPU throttle on a desktop GPU).',
      'iOS Safari (WebP textures and the HDR environment are expected to work but were not tested).',
      'How the walk pace and the camera distance feel to a person.',
    ],
    next: [
      'Marc plays it and says what is wrong.',
      'Then: ground detail and clutter, contact shadows, a better landing after the climb, an idle clip, the pharmacy strip if wanted, sound.',
    ],
    assumptions: [
      'Golden hour sinking toward sunset along the walk (the light follows progress). Candle and lantern light at the house; no electricity.',
      'One walking speed (about 1.25 m/s, the walk clip\u2019s own pace, a little slower on sand). No run.',
      'The route and the places on it (seawall, pump house, park, lane, gate, the house) are a proposal for Marc to change.',
      'Previous builds stay recoverable: tag baseline-opening-route-2026-09-30 (slice v1); pass 1 was never committed.',
    ],
  },
  overview: {
    intro: 'Working record for the opening. Everything here is a local file; another agent can continue from this folder, docs/STATE.md and docs/DESIGN.md. Start with the Opening redesign tab.',
    goal: 'Pass 2 of the opening, built to Marc\u2019s direction: his Tripo Marc walks a textured Florida canal neighborhood at golden hour, seawall → park → lane → a locked gate he climbs → the house, angled top-right. Text only. About 94 s for an agent. See the Opening redesign tab.',
    builds: [
      { status: 'agent-tested', label: 'Local dev build: http://localhost:5173/', href: 'http://localhost:5173/', note: 'Run `npm run dev` in the project folder first. ?debug=1 shows fps, position, ground and beats; ?dev=1 adds keys 1–7 to jump to checkpoints; ?voices=0 turns the placeholder voices off.' },
      { status: 'agent-tested', label: 'Live site: https://sarno-survive.vercel.app', href: 'https://sarno-survive.vercel.app', note: 'Opening pass 2, deployed 2026-10-01 at Marc’s request; playtest 13/13 against it.' },
      { status: 'reference', label: 'Previous builds: git tags baseline-opening-route-2026-09-30 (slice v1) and baseline-sandbox-2026-09-30', note: '`git checkout <tag>` restores either.' },
    ],
    controls: [
      { action: 'Walk', keys: 'WASD / arrows (W = up-screen)', touch: 'Thumb down anywhere on the left side, drag (floating stick)' },
      { action: 'Run (after Arianna calls)', keys: 'Hold Shift', touch: '🏃 on/off (appears when running is revealed)' },
      { action: 'Interact: step over, pick up', keys: 'E', touch: 'E (lights up when something is in reach)' },
      { action: 'Sound on/off', keys: '', touch: '🔊 (subtitles always show)' },
      { action: 'Pause / help', keys: 'Esc or H', touch: 'II' },
      { action: 'Restart', keys: 'R, or the button on the pause and end cards', touch: 'Pause → Restart' },
    ],
    progress: [
      { status: 'agent-tested', item: 'Opening pass 2: seawall → park → lane → locked gate → the house', note: 'Plays start to end card with normal controls (about 94 s for an agent). Text only.' },
      { status: 'implemented', item: 'Marc: Marc’s Tripo model, rigged, with Walk, Climb and Frustrated', note: 'blender/build_marc.py → public/assets/models/marc.glb. One methodical walking pace; the gate uses Frustrated then Climb.' },
      { status: 'implemented', item: 'Blender asset kit', note: 'blender/build_kit.py: generated leaf, frond and palmetto textures; oaks, palms, shrubs, palmettos; four houses, a pump house, walls, fences, the gate; playground, dock, cooler, bunny, branch.' },
      { status: 'implemented', item: 'Poly Haven textures, HDRI and props; Poly Pizza vehicles and rowboat', note: 'tools/fetch-polyhaven.mjs, tools/fetch-assets.mjs. All in CREDITS.md. Compressed for phones by tools/optimize-assets.mjs (about 11 MB in all).' },
      { status: 'agent-tested', item: 'Automated playtest: 13 checks', note: '`npm run playtest`: start, camera, walk, collisions, the gate, a full play-through, restart, muted, emulated touch.' },
      { status: 'superseded', item: 'Opening pass 1 (rejected by Marc)', note: 'Graybox, a log, a mud route. Never committed.' },
      { status: 'superseded', item: 'Slice v1: the long route from the shelter', note: 'Tag baseline-opening-route-2026-09-30; still the live site.' },
    ],
    checks: T.checks || [],
    next: [
      'Marc plays pass 2 and says what is wrong.',
      'Then the next visual pass (ground detail, contact shadows, the climb landing, an idle clip) or the door confrontation.',
    ],
    unverified: [
      'No physical phone (emulated only), no human playtest.',
      'The Mr. Mak Workspace repository was NOT inspected (the fetch was declined).',
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
    superseded: 'Replaced on 2026-09-30 by the opening redesign (see that tab). This was slice v1: a 350 m walk from the shelter to the house, about 140 s for an agent. Kept for comparison; tag baseline-opening-route-2026-09-30.',
    intro: 'One linear route. General travel is north (up-screen). Bends, openings and terrain change the composition. Boundaries are walls, fences, houses, a dense tree band on banks that rise either side of the trail, rocks and drifts. A corridor limit exists only as a safety net behind those boundaries.',
    legend: 'Dashed purple: the plan from pass 1. Solid blue: the implemented centerline. Meters; north is up.',
    planned: [[0, 12], [0, -10], [3, -24], [8, -50], [6, -72], [2, -88], [-4, -100], [-16, -122], [-12, -146], [4, -166], [10, -188], [2, -210], [-12, -232], [-14, -254], [-2, -274], [8, -292], [10, -310]],
    implemented: [[-1, 14], [-1, 2], [0, -10], [0, -12], [1, -24], [2, -50], [3, -78], [3, -89], [3, -93], [-3, -102], [-14, -122], [-15, -140], [-4, -160], [8, -180], [6, -202], [-6, -222], [-13, -242], [-9, -262], [2, -280], [9, -293], [10, -304], [10, -312]],
    markers: [{ x: -2.4, z: 13.2, label: 'Start (fire)' }, { x: 3, z: -90, label: 'Gate', color: '#2f7fc1' }, { x: -23.5, z: -140, label: 'Pond', color: '#6f95b6' }, { x: 13, z: -176, label: 'Woodshed', color: '#8a6547' }, { x: 10, z: -321, label: 'The house', color: '#b23b3b' }],
    sections: [
      { id: 'shelter', name: 'Shelter', band: [22, -12], color: '#f2c57c', status: 'superseded', time: '≈10 s', feel: 'A small pocket of warmth and fragile safety.',
        detail: 'Tile-roof pavilion with crates and a hanging lantern, the fire pit with log benches, low stucco walls. The fire and the lantern are the only warm light until the house. The only way out is a gap in the north wall, so you walk around the pavilion first.',
        shots: [{ title: 'Shelter', versions: [ref('11-home-pavilion.png', 'Reference: 11 home pavilion'), base('phone-start.png', 'Baseline sandbox (phone)'), v1('phone-shelter.png', 'Slice v1 (phone)'), v1('desktop-start.png', 'Slice v1 (desktop)')] }] },
      { id: 'street', name: 'Neighborhood edge', band: [-12, -90], color: '#e7d3c3', status: 'superseded', time: '≈25 s', feel: 'Traces of ordinary family life, abandoned.',
        detail: 'A short dead-end street: four stucco houses with barrel-tile roofs and boarded windows, cars, mailboxes, dead utility lines, a snowman, a swing set, a bicycle and two lawn flamingos. Backyard fences close it in. At the cul-de-sac a wooden gate in the back fence is the way into the woods (E to open).',
        shots: [{ title: 'Street', versions: [ref('12-gameplay-two-routes.png', 'Reference: 12 two routes'), base('phone-street.png', 'Baseline sandbox street'), v1('phone-street.png', 'Slice v1 street')] },
          { title: 'The gate', versions: [v1('phone-gate.png', 'Slice v1: gate closed, E prompt')] }] },
      { id: 'woods', name: 'Woods', band: [-90, -206], color: '#b9cbb8', status: 'superseded', time: '≈45 s', feel: 'Greater isolation, narrower views, fewer signs of safety.',
        detail: 'A packed trail between banks of pines and firs, bending west then east. It skirts a frozen pond (the view opens, and you can step onto the ice) and passes an old unlit woodshed. There are split-rail fence remnants, fallen logs and stumps. Deer, rabbits and a fox flee if you get close.',
        shots: [{ title: 'Woods', versions: [ref('06-snowy-woodland.png', 'Reference: 06 snowy woodland'), base('phone-woods.png', 'Baseline sandbox woods'), v1('phone-woods.png', 'Slice v1 woods'), v1('phone-pond.png', 'Slice v1 pond')] }] },
      { id: 'deep', name: 'Deeper snowy trail', band: [-206, -288], color: '#a8b8cc', status: 'superseded', time: '≈40 s', feel: 'Harder going: deep snow slows you, the light fades, heavier snowfall.',
        detail: 'A narrower trail with deep snow (2.3 m/s on the trail, 1.95 m/s off it), bumpier ground, drifts, dead pines and a fallen log that half-blocks the way. Fog closes in and the camera sits a little closer. Near the end, a warm window first shows at the top of the frame.',
        shots: [{ title: 'Deep trail', versions: [v1('phone-deep.png', 'Slice v1 deep trail'), v1('phone-glimpse.png', 'Slice v1: first glimpse (warm light, top right)')] }] },
      { id: 'house', name: 'The house', band: [-288, -335], color: '#d7a7a0', status: 'superseded', time: '≈15 s', feel: 'A framed destination; a small warm light that feels unsettling.',
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
    intro: 'Current pass (opening redesign): sparse, simple, reusable assets, broad flat materials, muted slate-brown and olive, warm candle and lantern light at the house. No snow in this pass. Earlier passes aimed at faceted snowy 3D (the references after the first three).',
    refsNote: REF_MISSING,
    refs: [
      { status: 'reference', file: R + '01-woods-and-log.png', title: 'Opening 01: woods and log', note: 'Current target (opening redesign): compact wooded approach, a low trunk to step over, a stucco wall.', missing: REF_MISSING },
      { status: 'reference', file: R + '02-bunny-discovery.png', title: 'Opening 02: bunny discovery', note: 'Current target: the clue beside a readable route.', missing: REF_MISSING },
      { status: 'reference', file: R + '03-car-and-house.png', title: 'Opening 03: car and house', note: 'Current target: the car, the yard wall and gate, the lit window.', missing: REF_MISSING },
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
      { status: 'agent-tested', what: 'The opening level: yard, passage, split, road, yard and house; mud patches; her prints', where: 'src/world/opening.js', use: 'The whole opening (replaces src/world/route.js, which is in tag baseline-opening-route-2026-09-30)' },
      { status: 'agent-tested', what: 'Fallen trunk, stuffed bunny, snapped branch, plastic chair, window figure, door crack', where: 'src/world/opening.js (primitive shapes)', use: 'Beats 2, 3, 6 and 7' },
      { status: 'superseded', what: 'Route layout, banks, trail ribbon, gate (slice v1)', where: 'src/world/route.js (in the tag)', use: 'The long route' },
      { status: 'agent-tested', what: 'Faceted snow terrain, footprints, snowfall', where: 'src/world/ground.js, src/systems/footprints.js, snowfall.js', use: 'Everywhere' },
    ],
  },

  characters: {
    intro: 'Marc is the only character on screen. Arianna and the two adults at the house are heard, not seen (placeholder voices, subtitled); the figure at the window is a flat dark shape. The stand-in is a recolored low-poly Adventurer. Final models, rigging and animation are deferred.',
    standins: [
      { status: 'agent-tested', file: O + 'phone-call.png', title: 'Marc at game scale (opening redesign)', note: 'About 10% of the screen height in portrait at the new camera distance, carrying the bunny.' },
      { status: 'agent-tested', file: O + 'phone-figure.png', title: 'The figure at the window (stand-in)', note: 'A flat dark head-and-shoulders shape in the lit window; it slides out of view at the reveal.' },
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
      { name: 'Arianna (7)', role: 'Older daughter, held at the house', slice: 'Heard once from ahead: “Daddy!” (placeholder voice). Her bunny and small prints are the clues.' },
      { name: 'Yola', role: 'Wife, medical knowledge', slice: 'Not in this slice' },
      { name: 'Lilah (2)', role: 'Younger daughter', slice: 'Not in this slice' },
      { name: 'The husband and wife at the house', role: 'Desperate people, not villains', slice: 'Heard arguing inside, then “Stay there.” Placeholder lines, labeled Man / Woman (inside). The confrontation is later work.' },
    ],
  },

  motion: {
    deferred: 'Final rigging and animation are deferred until a final character model exists. These tests check stand-in locomotion: responsiveness, turning, stopping, ground contact and footprints.',
    intro: 'The standard test (tools/capture.mjs motionTest) is W for 3 s, release and wait 1.3 s, then D, S, A, W for 1.1 s each. Clips are recorded from the game canvas, so they show no HUD. Input is scripted keyboard input, not a human thumb on a joystick. The clips play in the hub; use the controls to scrub.',
    tests: [
      {
        status: 'agent-tested', title: 'M2: opening redesign: walk, run, mud, step over', date: '2026-09-30', build: 'opening redesign',
        conditions: 'Chromium, emulated 390×844 phone, keyboard input; and the desktop playtest. Ground speeds from the playtest (1.5 s of input from a standstill).',
        clips: [
          { status: 'agent-tested', file: O + 'clip-walk-stop.webm', title: 'Standard motion test from the start', note: 'Walks across the first mud patch: tracks only there.' },
          { status: 'agent-tested', file: O + 'clip-sidewalk.webm', title: 'Running the sidewalk', note: 'Run on firm ground, 4.7 m/s.' },
          { status: 'agent-tested', file: O + 'clip-opening-a.webm', title: 'Stepping over the trunk', note: 'Part of play-through A.' },
          { status: 'agent-tested', file: O + 'phone-after-motion.png', title: 'Tracks after the test', note: 'Distance-based, mud only.' },
        ],
        findings: [
          'Speeds (m/s): sidewalk walk 2.15 / run 4.7; dirt walk 2.0 / run 4.4; mud walk 1.2 / run 1.75; 1.7 in the yard. Acceleration 0.38 m/s after 90 ms, 2.0 after 1.2 s; stops in about 0.45 s.',
          'Walk speed now sits below the walk/run blend (2.5–3.9 m/s), so walking plays the pure Walk clip (about 1.6× its natural rate) and running blends into Run.',
          'Stepping over the trunk: a 0.8 s controlled move with a 0.42 m lift, no collision during it, landing 1.05 m past the axis. Presses during the step do nothing. It plays the walk cycle: there is no climb animation yet.',
          'Tracks: one every 0.72 m in mud, alternating sides, none on dirt or pavement, none while standing; pool of 160.',
          'Feet now stand on the flat surfaces (sidewalk, road, mud). Before, they sat about 10 cm into them, because ground height ignored the overlays (fixed in ground.js).',
        ],
        revisions: [
          'R5: running locked until the story reveals it; touch run button hidden until then.',
          'R6: footprints split: step sounds stay on foot contacts; tracks became distance-based and mud-only.',
          'R7: groundHeight() returns the overlay height on roads, walks and mud.',
        ],
      },
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
