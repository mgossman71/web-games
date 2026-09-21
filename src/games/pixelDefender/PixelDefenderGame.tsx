import { useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import type { GameAction } from '../../types';

interface Alien {
  baseX: number;
  x: number;
  y: number;
  kind: number; // 0 small, 1 mid, 2 big
  hp: number;
  phase: number;
  dead: boolean;
}

interface Shot {
  x: number;
  y: number;
  vy: number;
}

interface Boss {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: number;
}

const BOSS_WAVES = [5, 10, 15];
const FINAL_WAVE = 15;

export default function PixelDefender(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const s = useRef({
    px: W / 2,
    pCd: 0,
    pShots: [] as Shot[],
    eShots: [] as Shot[],
    aliens: [] as Alien[],
    shields: [] as { x: number; hp: number }[],
    boss: null as Boss | null,
    score: 0,
    wave: 1,
    lives: 3,
    waveCooldown: 1.0,
    over: false,
  });

  const yShield = H - 96;

  const formRow = (y: number, kind: number, count: number): Alien[] => {
    const out: Alien[] = [];
    const gap = (W - 140) / count;
    for (let i = 0; i < count; i++) {
      out.push({
        baseX: 70 + i * gap + gap / 2,
        x: 70 + i * gap + gap / 2,
        y,
        kind,
        hp: kind === 2 ? 3 : kind === 1 ? 2 : 1,
        phase: (i / count) * Math.PI * 2 + kind,
        dead: false,
      });
    }
    return out;
  };

  const startWave = (wave: number) => {
    const st = s.current;
    st.wave = wave;
    st.waveCooldown = 1.0;
    rt.setLevel(wave);
    if (BOSS_WAVES.includes(wave)) {
      st.boss = {
        x: W / 2,
        y: 110,
        hp: 26 + wave * 4,
        maxHp: 26 + wave * 4,
        phase: 0,
      };
      st.aliens = [];
    } else {
      st.boss = null;
      st.aliens = [
        ...formRow(72, 2, 3),
        ...formRow(106, 1, 4),
        ...formRow(140, 0, 5 + Math.min(2, wave)),
      ];
    }
    st.shields = [
      { x: W * 0.3, hp: 20 + wave * 2 },
      { x: W * 0.5, hp: 20 + wave * 2 },
      { x: W * 0.7, hp: 20 + wave * 2 },
    ];
  };

  useEffect(() => {
    startWave(1);
    s.current.lives = 3;
    rt.setLives(3);
    rt.setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const st = s.current;
    const off = rt.input.subscribe((a: GameAction, down: boolean) => {
      if (!down || st.over) return;
      void a;
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        draw();
        return;
      }

      const t = rt.now() / 1000;

      // --- player movement ---
      let dir = 0;
      if (rt.input.isHeld('moveLeft')) dir -= 1;
      if (rt.input.isHeld('moveRight')) dir += 1;
      const ax = rt.input.getAxisX();
      if (ax !== 0) dir = ax;
      st.px += dir * 340 * dt;
      st.px = Math.max(30, Math.min(W - 30, st.px));

      // --- fire ---
      st.pCd -= dt;
      if ((rt.input.isHeld('fire') || rt.input.isHeld('jump') || rt.input.isHeld('confirm')) && st.pCd <= 0) {
        st.pCd = 0.21;
        st.pShots.push({ x: st.px, y: H - 56, vy: -440 });
        rt.sfx('laser');
      }

      // --- alien drift + enemy fire ---
      let alive = 0;
      for (const al of st.aliens) {
        if (al.dead) continue;
        alive++;
        al.x = al.baseX + Math.sin(t * 0.7 + al.phase) * 90 + Math.sin(t * 0.23) * 40;
      }
      void alive;
      // (rows were baked at spawn; nudge slowly down each second for pressure)
      if (st.waveCooldown > 0) {
        st.waveCooldown -= dt;
      }
      if (dt > 0 && Math.random() < (0.35 + st.wave * 0.05) * dt) {
        const pool = st.aliens.filter((a) => !a.dead);
        if (pool.length > 0) {
          const a = pool[(Math.random() * pool.length) | 0];
          st.eShots.push({ x: a.x, y: a.y + 14, vy: 160 + st.wave * 14 });
        }
      }

      // --- boss ---
      if (st.boss) {
        const b = st.boss;
        b.phase += dt;
        b.x = W / 2 + Math.sin(b.phase * 0.8) * (W / 2 - 80);
        b.y = 110 + Math.sin(b.phase * 1.7) * 14;
        if (dt > 0 && Math.random() < 1.5 * dt) {
          st.eShots.push({ x: b.x - 34, y: b.y + 22, vy: 200 });
          st.eShots.push({ x: b.x + 34, y: b.y + 22, vy: 200 });
          rt.sfx('thud');
        }
      }

      // --- player shots update + collisions ---
      for (let i = st.pShots.length - 1; i >= 0; i--) {
        const b = st.pShots[i];
        b.y += b.vy * dt;
        if (b.y < -16) {
          st.pShots.splice(i, 1);
          continue;
        }
        let hit = false;
        for (const al of st.aliens) {
          if (al.dead) continue;
          const size = al.kind === 2 ? 20 : al.kind === 1 ? 16 : 12;
          if (Math.abs(b.x - al.x) < size + 3 && Math.abs(b.y - al.y) < size + 6) {
            hit = true;
            al.hp -= 1;
            if (al.hp <= 0) {
              al.dead = true;
              st.score += al.kind === 2 ? 30 : al.kind === 1 ? 20 : 10;
              rt.setScore(st.score);
              rt.sfx('explosion');
              rt.addShake(4);
              rt.particles.spawnBurst(al.x, al.y, 14, 160, { colors: ['#f87171', '#fbbf24', '#fff'] });
            } else {
              rt.sfx('hit');
              rt.particles.spark(b.x, b.y, '#fca5a5');
            }
            break;
          }
        }
        if (!hit && st.boss && Math.abs(b.x - st.boss.x) < 52 && Math.abs(b.y - st.boss.y) < 34) {
          hit = true;
          st.boss.hp -= 1;
          rt.sfx('hit');
          rt.particles.spark(b.x, b.y, '#f87171');
          if (st.boss.hp <= 0) {
            st.score += 500 + st.wave * 10;
            st.boss = null;
            rt.addShake(18);
            rt.sfx('win');
            rt.particles.spawnBurst(W / 2, 110, 60, 300, { colors: ['#f87171', '#fbbf24', '#fff', '#22d3ee'] });
          }
        }
        if (hit) st.pShots.splice(i, 1);
      }

      // --- enemy shots ---
      for (let i = st.eShots.length - 1; i >= 0; i--) {
        const b = st.eShots[i];
        b.y += b.vy * dt;
        if (b.y > H + 16) {
          st.eShots.splice(i, 1);
          continue;
        }
        for (const sh of st.shields) {
          if (sh.hp > 0 && Math.abs(b.x - sh.x) < 42 && Math.abs(b.y - yShield) < 16) {
            sh.hp -= 1;
            st.eShots.splice(i, 1);
            rt.sfx('thud');
            break;
          }
        }
        if (st.eShots[i] === undefined) continue;
        if (b.y > H - 58 && Math.abs(b.x - st.px) < 22) {
          st.eShots.splice(i, 1);
          st.lives -= 1;
          st.pCd = 0.7;
          rt.setLives(st.lives);
          rt.sfx('explosion');
          rt.addShake(12);
          rt.particles.spawnBurst(st.px, H - 38, 26, 220, { colors: ['#22d3ee', '#fff'] });
          if (st.lives <= 0) {
            st.over = true;
            rt.endGame(st.score, false);
          }
          continue;
        }
      }

      // --- wave complete ---
      if ((st.aliens.every((a) => a.dead) || st.aliens.length === 0) && !st.boss && st.waveCooldown <= 0) {
        if (st.wave >= FINAL_WAVE) {
          st.over = true;
          st.score += 3000;
          rt.setScore(st.score);
          rt.endGame(st.score, true);
        } else {
          startWave(st.wave + 1);
        }
      }

      rt.particles.update(dt);
      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d0716');
    g.addColorStop(1, '#05040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(226,232,240,0.3)';
    for (let i = 0; i < 42; i++) {
      ctx.fillRect((i * 97 + 13) % W, (i * 151 + 29) % H, 1.5, 1.5);
    }

    // alien fleet
    for (const al of st.aliens) {
      if (al.dead) continue;
      drawAlien(ctx, al, rt.now());
    }

    // boss
    if (st.boss) {
      const b = st.boss;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#1c0b12';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(44, -10);
      ctx.lineTo(54, 14);
      ctx.lineTo(28, 32);
      ctx.lineTo(-28, 32);
      ctx.lineTo(-54, 14);
      ctx.lineTo(-44, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#f87171' : '#fbbf24';
        ctx.fillRect(i * 18 - 6, -8, 12, 12);
      }
      // hp bar
      ctx.shadowBlur = 0;
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#3f1d2b';
      ctx.fillRect(-50, -48, 100, 8);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(-50, -48, 100 * frac, 8);
      ctx.restore();
    }

    // shields
    for (const sh of st.shields) {
      if (sh.hp <= 0) continue;
      const frac = Math.min(1, sh.hp / 30);
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.6 * frac;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#22d3ee';
      const w = 42;
      ctx.beginPath();
      ctx.moveTo(sh.x - w, yShield + 14);
      ctx.lineTo(sh.x - w, yShield - 4);
      ctx.quadraticCurveTo(sh.x - w, yShield - 16, sh.x - w + 12, yShield - 16);
      ctx.lineTo(sh.x + w - 12, yShield - 16);
      ctx.quadraticCurveTo(sh.x + w, yShield - 16, sh.x + w, yShield - 4);
      ctx.lineTo(sh.x + w, yShield + 14);
      // notches where damaged
      for (let i = 1; i < 3; i++) {
        ctx.lineTo(sh.x - w + (w * 2 * i) / 3, yShield + 14);
        ctx.lineTo(sh.x - w + (w * 2 * i) / 3, yShield - 16 + (frac < 0.5 ? 10 : 0));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // player craft
    ctx.save();
    ctx.translate(st.px, H - 34);
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(11,18,32,0.9)';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, 4);
    ctx.lineTo(22, 12);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 16);
    ctx.lineTo(-8, 9);
    ctx.lineTo(-22, 12);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(0, -6, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // shots
    for (const b of st.pShots) {
      ctx.save();
      ctx.shadowColor = '#a5f3fc';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#a5f3fc';
      ctx.fillRect(b.x - 2, b.y - 9, 4, 13);
      ctx.restore();
    }
    for (const b of st.eShots) {
      ctx.save();
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fda4af';
      ctx.fillRect(b.x - 2.5, b.y - 5, 5, 11);
      ctx.restore();
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function drawAlien(ctx: CanvasRenderingContext2D, al: Alien, now: number) {
  const pulse = 1 + Math.sin(now / 280 + al.phase) * 0.05;
  ctx.save();
  ctx.translate(al.x, al.y);
  ctx.scale(pulse, pulse);
  const color = ['#fbbf24', '#fb923c', '#f87171'][al.kind];
  const w = [13, 17, 22][al.kind];
  const h = w * 0.75;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, 0);
  ctx.lineTo(w * 0.6, h);
  ctx.lineTo(-w * 0.6, h);
  ctx.lineTo(-w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0b0710';
  ctx.fillRect(-w * 0.45, -h * 0.35, w * 0.32, w * 0.3);
  ctx.fillRect(w * 0.13, -h * 0.35, w * 0.32, w * 0.3);
  ctx.restore();
}
