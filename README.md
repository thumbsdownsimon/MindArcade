# MindArcade

**Play it here: https://thumbsdownsimon.github.io/MindArcade/**

MindArcade is a set of four short browser games inspired by game-based cognitive assessments. Each game focuses on one
mental skill. When you finish a round, a results page shows your score, your play style and what you could work on.

Three of the games are 3D, with blocky Minecraft-style characters (box heads, box torsos, box limbs). You can rotate the
view, hover over characters to see who they are, and click them to make them react. The Racer game is still 2D.

## The games

| Game | Skill | What you do |
|---|---|---|
| **Ferry Game** (3D) | Problem solving | You stand on the start shore and look across a river. Get everyone across on a small raft without anyone being eaten: fox eats chicken, chicken eats larva, and the black fox eats everything except other black foxes. In the family puzzles, a kid can never travel as the only passenger. |
| **Racer Game** (2D) | Cognitive flexibility | Four lanes with hidden speeds. Find the fastest lane, then find it again each time it moves, which happens every 10 seconds. |
| **Bird Spotting Game** (3D) | Speed vs. accuracy | Search a 3D world for one species of bird. The map has oak forest, pine woods, a meadow, a lake, a village and hills. Birds sit in tree tops, under trees, on roofs and in tall grass, and some fly to new spots. A correct click scores +10 and a wrong one costs −5. |
| **Fish Discovery Game** (3D) | Learning & memory | Groups of fish leap out of a pond one at a time. Afterwards you answer a surprise question about where they appeared, in what order, how many there were, or which area had the most. |

## How it works

- **It is a static site.** The app is built with React, TypeScript and Vite. The build output is plain HTML, CSS and JS, so GitHub Pages hosts it directly.
- **There is no backend.** Your results are saved in your browser's `localStorage`, so they stay on your device and are never uploaded.
- **The 3D uses three.js** through [React Three Fiber](https://r3f.docs.pmnd.rs/). Every character and prop is built from coloured boxes (`src/three/models.ts`). The boxes for each body part are merged into one mesh, so a character takes only a few draw calls and its head, arms, legs, wings and tail can still be animated. The same models are rendered once to small PNGs for the icons in the HUD and question panels.
- **Games load on demand.** Each game is lazy-loaded, so the landing page stays small, and the 3D engine only downloads when you open a 3D game.
- **The puzzles are solved in advance.** The Ferry Game runs a breadth-first search (`src/games/ferry/engine.ts`) to find the minimum number of trips for each puzzle. Your "trip efficiency" is measured against that minimum.
- **The bird map is new every game.** The map is generated each time (`src/games/birds/world.ts`): the zones are shuffled, then scenery, bird perches and "occluder" boxes are placed. Occluders stop you from clicking a bird through a tree or a roof.
- **Scoring is game-specific.** Each game records raw events (trips, clicks, reaction times, answers) and turns them into a 0–100 score, a profile (e.g. *Strategic Planner*, *Sharp Spotter*), strengths and improvement tips. The `analyse` function at the bottom of each game file does this.

> These games are for fun and practice. They are inspired by game-based assessments but are **not** a validated psychometric test.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev       # http://localhost:5173
```

Production build:

```bash
npm run build     # type-checks, then writes static files to dist/
npm run preview   # serves the build on http://localhost:4173
```

## Deployment

The site deploys to GitHub Pages through GitHub Actions (`.github/workflows/deploy.yml`). Every push to `main` builds the
app and publishes `dist/`. Vite is configured with `base: './'` and the app uses hash-based routing (`#/play/ferry`), so
it works under the `/MindArcade/` sub-path with no extra setup.

To make this work in a fork, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## Project structure

```
src/
  App.tsx                 routing and layout
  components/             landing page, GameShell (intro → play → results), results view, icons
  three/                  shared 3D pieces: blocky models, canvas setup, labels, previews, snapshots
  games/registry.ts       game metadata (titles, instructions, accent colours), lazy-loaded components
  games/ferry/            puzzle engine + solver, 3D river scene, game logic and scoring
  games/racer/            2D lane-switching game
  games/birds/            map generator, 3D scene with camera controls, game logic and scoring
  games/fish/             3D pond scene, fish looks, game logic and scoring
  lib/                    shared types, helpers, localStorage history
```

To add a game, create a folder under `src/games/`, export a component that calls `onFinish(result)`, and add an entry
to `registry.ts`.
