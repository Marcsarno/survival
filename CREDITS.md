# Credits

## Downloaded models

Every downloaded model came from [poly.pizza](https://poly.pizza). The license was re-checked on each model page when it was downloaded on 2026-09-30; see `assets/source/manifest.json`. The untouched originals are in `assets/source/`. The game loads the processed versions in `public/assets/models/`, built by `blender/build_assets.py`.

### CC0 1.0 (public domain, credited anyway)

| Game file | Source model | Creator | Changes made |
|---|---|---|---|
| `player.glb` | [Adventurer](https://poly.pizza/m/5EGWBMpuXq) | Quaternius | Stray helper sphere removed; bare forearm faces recolored into long winter sleeves; olive jacket, denim jeans, brown boots and pack recolored |
| `zombie-a.glb` | [Adventurer](https://poly.pizza/m/5EGWBMpuXq) | Quaternius | Backpack removed; grey-green skin; faded, dirty clothing colors |
| `zombie-b.glb` | [Hooded Adventurer](https://poly.pizza/m/y9KWOVG21R) | Quaternius | Sword removed; grey-green skin; muted hood and clothing |
| `deer.glb`, `fox.glb`, `wolf.glb`, `dog.glb` | [Deer](https://poly.pizza/m/T6Cs7tmMHJ), [Fox](https://poly.pizza/m/Bc97C66HKi), [Wolf](https://poly.pizza/m/P1gU3Qkr9r), [Shiba Inu](https://poly.pizza/m/y4wdQpg767) | Quaternius | Re-exported only; scaled in the game |
| `stump.glb`, `fallen-log.glb` | [Mossy tree stump](https://poly.pizza/m/nFvEbUX6LE), [Mossy fallen log](https://poly.pizza/m/nwsYvcI0bC) | Quaternius | Scaled to meters; snow caps added on upward-facing faces |
| `wood-bundle.glb`, `campfire.glb` | [Logs](https://poly.pizza/m/fei4I7FfrJ), [Bonfire](https://poly.pizza/m/k1e0cOzi8A) | Quaternius | Scaled to meters |
| `radio.glb` | [Radio](https://poly.pizza/m/TPqvwkyWdV) | Quaternius | Scaled to meters |
| `axe.glb`, `pistol.glb`, `medkit.glb`, `food-can.glb`, `matchbox.glb`, `water-bottle.glb`, `backpack.glb` | [Axe](https://poly.pizza/m/W0UYZPYSXf), [Pistol](https://poly.pizza/m/J3i9KDQ3kt), [Medical kit](https://poly.pizza/m/cc9Kueieyl), [Food can](https://poly.pizza/m/YnowJvWqxE), [Matchbox](https://poly.pizza/m/22eU6FjNQ8), [Water bottle](https://poly.pizza/m/KpxDpidn1Z), [Backpack](https://poly.pizza/m/2g9Jm7kvIU) | Quaternius | Scaled to meters, origin at the base |

### CC BY 3.0 (attribution required)

| Game file | Source model | Creator | Changes made |
|---|---|---|---|
| `rabbit.glb` | [Cottontail rabbit](https://poly.pizza/m/3vvONbRCuEF) | Poly by Google | Scaled to 0.32 m; texture reduced to 256 px |
| `duck.glb` | [Mallard duck](https://poly.pizza/m/frSLi6b6Vid) | Poly by Google | Scaled to 0.38 m; texture reduced to 256 px |
| `owl.glb` | [Great horned owl](https://poly.pizza/m/fNkq9CwSG6d) | Poly by Google | Scaled to 0.75 m (with its perch); texture reduced to 256 px |

License: <https://creativecommons.org/licenses/by/3.0/>

### Downloaded but not used

The Quaternius tree, palm, bush, hedge and grass packs (library codes T5, T8, T10, F2, F3, F7, F11) are kept in `assets/source/`. They draw leaves with see-through leaf images, which clashed with the solid faceted look of the concept art, so replacement trees were built in Blender (see below).

## Models built for this project (Blender scripts)

These were generated procedurally by `blender/build_assets.py`: pines (3), firs (2), palms (3), shrubs (3), agave, croton, palmetto, hedge, rocks (3), snow mounds (2), the hand lantern, a sedan and an SUV, a dead pine (snag), a frozen iguana, a lawn flamingo and a snowman. Editable `.blend` files are in `assets/blend/`.

Houses, fences, walls, the playground, the pavilion, the pharmacy, the lifeguard tower, docks, roads and all textures are generated in code (`src/world/`).

## Code and libraries

- [three.js](https://threejs.org) (MIT)
- [Vite](https://vitejs.dev) (MIT)
- [Playwright](https://playwright.dev) (Apache-2.0), used only for the automated playtest
- Sound is synthesized with the Web Audio API; there are no audio files.


## The opening, pass 2 (2026-09-30)

### Marc

`marc.glb` is Marc's own model, made with Tripo and supplied by Marc (`assets/source/marc/`, rigged, with its clips). `blender/build_marc.py` keeps the Walk, Climb and Frustrated clips, renames them and reduces the texture to 2048 px; `tools/optimize-assets.mjs` compresses it.

### Poly Haven (CC0)

Textures (`public/assets/textures/<id>/`, reduced to WebP), the HDRI (`public/assets/env/`) and props (in `public/assets/models/kit/`: chair, trash can, utility box, picnic table, fern, crate, rubber duck, trash bag, stump, fallen street lamp; decimated where heavy, textures reduced to 512 px WebP). License: CC0, <https://polyhaven.com/license>. From `assets/source/polyhaven/manifest.json`:

| Type | Asset | Authors |
|---|---|---|
| texture | [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02) | Rob Tuytel |
| texture | [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) | Rob Tuytel |
| texture | [Brown Mud Leaves 01](https://polyhaven.com/a/brown_mud_leaves_01) | Rob Tuytel |
| texture | [Playground Sand](https://polyhaven.com/a/playground_sand) | eye-candy.xyz |
| texture | [Park Dirt](https://polyhaven.com/a/park_dirt) | Christopher Melani |
| texture | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | Charlotte Baglioni |
| texture | [Worn Concrete Floor](https://polyhaven.com/a/worn_concrete_floor) | Dimitrios Savva |
| texture | [Road Damaged](https://polyhaven.com/a/road_damaged) | Dimitrios Savva |
| texture | [Concrete Moss](https://polyhaven.com/a/concrete_moss) | Rob Tuytel |
| texture | [Worn Mossy Plasterwall](https://polyhaven.com/a/worn_mossy_plasterwall) | Amal Kumar |
| texture | [White Plaster Rough 01](https://polyhaven.com/a/white_plaster_rough_01) | Rob Tuytel |
| texture | [Red Plaster Weathered](https://polyhaven.com/a/red_plaster_weathered) | Amal Kumar |
| texture | [Clay Roof Tiles](https://polyhaven.com/a/clay_roof_tiles) | Amal Kumar |
| texture | [Roof Tiles](https://polyhaven.com/a/roof_tiles) | Stephan Seeliger |
| texture | [Weathered Planks](https://polyhaven.com/a/weathered_planks) | Dario Barresi, Dimitrios Savva |
| texture | [Wood Planks Grey](https://polyhaven.com/a/wood_planks_grey) | Rob Tuytel |
| texture | [Old Planks 02](https://polyhaven.com/a/old_planks_02) | Rob Tuytel |
| texture | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) | Rob Tuytel |
| texture | [Palm Bark](https://polyhaven.com/a/palm_bark) | Charlotte Baglioni |
| texture | [Green Metal Rust](https://polyhaven.com/a/green_metal_rust) | Rob Tuytel |
| texture | [Rusty Metal](https://polyhaven.com/a/rusty_metal) | Rob Tuytel |
| texture | [Terry Cloth](https://polyhaven.com/a/terry_cloth) | colormass, Rico Cilliers |
| hdri | [Dikhololo Sunset](https://polyhaven.com/a/dikhololo_sunset) | Greg Zaal |
| model | [Plastic Monobloc Chair 01](https://polyhaven.com/a/plastic_monobloc_chair_01) | Kuutti Siitonen |
| model | [Metal Trash Can](https://polyhaven.com/a/metal_trash_can) | GurJas Studios |
| model | [Street Lamp 02](https://polyhaven.com/a/street_lamp_02) | Josh Dean |
| model | [Wooden Picnic Table](https://polyhaven.com/a/wooden_picnic_table) | Ulan Cabanilla |
| model | [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers |
| model | [Shrub 03](https://polyhaven.com/a/shrub_03) | Rico Cilliers |
| model | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | Rob Tuytel |
| model | [Rubber Duck Toy](https://polyhaven.com/a/rubber_duck_toy) | Plat251 |
| model | [Utility Box 01](https://polyhaven.com/a/utility_box_01) | James Ray Cock |
| model | [Trashbag](https://polyhaven.com/a/trashbag) | Benny Weimer |
| model | [Wooden Crate 02](https://polyhaven.com/a/wooden_crate_02) | James Ray Cock, Jurita Burger |
| model | [Dry Branches Medium 01](https://polyhaven.com/a/dry_branches_medium_01) | Rico Cilliers |

### Poly Pizza vehicles and boat

| Game file | Source model | Creator | License | Changes made |
|---|---|---|---|---|
| `kit/car_white.glb` | [Car](https://poly.pizza/m/Cz6yDaUcM9) | Quaternius | CC0 1.0 | Smooth shading; aged in the game (dust, matte) |
| `kit/stationwagon.glb` | [Stationwagon](https://poly.pizza/m/vTTTjDoxhV) | Kay Lousberg | CC0 1.0 | As above |
| `kit/broken_car.glb` | [Broken Car](https://poly.pizza/m/Y67erogmR9) | Quaternius | CC0 1.0 | As above |
| `kit/van.glb` | [Generic Van](https://poly.pizza/m/BbRojf2v3H) | PuKkBuMXDD | CC BY 3.0 | As above |
| `kit/rowboat.glb` | [Rowboat](https://poly.pizza/m/dt1yhb5AYXD) | Poly by Google | CC BY 3.0 | As above |

### Built for this project

Everything else in `public/assets/models/kit/` is built by `blender/build_kit.py`: the trees, palms, shrubs and palmettos (leaf, frond and fan textures generated by `blender/kit/foliage.py`), the houses, pump house, walls, fences and gate, the playground, dock, cooler, bunny and branch. The neighborhood pass (2026-10-01) added, all generated the same way (no new downloads): the autumn leaf, big-leaf, grass and fallen-leaf textures; two copper oaks, a rust shrub, two big-leaf plants and three grass tufts; the boarded, teal and sand houses and two garden walls; an open suitcase and a cardboard box. Marc's Run clip comes from his own Tripo FBX.
