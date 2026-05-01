import React, { useRef, useEffect, useCallback } from 'react';
import { drawBallSkin, type BallSkin } from './BallSkinsScreen';
import type { LevelData } from '../types/level';

const CW = 390;
const BALL_R = 14;
const GRAVITY = 0.38;
const BOUNCE = 0.42;
const RIM_H = 14;
const DROP_H = 90;

type HoopPattern = 'still' | 'linear' | 'linear_v' | 'rectangle' | 'circle' | 'circle_cw' | 'circle_ccw' | 'figure8';

interface HoopInstance {
  x: number; y: number;
  prevX: number; prevY: number;
  baseX: number; baseY: number;
  pattern: HoopPattern;
  speed: number;
  innerHalf: number; rimThick: number;
  scored: boolean; lockedOut: boolean;
  ampX?: number; ampY?: number;
  frameOffset?: number;
  rotation?: number; // radians
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
  if (level <= 6)  return { innerHalf: 50, rimThick, speed: 2.0, pattern: 'figure8',   makesNeeded: 3 };
  // Levels 10+ are loaded from JSON files — this fallback is never reached in normal play
  return { innerHalf: 44, rimThick, speed: 2.0, pattern: 'linear', makesNeeded: 3 };
}

function setupHoops(level: number, shotIdx: number, ch: number, l1y2: number, l1y3: number): HoopInstance[] {
  const rimThick = 10;
  function h(baseX: number, baseY: number, pattern: HoopPattern, speed: number, innerHalf = 50, ampX?: number, ampY?: number, frameOffset?: number): HoopInstance {
    return { x: baseX, y: baseY, prevX: baseX, prevY: baseY, baseX, baseY, pattern, speed, innerHalf, rimThick, scored: false, lockedOut: false, ampX, ampY, frameOffset };
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
  if (level === 8) {
    const playMid = DROP_H + (ch - DROP_H) / 2;
    return [
      h(CW / 2, playMid, 'rectangle', 2.0, 50, 125, 230),
      h(CW / 2, playMid, 'rectangle', 2.0, 50, 125, 230, 30),
    ];
  }
  if (level === 9) {
    return [h(CW * 0.84, ch * 0.56, 'linear_v', 0.5, 50, undefined, ch * 0.27)];
  }
  if (level === 7) {
    return [
      h(CW / 2, ch - 260, 'linear', 1.0),
      h(CW / 2, ch - 120, 'linear', 2.0),
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

function drawHoop(ctx: CanvasRenderingContext2D, hoopX: number, hoopY: number, innerHalf: number, rimThick: number, rotation = 0) {
  const outerHalf = innerHalf + rimThick;
  ctx.save();
  ctx.translate(Math.round(hoopX), Math.round(hoopY));
  if (rotation) ctx.rotate(rotation);
  // Opening line
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-innerHalf, 0); ctx.lineTo(innerHalf, 0); ctx.stroke();
  // Left rim
  ctx.fillStyle = '#e83232';
  ctx.fillRect(-outerHalf, -RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(-outerHalf, -RIM_H / 2, rimThick, 3);
  // Right rim
  ctx.fillStyle = '#e83232';
  ctx.fillRect(innerHalf, -RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(innerHalf, -RIM_H / 2, rimThick, 3);
  // Net
  const netTop = RIM_H / 2;
  const netBot = netTop + 42;
  const netLines = 9;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= netLines; i++) {
    const t = i / netLines;
    const topX = -innerHalf + t * innerHalf * 2;
    const shrink = 0.35;
    const botX = -innerHalf * (1 - shrink) + t * innerHalf * 2 * (1 - shrink);
    ctx.beginPath(); ctx.moveTo(topX, netTop); ctx.lineTo(botX, netBot); ctx.stroke();
  }
  [0.3, 0.6, 1.0].forEach(frac => {
    const ny = netTop + (netBot - netTop) * frac;
    const shrink = 0.35 * frac;
    ctx.beginPath(); ctx.moveTo(-innerHalf * (1 - shrink), ny); ctx.lineTo(innerHalf * (1 - shrink), ny); ctx.stroke();
  });
  ctx.restore();
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

interface Obstacle {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string; thick: number;
  restitution?: number;
  friction?: number;
  label?: string;
  type?: 'trampoline';
}

function setupObstacles(level: number, ch: number): Obstacle[] {
  if (level === 9) {
    return [
      { x1: CW / 2, y1: DROP_H + 40, x2: CW - 5, y2: ch * 0.25, color: '#b0b0b0', thick: 5, restitution: 0.80, friction: 0.95 },
      { x1: 20, y1: ch * 0.78, x2: CW * 0.42, y2: ch * 0.78 + 8, color: '#ffd700', thick: 10, type: 'trampoline', restitution: 0.89, friction: 1.0 },
    ];
  }
  return [];
}

function levelDataToHoops(ld: LevelData): HoopInstance[] {
  return (ld.hoops ?? []).map(th => ({
    x: th.baseX, y: th.baseY, prevX: th.baseX, prevY: th.baseY,
    baseX: th.baseX, baseY: th.baseY,
    pattern: th.pattern as HoopPattern,
    speed: th.speed, innerHalf: th.innerHalf, rimThick: th.rimThick,
    scored: false, lockedOut: false,
    ampX: th.ampX || undefined, ampY: th.ampY || undefined,
    frameOffset: th.frameOffset || undefined,
    rotation: th.rotation ? th.rotation * Math.PI / 180 : 0,
  }));
}

function levelDataToObstacles(ld: LevelData): Obstacle[] {
  return (ld.obstacles ?? []).map(o => ({
    x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2,
    color: o.type === 'trampoline' ? '#ffd700' : '#b0b0b0',
    thick: o.thick, restitution: o.restitution, friction: o.friction,
    type: o.type === 'trampoline' ? 'trampoline' as const : undefined,
  }));
}

interface Props {
  onGameOver: (score: number, level: number) => void;
  onGameWon?: (score: number, level: number) => void;
  personalBest: number;
  arcadeMode?: boolean;
  startLevel?: number;
  onExit?: () => void;
  ballSkin?: BallSkin;
  testLevel?: LevelData;
  campaignLevels?: LevelData[];
}

export default function GameScreen({ onGameOver, onGameWon, personalBest, arcadeMode = false, startLevel = 1, onExit, ballSkin = 'basketball', testLevel, campaignLevels = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    phase: 'aiming' as 'aiming' | 'dropping' | 'scored' | 'missed' | 'levelup',
    gameOverFired: false,
    gameWonFired: false,
    wonPending: false,
    currentMakesNeeded: 3,
    ball: { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 },
    prevBall: { x: CW / 2, y: DROP_H / 2 + 15 },
    score: 0, level: 1, lives: 3, makesThisLevel: 0, frame: 0,
    hoops: [] as HoopInstance[],
    obstacles: [] as Obstacle[],
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
  const canvasHeight = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Read safe-area-inset-top so the game canvas sits below the status bar in PWA mode
    const safeEl = document.createElement('div');
    safeEl.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    document.body.appendChild(safeEl);
    const safeTop = parseInt(window.getComputedStyle(safeEl).paddingTop) || 0;
    document.body.removeChild(safeEl);
    const h = Math.min(window.innerHeight - safeTop, 844);
    canvasHeight.current = h;
    const s = stateRef.current;
    s.canvasHeight = h;
    s.level = startLevel;
    s.stars = makeStars(h);
    s.level1Shot2Y = h - 100 - Math.random() * 180;
    s.level1Shot3Y = h - 100 - Math.random() * 180;
    s.ball = { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 };
    s.prevBall = { x: CW / 2, y: DROP_H / 2 + 15 };
    s.frame = 20; // sin(0)=0 puts moving hoops at center; start mid-motion instead
    if (testLevel) {
      s.hoops = levelDataToHoops(testLevel);
      s.obstacles = levelDataToObstacles(testLevel);
      s.currentMakesNeeded = testLevel.makesNeeded;
    } else if (startLevel >= 10 && campaignLevels.length > 0) {
      const idx = startLevel - 10;
      if (idx < campaignLevels.length) {
        const ld = campaignLevels[idx];
        s.hoops = levelDataToHoops(ld);
        s.obstacles = levelDataToObstacles(ld);
        s.currentMakesNeeded = ld.makesNeeded;
      } else {
        s.hoops = [];
        s.obstacles = [];
        s.wonPending = true;
      }
    } else {
      s.hoops = setupHoops(startLevel, 0, h, s.level1Shot2Y, s.level1Shot3Y);
      s.obstacles = setupObstacles(startLevel, h);
    }
    positionHoops(s.hoops, s.frame);
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

  function positionHoops(hoops: HoopInstance[], frame: number) {
    for (const hoop of hoops) {
      const f = frame - (hoop.frameOffset ?? 0);
      const spd = hoop.speed * 0.018;
      const amp = CW / 2 - (hoop.innerHalf + hoop.rimThick) - 22;
      if (hoop.pattern === 'still') {
        // static
      } else if (hoop.pattern === 'linear') {
        const ax = hoop.ampX ?? amp;
        hoop.x = hoop.baseX + Math.sin(f * spd) * ax;
      } else if (hoop.pattern === 'linear_v') {
        const ay = hoop.ampY ?? amp;
        hoop.y = hoop.baseY + Math.sin(f * spd) * ay;
      } else if (hoop.pattern === 'rectangle') {
        const ax = hoop.ampX ?? amp;
        const ay = hoop.ampY ?? amp * 0.5;
        const t = (f * spd) % (Math.PI * 2);
        const side = Math.floor(t / (Math.PI / 2));
        const frac = (t % (Math.PI / 2)) / (Math.PI / 2);
        let rx = 0, ry = 0;
        if (side === 0)      { rx = -1 + 2 * frac; ry =  1; }
        else if (side === 1) { rx =  1;             ry =  1 - 2 * frac; }
        else if (side === 2) { rx =  1 - 2 * frac;  ry = -1; }
        else                 { rx = -1;             ry = -1 + 2 * frac; }
        hoop.x = hoop.baseX + rx * ax;
        hoop.y = hoop.baseY + ry * ay;
      } else if (hoop.pattern === 'circle') {
        const ax = hoop.ampX ?? amp;
        const ay = hoop.ampY ?? Math.min(amp, 75);
        hoop.x = hoop.baseX + Math.cos(f * spd) * ax;
        hoop.y = hoop.baseY + Math.sin(f * spd) * ay;
      } else if (hoop.pattern === 'circle_cw') {
        hoop.x = hoop.baseX + Math.cos(f * spd) * amp;
        hoop.y = hoop.baseY + Math.sin(f * spd) * 28;
      } else if (hoop.pattern === 'circle_ccw') {
        hoop.x = hoop.baseX - Math.cos(f * spd) * amp;
        hoop.y = hoop.baseY - Math.sin(f * spd) * 28;
      } else { // figure8
        hoop.x = hoop.baseX + Math.sin(f * spd) * amp;
        hoop.y = hoop.baseY + Math.sin(f * spd * 2) * 18;
      }
    }
  }

  function update(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    s.frame++;
    const ch = s.canvasHeight;

    if (s.shakeFrames > 0) { s.shakeFrames--; s.shakeIntensity *= 0.88; }
    s.particles = s.particles.filter(p => p.life > 0);
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
    s.plusOneAlpha = Math.max(0, s.plusOneAlpha - 0.04);

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
        const wasLevelUp = s.phase === 'levelup';
        if (s.lives <= 0 && !arcadeMode) { if (!s.gameOverFired) { s.gameOverFired = true; onGameOver(s.score, s.level); } return; }
        if (s.wonPending && !s.gameWonFired) { s.gameWonFired = true; onGameWon?.(s.score, s.level); return; }
        s.phase = 'aiming';
        s.ball = { x: CW / 2, y: DROP_H / 2 + 15, vx: 0, vy: 0 };
        s.prevBall = { ...s.ball };
        s.rimHitThisShot = false;
        s.nearMiss = false;
        s.missType = 'none';
        s.plusOneAlpha = 0;
        // Only rebuild hoops when the layout actually changes:
        // - level just changed (wasLevelUp)
        // - level 1 or 5: each shot has a different hoop configuration
        // Otherwise just reset flags so the hoop keeps moving with no glitch
        if (testLevel) {
          for (const hoop of s.hoops) { hoop.scored = false; hoop.lockedOut = false; }
        } else if (wasLevelUp || s.level === 1 || s.level === 5) {
          if (!testLevel && s.level >= 10) {
            const idx = s.level - 10;
            if (idx < campaignLevels.length) {
              const ld = campaignLevels[idx];
              s.hoops = levelDataToHoops(ld);
              s.obstacles = levelDataToObstacles(ld);
              positionHoops(s.hoops, s.frame);
            }
          } else {
            s.hoops = setupHoops(s.level, s.makesThisLevel, ch, s.level1Shot2Y, s.level1Shot3Y);
            positionHoops(s.hoops, s.frame);
            s.obstacles = setupObstacles(s.level, ch);
          }
        } else {
          for (const hoop of s.hoops) { hoop.scored = false; hoop.lockedOut = false; }
        }
      } else {
        for (const hoop of s.hoops) { hoop.prevX = hoop.x; hoop.prevY = hoop.y; }
        positionHoops(s.hoops, s.frame);
      }
      return;
    }

    for (const hoop of s.hoops) { hoop.prevX = hoop.x; hoop.prevY = hoop.y; }
    positionHoops(s.hoops, s.frame);
    if (s.phase !== 'dropping') return;

    const SUBSTEPS = 3;
    let resolved = false;
    for (let sub = 0; sub < SUBSTEPS && !resolved; sub++) {
      const subPrevBallX = s.ball.x;
      const subPrevBallY = s.ball.y;
      s.ball.vy += GRAVITY / SUBSTEPS;
      s.ball.x += s.ball.vx / SUBSTEPS;
      s.ball.y += s.ball.vy / SUBSTEPS;

      // Scoring check FIRST — before any collision moves the ball
      // sub===0 uses relative motion (ball vs hoop both moved since last frame)
      // sub>0 uses standard CCD (hoop.y is constant within a frame)
      for (const hoop of s.hoops) {
        if (hoop.scored) continue;
        const θ = hoop.rotation ?? 0;
        // Normal to hoop face (points "up" through opening when θ=0)
        const nθx = -Math.sin(θ), nθy = Math.cos(θ);
        // Tangent along hoop bar
        const tθx = Math.cos(θ), tθy = Math.sin(θ);
        let crossed = false, t = 0, hoopXAtT = hoop.x, hoopYAtT = hoop.y;
        if (sub === 0) {
          const relPrev = (subPrevBallX - hoop.prevX) * nθx + (subPrevBallY - hoop.prevY) * nθy;
          const relCurr = (s.ball.x - hoop.x) * nθx + (s.ball.y - hoop.y) * nθy;
          if ((relPrev < 0 && relCurr >= 0) || (relPrev > 0 && relCurr <= 0)) {
            crossed = true;
            if (Math.abs(relCurr - relPrev) > 0.001) t = -relPrev / (relCurr - relPrev);
            hoopXAtT = hoop.prevX + t * (hoop.x - hoop.prevX);
            hoopYAtT = hoop.prevY + t * (hoop.y - hoop.prevY);
          }
        } else {
          const relPrev = (subPrevBallX - hoop.x) * nθx + (subPrevBallY - hoop.y) * nθy;
          const relCurr = (s.ball.x - hoop.x) * nθx + (s.ball.y - hoop.y) * nθy;
          if ((relPrev < 0 && relCurr >= 0) || (relPrev > 0 && relCurr <= 0)) {
            crossed = true;
            if (Math.abs(relCurr - relPrev) > 0.001) t = -relPrev / (relCurr - relPrev);
            hoopXAtT = hoop.x;
            hoopYAtT = hoop.y;
          }
        }
        if (crossed) {
          const xAtCross = subPrevBallX + t * (s.ball.x - subPrevBallX);
          const yAtCross = subPrevBallY + t * (s.ball.y - subPrevBallY);
          // Position along hoop tangent (works for any rotation angle)
          const alongHoop = (xAtCross - hoopXAtT) * tθx + (yAtCross - hoopYAtT) * tθy;
          const openHalf = hoop.innerHalf - BALL_R * 0.5;
          if (Math.abs(alongHoop) < openHalf) {
            hoop.scored = true;
            s.score++;
            s.plusOneX = hoop.x;
            s.plusOneY = hoop.y - 30;
            s.plusOneAlpha = 1;
            playSwish();
            if (s.hoops.every(h => h.scored)) {
              s.makesThisLevel++;
              emitParticles(s.particles, hoop.x, hoop.y - 20, 24);
              s.phase = 'scored'; s.phaseTimer = 55;
              if (s.makesThisLevel >= s.currentMakesNeeded) {
                if (testLevel) {
                  // Community/test level: complete immediately, no level-up animation
                  s.wonPending = true;
                  // phase stays 'scored', phaseTimer = 55 — onGameWon fires after brief pause
                } else {
                  const bonus = s.level;
                  s.score += bonus;
                  s.levelBonus = bonus;
                  s.plusOneAlpha = 0;
                  s.level++; s.makesThisLevel = 0;
                  s.phase = 'levelup'; s.phaseTimer = 80; s.levelUpAlpha = 1;
                  emitParticles(s.particles, CW / 2, ch / 2, 40);
                  playLevelUp();
                  if (!arcadeMode && s.level >= 10) {
                    const nextIdx = s.level - 10;
                    if (nextIdx >= campaignLevels.length) {
                      s.wonPending = true;
                    } else {
                      s.currentMakesNeeded = campaignLevels[nextIdx].makesNeeded;
                    }
                  } else if (!arcadeMode && s.level < 10) {
                    s.currentMakesNeeded = getLevelCfg(s.level).makesNeeded;
                  }
                }
              }
              resolved = true;
              break;
            }
          } else {
            const dist = Math.abs(alongHoop) - openHalf;
            if (dist < 22) s.nearMiss = true;
          }
        }
      }
      if (resolved) break;

      // Rim collision for all hoops
      for (const hoop of s.hoops) {
        const RIM_R = hoop.rimThick / 2;
        const θr = hoop.rotation ?? 0;
        const cθ = Math.cos(θr), sθ = Math.sin(θr);
        const rimOffset = hoop.innerHalf + hoop.rimThick / 2;
        const rimCircles = [
          { x: hoop.x - rimOffset * cθ, y: hoop.y - rimOffset * sθ },
          { x: hoop.x + rimOffset * cθ, y: hoop.y + rimOffset * sθ },
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
            if (Math.abs(s.ball.vx) < 0.5) s.ball.vx = (Math.random() < 0.5 ? -1.0 : 1.0);
            if (!s.rimHitThisShot) { s.rimHitThisShot = true; playRim(); }
          }
        }
      }

      // Obstacle collisions
      for (const obs of s.obstacles) {
        const restitution = obs.restitution ?? BOUNCE;
        const friction = obs.friction ?? 0.85;
        const odx = obs.x2 - obs.x1, ody = obs.y2 - obs.y1;
        const len2 = odx * odx + ody * ody;
        if (len2 === 0) continue;
        let t = ((s.ball.x - obs.x1) * odx + (s.ball.y - obs.y1) * ody) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = obs.x1 + t * odx, cy = obs.y1 + t * ody;
        const ex = s.ball.x - cx, ey = s.ball.y - cy;
        const dist = Math.sqrt(ex * ex + ey * ey);
        if (dist < BALL_R && dist > 0.001) {
          const nx = ex / dist, ny = ey / dist;
          s.ball.x = cx + nx * (BALL_R + 0.5);
          s.ball.y = cy + ny * (BALL_R + 0.5);
          const dot = s.ball.vx * nx + s.ball.vy * ny;
          const tvx = s.ball.vx - dot * nx, tvy = s.ball.vy - dot * ny;
          s.ball.vx = tvx * friction + (-dot * nx) * restitution;
          s.ball.vy = tvy * friction + (-dot * ny) * restitution;
          if (!s.rimHitThisShot) { s.rimHitThisShot = true; playRim(); }
        }
        // Endpoint circle collisions — prevents ball sticking at corners
        const endR = obs.thick / 2;
        const minDist = BALL_R + endR;
        for (const ep of [{ x: obs.x1, y: obs.y1 }, { x: obs.x2, y: obs.y2 }]) {
          const dx = s.ball.x - ep.x, dy = s.ball.y - ep.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist && d > 0.001) {
            const nx = dx / d, ny = dy / d;
            s.ball.x = ep.x + nx * (minDist + 0.5);
            s.ball.y = ep.y + ny * (minDist + 0.5);
            const dot = s.ball.vx * nx + s.ball.vy * ny;
            const tvx = s.ball.vx - dot * nx, tvy = s.ball.vy - dot * ny;
            s.ball.vx = tvx * friction + (-dot * nx) * restitution;
            s.ball.vy = tvy * friction + (-dot * ny) * restitution;
            // Anti-stuck: if ball has almost no horizontal velocity after hitting
            // a metal endpoint, nudge it off to whichever side it's on
            if (obs.type !== 'trampoline' && Math.abs(s.ball.vx) < 0.5) {
              const midX = (obs.x1 + obs.x2) / 2;
              s.ball.vx += s.ball.x <= midX ? -1.2 : 1.2;
            }
            if (!s.rimHitThisShot) { s.rimHitThisShot = true; playRim(); }
          }
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
    ctx.lineCap = 'round';
    for (const obs of s.obstacles) {
      if (obs.type === 'trampoline') {
        const legLen = 22;
        // Legs
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.lineCap = 'square';
        ctx.beginPath(); ctx.moveTo(obs.x1, obs.y1); ctx.lineTo(obs.x1, obs.y1 + legLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(obs.x2, obs.y2); ctx.lineTo(obs.x2, obs.y2 + legLen); ctx.stroke();
        // Yellow frame
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(obs.x1, obs.y1); ctx.lineTo(obs.x2, obs.y2); ctx.stroke();
        // Black mat
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 5;
        ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(obs.x1 + 3, obs.y1); ctx.lineTo(obs.x2 - 3, obs.y2); ctx.stroke();
      } else {
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = obs.thick;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(obs.x1, obs.y1);
        ctx.lineTo(obs.x2, obs.y2);
        ctx.stroke();
        if (obs.label) {
          const mx = (obs.x1 + obs.x2) / 2, my = (obs.y1 + obs.y2) / 2;
          ctx.fillStyle = obs.color;
          ctx.font = '7px "Press Start 2P"';
          ctx.textAlign = 'center';
          ctx.fillText(obs.label, mx, my - 8);
        }
      }
    }
    if (s.ball.y < ch + BALL_R * 3) drawBallSkin(ctx, ballSkin, s.ball.x, s.ball.y, BALL_R);
    for (const hoop of s.hoops) drawHoop(ctx, hoop.x, hoop.y, hoop.innerHalf, hoop.rimThick, hoop.rotation ?? 0);
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
    if (arcadeMode || testLevel) {
      ctx.fillStyle = '#00ffff'; ctx.fillText('EXIT', 12, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('TAP ▼', 12, 14);
    } else {
      ctx.fillStyle = '#ffd700'; ctx.fillText(`${s.score}`, 12, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('SCORE', 12, 14);
    }
    // Center HUD: show level name for community/test levels, level number otherwise
    ctx.textAlign = 'center';
    if (testLevel) {
      const raw = testLevel.name.toUpperCase();
      const display = raw.length > 20 ? raw.slice(0, 19) + '…' : raw;
      ctx.fillStyle = '#00ffff'; ctx.font = '9px "Press Start 2P"'; ctx.fillText(display, CW / 2, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('COMMUNITY', CW / 2, 14);
    } else {
      ctx.fillStyle = '#00ffff'; ctx.font = '11px "Press Start 2P"'; ctx.fillText(`LVL ${s.level}`, CW / 2, 32);
      ctx.fillStyle = '#888'; ctx.font = '7px "Press Start 2P"'; ctx.fillText('LEVEL', CW / 2, 14);
    }
    ctx.textAlign = 'right'; ctx.font = '12px "Press Start 2P"';
    if (arcadeMode) {
      ctx.fillStyle = '#00ffff'; ctx.fillText('∞', CW - 10, 32);
    } else {
      let heartsStr = '';
      for (let i = 0; i < 3; i++) heartsStr += i < s.lives ? '♥' : '♡';
      ctx.fillStyle = '#ff4444'; ctx.fillText(heartsStr, CW - 10, 32);
    }
    // Progress bar — use currentMakesNeeded for community levels so it reflects the actual target
    const makesTarget = testLevel ? s.currentMakesNeeded : cfg.makesNeeded;
    const barH = 10, barY = ch - barH - 4;
    const prog = Math.min(1, s.makesThisLevel / makesTarget);
    ctx.fillStyle = '#111128'; ctx.fillRect(0, barY, CW, barH);
    ctx.fillStyle = '#00ffff'; ctx.fillRect(0, barY, Math.round(CW * prog), barH);
    ctx.fillStyle = '#ffffff22';
    for (let i = 1; i < makesTarget; i++) {
      const bx = Math.round(CW * i / makesTarget);
      ctx.fillRect(bx - 1, barY, 2, barH);
    }
    ctx.font = '8px "Press Start 2P"'; ctx.fillStyle = '#ffffff88'; ctx.textAlign = 'center';
    ctx.fillText(
      testLevel
        ? `${s.makesThisLevel}/${makesTarget} MAKES`
        : `${s.makesThisLevel}/${makesTarget} TO NEXT LEVEL`,
      CW / 2, barY - 5
    );
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
    if ((arcadeMode || testLevel) && onExit) {
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

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: 'calc(100dvh - env(safe-area-inset-top, 0px))', imageRendering: 'pixelated', touchAction: 'none' }}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      onMouseDown={onDown}
      onMouseMove={e => { if (e.buttons) onMove(e); }}
      onMouseUp={onUp}
    />
  );
}
