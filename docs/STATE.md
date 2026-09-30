# Current state

Last updated 2026-09-30, after the overnight build.

## What works (verified by the playtest; see PLAYTEST.md)

- **World:** a playable browser prototype with 9 connected outdoor areas and two travel loops. It covers snowy South Florida suburbs, a playground, a canal with docks, a beach, a pharmacy lot, a service road and camp, and pine woods with a frozen pond.
- **Resource loop:** gather or search, carry within pack limits, store in the stash, burn wood in the fire, and build 4 shelter upgrades.
- **Survival:**
  - Warmth, health, stamina and lantern oil.
  - Death drops your pack, and you can recover it.
  - Sleeping or resting passes time.
- **Combat:** the frozen hunt by sight, noise and lantern light. Aiming is forgiving and ammo is scarce; axe and shove work at close range.
- **Wildlife:** deer, foxes, rabbits, ducks, an owl, and wolves at night. A stray dog can be befriended.
- **Atmosphere:**
  - Day/night cycle, hand lantern, falling snow and passing squalls.
  - Fading footprints from the player, the frozen and animals.
  - Procedural sound.
- **Controls:** keyboard and mouse, plus touch controls. The camera height is adjustable, it rotates in 45° steps, and there is a low cinematic mode (C).
- **Guidance:** a goals checklist, a map that reveals areas as you visit them, and autosave.
- **Discoveries:** frozen iguanas, flamingos, snowmen, the emergency radio, pond water, the far-bank lantern, and snow squalls.
- **Pathfinding:** the frozen follow a flow field around walls, cars and fences.
- **Performance:** in the phone approximation (4× CPU throttle) it holds about 60 fps. Characters take one draw call each, and anything far away is neither drawn nor animated.
- **Pipeline:** repeatable Blender builds (`npm run assets`) produce compressed game models. Editable `.blend` files and license records are kept.

## Known issues / limitations

- **Phones untested on real hardware.** Only a simulated touch viewport was checked. Performance and controls still need a real iPhone and Android test.
- **Animals don't pathfind.** They wander and flee in straight lines. The frozen do pathfind, but only within about 34 m of the player.
- **Occasional frame-time spikes** (about 110 ms) during automated runs; the cause isn't isolated.
- **No interiors.** Houses and the pharmacy are searched at the door. The far canal bank can't be reached.
- **No end or win state.** It's a sandbox loop.
- **Lantern shadows are off by default** for performance. Enable them with `?shadows=high`.
- **An unused model:** a brown hooded survivor recolor is kept in `assets/source/survivor-built.glb` but not placed in the world.

## Untested behavior

- Long sessions beyond about 2 in-game days (save and load across many days, fire behavior while sleeping repeatedly).
- Browsers other than Chromium (Safari, Firefox).
- Rotated-camera movement over long routes (the harness uses the default camera angle).

## Next steps (suggested)

1. Play it on a phone and tune `quality=low`: shadows, pixel ratio, draw distance.
2. Deploy `dist/` to Vercel under the **marc731@gmail.com** account (the CLI is logged in) to get a link to text.
3. Vision items deliberately left out of this build: the daughter-rescue opening, family characters at the shelter, dialogue and choices.
4. More set dressing to match the concept density: potted plants, arched entries, pools, bikes.

## How to continue

Read `README.md`, then `docs/DESIGN.md`. Then run `npm run dev`, followed by `npm run playtest`, after any change.
