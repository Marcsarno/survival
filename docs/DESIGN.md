# Design record

This is the shared record of material decisions for the prototype. The user's vision notes and concept art live outside the repo (`Documents/Codex/2026-09-29/okay-so-there-s-a-few/outputs/`). The current project bible is `master-story-design-brief-2026-09-30.txt` in that folder. This file records what the build chose and why. **Later entries win:** the opening-route slice section below supersedes the sandbox sections after it wherever they conflict.

## Opening-route slice (2026-09-30)

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
