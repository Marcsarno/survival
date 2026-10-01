// Hub content. Edit this file to update the hub; hub.js renders it. Paths are relative to hub/.
// Status values: reference | planned | implemented | agent-tested | approved | unverified | superseded.
// "approved" means Marc said so in chat. Never set it on anything else.
const B = 'media/baseline/', S = 'media/slice-v1/', R = 'refs-local/';
const REF_MISSING = 'Concept art is kept outside the repo. Run `node tools/hub-refs.mjs` on Marc\'s machine to copy it into hub/refs-local/.';
const ref = (file, label, note) => ({ status: 'reference', file: R + file, label, note, missing: REF_MISSING });
const base = (file, label, note) => ({ status: 'superseded', file: B + file, label, note });
const v1 = (file, label, note) => ({ status: 'agent-tested', file: S + file, label, note });
const O = 'media/opening-v3/', N = 'media/neighborhood/';
const v2 = (file, title, note, status = 'agent-tested') => ({ status, file: O + file, title, note });
const was = (file, title, note) => ({ status: 'superseded', file: S + file, title, note });

const T = window.HUB_TIMINGS || { runs: [] };
const tOf = (label, id) => { const r = T.runs.find((x) => x.label === label); return r && r.beats[id] != null ? `${r.beats[id]} s` : '—'; };
const beat = (id, b) => ({ ...b, id, mud: tOf('Agent · phone, mud', id), firm: tOf('Agent · phone, firm', id) });

window.HUB = {
  updated: '2026-10-01 (opening, neighborhood pass)',

  redesign: {
    updated: '2026-10-01, neighborhood pass',
    intro: 'Pass 3 of the opening, to Marc’s neighborhood visual revision (claude-neighborhood-visual-revision.txt, 2026-10-01). It replaces the seawall start: Marc starts mid-search inside an abandoned South Florida neighborhood and the route runs among houses, side yards and a small park to the house. Keep the tree sway and the moving swing. Camera closer and a little lower. Restrained autumn color. Nothing here is approved by Marc; "agent-tested" means an automated run, not a person.',
    launch: [
      'Local: <code>npm run dev</code>, then open <a href="http://localhost:5173/">http://localhost:5173/</a> and press Start. On a phone on the same Wi-Fi, open the <code>Network:</code> address Vite prints.',
      'Controls: <b>WASD / arrows</b> or a left-thumb drag to walk; after Arianna calls, the same input runs · <b>E</b> (or the E button) to try and climb the gate and to pick up the bunny · <b>Esc</b> pause · <b>R</b> restart.',
      'Camera: candidate A by default. <code>?camset=b</code> or <code>?camset=pass2</code> switches; <code>?cam=fov,dist,pitch,lead</code> tunes.',
      'Hub: <code>npm run hub</code>. Checks: <code>npm run playtest</code> (17 checks), <code>node tools/walkthrough.mjs --clips</code> (and <code>--firm</code>), <code>node tools/camera-compare.mjs</code>, then <code>node tools/hub-timings.mjs</code>.',
      'Not deployed: https://sarno-survive.vercel.app still runs pass 2 (git tag <code>baseline-opening-pass2-2026-10-01</code>).',
    ],
    diagnosis: [
      'The opening (pass 2, captured below before any change) starts on a long canal promenade: water, a long sidewalk, flat grass, a toppled chair and a cooler. It does not say "collapse" or "search" on the first screen.',
      'The camera is high and far (about 50° down, Marc about 8% of the screen height): doors, windows and posture are hard to read.',
      'Color: bland overall, noisy up close. The stucco texture reads as orange-and-black mottling; the clay roof tiles repeat in a high-contrast pattern; the shrubs are dark, speckled masses.',
      'Ground: a lawn-like grass base with a uniform orange leaf strip for the path; no broken paving, mud, edges or raised grass.',
      'Foliage: canopies between Marc and the camera show diagonal stripes. Inspection: the near-canopy fade in src/core/seethrough.js discards pixels with a diagonal-line pattern (mod(3x + 2y, 5)), not a real dither.',
      'Direction for this pass: neighborhood start with a boarded house, a coherent cluster of interrupted life (flat-tired car, open suitcase, damaged fence), a legible route between properties with small muddy prints, one strong autumn canopy; the route relocates the existing beats; Arianna’s call turns the search into a run; a short muddy passage versus firm ground; the house reveal and the threatening voice.',
    ],
    before: [
      { status: 'superseded', file: 'media/neighborhood/before-opening.jpg', title: 'Before: the opening', note: 'Pass 2 start on the seawall promenade (game capture, 390×844).' },
      { status: 'superseded', file: 'media/neighborhood/before-clue.jpg', title: 'Before: the bunny', note: 'Pass 2 lane: the leaf strip, the dark shrubs, the striped canopy top-left.' },
      { status: 'superseded', file: 'media/neighborhood/before-house.jpg', title: 'Before: the house', note: 'Pass 2 yard: mottled orange stucco, high-contrast roof tiles.' },
      { status: 'superseded', file: 'media/neighborhood/before-park.jpg', title: 'Before: the park', note: 'Pass 2 park: open flat ground.' },
    ],
    refsNote: 'Marc’s two simplified concept images for this pass (kept outside the repo in hub/refs-local/). Used for model complexity and staging ideas, not as fixed layouts or palette.',
    refs: [
      { status: 'reference', file: R + 'pass3-ref-1.webp', title: 'Neighborhood: car, suitcase, broken gate', note: 'A boarded house ahead, a car with the trunk open, a suitcase, a broken fence gate, an autumn tree top-left.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass3-ref-2.webp', title: 'Side passage with prints', note: 'A path between walls and fences, small muddy prints, autumn leaves, a knocked-over bin.', missing: REF_MISSING },
      { status: 'reference', file: R + 'pass2-ref-7.webp', title: 'The playground (pass 2 ref)', note: 'Kept for the swing.', missing: REF_MISSING },
    ],
    camera: {
      note: 'Two modest candidates, closer and lower than pass 2, captured on the SAME views (the opening, the bunny, the house) on an emulated 390×844 phone; left to right: the pass-2 camera on the new scene, A, B. ?camset=pass2|a|b switches; ?cam=fov,dist,pitch,lead tunes.',
      chosen: 'Chosen: A (fov 42°, 14 m, 43° down, lead 0.45 m; Marc about 12% of the screen height, up from 8%). B (fov 40°, 12 m, 37° down; Marc about 16%) reads Marc and the boarded windows best, but on a portrait phone it is too narrow: at the house the framing pulls Marc off the left edge and at the start the car is cut. A keeps Marc, the clue and the destination together. The street zone adds a small north bias so the boarded windows clear the top edge; the subtitle moved below Marc and the prompt above it.',
      items: [
        { status: 'agent-tested', file: N + 'camera-street.jpg', title: 'The opening: pass 2 · A · B', note: 'Same spot, same moment.' },
        { status: 'agent-tested', file: N + 'camera-bunny.jpg', title: 'The bunny: pass 2 · A · B', note: 'The bunny by the broken fence, the mud passage and the walled garden beyond.' },
        { status: 'agent-tested', file: N + 'camera-yard.jpg', title: 'The house: pass 2 · A · B', note: 'B loses Marc off the left edge.' },
      ],
    },
    map: {
      legend: 'Solid blue: the walk (the mud way). Dashed: the firm way around the walled garden. Meters; north is up. About 75 m from the street to the door.',
      lines: [
        { pts: [[0.8, -0.3], [0.9, -3.4], [1.8, -6.4], [2.6, -9.8], [2.6, -17.6], [0.4, -23], [-0.2, -28], [1.0, -34], [1.2, -40], [2.0, -46.6], [1.8, -49.6], [2.2, -55], [2.3, -60.6], [5.2, -64.6], [7.6, -69.5]], color: '#2f7fc1' },
        { pts: [[2.0, -51], [9.9, -51.1], [9.9, -60.8], [6.8, -63.6]], color: '#2f7fc1', width: 3, dash: '5 5' },
        { pts: [[-13, -3.4], [0, -3.4]], color: '#b8a98a', width: 3 }, { pts: [[4.2, -3.4], [4.2, -34]], color: '#7a5a3a', width: 2 },
        { pts: [[-13, -34], [15, -34]], color: '#7a5a3a', width: 2 }, { pts: [[-7, -49.2], [15, -49.2]], color: '#7a5a3a', width: 2 },
      ],
      bands: [
        { z: [4, -3.4], name: 'The street', color: '#cfc7b8' }, { z: [-3.4, -18], name: 'Front yard, side passage', color: '#d8c6a6' }, { z: [-18, -34], name: 'Backyard', color: '#c9d0a8' },
        { z: [-34, -49.4], name: 'The park', color: '#d6d1a8' }, { z: [-49.4, -61.8], name: 'Mud or firm ground', color: '#b8a48e' }, { z: [-61.8, -82], name: 'The house', color: '#e3b9a6' },
      ],
      markers: [
        { x: 0.8, z: -0.3, label: 'Start: “Arianna?”' }, { x: -4, z: -13.2, label: 'Boarded house', color: '#8a8a8a', left: true }, { x: 3.4, z: -0.8, label: 'Car, suitcase', color: '#8a8a8a' },
        { x: 1.0, z: -4.6, label: 'Her prints' }, { x: 1.0, z: -34, label: 'Locked gate', left: true }, { x: 5.2, z: -41.4, label: 'The swing', color: '#8a8a8a' },
        { x: 2.55, z: -48.1, label: 'Bunny' }, { x: 2.3, z: -56, label: 'Mud', color: '#6b4a2a', left: true }, { x: 9.9, z: -56, label: 'Firm', color: '#8a8a8a' }, { x: 12.6, z: -74.2, label: 'The house', color: '#b23b3b' },
      ],
    },
    beatNote: 'One-time triggers by place or action, never timers; one text queue, so lines never overlap; restart clears everything. Times are agent play-throughs on an emulated phone (see Observed timing).',
    beatNames: { search: '“Arianna?”', prints: 'prints', call2: '“Arianna!”', creak: 'swing', locked: 'locked', over: 'over', park: 'park', bunny: 'bunny', urgency: '“Daddy!”', fork: 'fork', reveal: 'house', argument: 'voices', stay: '“Stay there.”', end: 'end' },
    beats: [
      beat('search', { status: 'agent-tested', beat: 'Searching the street', purpose: 'Start mid-search; absence and urgency from the first screen.', trigger: 'Start.', behavior: '“Arianna?” The boarded house ahead behind its low wall and broken gate; the car down on a flat tire, a suitcase dropped open beside it, the fence broken in; a copper oak framing the left.' }),
      beat('prints', { status: 'agent-tested', beat: 'Her prints', purpose: 'The first sign she came this way.', trigger: 'Near the first mud patch inside the gate.', behavior: '“She was here.” Small prints, only where the ground is soft: little mud patches along the way (gate, side passage, backyard gate, bunny). His head turns to them.' }),
      beat('call2', { status: 'agent-tested', beat: 'The side passage', purpose: 'Between properties; the view closes in.', trigger: 'Into the passage between the house and the neighbor’s fence.', behavior: '“Arianna!” Leaves drifted against the walls, a knocked-over bin and bags, raised grass at the wall bases.' }),
      beat('creak', { status: 'agent-tested', beat: 'A swing creaks', purpose: 'Pull him on with sound.', trigger: 'In the neglected backyard.', behavior: 'Caption: “A swing creaks, somewhere ahead.” Snapped limbs against the fence, a shed, a stump, an overturned chair.' }),
      beat('locked', { status: 'agent-tested', beat: 'The locked gate', purpose: 'The traversal (Marc’s gate, in the neglected yard).', trigger: 'E: try it. E again: climb.', behavior: 'He kicks at the latch (Frustrated), the gate rattles: “Locked.” Then he climbs it and drops down the far side. He can climb back.' }),
      beat('park', { status: 'agent-tested', beat: 'The park and the swing', purpose: 'An unsettling passing moment, not a detour.', trigger: 'Over the gate.', behavior: 'The swing set just right of the way, one seat still moving; his head turns to it.' }),
      beat('bunny', { status: 'agent-tested', beat: 'The bunny', purpose: 'The personal clue, easy to notice.', trigger: 'E at the bunny (or walking onto or past it).', behavior: '“She wouldn’t leave this.” White against the broken fence; Marc stops, picks it up and carries it.' }),
      beat('urgency', { status: 'agent-tested', beat: '“Daddy!” He runs.', purpose: 'Her call escalates the search into running.', trigger: '1.6 s after the bunny line (or at the fence).', behavior: '“Daddy!” from ahead, “Arianna!” A low drone. From here the same stick runs (the Run clip, 3.6 m/s).' }),
      beat('fork', { status: 'agent-tested', beat: 'Mud or firm ground', purpose: 'A short muddy passage straight on, or firm ground around.', trigger: 'Through the gap in the park fence.', behavior: 'Straight on: about 8 m of wet mud between a house and a walled garden (a wading walk, 1.15 m/s, deep prints). Right: a cracked concrete walk around the garden (about 22 m at a run). The choice is recorded on the end card.' }),
      beat('reveal', { status: 'agent-tested', beat: 'The house', purpose: 'The destination, framed.', trigger: 'Into the yard.', behavior: 'The house top-right, its front facing south-west, candle-lit windows. Marc slows to a walk; a figure leaves the window; “A door shuts inside the house.”' }),
      beat('stay', { status: 'agent-tested', beat: '“Stay there.”', purpose: 'The threatening voice.', trigger: 'Near the door once the voices end (or right at it).', behavior: 'Two adults argue inside (placeholder lines, usually cut short). “Stay there.” Marc stops, the door opens a crack, the end card shows each beat’s time.' }),
    ],
    timingNote: 'Agent play-throughs with normal controls (keyboard, straight-line steering; E at the gate twice and at the bunny). A person will be slower and will look around. Pass 2 took about 94 s.',
    runs: T.runs.length ? T.runs : [{ label: 'No runs yet', end: 1, beats: {}, gaps: 'Run npm run playtest, then node tools/hub-timings.mjs', note: '' }],
    afterNote: 'The neighborhood pass on an emulated 390×844 phone (agent play-through; HUD and text included). Media: hub/media/neighborhood/.',
    after: [
      { status: 'agent-tested', file: N + 'phone-start.jpg', title: 'The first screen', note: 'Boarded house, broken gate, prints, the car on a flat tire with the suitcase and a box, the broken fence, the copper oak.' },
      { status: 'agent-tested', file: N + 'phone-prints.jpg', title: '“She was here.”', note: 'Through the gate; her prints in the mud patch.' },
      { status: 'agent-tested', file: N + 'view-frontyard.jpg', title: 'Round the house', note: 'The boarded side, the passage ahead (no HUD).' },
      { status: 'agent-tested', file: N + 'view-passage.jpg', title: 'The side passage', note: 'Leaves drifted against the walls, raised grass, bin and bags.' },
      { status: 'agent-tested', file: N + 'view-backyard.jpg', title: 'The backyard', note: 'Neglected; snapped limbs against the fence.' },
      { status: 'agent-tested', file: N + 'phone-locked.jpg', title: 'Locked', note: 'The gate out of the backyard.' },
      { status: 'agent-tested', file: N + 'view-park.jpg', title: 'The park', note: 'The swing set to the right, the bunny ahead by the broken fence.' },
      { status: 'agent-tested', file: N + 'phone-bunny.jpg', title: 'The bunny', note: '“She wouldn’t leave this.”' },
      { status: 'agent-tested', file: N + 'view-fork.jpg', title: 'Mud or firm ground', note: 'Wet mud straight on; the concrete walk to the right of the walled garden.' },
      { status: 'agent-tested', file: N + 'view-firm.jpg', title: 'The firm way', note: 'Cracked concrete between the garden wall and the next house.' },
      { status: 'agent-tested', file: N + 'phone-reveal.jpg', title: 'The house (mud way)', note: 'Top-right, front facing south-west.' },
      { status: 'agent-tested', file: N + 'phone-reveal-firm.jpg', title: 'The house (firm way)', note: 'The same reveal from the other side.' },
      { status: 'agent-tested', file: N + 'phone-stay.jpg', title: '“Stay there.”', note: 'The end of the slice.' },
      { status: 'agent-tested', file: N + 'phone-end.jpg', title: 'End card', note: 'Each beat’s time and the way taken.' },
      { status: 'agent-tested', file: N + 'leaf-atlas-fix.jpg', title: 'Foliage fix', note: 'The leaf atlas before (about half its leaf pixels black: NaN), fixed, and the new autumn atlas.' },
    ],
    clips: [
      { status: 'agent-tested', file: N + 'clip-opening.webm', title: 'The opening (14 s)', note: 'Agent play-through, emulated phone, the game canvas only (no HUD or text): the start, through the gate, round the house. The trees sway.' },
      { status: 'agent-tested', file: N + 'clip-run.webm', title: 'Her call, the run, the house (14 s)', note: 'From “Daddy!”: the run, the mud, the yard, the house top-right. Canvas only.' },
    ],
    compare: [
      { title: 'The opening', before: { status: 'superseded', file: N + 'before-opening.jpg', title: 'Pass 2: the seawall' }, after: { status: 'agent-tested', file: N + 'after-opening.jpg', title: 'Neighborhood pass' }, note: 'A long promenade with a toppled chair and a cooler, seen from high up, became a closer, lower view of a boarded house, a broken gate with prints through it, and a car, suitcase and broken fence that say people left in a hurry.' },
      { title: 'The clue', before: { status: 'superseded', file: N + 'before-clue.jpg', title: 'Pass 2: the lane' }, after: { status: 'agent-tested', file: N + 'after-clue.jpg', title: 'Neighborhood pass' }, note: 'The bunny now sits white against a broken fence, the mud passage and the walled garden beyond it. No striped canopy, no black shrubs.' },
      { title: 'The house', before: { status: 'superseded', file: N + 'before-house.jpg', title: 'Pass 2: the yard' }, after: { status: 'agent-tested', file: N + 'after-house.jpg', title: 'Neighborhood pass' }, note: 'Same house and angle, closer: calm stucco instead of orange-and-black mottling, a softer roof, raised grass, the walk to the door.' },
    ],
    findings: [
      'Diagonal stripes on canopies: the near-canopy fade in src/core/seethrough.js discarded pixels with mod(3x + 2y, 5), and the see-through circle with mod(x + 2y, 4). Both patterns are diagonal lines. They are now a 4×4 Bayer dither, and the fade only acts on foliage right under the camera.',
      'Dark, speckled shrubs (also since pass 2), three causes. (1) The leaf painter in blender/kit/foliage.py raised sin(π) (slightly negative in float32) to a power: NaN beyond every leaf tip, saved as opaque black; about half of all leaf, frond, fan and grass pixels were black. (2) three.js flips the normal of double-sided cards seen from behind, so their clump normals pointed down. (3) Vertex colors are exported as sRGB, so a 0.45 base shade arrives at about 0.18. All three are fixed.',
      'Orange-and-black walls: the stucco texture (worn_mossy_plasterwall) was the mottling. All stucco now uses one calm plaster at low contrast (diff_soft), lifted so the house tints read as faded cream, sand and pale teal, with broad world-space wear: an uneven splash line at the base, faint rain streaks, large blotches.',
      'Roofs: a lower-contrast, less saturated clay tile (diff_soft) with a softer normal.',
      'The run: the Run clip’s hip track starts 0.57 units forward, so the old guess at the up axis picked z, dropped the hips to the ground and left the forward travel in. Every clip now uses y up. Its own pace is 4.5 m/s; the game runs at 3.6 m/s and plays it at 0.8×, so the feet do not slide.',
      'Walking (searching) is unchanged: 1.25–1.3 m/s, same acceleration and turning. I played it before changing anything and saw no start, stop or snag problem worth changing.',
    ],
    problems: [
      'No human has played it, and it has not run on a physical phone. Marc is the next test.',
      'The first screen trades the copper canopy against the boarded windows on a narrow portrait screen: the canopy frames the left and partly hides the gate post.',
      'The mud passage sits in shadow; its puddles read best in motion. The choice of way is legible but subtle.',
      'Long quiet stretch: about 14 s from the passage call to the creak caption, then 7 s to the gate (an agent walks straight; a person will look around).',
      'The argument inside is usually cut short by “Stay there.” (the yard walk is about 8 m). Lines are placeholders.',
      'The climb is the ledge Climb clip scaled to the gate; idle is a held pose; the car’s flat tire is a tilt, not a modeled flat.',
      'The firm way is a little faster than the mud (about 5 s against 8 s from the fence to the yard).',
      'About 7.6 MB to download; 290–330 draw calls and 200–250k triangles on screen.',
    ],
    unverified: [
      'A physical phone. Emulation only: 390×844 touch viewport, 4× CPU throttle, desktop GPU: 55–60 fps at every checkpoint.',
      'iOS Safari.',
      'How the closer camera, the walking pace and the run feel to a person.',
    ],
    next: [
      'Marc plays it and says what is wrong.',
      'Then, if he wants: a modeled flat tire and open trunk; a little more to find on the backyard stretch; an idle clip and a landing; sound for the run and the mud.',
    ],
    assumptions: [
      'This pass follows claude-neighborhood-visual-revision.txt (2026-10-01) where it conflicts with earlier direction: a running finale after her call and a mud-or-firm choice are back. The traversal stays Marc’s locked gate (he chose a gate over a log because it makes sense in the world); it now sits in the neglected backyard, and fallen limbs lie against the fence nearby.',
      'Marc’s lines are kept (“Arianna?”, “She was here.”, “She wouldn’t leave this.”, “Locked.”, “Daddy!”, “Stay there.”). No new story canon.',
      'The seawall, canal and pump house are gone from this route; the pass-2 build is at git tag baseline-opening-pass2-2026-10-01.',
      'Golden hour sinking toward sunset along the walk; candle and lantern light at the house only; no working streetlights.',
      'Not deployed: the live site still runs pass 2 until Marc asks for a deploy.',
    ],
  },
  overview: {
    intro: 'Working record for the opening. Everything here is a local file; another agent can continue from this folder, docs/STATE.md and docs/DESIGN.md. Start with the Opening redesign tab.',
    goal: 'The neighborhood pass of the opening (Marc\u2019s visual revision of 2026-10-01): Marc already searching an abandoned South Florida neighborhood at golden hour: the street → round the boarded house → the backyard and its locked gate → the park → the bunny → her call, running → mud or firm ground → the house, top-right. Text only. About 75 s for an agent. See the Opening redesign tab.',
    builds: [
      { status: 'agent-tested', label: 'Local dev build: http://localhost:5173/', href: 'http://localhost:5173/', note: 'Run `npm run dev` in the project folder first. ?debug=1 shows fps, position, ground and beats; ?dev=1 adds keys 1–7 to jump to checkpoints; ?voices=0 turns the placeholder voices off.' },
      { status: 'agent-tested', label: 'Live site: https://sarno-survive.vercel.app', href: 'https://sarno-survive.vercel.app', note: 'Still opening pass 2 (deployed 2026-10-01). The neighborhood pass is local only until Marc asks for a deploy.' },
      { status: 'reference', label: 'Pass 2 (the seawall walk): git tag baseline-opening-pass2-2026-10-01', note: 'Run git checkout baseline-opening-pass2-2026-10-01 to restore it.' },
      { status: 'reference', label: 'Previous builds: git tags baseline-opening-route-2026-09-30 (slice v1) and baseline-sandbox-2026-09-30', note: '`git checkout <tag>` restores either.' },
    ],
    controls: [
      { action: 'Walk', keys: 'WASD / arrows (W = up-screen)', touch: 'Thumb down anywhere on the left side, drag (floating stick)' },
      { action: 'Run (after Arianna calls)', keys: 'Automatic: the same keys run', touch: 'Automatic: the same drag runs' },
      { action: 'Interact: try and climb the gate, pick up', keys: 'E', touch: 'E (lights up when something is in reach)' },
      { action: 'Sound on/off', keys: '', touch: '🔊 (subtitles always show)' },
      { action: 'Pause / help', keys: 'Esc or H', touch: 'II' },
      { action: 'Restart', keys: 'R, or the button on the pause and end cards', touch: 'Pause → Restart' },
    ],
    progress: [
      { status: 'agent-tested', item: 'Opening, neighborhood pass: street → passage → backyard gate → park → bunny → run → mud or firm → the house', note: 'Plays start to end card with normal controls, either way (about 75 s for an agent). Text only. 17/17 automated checks.' },
      { status: 'superseded', item: 'Opening pass 2: seawall → park → lane → locked gate → the house', note: 'Tag baseline-opening-pass2-2026-10-01; still the live site.' },
      { status: 'implemented', item: 'Marc: Marc’s Tripo model, rigged, with Walk, Run, Climb and Frustrated', note: 'blender/build_marc.py → public/assets/models/marc.glb. A methodical walk while searching; the Run clip after her call; the gate uses Frustrated then Climb.' },
      { status: 'implemented', item: 'Blender asset kit', note: 'blender/build_kit.py: generated leaf (green and autumn), frond, palmetto, big-leaf, grass and fallen-leaf textures; oaks (two copper), palms, shrubs (one rust), big-leaf plants, three grass tufts; seven houses (boarded, teal, sand…), garden walls, fences, the gate; playground, bunny, branch, an open suitcase, a box. The neighborhood additions: build_kit.py -- neighborhood.' },
      { status: 'implemented', item: 'Poly Haven textures, HDRI and props; Poly Pizza vehicles and rowboat', note: 'tools/fetch-polyhaven.mjs, tools/fetch-assets.mjs. All in CREDITS.md. Compressed for phones by tools/optimize-assets.mjs (the opening downloads about 7.6 MB).' },
      { status: 'agent-tested', item: 'Automated playtest: 17 checks', note: '`npm run playtest`: start, camera, walk, collisions, the gate and climbing back, run and mud, the swing and tree sway, a full play-through (walk then run), restart, muted, performance, emulated touch.' },
      { status: 'superseded', item: 'Opening pass 1 (rejected by Marc)', note: 'Graybox, a log, a mud route. Never committed.' },
      { status: 'superseded', item: 'Slice v1: the long route from the shelter', note: 'Tag baseline-opening-route-2026-09-30.' },
    ],
    checks: T.checks || [],
    next: [
      'Marc plays the neighborhood pass and says what is wrong (local build; deploy when he asks).',
      'Then: what he asks for, or the door confrontation.',
    ],
    unverified: [
      'No physical phone (emulated only), no human playtest.',
      'The Mr. Mak Workspace repository was NOT inspected (the fetch was declined).',
      'Nothing in this hub is approved by Marc yet.',
    ],
    howto: [
      'Open hub/index.html directly in a browser, or run `npm run hub`, which serves it at http://localhost:5173/hub/.',
      'Content is in hub/data.js. Captures are in hub/media/<set>/. The neighborhood pass: node tools/walkthrough.mjs --clips (phone screenshots, two canvas clips), node tools/camera-compare.mjs (camera sheets), node tools/hub-timings.mjs (timings and check results). tools/capture.mjs still drives the older passes.',
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
