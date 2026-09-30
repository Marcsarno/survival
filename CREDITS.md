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
