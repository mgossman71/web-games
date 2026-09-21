import { useCallback, useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';
import { enableSwipe } from '../../gameEngine/gameHelpers';

const ROWS = 5;
const COLS = 9;
const PAD_Y = ROWS * 34 + 18;

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  kind: 'wide' | 'multi' | 'sticky' | 'slow' | 'life';
  t: number;
}

export default function BrickBlaster(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const s = useRef({
    paddle: { x: W / 2, w: 92 },
    balls: [] as { x: number; y: number; vx: number; vy: number; stuck: boolean }[],
    bricks: [] as { x: number; y: number; hp: number; color: string }[],
    powerups: [] as PowerUp[],
    score: 0,
    level: 1,
    lives: 3,
    combo: 0,
    wideT: 0,
    slowT: 0,
    over: false,
    won: false,
  });

  const placeBricks = useCallback(() => {
    const st = s.current;
    st.bricks = [];
    const colors = ['#f472b6', '#a855f7', '#22d3ee', '#facc15', '#34d399'];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < 0.12) continue;
        st.bricks.push({
          x: 60 + c * ((W - 120) / COLS),
          y: 70 + r * 34,
          hp: 1 + (st.level - 1) + (r === 0 && Math.random() < 0.4 ? 1 : 0),
          color: colors[r % colors.length],
        });
      }
    }
  }, [W]);

  const resetBall = useCallback(() => {
    const st = s.current;
    st.balls = [
      { x: st.paddle.x, y: PAD_Y - 12, vx: 180, vy: -220, stuck: true },
    ];
  }, []);

  useEffect(() => {
    placeBricks();
    resetBall();
    rt.setLives(3);
    rt.setLevel(1);
    rt.setScore(0);
  }, [placeBricks, resetBall, rt]);

  // Keyboard paddle + gamepad axis
  useEffect(() => {
    const off = rt.input.subscribe((a, down) => {
      if (!down) return;
      if (a === 'confirm' || a === 'jump') {
        const b = s.current.balls[0];
        if (b?.stuck) {
          b.stuck = false;
          const ang = -Math.PI / 2 + (s.current.paddle.x - W / 2) / W;
          b.vx = Math.cos(ang) * 230;
          b.vy = Math.sin(ang) * 230;
        }
      }
    });
    return off;
  }, [rt, W]);

  // Mouse drag
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const toDesign = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * W;
    };
    const move = (e: PointerEvent) => {
      const st = s.current;
      st.paddle.x = Math.max(56, Math.min(W - 56, toDesign(e.clientX)));
      st.balls.forEach((b) => {
        if (b.stuck) b.x = st.paddle.x;
      });
    };
    canvas.addEventListener('pointermove', move);
    return () => canvas.removeEventListener('pointermove', move);
  }, [rt, W]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;
      if (st.over) {
        draw();
        return;
      }

      // Axis from gamepad
      const ax = rt.input.getAxisX();
      if (ax !== 0) {
        st.paddle.x += ax * 380 * dt;
        st.paddle.x = Math.max(56, Math.min(W - 56, st.paddle.x));
        st.balls.forEach((b) => {
          if (b.stuck) b.x = st.paddle.x;
        });
      }
      st.wideT = Math.max(0, st.wideT - dt);
      st.slowT = Math.max(0, st.slowT - dt);
      for (let i = st.powerups.length - 1; i >= 0; i--) {
        const p = st.powerups[i];
        p.y += p.vy * dt;
        p.t += dt;
        if (p.y > H - 14) {
          st.powerups.splice(i, 1);
          continue;
        }
        // catch at bottom
        if (Math.abs(p.y - PAD_Y) < 18 && Math.abs(p.x - st.paddle.x) < st.paddle.w / 2 + 8) {
          applyPower(p.kind);
          st.powerups.splice(i, 1);
        }
      }

      const slow = st.slowT > 0 ? 0.55 : 1;
      for (let bi = st.balls.length - 1; bi >= 0; bi--) {
        const b = st.balls[bi];
        if (b.stuck) {
          b.x = st.paddle.x;
          b.y = PAD_Y - 12;
          continue;
        }
        b.x += b.vx * dt * slow;
        b.y += b.vy * dt * slow;
        // walls
        if (b.x < 8) {
          b.x = 8;
          b.vx = Math.abs(b.vx);
        }
        if (b.x > W - 8) {
          b.x = W - 8;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < 8) {
          b.y = 8;
          b.vy = Math.abs(b.vy);
        }
        // paddle
        if (b.vy > 0 && b.y + 6 >= PAD_Y - 6 && b.y + 6 <= PAD_Y + 16 && Math.abs(b.x - st.paddle.x) <= st.paddle.w / 2 + 8) {
          b.y = PAD_Y - 6;
          b.vy = -Math.abs(b.vy);
          const rel = (b.x - st.paddle.x) / (st.paddle.w / 2);
          const a = (rel * 0.9 + (Math.random() - 0.5) * 0.06) * Math.PI;
          const speed = Math.hypot(b.vx, b.vy) * 1.02;
          b.vx = -Math.sin(a) * speed;
          b.vy = -Math.abs(Math.cos(a) * speed);
          st.combo = 0;
          rt.sfx('thud');
        }
        // floor
        if (b.y > H + 10) {
          st.balls.splice(bi, 1);
        }
      }

      if (st.balls.length === 0) {
        st.lives -= 1;
        st.combo = 0;
        rt.setLives(st.lives);
        rt.sfx('explosion');
        if (st.lives <= 0) {
          st.over = true;
          rt.endGame(st.score, false);
          draw();
          return;
        }
        resetBall();
      }

      // bricks
      for (let i = st.bricks.length - 1; i >= 0; i--) {
        const br = st.bricks[i];
        for (const b of st.balls) {
          if (b.stuck) continue;
          const bx = Math.max(br.x, Math.min(b.x, br.x + 30));
          const by = Math.max(br.y, Math.min(b.y, br.y + 20));
          const dx = b.x - bx;
          const dy = b.y - by;
          if (dx * dx + dy * dy < 22) {
            // bounce based on which side
            b.vx = -b.vx;
            br.hp -= 1;
            st.combo += 1;
            st.score += 25 * st.level + st.combo * 5;
            rt.setScore(st.score);
            rt.sfx('hit');
            rt.particles.spawnBurst(b.x, b.y, 8, 110, { colors: [br.color, '#fff'] });
            if (br.hp <= 0) {
              st.bricks.splice(i, 1);
              if (Math.random() < 0.22) {
                st.powerups.push({
                  x: br.x + 15,
                  y: br.y + 10,
                  vy: 80,
                  kind: (['wide', 'multi', 'sticky', 'slow', 'life'] as const)[(Math.random() * 5) | 0],
                  t: 0,
                });
                rt.sfx('powerup');
              }
            }
            break;
          }
        }
      }

      if (st.bricks.length === 0) {
        // level up
        st.level += 1;
        st.score += 200 * st.level;
        rt.setScore(st.score);
        rt.setLevel(st.level);
        rt.sfx('levelup');
        placeBricks();
        resetBall();
      }

      function applyPower(kind: PowerUp['kind']) {
        st.score += 40;
        rt.sfx('coin');
        if (kind === 'wide') {
          st.wideT = 8;
        } else if (kind === 'multi') {
          const base = st.balls.find((b) => !b.stuck) ?? st.balls[0] ?? { x: st.paddle.x, y: PAD_Y - 12, vx: 0, vy: -200 };
          for (let i = 0; i < 2; i++) {
            const a = -Math.PI / 2 + (i === 0 ? -0.55 : 0.55);
            st.balls.push({ x: base.x, y: base.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, stuck: false });
          }
        } else if (kind === 'sticky') {
          // keep ball stuck for a moment (implement with slow)
          st.slowT = 4;
        } else if (kind === 'slow') {
          st.slowT = 6;
        } else if (kind === 'life') {
          st.lives = Math.min(6, st.lives + 1);
          rt.setLives(st.lives);
        }
        st.combo = 0;
      }

      // paddle width (wide power-up)
      const targetW = 92 + (st.wideT > 0 ? 46 : 0);
      st.paddle.w += (targetW - st.paddle.w) * Math.min(1, dt * 6);

      draw();
    },
  });

  const draw = () => {
    const ctx = rt.ctx;
    if (!ctx) return;
    const st = s.current;
    ctx.save();
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#100a1e');
    bg.addColorStop(1, '#060411');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const b of st.bricks) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.hp > 1 ? 1 : 0.85;
      const x = b.x + 2;
      const y = b.y + 2;
      const w = 26;
      const h = 20;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      if (b.hp > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      }
      ctx.restore();
    }

    // paddle
    const pw = st.paddle.w;
    ctx.save();
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(st.paddle.x - pw / 2 + 9, PAD_Y - 6);
    ctx.lineTo(st.paddle.x + pw / 2 - 9, PAD_Y - 6);
    ctx.arcTo(st.paddle.x + pw / 2, PAD_Y - 6, st.paddle.x + pw / 2, PAD_Y + 8, 8);
    ctx.arcTo(st.paddle.x + pw / 2, PAD_Y + 8, st.paddle.x - pw / 2, PAD_Y + 8, 8);
    ctx.arcTo(st.paddle.x - pw / 2, PAD_Y + 8, st.paddle.x - pw / 2, PAD_Y - 6, 8);
    ctx.arcTo(st.paddle.x - pw / 2, PAD_Y - 6, st.paddle.x + pw / 2, PAD_Y - 6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // balls
    for (const b of st.balls) {
      ctx.save();
      ctx.shadowColor = '#f8fafc';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // powerups
    for (const p of st.powerups) {
      ctx.save();
      const color =
        p.kind === 'wide' ? '#22d3ee' : p.kind === 'multi' ? '#a855f7' : p.kind === 'life' ? '#34d399' : '#facc15';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 9, p.y - 7, 18, 14);
      ctx.fillStyle = '#0b1120';
      ctx.font = '700 11px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letter = p.kind === 'wide' ? 'W' : p.kind === 'multi' ? '×3' : p.kind === 'life' ? '+' : p.kind === 'sticky' ? 'S' : '↓';
      ctx.fillText(letter, p.x, p.y + 1);
      ctx.restore();
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

// keep tree-shaking happy for enableSwipe in case some games skip it
void enableSwipe;
void useCallback;
void useEffect;
