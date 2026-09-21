import { useEffect, useRef } from 'react';
import { useGameRuntime } from '../../gameEngine/useGameRuntime';
import { useGameLoop } from '../../gameEngine/useGameLoop';

/**
 * Neon Racer — 3-lane highway dodger.
 * Steer between lanes, avoid traffic, chain near-misses for bonus points.
 * Speed increases with distance. One-ship arcade racer.
 */

const LANES = 3;

interface Traffic {
  lane: number;
  y: number;
  speed: number; // relative px/s
  color: string;
  w: number;
  h: number;
  passed: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

export default function NeonRacer(props: { width: number; height: number; runtime?: ReturnType<typeof useGameRuntime> }) {
  const rt = props.runtime ?? useGameRuntime();
  const W = rt.width;
  const H = rt.height;

  const roadL = W / 2 - 130;
  const roadR = W / 2 + 130;
  const laneW = (roadR - roadL) / LANES;
  const laneX = (lane: number) => roadL + (lane + 0.5) * laneW;

  const carW = 34;
  const carH = 54;
  const carY = H - 130;

  const s = useRef({
    px: W / 2,
    targetLane: 1,
    dist: 0,
    speed: 240,
    score: 0,
    nearStreak: 0,
    traffic: [] as Traffic[],
    sparks: [] as Spark[],
    spawnTimer: 0.8,
    laneLines: 0,
    over: false,
    dead: false,
  });

  // reset
  useEffect(() => {
    const st = s.current;
    st.px = W / 2;
    st.targetLane = 1;
    st.dist = 0;
    st.speed = 240;
    st.score = 0;
    st.nearStreak = 0;
    st.traffic = [];
    st.sparks = [];
    st.spawnTimer = 0.8;
    st.over = false;
    st.dead = false;
    rt.setScore(0);
    rt.setLives(0);
    rt.setLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pointer steering: tap left/right halves; swipe to change lane
  useEffect(() => {
    const canvas = rt.canvas;
    if (!canvas) return;
    const onDown = (e: PointerEvent) => {
      const st = s.current;
      if (st.over) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      if (x < W / 2) st.targetLane = Math.max(0, st.targetLane - 1);
      else st.targetLane = Math.min(LANES - 1, st.targetLane + 1);
      rt.sfx('select');
    };
    canvas.addEventListener('pointerdown', onDown);

    const onKey = (e: KeyboardEvent) => {
      const st = s.current;
      if (st.over || e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        st.targetLane = Math.max(0, st.targetLane - 1);
        rt.sfx('select');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        st.targetLane = Math.min(LANES - 1, st.targetLane + 1);
        rt.sfx('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, W]);

  useGameLoop(rt, {
    onFrame: (dt) => {
      const st = s.current;

      if (!st.over) {
        // difficulty ramp
        st.speed = 240 + st.dist * 0.06;
        if (st.speed > 620) st.speed = 620;
        const level = Math.floor(st.dist / 900);
        rt.setLevel(level);

        // smooth lane steering
        const tx = laneX(st.targetLane);
        const k = 1 - Math.exp(-12 * dt);
        st.px += (tx - st.px) * k;

        // distance + score
        st.dist += st.speed * dt;
        const gained = Math.floor(st.speed * dt * 0.1);
        if (gained > 0) {
          st.score += gained;
          rt.setScore(st.score);
        }

        // spawn traffic
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          const lane = (Math.random() * LANES) | 0;
          const colors = ['#f472b6', '#a78bfa', '#facc15', '#fb923c'];
          st.traffic.push({
            lane,
            y: -60,
            speed: 60 + Math.random() * 40,
            color: colors[(Math.random() * colors.length) | 0],
            w: 30,
            h: 48,
            passed: false,
          });
          // sometimes spawn a second one in a different lane
          if (Math.random() < 0.35 + level * 0.04) {
            const lane2 = (lane + 1 + ((Math.random() * (LANES - 1)) | 0)) % LANES;
            st.traffic.push({
              lane: lane2,
              y: -140,
              speed: 60 + Math.random() * 40,
              color: colors[(Math.random() * colors.length) | 0],
              w: 30,
              h: 48,
              passed: false,
            });
          }
          st.spawnTimer = Math.max(0.55, 1.25 - level * 0.07);
        }

        // move traffic (relative speed = our speed - their speed)
        for (let i = st.traffic.length - 1; i >= 0; i--) {
          const t = st.traffic[i];
          t.y += (st.speed - t.speed) * dt;
          // near-miss / pass
          if (!t.passed && t.y > carY + 30) {
            t.passed = true;
            const d = Math.abs(laneX(t.lane) - st.px);
            if (d < laneW * 1.15) {
              st.nearStreak += 1;
              const bonus = 15 * st.nearStreak;
              st.score += bonus;
              rt.setScore(st.score);
              rt.sfx('point');
              for (let k = 0; k < 6; k++) {
                st.sparks.push({
                  x: st.px + (Math.random() - 0.5) * 40,
                  y: carY - 10,
                  vx: (Math.random() - 0.5) * 120,
                  vy: -60 - Math.random() * 80,
                  life: 0,
                  max: 0.4,
                  color: '#67e8f9',
                });
              }
            } else {
              st.nearStreak = 0;
            }
            st.score += 5;
            rt.setScore(st.score);
          }
          if (t.y > H + 60) st.traffic.splice(i, 1);
        }

        // collision
        for (const t of st.traffic) {
          const dxc = Math.abs(laneX(t.lane) - st.px);
          const dyc = Math.abs(t.y - carY);
          if (dxc < (t.w + carW) / 2 - 4 && dyc < (t.h + carH) / 2 - 4) {
            // crash
            st.over = true;
            st.dead = true;
            rt.addShake(16);
            rt.sfx('explosion');
            rt.particles.spawnBurst(st.px, carY, 40, 240, { colors: ['#22d3ee', '#f472b6', '#fff'] });
            for (let k = 0; k < 24; k++) {
              st.sparks.push({
                x: st.px,
                y: carY,
                vx: (Math.random() - 0.5) * 320,
                vy: (Math.random() - 0.5) * 320,
                life: 0,
                max: 0.8,
                color: ['#fb923c', '#facc15', '#ef4444'][(Math.random() * 3) | 0],
              });
            }
            rt.endGame(st.score, false);
          }
        }
      }

      // lane line scroll
      st.laneLines = (st.laneLines + st.speed * dt) % 48;

      // sparks
      for (let i = st.sparks.length - 1; i >= 0; i--) {
        const p = st.sparks[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt;
        if (p.life > p.max) st.sparks.splice(i, 1);
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
    g.addColorStop(0, '#0b0a1e');
    g.addColorStop(0.6, '#120b2e');
    g.addColorStop(1, '#1a0b2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // horizon glow
    ctx.save();
    const hg = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, W * 0.8);
    hg.addColorStop(0, 'rgba(244,114,182,0.25)');
    hg.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, 160);
    ctx.restore();

    // road
    ctx.fillStyle = '#0f1024';
    ctx.fillRect(roadL, 0, roadR - roadL, H);
    // road edges
    ctx.save();
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadL, 0);
    ctx.lineTo(roadL, H);
    ctx.moveTo(roadR, 0);
    ctx.lineTo(roadR, H);
    ctx.stroke();
    ctx.restore();

    // lane dividers (dashed, scrolling)
    ctx.strokeStyle = 'rgba(103,232,249,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 26]);
    ctx.lineDashOffset = -st.laneLines;
    for (let i = 1; i < LANES; i++) {
      const x = roadL + i * laneW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // traffic
    for (const t of st.traffic) {
      const x = laneX(t.lane);
      ctx.save();
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#141130';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2.5;
      roundRect(ctx, x - t.w / 2, t.y - t.h / 2, t.w, t.h, 8);
      ctx.fill();
      ctx.stroke();
      // windshield
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x - t.w / 2 + 5, t.y - t.h / 2 + 6, t.w - 10, 8);
      ctx.restore();
    }

    // speed lines
    if (st.speed > 360) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 30 + st.speed * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // player car (if not exploded)
    if (!st.dead) {
      ctx.save();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#0b1524';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      roundRect(ctx, st.px - carW / 2, carY - carH / 2, carW, carH, 10);
      ctx.fill();
      ctx.stroke();
      // cockpit
      ctx.fillStyle = '#67e8f9';
      ctx.globalAlpha = 0.7;
      roundRect(ctx, st.px - 10, carY - 14, 20, 14, 5);
      ctx.fill();
      // engine glow
      ctx.globalAlpha = 0.8;
      ctx.save();
      ctx.translate(st.px, carY + carH / 2 + 4);
      const flame = 10 + Math.sin(rt.now() / 30) * 3 + st.speed * 0.02;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(0, flame);
      ctx.lineTo(7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    // sparks
    for (const p of st.sparks) {
      const a = 1 - p.life / p.max;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HUD-ish overlay
    ctx.font = '700 12px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(`${Math.floor(st.speed)} KM/H`, 16, 28);
    ctx.fillStyle = '#f472b6';
    ctx.textAlign = 'right';
    if (st.nearStreak >= 2) {
      ctx.fillText(`NEAR MISS x${st.nearStreak}`, W - 16, 28);
    }

    rt.particles.draw(ctx);
    ctx.restore();
  };

  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
