import { useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { TAU } from '../../utils/math';

/**
 * Tower Grid — grid-based tower defense.
 * Build towers on grid cells; enemies march along lanes toward the core.
 * 3 tower types, upgrades, 10 escalating waves.
 */

const COLS = 8;
const ROWS = 7;

type TowerKind = 'blaster' | 'frost' | 'turret';

const TOWER_INFO: Record<TowerKind, { name: string; color: string; cost: number; range: number; rate: number; dmg: number; desc: string }> = {
  blaster: { name: 'PULSE', color: '#22d3ee', cost: 40, range: 2.1, rate: 0.55, dmg: 9, desc: 'Fast single-target laser' },
  frost: { name: 'CRYO', color: '#a5f3fc', cost: 60, range: 1.8, rate: 0.9, dmg: 4, desc: 'Slows enemies in radius' },
  turret: { name: 'RAIL', color: '#f472b6', cost: 90, range: 3.0, rate: 1.5, dmg: 26, desc: 'Slow heavy railgun' },
};

interface Tower {
  cx: number;
  cy: number;
  kind: TowerKind;
  level: number;
  cd: number;
  angle: number;
}

interface Enemy {
  lane: number;
  dist: number; // cells along path
  hp: number;
  maxHp: number;
  speed: number; // cells/sec
  slowT: number;
  kind: number; // 0 grunt 1 runner 2 brute
  dead: boolean;
  px: number;
  py: number;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  life: number;
  color: string;
}

/** Wavy lane paths: each lane is a horizontal row with a sine offset baked per column. */
interface PathCol {
  lane: number;
  col: number;
  x: number;
  y: number;
}

function buildPaths(ox: number, oyTop: number, cell: number): PathCol[][] {
  const lanes: PathCol[][] = [];
  const laneRows = [1, 2, 4, 5];
  for (const row of laneRows) {
    const pts: PathCol[] = [];
    for (let c = 0; c <= COLS; c++) {
      const wiggle = Math.sin(c * 0.9 + row * 1.7) * cell * 0.45;
      pts.push({ lane: row, col: c, x: ox + c * cell, y: oyTop + (row + 0.5) * cell + (c > 0 && c < COLS ? wiggle : 0) });
    }
    lanes.push(pts);
  }
  return lanes;
}

const WAVES: { count: number; hp: number; speed: number; kinds: number[] }[] = [
  { count: 6, hp: 18, speed: 0.85, kinds: [0] },
  { count: 8, hp: 20, speed: 0.9, kinds: [0] },
  { count: 8, hp: 24, speed: 0.9, kinds: [0, 1] },
  { count: 10, hp: 28, speed: 0.95, kinds: [0, 1] },
  { count: 10, hp: 34, speed: 1.0, kinds: [0, 1] },
  { count: 12, hp: 38, speed: 1.0, kinds: [1, 2] },
  { count: 12, hp: 46, speed: 1.05, kinds: [0, 1, 2] },
  { count: 14, hp: 54, speed: 1.1, kinds: [1, 2] },
  { count: 14, hp: 66, speed: 1.15, kinds: [0, 1, 2] },
  { count: 18, hp: 80, speed: 1.25, kinds: [1, 2] },
];

export default function TowerGrid(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const cell = Math.floor(Math.min((W - 40) / (COLS + 0.5), (H - 110) / (ROWS + 0.8)));
  const ox = Math.max(8, (W - cell * COLS) / 2);
  const oyTop = 78;

  const [towerKind, setTowerKind] = useState<TowerKind>('blaster');

  const s = useRef({
    towers: [] as Tower[],
    enemies: [] as Enemy[],
    beams: [] as Beam[],
    paths: [] as PathCol[][],
    gold: 120,
    lives: 20,
    wave: 0, // 0 = none yet
    over: false,
    won: false,
    spawnLeft: 0,
    spawnTimer: 0,
    waveCooldown: 2.0,
    score: 0,
    hoveredCell: null as [number, number] | null,
  });

  useEffect(() => {
    const st = s.current;
    st.paths = buildPaths(ox, oyTop, cell);
    st.towers = [];
    st.enemies = [];
    st.beams = [];
    st.gold = 120;
    st.lives = 20;
    st.wave = 0;
    st.waveCooldown = 2.0;
    st.score = 0;
    st.over = false;
    st.won = false;
    rt.setScore(0);
    rt.setLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBuildable = (cx: number, cy: number) => {
    const st = s.current;
    const laneRows = [1, 2, 4, 5];
    if (laneRows.includes(cy)) return false;
    if (st.towers.some((t) => t.cx === cx && t.cy === cy)) return false;
    return true;
  };

  const enemyPos = (e: Enemy) => {
    const st = s.current;
    const path = st.paths[e.lane];
    const d = Math.max(0, Math.min(path.length - 1, e.dist));
    const i = Math.floor(d);
    const f = d - i;
    const a = path[i];
    const b = path[Math.min(path.length - 1, i + 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, end: e.dist >= path.length - 0.5 };
  };

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        draw();
        return;
      }

      // wave spawning
      if (st.waveCooldown > 0) {
        st.waveCooldown -= dt;
        if (st.waveCooldown <= 0) {
          st.wave += 1;
          rt.setLevel(st.wave);
          st.spawnLeft = WAVES[Math.min(WAVES.length - 1, st.wave - 1)].count;
          st.spawnTimer = 0;
          rt.sfx('levelup');
        }
      }
      if (st.wave > 0 && st.spawnLeft > 0) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          const cfg = WAVES[Math.min(WAVES.length - 1, st.wave - 1)];
          const kind = cfg.kinds[(Math.random() * cfg.kinds.length) | 0];
          const hp = kind === 2 ? cfg.hp * 2.4 : kind === 1 ? cfg.hp * 0.7 : cfg.hp;
          const speed = kind === 1 ? cfg.speed * 1.5 : kind === 2 ? cfg.speed * 0.6 : cfg.speed;
          st.enemies.push({
            lane: (Math.random() * st.paths.length) | 0,
            dist: 0,
            hp,
            maxHp: hp,
            speed,
            slowT: 0,
            kind,
            dead: false,
            px: -20,
            py: 0,
          });
          st.spawnLeft -= 1;
          st.spawnTimer = Math.max(0.45, 0.9 - st.wave * 0.03);
        }
      }

      // enemies
      for (let i = st.enemies.length - 1; i >= 0; i--) {
        const e = st.enemies[i];
        if (e.dead) continue;
        e.slowT = Math.max(0, e.slowT - dt);
        e.dist += e.speed * (e.slowT > 0 ? 0.5 : 1) * dt;
        const pos = enemyPos(e);
        e.px = pos.x;
        e.py = pos.y;
        if (pos.end) {
          e.dead = true;
          st.enemies.splice(i, 1);
          st.lives -= 1;
          rt.addShake(8);
          rt.sfx('explosion');
          rt.particles.spawnBurst(ox + COLS * cell, e.py, 16, 180, { colors: ['#ef4444', '#f97316'] });
          if (st.lives <= 0) {
            st.over = true;
            rt.endGame(st.score, false);
            draw();
            return;
          }
        }
      }

      // towers fire
      for (const t of st.towers) {
        t.cd -= dt;
        const info = TOWER_INFO[t.kind];
        const mx = ox + (t.cx + 0.5) * cell;
        const my = oyTop + (t.cy + 0.5) * cell;
        const dmgMul = 1 + (t.level - 1) * 0.55;
        const rangePx = info.range * cell * (1 + (t.level - 1) * 0.12);

        if (t.kind === 'frost') {
          // aura: slow everyone in range, damage tick
          if (t.cd <= 0) {
            t.cd = info.rate;
            let any = false;
            for (const e of st.enemies) {
              if (e.dead) continue;
              const d = Math.hypot(e.px - mx, e.py - my);
              if (d < rangePx) {
                e.slowT = Math.max(e.slowT, info.rate + 0.4);
                e.hp -= info.dmg * dmgMul;
                any = true;
              }
            }
            if (any) {
              st.beams.push({ x1: mx, y1: my, x2: mx, y2: my, t: 0, life: 0.18, color: 'frost' });
            }
          }
        } else {
          // target: nearest to core in range
          let best: Enemy | null = null;
          let bestScore = -1;
          for (const e of st.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.px - mx, e.py - my);
            if (d < rangePx) {
              const score = e.dist;
              if (score > bestScore) {
                bestScore = score;
                best = e;
              }
            }
          }
          if (best) {
            t.angle = Math.atan2(best.py - my, best.px - mx);
            if (t.cd <= 0) {
              t.cd = info.rate;
              best.hp -= info.dmg * dmgMul;
              st.beams.push({ x1: mx, y1: my, x2: best.px, y2: best.py, t: 0, life: 0.14, color: info.color });
              rt.particles.spark(best.px, best.py, info.color, 4);
              rt.sfx(t.kind === 'turret' ? 'thud' : 'laser');
              if (best.hp <= 0) {
                best.dead = true;
                const bounty = 8 + st.wave * 2 + best.kind * 6;
                st.gold += bounty;
                st.score += bounty * 2;
                rt.setScore(st.score);
                rt.sfx('coin');
                rt.particles.spawnBurst(best.px, best.py, 12, 160, { colors: [info.color, '#fff'] });
                // remove
                const idx = st.enemies.indexOf(best);
                if (idx >= 0) st.enemies.splice(idx, 1);
              }
            }
          }
        }
      }

      // wave complete?
      if (st.wave > 0 && st.spawnLeft === 0 && st.enemies.length === 0 && st.waveCooldown <= 0) {
        if (st.wave >= 10) {
          st.over = true;
          st.won = true;
          st.score += 1000 + st.lives * 30;
          rt.setScore(st.score);
          rt.endGame(st.score, true);
        } else {
          st.gold += 30 + st.wave * 8;
          st.waveCooldown = 2.2;
          rt.sfx('win');
        }
      }

      // beams
      for (let i = st.beams.length - 1; i >= 0; i--) {
        st.beams[i].t += dt;
        if (st.beams[i].t > st.beams[i].life) st.beams.splice(i, 1);
      }

      rt.particles.update(dt);
      draw();
    },
  });

  // pointer: build / upgrade
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const toCell = (e: PointerEvent): [number, number] | null => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const c = Math.floor((x - ox) / cell);
      const r = Math.floor((y - oyTop) / cell);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      const inCell = (x - (ox + c * cell)) < cell && (y - (oyTop + r * cell)) < cell;
      return inCell ? [c, r] : null;
    };
    const onMove = (e: PointerEvent) => {
      s.current.hoveredCell = toCell(e);
    };
    const onDown = (e: PointerEvent) => {
      const cellP = toCell(e);
      if (!cellP) return;
      const [c, r] = cellP;
      const st = s.current;
      const existing = st.towers.find((t) => t.cx === c && t.cy === r);
      if (existing) {
        const cost = TOWER_INFO[existing.kind].cost * existing.level;
        if (st.gold >= cost && existing.level < 3) {
          st.gold -= cost;
          existing.level += 1;
          st.score += 25;
          rt.setScore(st.score);
          rt.sfx('powerup');
          rt.particles.spawnBurst(ox + (c + 0.5) * cell, oyTop + (r + 0.5) * cell, 14, 140, { colors: [TOWER_INFO[existing.kind].color, '#fff'] });
        } else {
          rt.sfx('tick');
        }
      } else if (isBuildable(c, r)) {
        const cost = TOWER_INFO[towerKind].cost;
        if (st.gold >= cost) {
          st.gold -= cost;
          st.towers.push({ cx: c, cy: r, kind: towerKind, level: 1, cd: 0, angle: -Math.PI / 2 });
          rt.sfx('powerup');
          rt.particles.spawnBurst(ox + (c + 0.5) * cell, oyTop + (r + 0.5) * cell, 10, 110, { colors: [TOWER_INFO[towerKind].color] });
        } else {
          rt.sfx('tick');
        }
      } else {
        rt.sfx('tick');
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, towerKind, cell, ox, oyTop, W, H]);

  // keyboard: 1/2/3 to choose tower
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === '1') setTowerKind('blaster');
      if (e.key === '2') setTowerKind('frost');
      if (e.key === '3') setTowerKind('turret');
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0f1e');
    g.addColorStop(1, '#05070d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * cell;
        const y = oyTop + r * cell;
        const lane = [1, 2, 4, 5].includes(r);
        ctx.fillStyle = lane
          ? 'rgba(59,130,246,0.10)'
          : (r + c) % 2 === 0
            ? 'rgba(30,41,66,0.5)'
            : 'rgba(21,28,46,0.5)';
        ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }

    // lane arrows
    for (const path of st.paths) {
      ctx.strokeStyle = 'rgba(96,165,250,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // core (right edge, between lanes)
    const coreY = oyTop + 3.5 * cell;
    ctx.save();
    ctx.translate(ox + COLS * cell + cell * 0.5, coreY);
    const hpFrac = st.lives / 20;
    ctx.rotate(rt.now() / 900);
    ctx.strokeStyle = hpFrac > 0.4 ? '#34d399' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 16;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, -cell * 0.5);
      ctx.lineTo(cell * 0.18, -cell * 0.2);
      ctx.lineTo(-cell * 0.18, -cell * 0.2);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.2, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // towers
    for (const t of st.towers) {
      const x = ox + t.cx * cell;
      const y = oyTop + t.cy * cell;
      const info = TOWER_INFO[t.kind];
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      ctx.save();
      ctx.translate(cx, cy);
      if (t.kind === 'frost') {
        // range ring
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, info.range * cell * (1 + (t.level - 1) * 0.12), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.rotate(t.angle);
      ctx.shadowColor = info.color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = info.color;
      ctx.fillStyle = 'rgba(8,13,26,0.9)';
      ctx.lineWidth = 2.5;
      if (t.kind === 'turret') {
        ctx.fillRect(-cell * 0.26, -cell * 0.18, cell * 0.52, cell * 0.36);
        ctx.strokeRect(-cell * 0.26, -cell * 0.18, cell * 0.52, cell * 0.36);
        ctx.fillRect(cell * 0.18, -cell * 0.07, cell * 0.34, cell * 0.14);
        ctx.strokeRect(cell * 0.18, -cell * 0.07, cell * 0.34, cell * 0.14);
      } else if (t.kind === 'frost') {
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const a = (i / 6) * TAU + rt.now() / 1200;
          ctx.lineTo(Math.cos(a) * cell * 0.3, Math.sin(a) * cell * 0.3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, cell * 0.3, a - 0.25, a + 0.25);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(cell * 0.36, 0);
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      // level pips
      ctx.rotate(-t.angle);
      for (let i = 0; i < t.level; i++) {
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.arc(-cell * 0.22 + i * cell * 0.16, cell * 0.3, 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // enemies
    for (const e of st.enemies) {
      if (e.dead) continue;
      ctx.save();
      ctx.translate(e.px, e.py);
      const R = e.kind === 2 ? cell * 0.3 : e.kind === 1 ? cell * 0.17 : cell * 0.21;
      const color = e.kind === 2 ? '#f97316' : e.kind === 1 ? '#c084fc' : '#f87171';
      if (e.slowT > 0) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, R + 4, 0, TAU);
        ctx.stroke();
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#151a2b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.rotate(rt.now() / 130 + e.lane);
      ctx.beginPath();
      if (e.kind === 2) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const xx = Math.cos(a) * R;
          const yy = Math.sin(a) * R;
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.closePath();
      } else if (e.kind === 1) {
        ctx.moveTo(R, 0);
        ctx.lineTo(0, R * 0.8);
        ctx.lineTo(-R, 0);
        ctx.lineTo(0, -R * 0.8);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, R, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // hp bar
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(10,14,26,0.8)';
      ctx.fillRect(e.px - 14, e.py - cell * 0.42, 28, 4);
      ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(e.px - 14, e.py - cell * 0.42, 28 * frac, 4);
    }

    // beams
    for (const b of st.beams) {
      const alpha = 1 - b.t / b.life;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (b.color === 'frost') {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(b.x1, b.y1, (TOWER_INFO.frost.range * cell) * (0.5 + b.t * 2.4), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // hover ghost
    if (st.hoveredCell && !st.over) {
      const [c, r] = st.hoveredCell;
      const existing = st.towers.find((t) => t.cx === c && t.cy === r);
      const x = ox + c * cell;
      const y = oyTop + r * cell;
      const buildable = !existing && isBuildable(c, r);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = existing ? '#94a3b8' : buildable ? TOWER_INFO[towerKind].color : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
      if (!existing && buildable) {
        ctx.fillStyle = TOWER_INFO[towerKind].color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
        ctx.globalAlpha = 0.8;
        ctx.font = '600 10px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`$${TOWER_INFO[towerKind].cost}`, x + cell / 2, y + cell / 2 + 3);
      }
      ctx.restore();
    }

    // palette bar (top)
    const palette = [
      { key: 1, kind: 'blaster' as const, label: '1' },
      { key: 2, kind: 'frost' as const, label: '2' },
      { key: 3, kind: 'turret' as const, label: '3' },
    ];
    const pw = 118;
    const py0 = 10;
    palette.forEach((p, i) => {
      const px = 14 + i * (pw + 10);
      const active = towerKind === p.kind;
      ctx.save();
      ctx.fillStyle = active ? 'rgba(34,211,238,0.15)' : 'rgba(15,20,38,0.8)';
      ctx.strokeStyle = active ? TOWER_INFO[p.kind].color : 'rgba(71,85,105,0.6)';
      ctx.lineWidth = active ? 2 : 1;
      roundR(ctx, px, py0, pw, 46, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? '#f8fafc' : '#94a3b8';
      ctx.font = '700 12px Orbitron, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.label} ${TOWER_INFO[p.kind].name}`, px + 10, py0 + 20);
      ctx.font = '500 10px Orbitron, monospace';
      ctx.fillStyle = s.current.gold >= TOWER_INFO[p.kind].cost ? '#86efac' : '#fca5a5';
      ctx.fillText(`$${TOWER_INFO[p.kind].cost}`, px + 10, py0 + 38);
      ctx.restore();
    });

    // gold + lives
    ctx.font = '700 14px Orbitron, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`⬢ ${st.gold}`, W - 120, 32);
    ctx.fillStyle = st.lives > 6 ? '#34d399' : '#f87171';
    ctx.fillText(`CORE ${st.lives}`, W - 16, 32);

    // wave status
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px Orbitron, monospace';
    if (st.waveCooldown > 0 && st.wave > 0) {
      ctx.fillStyle = '#67e8f9';
      ctx.fillText(`WAVE ${st.wave + 1} IN ${Math.ceil(st.waveCooldown)}s`, W / 2, oyTop - 14);
    } else if (st.spawnLeft > 0) {
      ctx.fillText(`WAVE ${st.wave} — ${st.spawnLeft + st.enemies.length} HOSTILES REMAIN`, W / 2, oyTop - 14);
    } else if (st.wave === 0) {
      ctx.fillStyle = '#67e8f9';
      ctx.fillText(`WAVE 1 IN ${Math.ceil(st.waveCooldown)}s — BUILD YOUR DEFENSES!`, W / 2, oyTop - 14);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '500 10px Orbitron, monospace';
    ctx.fillText('TAP GRID TO BUILD · TAP TOWER TO UPGRADE', W / 2, H - 10);

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function roundR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
