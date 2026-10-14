# MindArcade

**Play it here: https://thumbsdownsimon.github.io/MindArcade/**

MindArcade is a set of nine short browser games for practising the kind of aptitude and logic tests employers use
(SHL, Aon, Talent Q, Capp, Arctic Shores and similar). Each game focuses on one mental skill. Every game starts with an
optional practice round with hints and explanations. When you finish a real round, a results page shows your score,
your play style, what you could work on and your progress over your previous attempts.

Four of the games are 3D, with blocky Minecraft-style characters and props. The reasoning and attention tests are 2D,
because they need crisp shapes, readable data and fast, precise reactions.

## The games

| Game | Skill | What you do |
|---|---|---|
| **Ferry Game** (3D) | Problem solving | Get everyone across a river on a small raft without anyone being eaten. Each run has 8 puzzles from warm-up to expert, most of them animal mixes generated for that game: foxes, chickens and larvae, wolves that eat sheep when they outnumber them, a sheepdog that guards its bank, a bear that takes two seats, and the classic police-and-thief IQ puzzle where there is no sailor and only adults can row. The fewest possible trips stays hidden during the test. Afterwards you can retry, unscored and with hints, the puzzles you didn't solve perfectly. |
| **Racer Game** (2D) | Cognitive flexibility | Four lanes with hidden speeds. Find the fastest lane, then find it again each time it moves, which happens every 10 seconds. |
| **Bird Spotting Game** (3D) | Speed vs. accuracy | Search a 3D world for one species of bird. The map has oak forest, pine woods, a meadow, a lake, a village and hills. Birds sit in tree tops, under trees, on roofs and in tall grass, and some fly to new spots. A correct click scores +10 and a wrong one costs −5. |
| **Fish Discovery Game** (3D) | Learning & memory | Groups of fish leap out of a pond one at a time. Afterwards you answer a surprise question about where they appeared, in what order, how many there were, or which area had the most. |
| **Pattern Matrix** (2D) | Inductive reasoning | Raven-style 3×3 matrices generated from rules (constant, one-of-each, step-by-step, arithmetic) on shape, count, colour, fill and arrow direction. 12 puzzles, 90 s each. |
| **Number Crunch** (2D) | Numerical reasoning | A revenue table, a bar chart and a staff survey with percentage, share, projection, currency, ratio and weighted-average questions. Wrong options come from typical mistakes. Built-in calculator. |
| **Tower Planner** (3D) | Planning | Tower of London: rebuild the goal layout with the fewest moves, after predicting how many moves you need. 3- and 4-block puzzles. |
| **Rule Switch** (2D) | Deductive flexibility | Wisconsin-style card sorting: find the hidden rule (colour, shape or number) from feedback, and notice when it changes. |
| **Focus Stream** (2D) | Attention & control | Flanker arrows, Stroop colour words and a 2-back letter stream, scored on accuracy, reaction time and d′. |

## How it works

- **It is a static site.** The app is built with React, TypeScript and Vite. The build output is plain HTML, CSS and JS, so GitHub Pages hosts it directly.
- **There is no backend.** Your results are saved in your browser's `localStorage`, so they stay on your device and are never uploaded.
- **The 3D uses three.js** through [React Three Fiber](https://r3f.docs.pmnd.rs/). Every character and prop is built from coloured boxes (`src/three/models.ts`). The boxes for each body part are merged into one mesh, so a character takes only a few draw calls and its head, arms, legs, wings and tail can still be animated. The same models are rendered once to small PNGs for the icons in the HUD and question panels.
- **Games load on demand.** Each game is lazy-loaded, so the landing page stays small, and the 3D engine only downloads when you open a 3D game.
- **The puzzles are solved in advance.** The Ferry Game runs a breadth-first search (`src/games/ferry/engine.ts`) to find the minimum number of trips for each puzzle. Your "trip efficiency" is measured against that minimum. The same solver powers the practice hints. Tower Planner does the same for its moves (`src/games/tower/engine.ts`).
- **Ferry puzzles are rated, not hand-labelled.** `src/games/ferry/rating.ts` maps every reachable state and walks the best solution. It counts *detours* (trips where a passenger has to go back, the counter-intuitive move) and *traps* (the share of choices at each step that get someone eaten or lead nowhere). Together these set the tier. The generator (`src/games/ferry/generate.ts`) draws random animal casts and keeps one only if every animal takes part in a rule, the solver can solve it, and it rates in the tier the run needs. The police-and-thief families are a small, fixed set, so they stay hand-written in `puzzles.ts`.
- **Most content is generated.** Pattern matrices (`src/games/matrix/generate.ts`), numerical data sets and questions (`src/games/numbers/data.ts`) and tower layouts are generated fresh each game. Matrix answer options are built as a 2×2×2 set, so the answer can't be found by spotting the odd one out.
- **Practice rounds are never saved.** Each game gets a `practice` prop and runs a shorter, gentler version with explanations.
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
  games/matrix/           pattern-matrix generator, SVG figures, game and scoring
  games/numbers/          data sets and questions, table/chart exhibit, calculator
  games/tower/            Tower of London solver and generator, 3D board
  games/switch/           card-sorting game
  games/focus/            flanker, Stroop and 2-back tasks
  lib/                    shared types, helpers, localStorage history
```

To add a game, create a folder under `src/games/`, export a component that calls `onFinish(result)`, and add an entry
to `registry.ts`.
