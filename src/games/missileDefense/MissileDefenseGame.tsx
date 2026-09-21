import { useEffect, useRef, useState } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { TAU } from '../../utils/math';

/**
 * Defense Grid — radial tower defense.
 * Enemies crawl along concentric rings toward the core.
 * Orbiting auto-turrets you charge with clicks. Keep the core alive, 12 waves.
 */

interface Enemy {
  ring: number; // 0 outer ... 3 inner
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  kind: 0 | 1 | 2;
  alive: boolean;
  x: number;
  y: number;
}

interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const RINGS = 4;

export default function DefenseGrid(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const baseR = Math.min(W, H) * 0.42;
  const ringR = (i: number) => baseR * (1 - i * 0.17);

  const [turretCount, setTurretCount] = useState(2); // 2-4
  const turretRef = useRef(2);
  turretRef.current = turretCount;

  const s = useRef({
    enemies: [] as Enemy[],
    bolts: [] as Bolt[],
    turrets: [] as number[], // angles (filled by placeTurrets in effects)
    spin: 0,
    wave: 0,
    spawnLeft: 0,
    spawnTimer: 0,
    waveCooldown: 2.5,
    coreHp: 30,
    energy: 0, // click-charge power
    score: 0,
    over: false,
    won: false,
    combo: 0,
  });

  useEffect(() => {
    const st = s.current;
    st.enemies = [];
    st.bolts = [];
    st.turrets = placeTurrets(turretRef.current);
    st.spin = 0;
    st.wave = 0;
    st.spawnLeft = 0;
    st.spawnTimer = 0;
    st.waveCooldown = 2.5;
    st.coreHp = 30;
    st.energy = 0;
    st.score = 0;
    st.over = false;
    st.won = false;
    st.combo = 0;
    rt.setScore(0);
    rt.setLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const st = s.current;
    st.turrets = placeTurrets(turretRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turretCount]);

  function placeTurrets(n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push((i / n) * TAU);
    return out;
  }

  const enemyPos = (e: Enemy) => {
    const r = ringR(e.ring);
    return {
      x: cx + Math.cos(e.angle) * r,
      y: cy + Math.sin(e.angle) * r,
    };
  };

  // charging: hold pointer / space to charge, auto-fires strongest bolt in facing... simpler: click = charge+fire at nearest
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const down = (e: PointerEvent) => {
      const st = s.current;
      if (st.over) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const my = ((e.clientY - rect.top) / rect.height) * H;
      fireCharged(st, mx, my, false);
    };
    canvas.addEventListener('pointerdown', down);
    const kd = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        fireCharged(s.current, cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40, true);
      }
    };
    window.addEventListener('keydown', kd);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', kd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, W, H, cx, cy]);

  function fireCharged(st: typeof s.current, tx: number, ty: number, any: boolean) {
    if (st.over) return;
    // pick target: nearest enemy to pointer (or to core if `any`)
    let target: Enemy | null = null;
    let best = Infinity;
    for (const e of st.enemies) {
      if (!e.alive) continue;
      const p = enemyPos(e);
      const d = any ? Math.hypot(p.x - cx, p.y - cy) : Math.hypot(p.x - tx, p.y - ty);
      if (d < best) {
        best = d;
        target = e;
      }
    }
    if (!target) {
      rt.sfx('tick');
      return;
    }
    const tp = enemyPos(target);
    const dx = tp.x - cx;
    const dy = tp.y - cy;
    const d = Math.max(1, Math.hypot(dx, dy));
    const speed = 520;
    // spawn from turret nearest to target bearing
    const bearing = Math.atan2(dy, dx);
    let bt = st.turrets[0];
    let ba = Infinity;
    for (const a of st.turrets) {
      const d2 = Math.abs(Math.atan2(Math.sin(a - bearing), Math.cos(a - bearing)));
      if (d2 < ba) {
        ba = d2;
        bt = a;
      }
    }
    const ox = cx + Math.cos(bt) * baseR * 0.5;
    const oy = cy + Math.sin(bt) * baseR * 0.5;
    st.bolts.push({
      x: ox,
      y: oy,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      life: 1.4,
      color: '#67e8f9',
    });
    st.energy = Math.min(100, st.energy + 8);
    rt.sfx('laser');
    rt.particles.spark(ox, oy, '#67e8f9', 5);
  }

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        rt.particles.update(dt);
        draw();
        return;
      }

      st.spin += dt * 0.6;
      // keep turret offsets
      st.turrets = st.turrets.map((a) => a); // static offsets; spin applies to all

      // wave start
      if (st.waveCooldown > 0) {
        st.waveCooldown -= dt;
        if (st.waveCooldown <= 0) {
          st.wave += 1;
          rt.setLevel(st.wave);
          st.spawnLeft = 5 + st.wave * 2;
          st.spawnTimer = 0;
          rt.sfx('levelup');
        }
      }

      if (st.spawnLeft > 0) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          const w = st.wave;
          const kind = (((Math.random() * 3) | 0) as 0 | 1 | 2);
          const hp = (kind === 2 ? 60 : kind === 1 ? 26 : 16) * (1 + w * 0.22);
          const speed = (kind === 1 ? 0.55 : kind === 2 ? 0.3 : 0.42) * (1 + w * 0.03);
          st.enemies.push({
            ring: 0,
            angle: Math.random() * TAU,
            hp,
            maxHp: hp,
            speed,
            kind,
            alive: true,
            x: -999,
            y: -999,
          });
          st.spawnLeft -= 1;
          st.spawnTimer = Math.max(0.4, 0.9 - w * 0.04);
        }
      }

      // enemies crawl inward
      for (let i = st.enemies.length - 1; i >= 0; i--) {
        const e = st.enemies[i];
        if (!e.alive) continue;
        e.angle += e.speed * dt;
        // pull inward continuously
        const p = enemyPos(e);
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d = Math.hypot(dx, dy);
        const ddx = (dx / d) * e.speed * 40 * dt;
        const ddy = (dy / d) * e.speed * 40 * dt;
        // advance ring when close enough
        if (d < ringR(e.ring + 1) + 8 && e.ring < RINGS - 1) {
          e.ring += 1;
          rt.sfx('tick');
        }
        e.x = p.x + ddx;
        e.y = p.y + ddy;
        if (d < baseR * 0.16) {
          // hit core
          e.alive = false;
          st.enemies.splice(i, 1);
          st.coreHp -= 3;
          st.combo = 0;
          rt.addShake(10);
          rt.sfx('explosion');
          rt.particles.spawnBurst(cx, cy, 20, 180, { colors: ['#f87171', '#fb923c'] });
          if (st.coreHp <= 0) {
            st.over = true;
            st.won = false;
            rt.endGame(st.score, false);
          }
        }
      }

      // bolts
      for (let i = st.bolts.length - 1; i >= 0; i--) {
        const b = st.bolts[i];
        b.life -= dt;
        if (b.life <= 0) {
          st.bolts.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        let hit = false;
        for (const e of st.enemies) {
          if (!e.alive) continue;
          const p = enemyPos(e);
          if (Math.hypot(p.x - b.x, p.y - b.y) < 22) {
            const dmg = 20 + st.energy * 0.2 + st.wave * 1.2;
            e.hp -= dmg;
            hit = true;
            break;
          }
        }
        if (hit) {
          st.bolts.splice(i, 1);
          rt.particles.spark(b.x, b.y, '#67e8f9', 6);
          continue;
        }
      }

      // kill
      for (let i = st.enemies.length - 1; i >= 0; i--) {
        const e = st.enemies[i];
        if (e.alive && e.hp <= 0) {
          e.alive = false;
          st.enemies.splice(i, 1);
          st.combo += 1;
          const bounty = (e.kind === 2 ? 30 : e.kind === 1 ? 16 : 10) + st.wave * 2 + st.combo;
          st.score += bounty;
          rt.setScore(st.score);
          st.energy = Math.min(100, st.energy + 3);
          rt.sfx('coin');
          rt.particles.spawnBurst(e.x, e.y, 10, 150, {
            colors: e.kind === 2 ? ['#f97316', '#fbbf24'] : ['#a78bfa', '#f0abfc'],
          });
        }
      }

      // wave clear
      if (st.spawnLeft === 0 && st.enemies.length === 0 && st.waveCooldown <= 0 && st.wave > 0) {
        if (st.wave >= 12) {
          st.over = true;
          st.won = true;
          st.score += 1500 + st.coreHp * 25;
          rt.setScore(st.score);
          rt.endGame(st.score, true);
        } else {
          st.coreHp = Math.min(30, st.coreHp + 3);
          st.score += 80 + st.wave * 10;
          rt.setScore(st.score);
          st.waveCooldown = 2.6;
          rt.sfx('win');
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
    const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0c1322');
    bg.addColorStop(1, '#04060c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // rings
    for (let i = 0; i < RINGS; i++) {
      const r = ringR(i);
      ctx.save();
      ctx.strokeStyle = 'rgba(59,130,246,0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -st.spin * 30 * (i % 2 === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // spokes
    ctx.strokeStyle = 'rgba(59,130,246,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + st.spin * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * baseR * 0.14, cy + Math.sin(a) * baseR * 0.14);
      ctx.lineTo(cx + Math.cos(a) * baseR, cy + Math.sin(a) * baseR);
      ctx.stroke();
    }

    // core
    const coreFrac = Math.max(0, st.coreHp / 30);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.spin * 0.8);
    const coreCol = coreFrac > 0.4 ? '#34d399' : '#f87171';
    ctx.strokeStyle = coreCol;
    ctx.shadowColor = coreCol;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, -baseR * 0.13);
      ctx.lineTo(baseR * 0.05, -baseR * 0.07);
      ctx.lineTo(-baseR * 0.05, -baseR * 0.07);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 0.06, 0, TAU);
    ctx.fillStyle = coreCol;
    ctx.fill();
    ctx.restore();
    // core HP ring
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.17, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = coreCol;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.17, -Math.PI / 2, -Math.PI / 2 + TAU * coreFrac);
    ctx.stroke();
    ctx.restore();

    // turrets (on middle ring, static positions, glow)
    for (const a of st.turrets) {
      const x = cx + Math.cos(a) * baseR * 0.5;
      const y = cy + Math.sin(a) * baseR * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#0b1626';
      ctx.strokeStyle = '#67e8f9';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      // base
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // barrel
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(4, -2.5, 14, 5);
      ctx.restore();
    }

    // enemies
    for (const e of st.enemies) {
      if (!e.alive) continue;
      const p = enemyPos(e);
      e.x = p.x;
      e.y = p.y;
      const R = e.kind === 2 ? 16 : e.kind === 1 ? 12 : 10;
      const col = e.kind === 2 ? '#f97316' : e.kind === 1 ? '#a78bfa' : '#f87171';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(e.angle * 3 + rt.now() / 150);
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(6,10,20,0.9)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const sides = e.kind === 2 ? 6 : 4;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * TAU;
        const xx = Math.cos(a) * R;
        const yy = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // hp
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(10,14,26,0.7)';
      ctx.fillRect(p.x - 12, p.y - R - 8, 24, 3);
      ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(p.x - 12, p.y - R - 8, 24 * frac, 3);
    }

    // bolts
    for (const b of st.bolts) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      const dl = 14;
      const d = Math.hypot(b.vx, b.vy);
      ctx.beginPath();
      ctx.moveTo(b.x - (b.vx / d) * dl, b.y - (b.vy / d) * dl);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    // HUD
    ctx.font = '700 12px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`WAVE ${Math.min(12, st.wave)}/12`, 16, 26);
    ctx.fillStyle = '#facc15';
    ctx.fillText(`CHARGE ${Math.round(st.energy)}`, 16, 46);

    ctx.textAlign = 'right';
    ctx.fillStyle = coreFrac > 0.4 ? '#34d399' : '#f87171';
    ctx.fillText(`CORE ${st.coreHp}`, W - 16, 26);
    if (st.combo >= 3) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`COMBO x${st.combo}`, W - 16, 46);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px Orbitron, monospace';
    ctx.fillText('TAP / SPACE TO FIRE — KEEP THE CORE ALIVE', W / 2, H - 12);

    // turret count selector (top center, tappable: 2 / 3 / 4)
    const opts = [2, 3, 4];
    const bw = 64;
    const bx0 = W / 2 - (opts.length * (bw + 8)) / 2 + 4;
  opts.forEach((n, i) => {
      const x = bx0 + i * (bw + 8);
      const active = turretCount === n;
      const cost = n === 2 ? 0 : n === 3 ? 150 : 350;
      const affordable = st.score >= cost && !st.over;
      ctx.save();
      ctx.fillStyle = active ? 'rgba(103,232,249,0.2)' : 'rgba(15,20,38,0.75)';
      ctx.strokeStyle = active ? '#67e8f9' : affordable ? 'rgba(103,232,249,0.5)' : 'rgba(100,116,139,0.4)';
      ctx.lineWidth = active ? 2 : 1;
      roundR(ctx, x, 60, bw, 34, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? '#f8fafc' : affordable ? '#94a3b8' : '#475569';
      ctx.font = '700 12px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${n} TURRETS`, x + bw / 2, 76);
      ctx.font = '500 9px Orbitron, monospace';
      ctx.fillStyle = affordable ? '#86efac' : '#64748b';
      ctx.fillText(cost === 0 ? 'FREE' : `${cost} PTS`, x + bw / 2, 90);
      ctx.restore();
    });

    rt.particles.draw(ctx);
    ctx.restore();
  };

  // turret count click handling (in-canvas)
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const my = ((e.clientY - rect.top) / rect.height) * H;
      const opts = [2, 3, 4];
      const bw = 64;
      const bx0 = W / 2 - (opts.length * (bw + 8)) / 2 + 4;
      const st2 = sStoreRef.current;
      for (let i = 0; i < opts.length; i++) {
        const x = bx0 + i * (bw + 8);
        if (my >= 60 && my <= 94 && mx >= x && mx <= x + bw) {
          const n = opts[i];
          const cost = n === 2 ? 0 : n === 3 ? 150 : 350;
          if (st2.score >= cost && n !== turretCount) {
            st2.score -= cost;
            rt.setScore(st2.score);
            setTurretCount(n);
            rt.sfx('powerup');
            rt.particles.spawnBurst(cx, cy, 16, 140, { colors: ['#67e8f9'] });
          } else {
            rt.sfx('danger');
          }
          e.stopPropagation();
          return;
        }
      }
    };
    canvas.addEventListener('pointerdown', onDown, true); // capture: before fire handler
    return () => canvas.removeEventListener('pointerdown', onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, W, H, turretCount, cx, cy]);

  const sStoreRef = useRef(s.current);

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
