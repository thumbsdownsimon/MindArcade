# MindArcade

Four short cognitive games, inspired by game-based assessments, each followed by a personal results page with a score, style profile, strengths and things to work on.

| Game | Skill | Based on |
|---|---|---|
| Ferry Game | Problem-solving ability & style | River-crossing puzzles (fox/chicken/larva, black fox, adults & kids); minimum trips computed by a BFS solver |
| Racer Game | Cognitive flexibility | Four lanes with hidden speeds; the fastest lane moves every 10 s |
| Bird Spotting Game | Speed–accuracy trade-off | Pannable map search with +/− scoring and free target switching |
| Fish Discovery Game | Learning ability & memory | Sequences of fish groups on a pond, followed by order / location / count questions |

Results are stored in the browser's `localStorage`. There is no backend or database.

## Run locally (Windows)

Requires Node.js 20+.

```powershell
npm install
npm run dev
```

Open http://localhost:5173.

## Production build

```powershell
npm run build      # outputs static files to dist/
npm run preview    # serve the build locally on http://localhost:4173
```

## Deploy to the homelab

**Option A – Docker (recommended).** The container runs a small nginx that only serves the static files. Your existing homelab nginx stays the public entry point and proxies to it.

```bash
docker compose up -d --build     # serves on port 8080
```

Example reverse-proxy block for your existing nginx:

```nginx
location / {
    proxy_pass http://<docker-host>:8080;
    proxy_set_header Host $host;
}
```

The app uses relative asset paths and hash-based routing, so it also works under a sub-path (e.g. `location /games/ { proxy_pass http://<docker-host>:8080/; }`).

**Option B – no container.** Run `npm run build` and point a `root` in your existing nginx at the `dist/` folder.

## Project structure

```
src/
  App.tsx               routing + layout
  components/           Landing page, GameShell (intro → play → results), ResultsView, icons
  games/registry.ts     game metadata (titles, instructions, accent colours)
  games/<game>/         one folder per game: component, scoring/feedback logic, styles
  lib/                  shared types, helpers, localStorage history
```

To add a new game, create a folder under `src/games/`, export a component that calls `onFinish(result)`, and add an entry to `registry.ts`.
