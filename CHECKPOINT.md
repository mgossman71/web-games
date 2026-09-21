# CHECKPOINT — Game Vault (interactive arcade) — SHIPPED ✅ · PUBLISHED 🌐

This file is the authoritative handoff. Three defects have been **FOUND,
FIXED, and VERIFIED** (15-route crash, "Play Again / frozen canvas", and
Neon Snake's death-before-input), and the project is now a **public GitHub
repo: https://github.com/mgossman71/web-games** (branch `main`).

Absolute project root: **/Users/markgossman/Documents/GITHUB/test**
HARD CONSTRAINT: ALL work stays inside that directory. Do not operate outside it.

---

## 1. Goal (DONE)
"Game Vault": a production-quality, original, browser-playable arcade web app.
- Exactly 15 ORIGINAL games (no copyrighted / ROM / commercial assets).
- Stack: React 19 + TypeScript 5.8 + Vite 6 + HTML5 Canvas + CSS + Web Audio API +
  Gamepad API + LocalStorage. Hash-routed (static, works on plain nginx).
- Deployed via Docker Compose (node:22-alpine build → nginx:1.27-alpine),
  host port 8080 → container 80, `restart: unless-stopped`, healthcheck.

## 2. THE BUG — ROOT CAUSE + FIX (RESOLVED THIS SESSION)
**Symptom:** ALL 15 `/play/:id` routes crashed at load:
```
pageerror: Cannot read properties of null (reading 'runtime')
```
`#root` 0 children (whole tree unmounted), NO `#gv-eb` error boundary, 0
canvases; home route fine. Reproduced cleanly (headless chromium) against the
docker-served production build.

**ROOT CAUSE:** `src/pages/GamePage.tsx` — `LoadedGame` used
`useState<ComponentType | null>(null)` for `Ready` and called
`setReady(m.default)`. **`m.default` is a function (the game component)**, and
React treats a function passed to `setState` as an **updater**: it invoked
`m.default(prevState)` with `prevState = null`. The game ran with
`props === null` → first line `props.runtime` threw. Because it ran inside
`useState`'s reducer (`typeof t == "function" ? t(e) : t`), it threw OUTSIDE a
normal render commit → not caught by the class ErrorBoundary → uncaught
pageerror → React unmounted the root. (Explains the prior session's probe
reading of `props === null`.)

**FIX (one line, `src/pages/GamePage.tsx`):**
```diff
-        if (alive) setReady(m.default);
+        if (alive) setReady(() => m.default);
```
Wrapping in `() =>` makes React call the ARROW (returns the component) instead
of calling the component itself. `Ready` is then a component, rendered normally
with the `runtime` prop.

## 2b. BUG #2 — "Play Again doesn't restart" (frozen canvas) — RESOLVED
**Symptom:** lose a game → click **Play Again** → the board looks exactly like
the moment of death; the game does not appear to restart. (In reality the
canvas was frozen on the VERY FIRST frame of the session for ALL games.)

**ROOT CAUSE (proven with instrumentation):** `src/app/gameState.tsx` —
`GameStatusProvider` defined `setPaused`/`setOver`/`reset` as inline arrow
functions and built the context `value` object inline → new identities on
EVERY provider render. `GameShell`'s `runtime` object is a `useMemo` whose
deps include `setPaused` → each re-render created a **new runtime with
`ctx: null`** (test log showed 6 recreations in one short run). The canvas +
2D context are bound once (by `GameCanvas`'s one-shot `onReady`) to the
FIRST runtime object, so every later `drawWorld()` hit `if (!ctx) return`
and silently stopped painting. Game logic (movement, death, HUD, overlays)
kept running invisibly — the user played "blind" on a frozen first frame.

**FIX (`src/app/gameState.tsx`):** wrap `setPaused`/`setOver`/`reset` in
`useCallback(..., [])` (reading `over` via `overRef`) and memoize the context
`value` with `useMemo`. Result: `runtime` is created exactly once, keeps its
canvas/ctx for the shell's lifetime, `useGameLoop` runs once per game mount,
and Play Again (remount via `runKey`) renders a fresh board.

**VERIFIED (headless, pixel-level):** board pixels change while playing;
game-over overlay works; Play Again visually resets the board (dataURL
differs from the death frame); no instant death after restart; can die again;
zero console/page errors. Full regression: 16/16 routes render clean +
live-render pixel check on block-drop (memory-matrix is static by design
until a card is clicked — expected).

## 2c. BUG #3 — Neon Snake died before first input — RESOLVED
**Symptom:** a fresh snake run auto-started moving right and died into the
right wall ~2s after load (score 20) before the player had any chance to steer.

**FIX (`src/games/snake/SnakeGame.tsx`):** added a `started: boolean` state
(init `false`). `stepWorld()` returns early while `!started && !dead`, so the
snake is frozen until the first steering input (keyboard / gamepad / swipe /
virtual buttons — all funnel through the same action pipeline) sets
`s.started = true`. While waiting, a pulsing on-board hint
"PRESS AN ARROW KEY — OR SWIPE — TO START" is drawn. Death/respawn logic
unchanged.

**Related fix (`src/gameEngine/input.ts`):** `preventDefault()` was called on
**keyup** events, whose listener is registered `passive: true` → Chromium
warning "Unable to preventDefault inside passive event listener invocation"
every time an arrow key was released. Now called on **keydown only** (also
where it matters — scroll intent begins on keydown).

## 3. What was also done this session
- Removed ALL leftover TEMP diagnostics (SnakeGame `__propDesc`/`__snake_calls`
  + `[SNAKE-DOM]` div; GameShell `__shellMark`/`__shell_calls`;
  useGameRuntime `__diag`/`__gv_rt_diag__` + throwaway line).
- Deleted leftover `gvaunt_probe.json`.
- Created `README.md` (setup / run / architecture / how to add a game).
- Killed two stale servers left by the prior session: Vite dev on 127.0.0.1:5199
  and `python http.server` on 127.0.0.1:5197.
- Rebuilt + redeployed via Docker Compose.
- Neon Snake: wait-for-first-input gate + on-board hint (see 2c).
- `src/gameEngine/input.ts`: `preventDefault` now keydown-only (passive-listener
  warning eliminated).
- **Published to GitHub (public):** `mgossman71/web-games` — repo created,
  `.gitignore` added (node_modules/dist excluded), `git init -b main`,
  initial commit `851639c` (66 files) pushed to `main`, remote `origin` set,
  working tree clean.
## 4. VERIFICATION (all PASSED)
- `npx tsc --noEmit` → **0 errors**.
- `npm run build` → passes (15 lazy game chunks + index).
- Docker: `docker compose build` + `up -d` → container `game-vault` **Up (healthy)**
  at http://127.0.0.1:8080 (index + all game chunks HTTP 200, no temp markers).
- **Clean headless render check (playwright-core + cached chromium): 16/16 PASS**
  (home + all 15 game routes, each canvas ≥ 1, no `#gv-eb`, no console/page errors).
- **Interaction check: INTERACTION-PASS** — pause overlay while playing + resume,
  game-over overlay with final score, and localStorage writes
  (`gv.score.neon-snake`, `gv.stats.v1`, `gv.achievements.v1`, etc.).
- **Neon Snake pixel test: SNAKE-FIX-PASS** — no game over before first input
  (idle 4s), no game over 500ms after first input, game over only after the
  snake actually hits the top wall (score 10), localStorage writes present,
  zero console/page errors.
- **Play-again pixel test: PLAY-AGAIN-PASS** (after the 2b fix) — board pixels
  change while playing (live render), death board ≠ post-restart board, no
  instant death after restart, can die again in the restarted game; verified
  on the CLEAN (instrumentation-removed) build.
- NOTE: the two temp test scripts (`e2e-check.mjs`, `e2e-play.mjs`) were used for
  the above and then **deleted** (throwaway, not part of the app). If you want them
  kept for regression, re-add them under a `tests/` dir.

## 5. File state (final)
- `src/pages/GamePage.tsx` — **FIXED** (`setReady(() => m.default)`).
- `src/app/gameState.tsx` — **FIXED** (stable `useCallback`/`useMemo` context —
  see 2b).
- `src/games/snake/SnakeGame.tsx` — wait-for-first-input gate + hint (2c).
- `src/gameEngine/input.ts` — keydown-only `preventDefault` (2c).
- `src/gameEngine/GameShell.tsx`, `src/gameEngine/useGameRuntime.tsx` — clean
  (all temp instrumentation removed).
- `README.md` — created, gotchas documented. `.gitignore` — created.
  `gvaunt_probe.json` — deleted.
- **Published:** `mgossman71/web-games` (public, branch `main`) mirrors this
  tree — initial commit `851639c`, then a docs-only checkpoint commit.
- Everything else under `src/` clean and working.

## 6. Build / run / test commands (run INSIDE the project root)
- Typecheck: `npx tsc --noEmit` (0 errors)
- Build: `npm run build` (tsc --noEmit && vite build)
- Docker: `docker compose up -d --build` → http://localhost:8080
  - stop: `docker compose down`; status: `docker ps --filter name=game-vault`
- Dev: `npx vite --host 127.0.0.1 --port 5173`
- Static preview: `npm run build && npx vite preview --host 127.0.0.1 --port 4173`
- 15 game ids: block-drop, brick-blaster, checkers, connect-four, dungeon-maze,
  endless-runner, memory-matrix, mines, missile-defense, neon-racer, neon-snake,
  orbital-defense, paddle-arena, pixel-defender, tower-grid

## 7. Next steps (optional polish only — app is functional)
1. ~~(Optional) `git init` + initial commit~~ — **DONE**: public repo
   `mgossman71/web-games`, `main` pushed (commit `851639c`).
2. (Optional) CI / static deploy: GitHub Actions build, or GitHub Pages.
3. (Optional) Re-add the regression e2e scripts under a `tests/` dir.
4. (Optional) Play each game briefly by hand to confirm feel/balance.
5. (Optional) Verify the other pages (Stats / Achievements / Settings) render and
   that achievements/toasts fire — home + game routes are proven; these chrome
   pages were not explicitly load-tested this session.
6. Do NOT leave the project root; do NOT bundle third-party / copyrighted assets.

## 8. Key context / assumptions / discoveries
- Environment: macOS, user home /Users/markgossman. Docker 29.8.0 + Compose
  v5.5.1. Containers `dashboard-backend` (:4000) and `dashboard-frontend` (:3000)
  are UNRELATED — leave them alone. Host 8080 = game-vault.
- Versions: React 19.x, react-dom 19.x, react-router-dom 7.x (HashRouter),
  Vite 6.x, TS 5.8, Node 22 (alpine, in Docker).
- `playwright-core` ^1.63 is a devDependency with a cached chromium (1243) in
  ~/Library/Caches/ms-playwright — headless verification works offline.
- Filename on disk is `CHECKPOINT.md` (uppercase); macOS FS is case-insensitive.
- The core lessons: (1) **never pass a function/component straight to
  `setState`** — React will invoke it as an updater with the previous state
  (broke every game route). (2) **keep context callback/value identities
  stable** — an unstable callback used in a `useMemo` dep silently recreates
  the memoized object (here: the shell runtime with `ctx: null`), which froze
  every game's canvas on its first frame.

— End of checkpoint (app is live at http://127.0.0.1:8080; published at
https://github.com/mgossman71/web-games).