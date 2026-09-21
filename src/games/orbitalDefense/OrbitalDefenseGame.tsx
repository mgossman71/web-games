import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { TAU } from '../../utils/math';

interface Astro {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  verts: number[];
  hue: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

const MAX_WAVE = 12;

export default function OrbitalDefense(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const s = useRef({
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, fireCd: 0, invuln: 0 },
    rocks: [] as Astro[],
    bullets: [] as Bullet[],
    score: 0,
    wave: 1,
    lives: 3,
    waveCooldown: 1.4,
    over: false,
    won: false,
  });

  const makeRock = useCallback(
    (size: 1 | 2 | 3): Astro => {
      const st = s.current;
      let x = 0;
      let y = 0;
      const side = Math.floor(Math.random() * 4);
      const rEst = size === 3 ? 34 : size === 2 ? 20 : 12;
      if (side === 0) {
        x = Math.random() * W;
        y = -rEst - 6;
      } else if (side === 1) {
        x = W + rEst + 6;
        y = Math.random() * H;
      } else if (side === 2) {
        x = Math.random() * W;
        y = H + rEst + 6;
      } else {
        x = -rEst - 6;
        y = Math.random() * H;
      }
      const tx = W / 2 + (Math.random() - 0.5) * 260;
      const ty = H / 2 + (Math.random() - 0.5) * 260;
      const dx = tx - x;
      const dy = ty - y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 42 + Math.random() * 40 + st.wave * 6;
      const n = 8 + Math.floor(Math.random() * 3);
      const verts: number[] = [];
      for (let i = 0; i < n; i++) verts.push(0.72 + Math.random() * 0.45);
      return {
        x,
        y,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed,
        r: size === 3 ? 34 + Math.random() * 8 : size === 2 ? 20 + Math.random() * 6 : 10 + Math.random() * 4,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 2.2,
        verts,
        hue: 195 + Math.random() * 70,
      };
    },
    [W, H],
  );

  const spawnWave = useCallback(() => {
    const st = s.current;
    const big = 4 + st.wave;
    for (let i = 0; i < big; i++) st.rocks.push(makeRock(3));
    if (st.wave >= 3) {
      for (let i = 0; i < Math.min(5, st.wave - 1); i++) st.rocks.push(makeRock(2));
    }
    st.waveCooldown = 1.4;
    rt.setLevel(st.wave);
  }, [makeRock, rt]);

  useEffect(() => {
    const st = s.current;
    st.wave = 1;
    spawnWave();
    rt.setLives(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        rt.particles.update(dt);
        draw();
        return;
      }

      st.waveCooldown = Math.max(0, st.waveCooldown - dt);
      if (st.rocks.length === 0 && st.waveCooldown <= 0) {
        if (st.wave >= MAX_WAVE) {
          st.over = true;
          st.won = true;
          st.score += 2000 + st.wave * 100;
          rt.endGame(st.score, true);
          draw();
          return;
        }
        st.wave += 1;
        spawnWave();
        rt.sfx('levelup');
      }

      const sp = st.ship;
      const ax = rt.input.getAxisX();
      const thrustHeld = rt.input.isHeld('moveUp') || rt.input.getAxisY() < -0.5;
      const turn = (rt.input.isHeld('moveRight') ? 1 : 0) - (rt.input.isHeld('moveLeft') ? 1 : 0) + ax * 0.8;
      const turning = Math.max(-1, Math.min(1, turn));
      if (Math.abs(ax) > 0.4) {
        // axis already encoded turn above; no double apply
      }
      sp.angle += turning * 3.3 * dt;

      if (thrustHeld) {
        sp.vx += Math.cos(sp.angle) * 340 * dt;
        sp.vy += Math.sin(sp.angle) * 340 * dt;
        if (Math.random() > 0.55) {
          rt.particles.spark(
            sp.x - Math.cos(sp.angle) * 12 + (Math.random() - 0.5) * 5,
            sp.y - Math.sin(sp.angle) * 12 + (Math.random() - 0.5) * 5,
            '#f59e0b',
            2,
          );
        }
      }
      const damp = Math.exp(-1.1 * dt);
      sp.vx *= damp;
      sp.vy *= damp;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      if (sp.x < -18) sp.x = W + 18;
      if (sp.x > W + 18) sp.x = -18;
      if (sp.y < -18) sp.y = H + 18;
      if (sp.y > H + 18) sp.y = -18;

      sp.fireCd -= dt;
      if (rt.input.isHeld('fire') || rt.input.isHeld('jump')) {
        if (sp.fireCd <= 0) {
          sp.fireCd = 0.17;
          sp.vx -= Math.cos(sp.angle) * 26;
          sp.vy -= Math.sin(sp.angle) * 26;
          st.bullets.push({
            x: sp.x + Math.cos(sp.angle) * 14,
            y: sp.y + Math.sin(sp.angle) * 14,
            vx: Math.cos(sp.angle) * 480 + sp.vx,
            vy: Math.sin(sp.angle) * 480 + sp.vy,
            t: 0,
          });
          rt.sfx('laser');
        }
      }

      sp.invuln = Math.max(0, sp.invuln - dt);

      for (let i = st.rocks.length - 1; i >= 0; i--) {
        const ro = st.rocks[i];
        ro.x += ro.vx * dt;
        ro.y += ro.vy * dt;
        ro.rot += ro.spin * dt;

        if (ro.x < -ro.r - 40) ro.x = W + ro.r + 24;
        if (ro.x > W + ro.r + 40) ro.x = -ro.r - 24;
        if (ro.y < -ro.r - 40) ro.y = H + ro.r + 24;
        if (ro.y > H + ro.r + 40) ro.y = -ro.r - 24;

        let destroyed = false;
        for (let bi = st.bullets.length - 1; bi >= 0; bi--) {
          const b = st.bullets[bi];
          const dx = b.x - ro.x;
          const dy = b.y - ro.y;
          if (dx * dx + dy * dy < (ro.r + 5) ** 2) {
            destroyed = true;
            st.bullets.splice(bi, 1);
            const pts = ro.r > 26 ? 20 : ro.r > 16 ? 50 : 100;
            st.score += pts * Math.max(1, Math.min(4, st.wave / 3 | 0 || 1));
            st.score += 0;
            rt.setScore(st.score);
            rt.sfx('explosion');
            split(ro, i);
            break;
          }
        }
        if (destroyed) continue;

        const dx = sp.x - ro.x;
        const dy = sp.y - ro.y;
        if (dx * dx + dy * dy < (ro.r + 11) ** 2 && sp.invuln <= 0) {
          st.lives -= 1;
          sp.invuln = 2.2;
          sp.vx = dx * 8;
          sp.vy = dy * 8;
          rt.sfx('explosion');
          rt.addShake(14);
          rt.particles.spawnBurst(sp.x, sp.y, 26, 220, { colors: ['#22d3ee', '#f8fafc'] });
          rt.setLives(st.lives);
          if (st.lives <= 0) {
            st.over = true;
            rt.endGame(st.score, false);
          }
        }
      }

      for (let i = st.bullets.length - 1; i >= 0; i--) {
        const b = st.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.t += dt;
        if (b.t > 1.1 || b.x < -24 || b.x > W + 24 || b.y < -24 || b.y > H + 24) st.bullets.splice(i, 1);
      }

      rt.particles.update(dt);
      draw();
    },
  });

  const split = (parent: Astro, idx: number) => {
    const st = s.current;
    st.rocks.splice(idx, 1);
    const count = parent.r > 26 ? 2 : parent.r > 16 ? 4 : 0;
    for (let k = 0; k < count; k++) {
      const child = makeRock(parent.r > 26 ? 2 : 1);
      const ang = Math.random() * TAU;
      const spd = 70 + Math.random() * 70;
      child.x = parent.x;
      child.y = parent.y;
      child.vx = Math.cos(ang) * spd + parent.vx * 0.1;
      child.vy = Math.sin(ang) * spd + parent.vy * 0.1;
      st.rocks.push(child);
    }
    rt.particles.spawnBurst(parent.x, parent.y, 20, 190, { colors: ['#94a3b8', '#e2e8f0', `hsl(${parent.hue},70%,60%)`] });
  };

  const stars = useMemo(() => {
    const out: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 80; i++) {
      out.push({ x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.5, a: 0.2 + Math.random() * 0.6 });
    }
    return out;
  }, [W, H]);

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;

    ctx.save();
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, W, H);
    for (const st0 of stars) {
      ctx.globalAlpha = st0.a;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(st0.x, st0.y, st0.r, st0.r);
    }
    ctx.globalAlpha = 1;

    for (const ro of st.rocks) {
      ctx.save();
      ctx.translate(ro.x, ro.y);
      ctx.rotate(ro.rot);
      ctx.shadowColor = `hsl(${ro.hue}, 65%, 60%)`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const n = ro.verts.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = ro.r * ro.verts[i];
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.strokeStyle = `hsl(${ro.hue}, 55%, 62%)`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    for (const b of st.bullets) {
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 9;
      ctx.fillStyle = '#a5f3fc';
      ctx.fillRect(b.x - 3.5, b.y - 1.2, 7, 2.4);
    }
    ctx.restore();

    const sp = st.ship;
    const blink = sp.invuln > 0 && Math.sin(performance.now() / 55) > 0;
    if (!blink) {
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.angle + Math.PI / 2);
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(34,211,238,0.15)';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 9);
      ctx.lineTo(5, 6);
      ctx.lineTo(3, 11);
      ctx.lineTo(-3, 11);
      ctx.lineTo(-5, 6);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}
