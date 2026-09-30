# Design record

This is the shared record of material decisions for the prototype. The user's vision notes and concept art live outside the repo (`Documents/Codex/2026-09-29/okay-so-there-s-a-few/outputs/`). This file records what the build chose and why. Later entries win.

## Scope of this prototype (Sep 2026 overnight build)

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
