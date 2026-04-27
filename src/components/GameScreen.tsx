import React, { useRef, useEffect, useCallback } from 'react';
import { drawBallSkin, type BallSkin } from './BallSkinsScreen';

const CW = 390;
const BALL_R = 14;
const GRAVITY = 0.38;
const BOUNCE = 0.42;
const RIM_H = 14;
const DROP_H = 90;

type HoopPattern = 'still' | 'linear' | 'rectangle' | 'circle' | 'circle_cw' | 'circle_ccw' | 'figure8';

interface HoopInstance {
  x: number; y: number;
  baseX: number; baseY: number;
  pattern: HoopPattern;
  speed: number;
  innerHalf: number; rimThick: number;
  scored: boolean; lockedOut: boolean;
}

interface LevelCfg {
  innerHalf: number;
  rimThick: number;
  speed: number;
  pattern: HoopPattern;
  makesNeeded: number;
}

function getLevelCfg(level: number): LevelCfg {
  const rimThick = 10;
  if (level <= 1)  return { innerHalf: 50, rimThick, speed: 0,   pattern: 'still',     makesNeeded: 3 };
  if (level <= 2)  return { innerHalf: 50, rimThick, speed: 1.5, pattern: 'linear',    makesNeeded: 3 };
  if (level <= 3)  return { innerHalf: 50, rimThick, speed: 1.5, pattern: 'rectangle', makesNeeded: 3 };
  if (level <= 4)  return { innerHalf: 50, rimThick, speed: 1.8, pattern: 'circle',    makesNeeded: 3 };
  if (level <= 5)  return { innerHalf: 50, rimThick, speed: 0,   pattern: 'still',     makesNeeded: 3 };
  if (level <= 10) return { innerHalf: 44, rimThick, speed: 2.0, pattern: 'linear',    makesNeeded: 3 };
  if (level <= 15) return { innerHalf: 36, rimThick, speed: 2.8, pattern: 'linear',    makesNeeded: 4 };
  if (level <= 20) return { innerHalf: 36, rimThick, speed: 3.2, pattern: 'figure8',   makesNeeded: 4 };
  const ex = level - 20;
  return { innerHalf: Math.max(24, 36 - ex * 2), rimThick, speed: Math.min(8, 3.8 + ex * 0.25), pattern: 'figure8', makesNeeded: 5 };
}

function setupHoops(level: number, shotIdx: number, ch: number, l1y2: number, l1y3: number): HoopInstance[] {
  const rimThick = 10;
  function h(baseX: number, baseY: number, pattern: HoopPattern, speed: number, innerHalf = 50): HoopInstance {
    return { x: baseX, y: baseY, baseX, baseY, pattern, speed, innerHalf, rimThick, scored: false, lockedOut: false };
  }
  if (level === 1) {
    if (shotIdx === 0) return [h(CW / 2, DROP_H + 80, 'still', 0)];
    if (shotIdx === 1) return [h(CW - 100, l1y2, 'still', 0)];
    return [h(100, l1y3, 'still', 0)];
  }
  if (level === 5) {
    if (shotIdx === 0) {
      // Two stacked static hoops — ball scores +1 each, must clear both
      return [
        h(CW / 2, ch - 235, 'still', 0),
        h(CW / 2, ch - 120, 'still', 0),
      ];
    }
    if (shotIdx === 1) {
      // Three hoops: top static, middle moves left-right, bottom static
      return [
        h(CW / 2, ch - 295, 'still',  0),
        h(CW / 2, ch - 185, 'linear', 1.5),
        h(CW / 2, ch - 95,  'still',  0),
      ];
    }
    // Shot 2: two circles going opposite directions — line up at x=CW/2 to shoot
    return [
      h(CW / 2, ch - 265, 'circle_cw',  1.5),
      h(CW / 2, ch - 135, 'circle_ccw', 1.5),
    ];
  }
  const cfg = getLevelCfg(level);
  return [h(CW / 2, ch - 170, cfg.pattern, cfg.speed, cfg.innerHalf)];
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSwish() {
  try {
    const ctx = getAudio();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 3200; filt.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.45;
    src.connect(filt); filt.connect(g); g.connect(ctx.destination); src.start();
    [523, 659, 784].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.055);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.055 + 0.12);
      o.connect(og); og.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.055);
      o.stop(ctx.currentTime + i * 0.055 + 0.12);
    });
  } catch (_) {}
}

function playRim() {
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.14);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.14);
  } catch (_) {}
}

function playMiss() {
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.22);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.22);
  } catch (_) {}
}

function playLevelUp() {
  try {
    const ctx = getAudio();
    [261, 329, 392, 523, 659].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.13);
    });
  } catch (_) {}
}

function pixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const x = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - x), Math.round(cy + y), x * 2, 1);
  }
}

function drawHoop(ctx: CanvasRenderingContext2D, hoopX: number, hoopY: number, innerHalf: number, rimThick: number) {
  const outerHalf = innerHalf + rimThick;
  const ry = Math.round(hoopY), hx = Math.round(hoopX);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(hx - innerHalf, ry); ctx.lineTo(hx + innerHalf, ry); ctx.stroke();
  ctx.fillStyle = '#e83232';
  ctx.fillRect(hx - outerHalf, ry - RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(hx - outerHalf, ry - RIM_H / 2, rimThick, 3);
  ctx.fillStyle = '#e83232';
  ctx.fillRect(hx + innerHalf, ry - RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(hx + innerHalf, ry - RIM_H / 2, rimThick, 3);
  const netTop = ry + RIM_H / 2;
  const netBot = netTop + 42;
  const netLines = 9;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= netLines; i++) {
    const t = i / netLines;
    const topX = hx - innerHalf + t * innerHalf * 2;
    const shrink = 0.35;
    const botX = hx - innerHalf * (1 - shrink) + t * innerHalf * 2 * (1 - shrink);
    ctx.beginPath(); ctx.moveTo(topX, netTop); ctx.lineTo(botX, netBot); ctx.stroke();
  }
  [0.3, 0.6, 1.0].forEach(frac => {
    const ny = netTop + (netBot - netTop) * frac;
    const shrink = 0.35 * frac;
    const lx = hx - innerHalf * (1 - shrink);
    const rx = hx + innerHalf * (1 - shrink);
    ctx.beginPath(); ctx.moveTo(lx, ny); ctx.lineTo(rx, ny); ctx.stroke();
  });
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; sz: number; }
const PCOLORS = ['#ffd700', '#ff6b35', '#00ffff', '#ff69b4', '#ffffff'];

function emitParticles(particles: Particle[], x: number, y: number, n = 20) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2, life: 55, max: 55, color: PCOLORS[Math.floor(Math.random() * PCOLORS.length)], sz: 3 + Math.random() * 3 });
  }
}

interface Star { x: number; y: number; sz: number; phase: number; }
function makeStars(h: number): Star[] {
  return Array.from({ length: 55 }, () => ({ x: Math.random() * CW, y: Math.random() * h, sz: Math.random() < 0.65 ? 1 : 2, phase: Math.random() * Math.PI * 2 }));
}

interface Props {
  onGameOver: (score: number, level: number) => void;
  personalBest: number;
  arcadeMode?: boolean;
  startLevel?: number;
  onExit?: () => void;
  ballSkin?: BallSkin;
}

export default function GameScreen({ onGameOver, personalBest, arcadeMode = false, startLevel = 1, onExit, ballSkin = 'basketball' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    phase: 'aiming' as 'aiming' | 'dropping' | 'scored' | 'missed' | 'levelup',
    ball: { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 },
    prevBall: { x: CW / 2, y: DROP_H / 2 + 15 },
    score: 0, level: 1, lives: 3, makesThisLevel: 0, frame: 0,
    hoops: [] as HoopInstance[],
    particles: [] as Particle[],
    stars: [] as Star[],
    shakeFrames: 0, shakeIntensity: 0, phaseTimer: 0,
    rimHitThisShot: false,
    plusOneAlpha: 0, plusOneY: 0, plusOneX: CW / 2, levelUpAlpha: 0, canvasHeight: 0,
    showDragHint: true,
    nearMiss: false,
    missType: 'none' as 'none' | 'close' | 'airball',
    closeToggle: false,
    levelBonus: 0,
    level1Shot2Y: 0, level1Shot3Y: 0,
  });
  const rafRef = useRef(0);
  const canvasHeight = useRef(Math.min(window.innerHeight, 844));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const h = Math.min(window.innerHeight, 844);
    canvasHeight.current = h;
    const s = stateRef.current;
    s.canvasHeight = h;
    s.level = startLevel;
    s.stars = makeStars(h);
    s.level1Shot2Y = h - 100 - Math.random() * 180;
    s.level1Shot3Y = h - 100 - Math.random() * 180;
    s.ball = { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 };
    s.prevBall = { x: CW / 2, y: DROP_H / 2 + 15 };
    s.hoops = setupHoops(startLevel, 0, h, s.level1Shot2Y, s.level1Shot3Y);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = CW * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(dpr, dpr);
    function loop() { update(ctx); render(ctx); rafRef.current = requestAnimationFrame(loop); }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function update(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    s.frame++;
    const ch = s.canvasHeight;

    // Update each hoop's position based on its pattern
    for (const hoop of s.hoops) {
      const spd = hoop.speed * 0.018;
      const amp = CW / 2 - (hoop.innerHalf + hoop.rimThick) - 22;
      if (hoop.pattern === 'still') {
        // static — stays at base
      } else if (hoop.pattern === 'linear') {
        hoop.x = hoop.baseX + Math.sin(s.frame * spd) * amp;
      } else if (hoop.pattern === 'rectangle') {
        const t = (s.frame * spd) % (Math.PI * 2);
        const side = Math.floor(t / (Math.PI / 2));
        const frac = (t % (Math.PI / 2)) / (Math.PI / 2);
        let rx = 0, ry = 0;
        if (side === 0)      { rx = -1 + 2 * frac; ry =  0.5; }
        else if (side === 1) { rx =  1;             ry =  0.5 - frac; }
        else if (side === 2) { rx =  1 - 2 * frac;  ry = -0.5; }
        else                 { rx = -1;             ry = -0.5 + frac; }
        hoop.x = hoop.baseX + rx * amp;
        hoop.y = hoop.baseY + ry * amp;
      } else if (hoop.pattern === 'circle') {
        hoop.x = hoop.baseX + Math.cos(s.frame * spd) * amp;
        hoop.y = hoop.baseY + Math.sin(s.frame * spd) * Math.min(amp, 75);
      } else if (hoop.pattern === 'circle_cw') {
        // clockwise: starts right, sweeps down. Opposite x to circle_ccw so they diverge.
        hoop.x = hoop.baseX + Math.cos(s.frame * spd) * amp;
        hoop.y = hoop.baseY + Math.sin(s.frame * spd) * 28;
      } else if (hoop.pattern === 'circle_ccw') {
        // counter-clockwise with inverted x so they're on opposite sides normally
        // both reach x=baseX at the same time (cos=0), that's the sweet spot to shoot
        hoop.x = hoop.baseX - Math.cos(s.frame * spd) * amp;
        hoop.y = hoop.baseY - Math.sin(s.frame * spd) * 28;
      } else { // figure8
        hoop.x = hoop.baseX + Math.sin(s.frame * spd) * amp;
        hoop.y = hoop.baseY + Math.sin(s.frame * spd * 2) * 18;
      }
    }

    if (s.shakeFrames > 0) { s.shakeFrames--; s.shakeIntensity *= 0.88; }
    s.particles = s.particles.filter(p => p.life > 0);
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }

    if (s.phase === 'scored' || s.phase === 'missed' || s.phase === 'levelup') {
      s.phaseTimer--;
      if (s.phase === 'scored') s.plusOneAlpha = Math.max(0, s.phaseTimer / 45);
      if (s.phase === 'levelup') s.levelUpAlpha = Math.max(0, s.phaseTimer / 60);
      if (s.phase === 'scored' || s.phase === 'levelup') {
        s.ball.vy += GRAVITY;
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
      }
      if (s.phaseTimer <= 0) {
        if (s.lives <= 0 && !arcadeMode) { onGameOver(s.score, s.level); return; }
        s.phase = 'aiming';
        s.ball = { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 };
        s.prevBall = { ...s.ball };
        s.rimHitThisShot = false;
        s.nearMiss = false;
        s.missType = 'none';
        s.hoops = setupHoops(s.level, s.makesThisLevel, ch, s.level1Shot2Y, s.level1Shot3Y);
      }
      return;
    }
    if (s.phase !== 'dropping') return;

    const SUBSTEPS = 3;
    let resolved = false;
    for (let sub = 0; sub < SUBSTEPS && !resolved; sub++) {
      s.ball.vy += GRAVITY / SUBSTEPS;
      s.ball.x += s.ball.vx / SUBSTEPS;
      s.ball.y += s.ball.vy / SUBSTEPS;

      // Rim collision for all hoops
      for (const hoop of s.hoops) {
        const RIM_R = hoop.rimThick / 2;
        const rimCircles = [
          { x: hoop.x - hoop.innerHalf - hoop.rimThick / 2, y: hoop.y },
          { x: hoop.x + hoop.innerHalf + hoop.rimThick / 2, y: hoop.y },
        ];
        for (const rim of rimCircles) {
          const dx = s.ball.x - rim.x, dy = s.ball.y - rim.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = BALL_R + RIM_R;
          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist, ny = dy / dist;
            s.ball.x = rim.x + nx * (minDist + 0.5);
            s.ball.y = rim.y + ny * (minDist + 0.5);
            const dot = s.ball.vx * nx + s.ball.vy * ny;
            s.ball.vx = (s.ball.vx - 2 * dot * nx) * BOUNCE;
            s.ball.vy = (s.ball.vy - 2 * dot * ny) * BOUNCE;
            if (!s.rimHitThisShot) { s.rimHitThisShot = true; playRim(); }
          }
        }
      }

      // Scoring check for all hoops
      for (const hoop of s.hoops) {
        if (hoop.lockedOut || hoop.scored) continue;
        if (s.ball.vy > 0) {
          const openLeft  = hoop.x - hoop.innerHalf + BALL_R * 0.5;
          const openRight = hoop.x + hoop.innerHalf - BALL_R * 0.5;
          const inZone = s.ball.y >= hoop.y - BALL_R && s.ball.y <= hoop.y + BALL_R;
          if (inZone) {
            if (s.ball.x > openLeft && s.ball.x < openRight) {
              hoop.scored = true;
              s.score++;
              s.plusOneX = hoop.x;
              s.plusOneY = hoop.y - 30;
              s.plusOneAlpha = 1;
              playSwish();
              // Shot complete when every hoop is scored
              if (s.hoops.every(h => h.scored)) {
                s.makesThisLevel++;
                emitParticles(s.particles, hoop.x, hoop.y - 20, 24);
                s.phase = 'scored'; s.phaseTimer = 55;
                if (s.makesThisLevel >= getLevelCfg(s.level).makesNeeded) {
                  const bonus = s.level;
                  s.score += bonus;
                  s.levelBonus = bonus;
                  s.plusOneAlpha = 0;
                  s.level++; s.makesThisLevel = 0;
                  s.phase = 'levelup'; s.phaseTimer = 80; s.levelUpAlpha = 1;
                  emitParticles(s.particles, CW / 2, ch / 2, 40);
                  playLevelUp();
                }
                resolved = true;
                break;
              }
            } else {
              const dist = s.ball.x < openLeft ? openLeft - s.ball.x : s.ball.x - openRight;
              if (dist < 22) s.nearMiss = true;
            }
          }
          if (s.ball.y > hoop.y + BALL_R * 2) hoop.lockedOut = true;
        }
      }
      if (resolved) break;

      if (s.ball.y > ch + BALL_R * 2) {
        if (!arcadeMode) s.lives = Math.max(0, s.lives - 1);
        s.phase = 'missed'; s.phaseTimer = s.lives <= 0 && !arcadeMode ? 90 : 50;
        s.shakeFrames = 16; s.shakeIntensity = 9;
        if (s.nearMiss || s.rimHitThisShot) {
          s.missType = 'close';
          s.closeToggle = !s.closeToggle;
        } else {
          s.missType = 'airball';
        }
        s.nearMiss = false;
        playMiss();
        resolved = true;
        break;
      }
    }
    s.prevBall = { x: s.ball.x, y: s.ball.y };
  }

  function render(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    const ch = s.canvasHeight;
    const cfg = getLevelCfg(s.level);
    const sx = s.shakeFrames > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0;
    const sy = s.shakeFrames > 0 ? (Math.random() - 0.5) * s.shakeIntensity : 0;
    ctx.fillStyle = '#1a1035';
    ctx.fillRect(0, 0, CW, ch);
    for (const star of s.stars) {
      const alpha = 0.5 + 0.5 * Math.sin(s.frame * 0.03 + star.phase);
      ctx.fillStyle = `rgba(200,210,255,${alpha})`;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.sz, star.sz);
    }
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, CW, DROP_H);
    ctx.strokeStyle = '#00ffff44'; ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, DROP_H); ctx.lineTo(CW, DROP_H); ctx.stroke();
    ctx.setLineDash([]);
    if (s.showDragHint && s.phase === 'aiming') {
      const pulse = 0.65 + 0.35 * Math.sin(s.frame * 0.07);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(0,0,20,0.75)';
      ctx.fillRect(16, ch / 2 - 46, CW - 32, 76);
      ctx.fillStyle = '#00ffff';
      ctx.font = '16px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('◄  DRAG BALL  ►', CW / 2, ch / 2 - 12);
      ctx.fillStyle = '#ffffff99';
      ctx.font = '8px "Press Start 2P"';
      ctx.fillText('LEFT OR RIGHT TO AIM', CW / 2, ch / 2 + 18);
      ctx.globalAlpha = 1;
    }
    if (s.phase === 'aiming') {
      for (let i = 1; i <= 9; i++) {
        const dotY = s.ball.y + i * 22;
        if (dotY > DROP_H && dotY < ch) {
          ctx.fillStyle = `rgba(0,255,255,${0.7 - i * 0.07})`;
          ctx.fillRect(Math.round(s.ball.x) - 2, Math.round(dotY) - 2, 4, 4);
        }
      }
    }
    for (const p of s.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.sz), Math.round(p.sz));
    }
    ctx.globalAlpha = 1;
    if (s.ball.y < ch + BALL_R * 3) drawBallSkin(ctx, ballSkin, s.ball.x, s.ball.y, BALL_R);
    for (const hoop of s.hoops) drawHoop(ctx, hoop.x, hoop.y, hoop.innerHalf, hoop.rimThick);
    if (s.plusOneAlpha > 0.01) {
      ctx.globalAlpha = s.plusOneAlpha;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 22px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('+1', Math.round(s.plusOneX), Math.round(s.plusOneY - (1 - s.plusOneAlpha) * 20));
      ctx.globalAlpha = 1;
    }
    if (s.phase === 'missed' && s.missType !== 'none') {
      const missAlpha = Math.min(1, s.phaseTimer / 15);
      ctx.globalAlpha = missAlpha;
      ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center';
      if (s.missType === 'close') {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(s.closeToggle ? 'ALMOST!' : 'CLOSE!', CW / 2, ch / 2 - 20);
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.fillText('AIRBALL!', CW / 2, ch / 2 - 20);
      }
      ctx.globalAlpha = 1;
    }
    if (s.phase === 'levelup' && s.levelUpAlpha > 0.01) {
      ctx.globalAlpha = s.levelUpAlpha * 0.85;
      ctx.fillStyle = '#000033';
      ctx.fillRect(0, ch / 2 - 60, CW, 120);
      ctx.globalAlpha = s.levelUpAlpha;
      ctx.fillStyle = '#00ffff'; ctx.font = '18px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('LEVEL UP!', CW / 2, ch / 2 - 10);
      ctx.fillStyle = '#ffd700'; ctx.font = '13px "Press Start 2P"';
      ctx.fillText(`LEVEL ${s.level}`, CW / 2, ch / 2 + 20);
      ctx.fillStyle = '#00ff99'; ctx.font = '9px "Press Start 2P"';
      ctx.fillText(`+${s.levelBonus} BONUS PTS`, CW / 2, ch / 2 + 46);
      ctx.globalAlpha = 1;
    }
    ctx.font = '11px "Press Start 2P"'; ctx.textAlign = 'left';
    if (arcadeMode) {
      ctx.fillStyle = '#00ffff'; ctx.fillText('EXIT', 12, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('TAP ▼', 12, 14);
    } else {
      ctx.fillStyle = '#ffd700'; ctx.fillText(`${s.score}`, 12, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('SCORE', 12, 14);
    }
    ctx.fillStyle = '#00ffff'; ctx.font = '11px "Press Start 2P"'; ctx.textAlign = 'center';
    ctx.fillText(`LVL ${s.level}`, CW / 2, 32);
    ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('LEVEL', CW / 2, 14);
    ctx.textAlign = 'right'; ctx.font = '12px "Press Start 2P"';
    if (arcadeMode) {
      ctx.fillStyle = '#00ffff'; ctx.fillText('∞', CW - 10, 32);
    } else {
      let heartsStr = '';
      for (let i = 0; i < 3; i++) heartsStr += i < s.lives ? '♥' : '♡';
      ctx.fillStyle = '#ff4444'; ctx.fillText(heartsStr, CW - 10, 32);
    }
    const barH = 10, barY = ch - barH - 4;
    const prog = Math.min(1, s.makesThisLevel / cfg.makesNeeded);
    ctx.fillStyle = '#111128'; ctx.fillRect(0, barY, CW, barH);
    ctx.fillStyle = '#00ffff'; ctx.fillRect(0, barY, Math.round(CW * prog), barH);
    ctx.fillStyle = '#ffffff22';
    for (let i = 1; i < cfg.makesNeeded; i++) {
      const bx = Math.round(CW * i / cfg.makesNeeded);
      ctx.fillRect(bx - 1, barY, 2, barH);
    }
    ctx.font = '8px "Press Start 2P"'; ctx.fillStyle = '#ffffff88'; ctx.textAlign = 'center';
    ctx.fillText(`${s.makesThisLevel}/${cfg.makesNeeded} TO NEXT LEVEL`, CW / 2, barY - 5);
    ctx.restore();
  }

  const getX = (e: React.TouchEvent | React.MouseEvent): number => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    if ('touches' in e) return (e.touches[0]?.clientX ?? e.changedTouches[0].clientX - rect.left) * scaleX;
    return ((e as React.MouseEvent).clientX - rect.left) * scaleX;
  };

  const getY = (e: React.TouchEvent | React.MouseEvent): number => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvasHeight.current / rect.height;
    if ('touches' in e) return (e.touches[0]?.clientY ?? e.changedTouches[0].clientY - rect.top) * scaleY;
    return ((e as React.MouseEvent).clientY - rect.top) * scaleY;
  };

  const onDown = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    try { getAudio(); } catch (_) {}
    const s = stateRef.current;
    s.showDragHint = false;
    if (arcadeMode && onExit) {
      const y = getY(e);
      const x = getX(e);
      if (y < 48 && x < 80) { onExit(); return; }
    }
    if (s.phase !== 'aiming') return;
    const y = getY(e);
    if (y > DROP_H + 10) return;
    const x = Math.max(BALL_R + 2, Math.min(CW - BALL_R - 2, getX(e)));
    s.ball.x = x;
  }, []);

  const onMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    if (s.phase !== 'aiming') return;
    const x = Math.max(BALL_R + 2, Math.min(CW - BALL_R - 2, getX(e)));
    s.ball.x = x;
  }, []);

  const onUp = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    if (s.phase !== 'aiming') return;
    s.phase = 'dropping';
    s.ball.vy = 0; s.ball.vx = 0;
    s.prevBall = { x: s.ball.x, y: s.ball.y };
    s.rimHitThisShot = false;
  }, []);

  const ch = Math.min(window.innerHeight, 844);
  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={ch}
      style={{ display: 'block', width: '100%', height: '100dvh', imageRendering: 'pixelated', touchAction: 'none' }}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      onMouseDown={onDown}
      onMouseMove={e => { if (e.buttons) onMove(e); }}
      onMouseUp={onUp}
    />
  );
}
