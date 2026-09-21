# Game Vault

A production-quality, original, browser-playable arcade — 15 original games
inspired by classic genres (no copyrighted assets, no ROMs).

## Tech stack
- React 19 + TypeScript 5.8 + Vite 6
- HTML5 Canvas rendering (DPR-aware) + CSS (neon/gaming theme)
- Web Audio API (synthesized SFX, no audio files)
- Gamepad API, keyboard, mouse and touch input
- LocalStorage persistence (scores, stats, achievements, settings, daily challenge)
- Hash routing → fully static, works behind plain nginx

## Quick start
```bash
# Docker (recommended) — builds and serves the production bundle
docker compose up -d --build
# → http://localhost:8080

# Or locally
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

## Architecture
```
src/
  app/            globalStore, game status context, game registry (15 games, lazy)
  audio/          Web Audio synth engine + useAudio hook
  components/     Navbar, Hud, VirtualControls, AchievementToasts, GameArt, GameCard
  gameEngine/     GameShell (game chrome), GameCanvas (DPR-aware), useGameLoop,
                  input (keyboard/gamepad/virtual), particles, screenShake, physics
  games/<id>/     one folder per game — uniform shape, see below
  pages/          Home, Game (lazy + error boundary), Stats, Achievements, Settings
  services/       game runtime object, daily challenge, storage (scores/stats/achievements/settings)
  styles/         index.css (single neon theme)
```

### How a game works
- `GameShell` renders the play field (`GameCanvas`), HUD, overlays (pause,
  game-over, help) and builds a **`GameRuntime`** object (canvas, ctx, input,
  particles, shake, sfx, score/level/lives setters, `endGame`, …).
- The runtime is handed to the game as a **plain React prop**
  (`<Game runtime={runtime} />`); a fallback registry
  (`useGameRuntime()`) exists but the prop is the primary path.
- Games paint onto the shell's canvas and **return `null`**; the loop is
  `useGameLoop(runtime, { onFrame })`.
- One known gotcha (fixed): never pass a component function directly to
  `setState` — React calls it as an updater with the previous state.
  In `GamePage` it is `setReady(() => module.default)`.
- Another gotcha (fixed): keep context callback identities stable.
  `GameShell` memoizes its `runtime` object (canvas/ctx/input/…) on the
  `setPaused` callback from `GameStatusProvider`; those callbacks must be
  `useCallback`-stable, or the memo recreates a runtime with `ctx: null`
  and every game's canvas freezes on its first frame.

## Adding a game
1. Create `src/games/<dir>/<Name>Game.tsx` (uniform shape: read `props.runtime`,
   use `useGameLoop`, return `null`).
2. Add one entry to `src/app/registry.ts` (definition + `load: () => import(...)`).
That's it — home page, routing, stats and achievements pick it up automatically.

## Commands
| Task          | Command                                   |
| ------------- | ----------------------------------------- |
| Typecheck     | `npx tsc --noEmit`                        |
| Build         | `npm run build`                           |
| Dev server    | `npx vite --host 127.0.0.1 --port 5173`   |
| Docker build  | `docker compose build`                    |
| Docker run    | `docker compose up -d` (port 8080)        |
| Docker stop   | `docker compose down`                     |

## 15 games
block-drop, brick-blaster, checkers, connect-four, dungeon-maze,
endless-runner, memory-matrix, mines, missile-defense, neon-racer, neon-snake,
orbital-defense, paddle-arena, pixel-defender, tower-grid