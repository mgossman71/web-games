import type { GameDefinition } from '../types';

export interface RegistryEntry {
  def: GameDefinition;
  /** Lazy-loaded React game component. */
  load: () => Promise<{ default: React.ComponentType<{ width: number; height: number }> }>;
}

/**
 * Central game registry. Home, Daily Challenge and routing all read from here.
 * Adding a game = add one entry + create the game folder. Nothing else.
 */
export const GAME_REGISTRY: RegistryEntry[] = [
  // ---------------------------------------------------------------- arcade
  {
    def: {
      id: 'neon-snake',
      name: 'Neon Snake',
      short: 'Classic grid snake with power-ups and speed-up',
      description: 'Eat energy cells to grow. Every few bites the grid speeds up and hazard cells appear. Chain gold cells for bonus points.',
      genre: 'Arcade',
      tags: ['snake', 'classic', 'endless'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Arrow keys or WASD — steer', 'Swipe anywhere on the play field', 'Gamepad D-pad / stick — steer', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'touch', 'gamepad'],
      accent: '#34d399',
      artId: 'snake',
      features: ['Progressively faster speed', 'Bonus gold cells', 'Hazard cells at higher levels', 'Local high score', 'Swipe + gamepad steering'],
      width: 480,
      height: 480,
    },
    load: () => import('../games/snake/SnakeGame'),
  },
  {
    def: {
      id: 'brick-blaster',
      name: 'Brick Blaster',
      short: 'Breakout with multiple balls and power-ups',
      description: 'Keep the plasma orb alive. Power-ups drop: wide paddle, extra balls, sticky paddle and slow-mo. Brick layouts change every level.',
      genre: 'Arcade',
      tags: ['breakout', 'paddle', 'powerups'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Mouse or Arrow keys / A-D — move paddle', 'Touch drag — move paddle', 'Gamepad stick — move paddle', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'mouse', 'touch', 'gamepad'],
      accent: '#f472b6',
      artId: 'bricks',
      features: ['Multi-ball', '5 power-up types', 'Rotating brick layouts', 'Particle collisions', 'Lives and high score'],
      width: 480,
      height: 600,
    },
    load: () => import('../games/brickBlaster/BrickBlasterGame'),
  },
  {
    def: {
      id: 'orbital-defense',
      name: 'Orbital Defense',
      short: 'Asteroid-style space shooter',
      description: 'A lone fighter against a falling nebula. Split the rocks, dodge the fragments, ride the waves. Waves keep getting meaner.',
      genre: 'Arcade',
      tags: ['asteroids', 'space', 'waves'],
      players: 1,
      difficulty: 'Medium',
      controls: ['Arrow keys or WASD — thrust & rotate', 'Space or Z — fire', 'Gamepad stick — thrust, A — fire', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'gamepad', 'touch'],
      accent: '#22d3ee',
      artId: 'ship',
      features: ['Momentum physics', 'Asteroid splitting', 'Particle explosions', 'Wave progression', '3 lives'],
      width: 640,
      height: 480,
    },
    load: () => import('../games/orbitalDefense/OrbitalDefenseGame'),
  },
  {
    def: {
      id: 'pixel-defender',
      name: 'Pixel Defender',
      short: 'Classic alien-wave shooter with shields & boss',
      description: 'Stand your line against a descending grid of drones. Shields absorb hits. Every 5th wave ships a boss with a unique firing pattern.',
      genre: 'Arcade',
      tags: ['invaders', 'waves', 'boss'],
      players: 1,
      difficulty: 'Medium',
      controls: ['Arrow keys or A/D — move', 'Space or Z — fire (hold for auto)', 'Gamepad: stick/A — fire', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'gamepad'],
      accent: '#a78bfa',
      artId: 'invaders',
      features: ['Shield blocks shots', '5-wave boss cycle', 'Escalating speed', 'Auto-fire hold', 'Power-up drops'],
      width: 480,
      height: 560,
    },
    load: () => import('../games/pixelDefender/PixelDefenderGame'),
  },
  {
    def: {
      id: 'paddle-arena',
      name: 'Paddle Arena',
      short: 'Pong against a smart AI or a friend',
      description: 'Two paddles, one ball, three AI difficulties. Local 2-player on the same keyboard, or beat the machine. Best of 5 with first-to-10.',
      genre: 'Arcade',
      tags: ['pong', '2p', 'ai'],
      players: 2,
      difficulty: 'Easy',
      controls: ['Player 1 — W/S (or Up/Down on the left) — move your paddle', 'Player 2 — ↑/↓ — move your paddle (2P mode)', 'Gamepad: stick — paddle', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'gamepad'],
      accent: '#fbbf24',
      artId: 'pong',
      features: ['AI: Rookie / Pro / Legend', 'Local 2-player', 'First to 10', 'Ball speeds up on every hit'],
      width: 640,
      height: 400,
    },
    load: () => import('../games/paddleArena/PaddleArenaGame'),
  },
  // ------------------------------------------------------------- racing
  {
    def: {
      id: 'neon-racer',
      name: 'Neon Racer',
      short: 'Top-down circuit racing with AI rivals',
      description: 'Three original tracks, full throttle, three AI drivers, and a lap timer with best-lap records. Beat the field — beat the clock.',
      genre: 'Racing',
      tags: ['racing', 'circuit', 'laps'],
      players: 1,
      difficulty: 'Medium',
      controls: ['W / Arrow Up — accelerate', 'S / Arrow Down — brake & reverse', 'A / Arrow Left & D / Arrow Right — steer', 'Gamepad stick + trigger — steer & throttle', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'gamepad', 'touch'],
      accent: '#fb7185',
      artId: 'racer',
      features: ['3 tracks', '3 AI drivers', 'Best-lap records per track', '3-lap race', 'Skid & boost zones'],
      width: 720,
      height: 440,
    },
    load: () => import('../games/neonRacer/NeonRacerGame'),
  },
  // ------------------------------------------------------------- puzzle
  {
    def: {
      id: 'block-drop',
      name: 'Block Drop',
      short: 'Falling block puzzle, original art',
      description: 'Rotate and stack tetromino-style blocks under your own original neon palette. Ghost piece, hold slot, 5-bag shuffle, and line-clear multipliers.',
      genre: 'Puzzle',
      tags: ['blocks', 'tetromino', 'puzzle'],
      players: 1,
      difficulty: 'Medium',
      controls: ['← / A — move left', '→ / D — move right', '↑ / W — rotate', '↓ / S — soft drop', 'Space — hard drop', 'X or C — hold piece', 'Gamepad + A — rotate, B — drop'],
      supportedInputs: ['keyboard', 'gamepad', 'touch'],
      accent: '#60a5fa',
      artId: 'blocks',
      features: ['7-bag shuffle', 'Ghost piece', 'Hold slot', 'Combo multipliers', 'Original art'],
      width: 320,
      height: 480,
    },
    load: () => import('../games/blockDrop/BlockDropGame'),
  },
  {
    def: {
      id: 'mines',
      name: 'Mines',
      short: 'Classic mine-clearing logic',
      description: 'Clear the field, flag the mines. Easy / medium / hard / custom boards. No color-only cues — mines always ship with a flag state.',
      genre: 'Puzzle',
      tags: ['mines', 'logic', 'grid'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Left click / tap — reveal', 'Right click / long press — flag', 'Mouse + touch supported', 'P or Start — pause'],
      supportedInputs: ['mouse', 'touch', 'keyboard'],
      accent: '#2dd4bf',
      artId: 'mines',
      features: ['Easy 9×9', 'Medium 16×16', 'Hard 24×24', 'Custom sizes', 'Touch long-press flag'],
      width: 480,
      height: 520,
    },
    load: () => import('../games/mines/MinesGame'),
  },
  {
    def: {
      id: 'memory-matrix',
      name: 'Memory Matrix',
      short: 'Card-matching with original symbols',
      description: 'Flip pairs, beat the clock. Three grid sizes with distinct original glyphs — not shapes from other memory apps.',
      genre: 'Puzzle',
      tags: ['memory', 'cards', 'match'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Arrow keys + Enter — flip a tile', 'Arrow keys — move cursor', 'Mouse — click a tile', 'Touch — tap a tile', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'mouse', 'touch'],
      accent: '#f0abfc',
      artId: 'memory',
      features: ['4×3, 6×4, 8×4 sizes', 'Timer & move counter', 'Local best moves per size'],
      width: 480,
      height: 480,
    },
    load: () => import('../games/memoryMatrix/MemoryMatrixGame'),
  },
  // ------------------------------------------------------------- strategy
  {
    def: {
      id: 'tower-grid',
      name: 'Tower Grid',
      short: 'Grid tower defense, three tower types',
      description: 'Route the swarm past your base. Three tower archetypes, upgrades, selling, and 12 waves of escalating enemies.',
      genre: 'Strategy',
      tags: ['towers', 'defense', 'waves'],
      players: 1,
      difficulty: 'Hard',
      controls: ['Mouse — select tower, place it', 'Right-click a tower — sell for 60%', 'Gamepad + touch — tap a spot to place, tap a tower to select', '1/2/3 — switch tower type', 'P or Start — pause'],
      supportedInputs: ['mouse', 'touch', 'gamepad', 'keyboard'],
      accent: '#4ade80',
      artId: 'towers',
      features: ['3 tower archetypes', 'Upgrades & selling', '12 escalating waves', 'Money economy'],
      width: 640,
      height: 520,
    },
    load: () => import('../games/towerGrid/TowerGridGame'),
  },
  // ------------------------------------------------------------ board
  {
    def: {
      id: 'connect-four',
      name: 'Connect Four',
      short: 'Local 2P or a computer with 3 difficulties',
      description: '7-column, 6-row classic. Be the first to line up four — horizontal, vertical or diagonal. AI: Rookie, Pro, Legend (deep look-ahead).',
      genre: 'Board',
      tags: ['connect-four', '2p', 'ai'],
      players: 2,
      difficulty: 'Easy',
      controls: ['Arrow keys — move column', 'Enter or Space — drop disc', 'Mouse — hover & click a column', 'Touch — tap a column', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'mouse', 'touch', 'gamepad'],
      accent: '#fb923c',
      artId: 'connect4',
      features: ['Local 2P', '3 AI levels', 'Disc drop animation', 'Win detection all 4 directions'],
      width: 560,
      height: 480,
    },
    load: () => import('../games/connectFour/ConnectFourGame'),
  },
  {
    def: {
      id: 'checkers',
      name: 'Checkers',
      short: 'Legal moves, kings, AI opponent',
      description: 'Standard 8×8 with forced jumps and king pieces. Play against a friend or the machine (three AI levels). No flying captures.',
      genre: 'Board',
      tags: ['checkers', '2p', 'ai'],
      players: 2,
      difficulty: 'Easy',
      controls: ['Arrow keys + Enter — select & move', 'Mouse — click a piece, click a destination', 'Touch — tap a piece, tap a destination', 'Gamepad — D-pad + A', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'mouse', 'touch', 'gamepad'],
      accent: '#e2e8f0',
      artId: 'checkers',
      features: ['Forced jumps', 'King pieces', '3 AI levels'],
      width: 480,
      height: 480,
    },
    load: () => import('../games/checkers/CheckersGame'),
  },
  // ------------------------------------------------------------- casual
  {
    def: {
      id: 'dungeon-maze',
      name: 'Dungeon Maze',
      short: 'Random mazes, collect gems, find the exit',
      description: 'A new maze is generated every run. Collect gems, dodge patrolling drones at higher levels, and reach the glowing exit before the timer.',
      genre: 'Casual',
      tags: ['maze', 'dungeon', 'roguelite'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Arrow keys or WASD — move', 'Swipe — slide in that direction', 'Gamepad D-pad / stick — move', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'touch', 'gamepad'],
      accent: '#c084fc',
      artId: 'maze',
      features: ['Recursive-backtracker mazes', 'Size ramps with level', 'Drones from level 3', 'Gems & timed exit'],
      width: 480,
      height: 480,
    },
    load: () => import('../games/dungeonMaze/DungeonMazeGame'),
  },
  {
    def: {
      id: 'endless-runner',
      name: 'Endless Runner',
      short: 'Jumps, slides, speed ramps',
      description: 'A side-scroller of your own choosing — jump over barriers, slide under beams, hit ramps for air time. Speed ramps forever.',
      genre: 'Action',
      tags: ['runner', 'side-scroller', 'endless'],
      players: 1,
      difficulty: 'Easy',
      controls: ['Space / ↑ / W — jump', '↓ / S — slide', 'Mouse click — jump', 'Touch tap — jump, swipe down — slide', 'Gamepad A — jump, D-pad down — slide', 'P or Start — pause'],
      supportedInputs: ['keyboard', 'mouse', 'touch', 'gamepad'],
      accent: '#fca5a5',
      artId: 'runner',
      features: ['Procedural obstacles', 'Ramp jumps', 'Speed keeps ramping', 'Coin pickups'],
      width: 720,
      height: 360,
    },
    load: () => import('../games/endlessRunner/EndlessRunnerGame'),
  },
  {
    def: {
      id: 'missile-defense',
      name: 'Missile Command Center',
      short: 'Intercept swarms, protect the cities',
      description: 'Aim at incoming missiles and fire your limited interceptor rounds. Chain explosions for multipliers. If a city falls, you lose the round.',
      genre: 'Action',
      tags: ['missile', 'intercept', 'chain'],
      players: 1,
      difficulty: 'Hard',
      controls: ['Mouse — aim & click to fire', 'Touch — drag to aim, tap to fire', 'Keyboard: arrow keys aim, Space fires', 'Gamepad stick — aim, A — fire', 'P or Start — pause'],
      supportedInputs: ['mouse', 'touch', 'keyboard', 'gamepad'],
      accent: '#67e8f9',
      artId: 'missiles',
      features: ['Limited interceptor rounds', 'Chain explosions', 'Wave progression', 'Multiple launch sites'],
      width: 640,
      height: 480,
    },
    load: () => import('../games/missileDefense/MissileDefenseGame'),
  },
];

const byId = new Map(GAME_REGISTRY.map((e) => [e.def.id, e]));

export function getGame(id: string): RegistryEntry | undefined {
  return byId.get(id);
}

export function allGames(): GameDefinition[] {
  return GAME_REGISTRY.map((e) => e.def);
}

export function randomGame(excludeId?: string): GameDefinition {
  const pool = excludeId ? GAME_REGISTRY.filter((e) => e.def.id !== excludeId) : GAME_REGISTRY;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i].def;
}

export function gamesByGenre(genre: string): GameDefinition[] {
  return allGames().filter((g) => g.genre === genre);
}
