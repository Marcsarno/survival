# Design record

This is the shared record of material decisions for the prototype. The user's vision notes and concept art live outside the repo (`Documents/Codex/2026-09-29/okay-so-there-s-a-few/outputs/`). The current project bible is `master-story-design-brief-2026-09-30.txt` in that folder. This file records what the build chose and why. **Later entries win:** "Opening, pass 2" supersedes everything below it wherever they conflict.

## Opening, pass 2 (2026-09-30, current)

**Why:** Marc stopped pass 1. In his words: the path, the beats and the pace "suck"; it wasn't clear where to go by the mud and you could just walk round it; the car was badly placed; and the look got "far far worse". Pass 1 used no assets and no Blender, turned snow off and used code primitives.

**His direction:**
- Push much harder on the look: find and use art assets, make textures, use Blender.
- His Tripo model of Marc.
- His five style images as the target: the bunny, the seawall walk, camp/road/carport, the playground, the pharmacy strip.
- A varied walk, not straight up.
- The house top-right of the screen, its front facing south-west.
- A locked gate Marc tries, then climbs, instead of a log.
- No mud route and no sprint: a methodical walk with weight.
- Text, not AI voice.
- The game itself is a character.

### The walk (`src/world/level.js`, `src/systems/story.js`)
| Beat | Where | What happens |
|---|---|---|
| search | the seawall promenade (start) | "Arianna?" Canal, dock and rowboat, toppled chair and cooler, a fallen street lamp. "Arianna!" further on. |
| creak | the end of the promenade | Caption: "A swing creaks, somewhere ahead." The swing keeps swaying and creaking. |
| park | through the split-rail fence | The playground: swing set (one seat broken), slide, tire tunnel, bucket, rubber duck, bench. |
| prints | her prints in the sand | "She was here." Marc's head turns to them. |
| bunny | the lane, by a broken fence under a big oak | E: "She wouldn't leave this." He carries it. |
| urgency | 1.6 s later | "Daddy!" (distant) / "Arianna!" The drone starts. No sprint. |
| locked / over | the privacy-fence gate | E: he kicks at the latch, the gate rattles, "Locked." E: he climbs and drops over. |
| reveal | over the gate | The house top-right, front to the south-west, candle-lit windows; the figure leaves the window; "A door shuts inside the house." |
| argument / stay | the yard | Two voices (placeholder lines), then "Stay there." Marc stops, the door opens a crack, end card. |

**Layout:** about 110 m. Seawall promenade north (z 10 → −24); east into the park (x 8–31); north up the lane (x 19–23); the gate at (23.2, −70.2); the house at (33.6, −84.6), rotated −45°.

**Camera:** fixed, looking north.
- Portrait FOV 46°, distance 17.5 m, pitch 0.87 rad; landscape 34° and 24 m.
- Per-area zoom and framing bias:
  - seawall 1.0, slightly toward the water
  - park 1.12, toward the playground
  - lane 0.95
  - yard 1.18, toward the house

### Marc (`src/systems/player.js`, `blender/build_marc.py`)
- **Model:** Tripo with a Mixamo-style rig. Clips: Walk, Climb, Frustrated.
- **Root motion:** the Hips track's horizontal motion is removed at load (made in-place); the game moves him.
- **Pace:**
  - Walk speed is measured from the clip: 1.25 m/s at 1.8 m tall, played at its natural rate.
  - By surface: concrete 1.3, grass and leaves 1.22, sand 1.05 m/s.
  - Accel 3.2 and decel 5.5 m/s²; turn rate 4.2 rad/s.
- **Idle:** a still pose taken from Frustrated's first frame, with breathing. The procedural offsets are undone each frame (the mixer does not rewrite unchanged bones).
- **Head look:** turns toward the swing, the prints, the bunny and then the house, limited to ±1.1 rad.
- **Gate:**
  - Try: the Frustrated clip, a rattle on the kick, "Locked."
  - Climb: Climb frames 8–47 with its vertical rise scaled to 0.78 (the clip climbs a ledge about 2.2 m high; the gate is 1.75 m), while the game moves him onto the gate line.
  - Then a 0.55 s drop to the far side, starting from where the hips were.
- **Prints:** on sand and leaf litter only, distance-based. Her prints are authored (playground, lane).

### Look
- **Assets:**
  - *Blender kit* (`blender/build_kit.py`, modules in `blender/kit/`), exported without images; the game assigns shared textures by material name (`src/world/materials.js`):
    - **Foliage:** canopies are clusters of leaf cards with normals pointing out of each clump (soft masses); leaf, frond, fan and grass atlases are generated with numpy.
    - **Houses:** Florida block-and-stucco, clay hip roofs or flat roofs behind a parapet, framed windows (boarded or lit), doors, a portico, a carport, AC units, grime toward the ground.
  - *Poly Haven:* textures (stucco, clay tile, planks, bark, concrete, leaf litter, sand…), the `dikhololo_sunset` HDRI, and props (chair, trash can, utility box, picnic table, fern, crate, rubber duck, trash bag, stump, fallen street lamp).
  - *Poly Pizza:* vehicles and the rowboat, kept with their own paint and aged in the game.
- **Ground:** a splat shader blends grass, leaf litter, sand and dirt with a painted mask and macro noise. The promenade and walks are concrete meshes. The water is animated normals reflecting the HDRI.
- **Light:**
  - Golden-hour sun from the west-south-west, sinking with progress (elevation 0.5 → 0.27 rad, warmer and dimmer toward the house).
  - Hemisphere fill and HDRI image-based light; exposure about 1.06.
  - A light haze far up the frame only.
  - A CSS grade (contrast 1.05, saturation 1.1, sepia 0.05) and a vignette.
- **Life:**
  - Foliage sways (vertex wind).
  - The swing keeps moving and the boat bobs.
  - Dust drifts in the light, leaves fall, birds cross now and then (their shadows sweep the ground).
  - Candle and lantern lights flicker.
- **See-through:** around Marc for everything, plus near-camera thinning for foliage.
- **Size:** `tools/optimize-assets.mjs` brings it to about 11 MB:
  - WebP textures: color 1024 px, normal maps 512 px.
  - Meshopt-compressed models.
  - Prop textures at 512 px.

## Opening redesign, pass 1 (2026-09-30, rejected by Marc; never committed)

**Source:** `opening-redesign-handoff/claude-prompt.txt` in the Codex outputs folder, with three concept images beside it (01 woods and log, 02 bunny discovery, 03 car and house). The prompt supersedes the camp start, the long walk and the snow requirement.

**Goal:** a short, learnable opening that holds attention through purposeful beats, not a decorated walking corridor. The player should learn, find, do or hear something every 10–20 s of a first play. That is a heuristic, not a quota: there are no timers, no minimum duration and no invisible gates.

**Scope:** seven beats, start to end card (below). There is no inventory, combat, crafting, cinematics, interior, rescue or confrontation. Previous builds are at tags `baseline-opening-route-2026-09-30` (slice v1, the long route) and `baseline-sandbox-2026-09-30`.

### Why the long route was replaced
Slice v1 took an agent 140 s over about 350 m, mostly straight up-screen. Its one interaction (the gate) came about 35 s in, followed by about 100 s of scenery with nothing to find, hear or decide. Jog was available from the start, so hurrying meant nothing. At 22 m the camera made Marc 4–5% of a phone screen, too small for clues to read.

### The sequence (`src/systems/story.js`)
| # | Beat | Trigger | What happens |
|---|---|---|---|
| 1 | Search | Start | Marc: "Arianna?" Small prints cross a mud patch to a broken fence gap. A one-line movement hint, hidden after 3 m. |
| 2 | Traversal | E within 1.8 m of the trunk while facing it | A knee-high trunk spans the passage (outbuilding wall on one side, brush and a pine on the other: no way round). A 0.8 s controlled step over. Works both ways; no re-trigger mid-step. The path then bends west through three pines. |
| 3 | Personal clue | E at the bunny; or walking onto it (< 0.95 m); or passing within 4.6 m and 3.2 m beyond it | The worn bunny against a broken fence, a snapped branch, her prints. Marc stops for 0.95 s and carries it in his left hand (no inventory). "She wouldn't leave this." If he only passed it, he says the line but leaves it, and it can still be picked up. |
| 4 | Urgency | 1.4 s after that line; or reaching the split without it | Arianna (distant): "Daddy!" (a small camera shake, the drone starts). Marc: "Arianna! I'm coming!" Running unlocks as he answers: a hint, and the 🏃 button appears. |
| 5 | Terrain decision | The split; the rejoin records the route and the seconds on each surface | The muddy direct route, with her prints leading that way, or the firm sidewalk curving round a lot. Both rejoin at the road. |
| 6 | Reveal | Rounding the car's east end (x > −0.2, z < −68.4), or reaching the wall | A dark figure at a lit window slides out of view, a door shuts (0.6 s), and the camera widens on the house through the open gate. The argument starts 1.3 s later. |
| 7 | Human threat | Into the yard (slows Marc); then z < −79.5 once the argument has ended, or the porch steps (z < −82.2) | Two adults argue inside. "Stay there." Marc stops, the door opens a crack, and 1.5 s later the end card shows the time of each beat. Reaching the steps early drops the argument lines not yet spoken (the current line finishes). |

- **State:** every beat is a one-time flag stamped with story time (seconds since Start, pauses excluded). `Story.reset()` clears flags, queue, timers, run, the bunny, the window figure and the door. Backtracking never replays a cue.
- **Dialogue:** one queue, one line at a time with a 0.3–0.35 s gap. Duration is 0.75 s + 0.05 s per character (1.3–3.2 s). Subtitles are speaker-labeled and always on, so it plays muted.
- **Placeholder lines** (Marc to rewrite, intent from the brief: an uneasy wife, a desperate husband): Woman: "Someone's out there." Man: "Then keep her quiet." Woman: "She's a little girl—" Man: "We don't have a choice." Man (at the door): "Stay there." No names or new lore.
- **Voices:** the browser's speech synthesis (Web Speech API), pitched per speaker: Marc 0.85, Arianna 1.9, man 0.55, woman 1.2. These are placeholders, not recordings and not final voices. `?voices=0` turns them off. Mute stops them too.
- **Audio:** WebAudio starts from the Start button. A wind bed; footsteps by surface (dirt soft, paved tap, a wet thud in mud); the door; a low drone the story raises (call 0.35, reveal 0.6, yard 0.85, "Stay there." 1) and cuts at the end.

### Layout (`src/world/opening.js`)
- About 90 m: the main polyline is 91 m (86 m from the spawn), and the sidewalk branch is 25 m against 16.5 m straight through the mud. Points are `[x, z, w]`, where `w` is the outer walkable half-width, a safety net behind visible fences, walls, trunks and shrubs. The corridor clamp uses the nearer of the two polylines.
- **Areas:**
  - The abandoned yard (spawn at 0.2, 2.6).
  - The fence gap at z −7.
  - The passage beside the stucco outbuilding (x 4.6, z −7.5 to −23.5).
  - The trunk at z −13.5 (x −3.9 to 4.5).
  - The bend through three pines.
  - The broken fence and bunny (−5.15, −33.6).
  - A house corner.
  - The split at (−3, −46): mud from z −47.6 to −60.8, and the sidewalk out to x 5.
  - The rejoin at (−2, −62.5).
  - The road (z −66.5 to −72.7).
  - The car at (−1.6, −70.9), parallel to the wall.
  - The yard wall at z −73.4 with an open gate (x 2.6 to 4.8).
  - The house at (3.7, −88.5), front at z −84.
- **Canopies:** from this camera a tall canopy shows about 6 m up-screen of its trunk. Generated pines and palms whose canopy would land on the route, road or yard become shrubs or palmettos.
- **No snow in this pass:** `B.setSnowy(false)` drops caps, sills and drifts. `setSurfaceSnow(0)` gives bare roads and walks. The loader drops the models' `Snow` parts (`dropSnow`). Roofs use a muted weathered tile. All of it is reversible: the snow code and `snowfall.js` remain.
- **Ground:** dirt (`#5a4a3a`) with broad olive patches and a slightly lighter trodden line along the routes, low terrain noise (×0.45). Mud is flat overlay blobs with a damp rim. `groundHeight()` now returns the overlay height on roads, walks and mud. Before, feet and prints sat about 10 cm into the overlays.
- **Light:** `MUTED_KEYS` gives an overcast late afternoon. Hour by progress: 17.45 → 17.8 → 18.15 → 18.5 at progress 0, 0.45, 0.75 and 1. The sun is held high (`minSunY` 0.95) for shorter shadows. Exposure is 1.25. At the house: two candle-lit windows, a wall lantern and glow sprites, all flickering. No electricity.

### Camera
- **Portrait:** FOV 50°, distance 15.5 m (was 22), pitch 0.87 rad (≈50°), lead 1.3 m plus up to 1.6 m toward the motion. **Landscape:** FOV 36°, 20 m, lead 1.6. Marc is about 10% of the screen height in portrait and sits at about 55–60% from the top, above the subtitles and thumbs.
- **Per area** (`ZONES`): zoom yard-edge 1.0, passage 0.95, bunny 0.92, split 1.32, road 1.4, yard 1.05.
- **Framing bias:** in the split, road and yard, the focus is pulled toward a point. The pull is clamped to ±2.6 m sideways and ±1.0 m forward, so Marc stays in frame. It never rotates.

### Movement and tracks
| | Value |
|---|---|
| Walk (m/s) | paved 2.15 · dirt 2.0 · mud 1.2 |
| Run (m/s), after the call | paved 4.7 · dirt 4.4 · mud 1.75 |
| Yard | capped at 1.7 (Marc slows down) |
| Walk→Run blend | 2.5–3.9 m/s, so walking plays the pure Walk clip |
| Step over | 0.8 s, 0.42 m lift, lands 1.05 m past the trunk axis, no collision during it |
| Tracks | Distance-based, mud only, every 0.72 m, alternating sides; pool of 160, 150 s fade; none while standing |
| Her prints | 25 authored prints in three mud patches, scale 0.68, never fade |
| Step sounds | On foot contacts from the gait phase, by surface |

### UI
- **Text:** subtitles near the bottom (above the touch controls on phones); one hint at a time near the top; the E prompt.
- **Touch:** the E button and, after the call, the 🏃 toggle (pulses when it appears, dims in the yard). The lantern is gone.
- **End card:** the total time and each beat's time.
- **Corner buttons:** pause and sound. They lose focus after a click so the keys keep driving the game.

## Opening-route slice (2026-09-30, superseded)

**Goal:** a compact, linear, playable approach to the house where Arianna is held. It should feel deliberate, vulnerable and increasingly tense: a worried father moving from fragile safety toward a dangerous house. Story first, atmosphere second, gameplay third, and graybox first.

**Scope:** shelter → neighborhood edge → woods → deeper snowy trail → the house. It has one route interaction (the gate), an arrival trigger, an end card and restart. There is no inventory, crafting, combat, infected, dialogue, cinematics, interior or confrontation. Starting at the shelter is for this test only.

**Not decided by this build (Marc's calls):** story beats on the approach ("DAD!", a voice from the house), why there is snow, the shelter's final form, and anything about the people in the house.

### Camera
- Fixed angle looking north. Up-screen is always the direction of travel. It never rotates and has no player zoom. A special angle is reserved for deliberate cinematic moments later.
- **Portrait:** FOV 52°, distance 22 m, pitch 0.86 rad (≈49°) above the horizon, lead 6 m north plus up to 2.5 m toward the motion.
- **Landscape:** FOV 36°, distance 26 m, pitch 0.86 rad.
- **Authored distance per section** (the brief allows slight zoom): shelter ×1.0, street ×1.3, woods ×0.95, deep trail ×0.92, house ×1.12. It eases over a few seconds.
- The portrait frame is only about 10 m wide at the player but sees about 28 m ahead, so the route is laid out tall and narrow: things of interest sit within about ±6 m of the path or ahead of it.
- The character is about 4–5% of screen height in portrait. That is the main open trade-off.

### Route layout (`src/world/route.js`)
- A centerline of points `[x, z, w, tw]`. `w` is the walkable half-width and `tw` the packed-trail half-width. The route is monotonic in z, so `atZ(z, lateral)` places set dressing relative to the path.
- **Boundaries** are visible things: stucco walls, backyard fences, houses, a dense tree band on banks that rise either side of the trail, rocks, drifts and the yard fence. `clampToRoute()` is a safety limit only, and sits behind those.
- **Terrain:** the woods trail runs in a shallow valley; banks rise 2 m within about `w + 3` and another 1.8 m beyond. Flat pockets are kept for the pond, the woodshed and the house clearing. The trail is a ribbon mesh with a trampled texture, and sits about 0.12 m lower.
- **Lengths:** 347 m of centerline. The street is 65 m; woods about 115 m; deep trail about 80 m.
- **Light by progress:** hour 19.3 → 19.5 → 19.85 → 20.15 → 20.35 at progress 0, 0.22, 0.55, 0.82 and 1. The sun hands over to the moon between 19.1 and 19.9 with no jump.
- **Fog** starts at the camera distance plus 3 m and extends 95 / 85 / 62 / 46 / 60 m by section. Snowfall is ×0.7 / 0.9 / 1.2 / 2.1 / 1.3.
- **Warm light only** at the shelter (fire, lantern) and the house (windows, porch lanterns, glow sprites that ignore fog so they read at a distance). The street houses are dark.

### Movement (`src/systems/player.js`)
| | Value |
|---|---|
| Speed by ground (m/s) | paved 3.2 · trail 2.95 · snow 2.6 · ice 2.4 · deep trail 2.3 · deep off-trail 1.95 |
| Jog | ×1.42 (×1.25 in deep snow): a step up, not a sprint |
| Acceleration / deceleration | 8 / 11 m/s² |
| Turning | ≤10 rad/s, eased; speed × (0.35 + 0.65·cos(0.9·Δ)) while facing away from the input |
| Uphill | up to −30% on steep rises |
| Collision | 0.34 m circle, sub-stepped at ≤0.2 m, velocity = actual displacement (no pushing momentum into walls) |
| Gait | Idle/Walk/Run weights by speed; Walk→Run blend between 2.2 and 3.4 m/s; a shared phase; clip rates from strides measured at load (Walk 1.70 m per loop at 1.27 m/s, Run 2.29 m per loop at 2.89 m/s) |
| Facing | The Adventurer rig faces −z; an inner pivot turns it around. The baseline skipped this, so Marc walked backwards. |

### Footprints
- One print per foot contact (phase 0 = left, 0.5 = right), placed at the foot bone and nudged 6 cm toward the toes.
- Mirrored per foot and height-sampled at the print.
- Pool of 700 with a 900 s fade.
- Strength: pavement 0.3, trail 0.85, snow 1.0, deep 1.25 (18% larger).
- `Player.onFootfall()` is the integration point for a final rig's contact events. The distance-based stepper remains as a fallback when foot bones are missing.

### UI
- A prompt, a pause/help card, the end card, and pause and sound buttons.
- **Touch:** a floating joystick in the left 62% × lower 72% of the screen; E / jog / lantern bottom right. E lights up when something is in reach.
- Page scroll, rubber-banding, double-tap and pinch zoom are blocked.

### Production record
- `hub/` holds the plan, references, assets, characters, motion tests and before/after.
- Statuses are reference / planned / implemented / agent-tested / approved by Marc. Only Marc approves.
- Captures come from `tools/capture.mjs`. Clips are MediaRecorder canvas recordings; `tools/webm-duration.mjs` adds the missing duration.

---

The sections below describe the sandbox build (tag `baseline-sandbox-2026-09-30`). They are kept for history and for reusing its parts.

## Scope of the sandbox prototype (Sep 2026 overnight build)

- Environments and playable systems only.
- Out of scope for now, kept as future direction: cinematics, dialogue scenes, family characters, the daughter-rescue opening, and scripted missions.
- Outdoors-first: houses are searched at the porch or entry, and there are no interiors.

## Visual anchors (concept images compared against)

| Anchor | Used for |
|---|---|
| `concept-art/environment-studies/05-residential-street.png` | Street layout, stucco and barrel-tile roofs, boarded windows, pavers, patchy snow on asphalt |
| `concept-art/environment-studies/06-abandoned-playground.png` | Playground equipment, rubber tiles, metal fence |
| `concept-art/environment-studies/07-beach-access-road.png` | Bollards, dune fence, sand with snow, lifeguard color |
| `concept-art/environment-studies/08-canal-homes-night.png` | Seawall, docks, patios, night lantern mood |
| `concept-art/environment-studies/references/01-wood-shelter.png` | Woodshed with stacked log ends and a lantern, faceted pines, footprints |
| `concept-art/environment-studies/references/03-snow-pharmacy.png` | Pharmacy exterior, parking lot, snowy car |
| `concept-art/environment-studies/04-zombie-encounter.png` | Shooting at a zombie, forgiving aim |
| `concept-art/home-and-decisions/11-home-pavilion.png` | The shelter: tile-roof park pavilion with tarps, crates and a lantern |

**Style rules:** faceted (flat-shaded) forms, restrained textures, snow on every upward face, normal human proportions, and warm lantern or fire light against blue-white snow.

## Engine and technical decisions

- **Three.js + Vite, plain ES modules.** The goal is instant browser delivery to friends via a texted link.
- **One continuous map, about 300 × 250 m, with no loading screens.** Areas are named polygons, and a banner appears on entry.
- **Characters and animals are baked in Blender:** material colors go into vertex colors and the meshes are joined, one draw call each. Anything beyond 55 m is neither drawn nor animated.
- **Draw calls are kept low.** Procedural buildings merge into one mesh per material per 48 m chunk. Repeated models (trees, shrubs, rocks) are GPU-instanced. The full world is about 600–800 draw calls and 500k triangles, including the shadow pass. Desktop holds 60 fps.
- **Terrain** is a 3 m faceted triangle grid. `groundHeight()` interpolates the exact triangle that is drawn, so feet and footprints match the surface. Snow is pulled down under pavement.
- **Collision** is 2D on the ground plane: circles and rotated boxes in a spatial hash. Low walls are flagged so they don't block line of sight.
- **See-through occlusion.** A screen-space dithered circle removes anything nearer the camera than the player (canopies, roofs). Shadows are unaffected.
- **Footprints** are an instanced decal pool: 900 for the player, 500 for the frozen, 400 for animals. Opacity is stored in the instance color and fades over about 2.5 minutes.
- **Lighting.** There is one shadowed directional light (sun by day, moon by night) that follows the player, plus a hemisphere light. There are about 6 point lights: fire, shelter lamp, lantern post, hand lantern, a soft fill light at night, and the muzzle flash. Lantern shadows are opt-in (`?shadows=high`), because point shadows re-render the scene six times.
- **Sound** is procedural Web Audio (noise and oscillators), so there are no audio assets to license.
- **Saving** uses `localStorage` (`sarno-survive-save-v1`), autosaved every 30 s and whenever you sleep or build.

## Asset decisions

- **Characters.** The two approved bases are used: Adventurer (the player) and Hooded Adventurer. Zombies are recolors of both. The player gets winter sleeves and a jacket-and-jeans palette, matching the concept protagonist.
- **Animals** are all on the approved list: deer, fox, wolf, dog (Shiba), rabbit, duck and owl. Rejected animals were not used.
- **Trees and plants.** The downloaded Quaternius nature packs draw leaves with see-through leaf images, which read as realistic cutouts rather than the concept's solid facets. Replacement pines, firs, palms, shrubs, agave, croton and palmetto were built as Blender scripts with snow-capped top faces. The downloaded packs are kept, unused.
- **Cars and the lantern** were built in Blender. Car paint is recolored per car in code.
- **Scale:** 1 unit = 1 m, the player is 1.8 m tall, and deer are 1.45 m at the shoulder.

## Gameplay numbers (current tuning)

| System | Value |
|---|---|
| Walk / sprint speed | 2.7 / 4.8 m/s; ×0.92 in snow off pavement |
| Stamina | Sprint drains 16/s |
| Warmth drain outside | 0.28/s by day, up to 0.58/s at night (full to empty in about 3–6 min). The lantern cuts it by 25%. Standing by the fire regains 7/s. At zero warmth, health drops 1.2/s. |
| Hunger | Drains 100 → 0 over one in-game day (24 min). Food adds 50. When empty, stamina recovers at half speed and warmth drains 25% faster. Sleeping costs 25. |
| Fire | Burns 0.2 fuel/s (0.12 with the windbreak). Wood adds 22. Relighting costs one match and one wood. |
| Pack | 10 slots; the hiking backpack adds 6 |
| Frozen | 3 hp. Speed 1.35 m/s by day, 1.9 at night. They hit for 9 (13 at night) every 1.7 s, and the player gets a 0.7 s grace period after each hit. Sight is 11 m by day, 6 m at night, and 16 m if your lantern is lit. Hearing grows with noise. |
| Pistol | 1.5 damage; 3 on a fully steady shot. Hit chance is 60% + 40% × steadiness, where steadiness builds over 0.9 s. There are 5 + 6 + 4 + a few loose rounds in the world. |
| Axe | 1.1 damage, stagger, knockback. Wood gathered from logs: 1 without the axe, 3 with it. |

## Deliberate open questions (not decided by this build)

Final camera angle and rotation (the build offers adjustable height and 45° rotation). The shelter's final form (the pavilion was used as the prototype shelter). Zombie lore, the cause of the snow, mission structure, and family characters.
