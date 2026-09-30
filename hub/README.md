# Project hub

A browser-viewable production record for Sarno Survive. It covers the plan, the route, references, assets, characters, motion tests, and before/after comparisons. It is not part of the game build.

- **Open:** double-click `index.html`, or run `npm run hub` (served at http://localhost:5173/hub/).
- **Content:** `data.js`. Edit it and reload. `hub.js` renders it, and `hub.css` styles it.
- **Captures:** `media/<set>/`, written by `node tools/capture.mjs --set=<name>`. Each set's `capture.json` records the commit, viewport and conditions. `baseline/` is the old sandbox. `slice-v1/` is the first opening-route build.
- **References:** `refs-local/` is gitignored because the concept art stays outside the repo. `node tools/hub-refs.mjs` copies it from Marc's Codex outputs folder.
- **Statuses:** reference, planned, implemented, agent-tested, approved (Marc only), unverified, superseded. Never set `approved` unless Marc said so in chat.
- **Keep versions together:** in `route.sections[].shots`, each group lists a reference, the baseline and slice versions, and the viewer switches between them.
- **Updating after a change:** capture a new set (for example `slice-v2`). Point the relevant entries at it and keep the older set as a version. Add a motion-test entry with conditions, findings and revisions.
