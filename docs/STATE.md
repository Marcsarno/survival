# Current state

Last updated 2026-09-30. Live at **https://sarno-survive.vercel.app**. The latest playtest passed 30 of 30 checks, both locally and against the live site.

## What works (verified by the playtest; see PLAYTEST.md)

- **World:** a playable browser prototype with 9 connected outdoor areas and two travel loops. It covers snowy South Florida suburbs, a playground, a canal with docks, a beach, a pharmacy lot, a service road and camp, and pine woods with a frozen pond.
- **Resource loop:** gather or search, carry within pack limits, store in the stash, burn wood in the fire, and build 4 shelter upgrades.
- **Survival:**
  - Warmth, health, stamina and lantern oil.
  - Hunger drains over a day; food refills it.
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
- **One startup hitch.** Expect a single hitch of about 80 ms in the first second while shaders compile. The 110 ms spikes in automated runs come from screenshot capture.
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
2. Vision items deliberately left out of this build: the daughter-rescue opening, family characters at the shelter, dialogue and choices.
3. More set dressing to match the concept density: arched entries, awnings, more yard props.
4. Optional: connect the GitHub repo to the Vercel project so each push deploys automatically. Today deploys are manual.

## Deployment

- **Vercel project:** `sarno-survive` on the **Marc Sarno** team (`marcsarno`), account marc731@gmail.com. The live URL is <https://sarno-survive.vercel.app>.
- **Linking:** `.vercel/project.json` links this folder to the project. It is gitignored, so a fresh clone needs `npx vercel link --yes --project sarno-survive --scope marcsarno` once.
- **Redeploy:** run `npx vercel whoami` first; it should print `marc731-6361`. Then run `npm run deploy`. Vercel builds using `vercel.json` (`npm run build`, output in `dist/`). `.vercelignore` keeps the Blender and source-asset folders out of the upload; its patterns are anchored with a leading `/`, because a bare `assets/` would also drop `public/assets/`.
- **Verify live:** `node tools/playtest.mjs --url=https://sarno-survive.vercel.app/`

## Starting a new chat

Open this folder in Claude Code and say something like: "Read CLAUDE.md and docs/STATE.md, then let's improve X." Everything needed to continue is in the repo and in this file. Before any Vercel command, confirm the account is marc731, not hornerxpress.

## How to continue

Read `README.md`, then `docs/DESIGN.md`. Run `npm run dev` while working. After any change, run `npm run playtest`, then `npm run deploy` when it passes.
