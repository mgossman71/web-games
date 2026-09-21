import { useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';

/**
 * Endless Runner — auto-scrolling parkour.
 * Jump (double jump!) over spikes, slide under drones, grab coins.
 * Speed ramps forever. One-hit death, instant retry.
 */

const GROUND_Y_FRAC = 0.78;

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'spike' | 'drone' | 'block';
  passed: boolean;
}

interface Coin {
  x: number;
  y: number;
  r: number;
  taken: boolean;
}

export default function EndlessRunner(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const groundY = Math.round(H * GROUND_Y_FRAC);
  const px = Math.round(W * 0.24);
  const runH = 46; // upright body height
  const slideH = 22;

  const s = useRef({
    py: groundY,
    vy: 0,
    jumps: 0, // 0 = grounded
    sliding: false,
    slideT: 0,
    speed: 300,
    dist: 0,
    score: 0,
    coins: 0,
    spawnTimer: 1.2,
    obstacles: [] as Obstacle[],
    coinLines: [] as Coin[],
    over: false,
    bgOffset: 0,
    bg2Offset: 0,
  });

  useEffect(() => {
    const st = s.current;
    st.py = groundY;
    st.vy = 0;
    st.jumps = 0;
    st.sliding = false;
    st.speed = 300;
    st.dist = 0;
    st.score = 0;
    st.coins = 0;
    st.spawnTimer = 1.2;
    st.obstacles = [];
    st.coinLines = [];
    st.over = false;
    rt.setScore(0);
    rt.setLives(0);
    rt.setLevel(0);
    rt.setTimeLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bodyRect = (st: { py: number; sliding: boolean }) => {
    const h = st.sliding ? slideH : runH;
    return { x: px - 16, y: st.py - h, w: 32, h };
  };

  const doJump = () => {
    const st = s.current;
    if (st.over) return;
    if (st.jumps === 0) {
      st.vy = -620;
      st.jumps = 1;
      st.sliding = false;
      rt.sfx('shoot');
      rt.particles.spawnBurst(px, st.py, 8, 110, { colors: ['#34d399', '#022c22'] });
    } else if (st.jumps === 1) {
      st.vy = -520;
      st.jumps = 2;
      rt.sfx('powerup');
      rt.particles.spark(px, st.py - 30, '#67e8f9', 10);
    }
  };

  const doSlide = (down: boolean) => {
    const st = s.current;
    if (st.over) return;
    st.sliding = down && st.jumps === 0;
    if (down && st.jumps > 0) {
      // fast-fall
      st.vy = Math.max(st.vy, 500);
      rt.sfx('thud');
    }
  };

  // input: keyboard, pointer halves
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        doJump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        doSlide(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') doSlide(false);
    };
    const pd = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * H;
      if (y > H * 0.66) doSlide(true);
      else doJump();
    };
    const pu = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * H;
      if (y > H * 0.66) doSlide(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointerdown', pd);
      canvas.removeEventListener('pointerup', pu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, H, groundY]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;

      if (!st.over) {
        st.speed = Math.min(720, 300 + st.dist * 0.05);
        const level = Math.floor(st.dist / 700);
        rt.setLevel(level);
        rt.setTimeLabel(`${Math.floor(st.dist / 10)}m`);

        st.dist += st.speed * dt / 10;
        const gained = Math.floor(st.speed * dt * 0.08);
        if (gained > 0) {
          st.score += gained;
          rt.setScore(st.score);
        }
        st.bgOffset = (st.bgOffset + st.speed * 0.25 * dt) % W;
        st.bg2Offset = (st.bg2Offset + st.speed * 0.55 * dt) % W;

        // physics
        st.vy += 1500 * dt;
        st.py += st.vy * dt;
        if (st.py >= groundY) {
          st.py = groundY;
          st.vy = 0;
          st.jumps = 0;
        }

        // spawning
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          const gapBase = Math.max(0.62, 1.15 - level * 0.05);
          st.spawnTimer = gapBase + Math.random() * 0.5;
          const r = Math.random();
          const x = W + 40;
          if (r < 0.38) {
            const h = 34 + Math.random() * 22;
            st.obstacles.push({ x, y: groundY, w: 26, h, kind: 'spike', passed: false });
            // coin arc above
            spawnCoinArc(st, x, groundY - h - 40, 3);
          } else if (r < 0.68) {
            const flyY = groundY - 14; // drone bottom near ground: slide under
            st.obstacles.push({ x, y: flyY - 26, w: 34, h: 26, kind: 'drone', passed: false });
            spawnCoinLine(st, x + 60, groundY - 40, 4);
          } else {
            const h = 70 + Math.random() * 30;
            st.obstacles.push({ x, y: groundY, w: 30, h, kind: 'block', passed: false });
            spawnCoinArc(st, x, groundY - h - 50, 4);
          }
        }

        // move + collide
        const br = bodyRect(st);
        for (let i = st.obstacles.length - 1; i >= 0; i--) {
          const o = st.obstacles[i];
          o.x -= st.speed * dt;
          if (!o.passed && o.x + o.w < px) {
            o.passed = true;
            st.score += 25;
            rt.setScore(st.score);
          }
          if (o.x < -80) {
            st.obstacles.splice(i, 1);
            continue;
          }
          const oy = o.kind === 'spike' || o.kind === 'block' ? o.y - o.h : o.y;
          if (br.x < o.x + o.w && br.x + br.w > o.x && br.y < oy + o.h && br.y + br.h > oy) {
            st.over = true;
            rt.addShake(14);
            rt.sfx('explosion');
            rt.particles.spawnBurst(px, st.py - 20, 34, 220, { colors: ['#34d399', '#f87171', '#fff'] });
            rt.endGame(st.score, false);
          }
        }

        // coins
        for (let i = st.coinLines.length - 1; i >= 0; i--) {
          const c = st.coinLines[i];
          c.x -= st.speed * dt;
          if (c.x < -30) {
            st.coinLines.splice(i, 1);
            continue;
          }
          if (!c.taken) {
            const cx = px;
            const cy = st.py - (st.sliding ? 12 : runH / 2);
            if (Math.hypot(c.x - cx, c.y - cy) < c.r + 24) {
              c.taken = true;
              st.coins += 1;
              st.score += 50;
              rt.setScore(st.score);
              rt.sfx('coin');
              rt.particles.spark(c.x, c.y, '#facc15', 8);
            }
          }
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
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050816');
    g.addColorStop(0.7, '#0b1120');
    g.addColorStop(1, '#101b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // far skyline
    ctx.fillStyle = '#111a30';
    for (let i = 0; i < 9; i++) {
      const bw = 60 + ((i * 53) % 50);
      const bx = ((i * 97 - st.bgOffset) % (W + 120) + (W + 120)) % (W + 120) - 60;
      const bh = 60 + ((i * 37) % 90);
      ctx.fillRect(bx, groundY - bh - 30, bw, bh + 30);
    }
    // near skyline
    ctx.fillStyle = '#0e2b3d';
    for (let i = 0; i < 6; i++) {
      const bw = 80 + ((i * 41) % 60);
      const bx = ((i * 151 - st.bg2Offset) % (W + 160) + (W + 160)) % (W + 160) - 80;
      const bh = 90 + ((i * 61) % 70);
      ctx.fillRect(bx, groundY - bh, bw, bh);
      // windows
      ctx.fillStyle = 'rgba(103,232,249,0.25)';
      for (let wy = 0; wy < 4; wy++) {
        for (let wx = 0; wx < 3; wx++) {
          if ((i + wx + wy) % 3 === 0) ctx.fillRect(bx + 12 + wx * 20, groundY - bh + 14 + wy * 22, 8, 10);
        }
      }
      ctx.fillStyle = '#0e2b3d';
    }

    // ground
    ctx.fillStyle = '#0a1424';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.save();
    ctx.strokeStyle = '#34d399';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    ctx.restore();
    // ground dashes
    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.lineWidth = 2;
    const dash = 26;
    for (let x = -((st.dist * 10) % (dash * 2)); x < W; x += dash * 2) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 18);
      ctx.lineTo(x + dash, groundY + 18);
      ctx.stroke();
    }

    // obstacles
    for (const o of st.obstacles) {
      ctx.save();
      if (o.kind === 'spike') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#f87171';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        const n = 3;
        const sw = o.w / n;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.moveTo(o.x + i * sw, o.y);
          ctx.lineTo(o.x + i * sw + sw / 2, o.y - o.h);
          ctx.lineTo(o.x + (i + 1) * sw, o.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (o.kind === 'drone') {
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.fillStyle = '#1c2333';
        roundRectC(ctx, o.x, o.y, o.w, o.h, 6);
        ctx.fill();
        ctx.stroke();
        // rotors
        const spin = rt.now() / 40;
        ctx.strokeStyle = 'rgba(250,204,21,0.8)';
        ctx.beginPath();
        ctx.moveTo(o.x - 4, o.y - 2);
        ctx.lineTo(o.x + 10, o.y - 6 + Math.sin(spin) * 2);
        ctx.moveTo(o.x + o.w + 4, o.y - 2);
        ctx.lineTo(o.x + o.w - 10, o.y - 6 + Math.cos(spin) * 2);
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y + o.h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#60a5fa';
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        roundRectC(ctx, o.x, o.y - o.h, o.w, o.h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(96,165,250,0.5)';
        ctx.beginPath();
        ctx.moveTo(o.x + 4, o.y - o.h / 2);
        ctx.lineTo(o.x + o.w - 4, o.y - o.h / 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // coins
    for (const c of st.coinLines) {
      if (c.taken) continue;
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#facc15';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      const squish = Math.abs(Math.sin(rt.now() / 300 + c.x * 0.02));
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r * (0.4 + 0.6 * squish), c.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // runner
    if (!st.over) {
      const h = st.sliding ? slideH : runH;
      const by = st.py - h;
      ctx.save();
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#06231c';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      roundRectC(ctx, px - 14, by, 28, h, 8);
      ctx.fill();
      ctx.stroke();
      // eye
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(px + 6, by + 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // legs (running animation)
      const run = rt.now() / 90;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      const legA = st.jumps > 0 ? 0.5 : Math.sin(run) * 0.7;
      ctx.beginPath();
      ctx.moveTo(px - 6, st.py - 8);
      ctx.lineTo(px - 6 + Math.sin(legA) * 10, st.py - 1);
      ctx.moveTo(px + 6, st.py - 8);
      ctx.lineTo(px + 6 + Math.sin(-legA) * 10, st.py - 1);
      ctx.stroke();
      ctx.restore();

      // afterimage
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#34d399';
      roundRectC(ctx, px - 14 - 14, by, 28, h, 8);
      ctx.stroke();
      ctx.restore();
    }

    // coins counter
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`◉ ${st.coins}`, 16, 30);

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;

  function spawnCoinArc(st: { coinLines: Coin[] }, x: number, topY: number, n: number) {
    for (let i = 0; i < n; i++) {
      const fx = (i / (n - 1) - 0.5) * 70;
      const fy = -Math.cos((i / (n - 1)) * Math.PI) * 26;
      st.coinLines.push({ x: x + fx, y: topY + fy + 26, r: 9, taken: false });
    }
  }

  function spawnCoinLine(st: { coinLines: Coin[] }, x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      st.coinLines.push({ x: x + i * 30, y, r: 9, taken: false });
    }
  }
}

function roundRectC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
