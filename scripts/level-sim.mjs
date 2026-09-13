#!/usr/bin/env node
// Headless Fall Ball level simulator.
//
// Mirrors the physics in src/components/GameScreen.tsx (gravity, substeps,
// CCD scoring, rim + obstacle collisions) and brute-forces every combination
// of drop position × release frame to answer, for each campaign level:
//
//   solvable?   – does at least one (x, frame) pair score?
//   rate        – % of all sampled shots that score (raw luck factor)
//   bestX       – the drop x with the highest success rate, and that rate
//   timing      – longest run of consecutive release frames that score at bestX
//                 (∞ for still hoops; small = tight timing)
//   xWindow     – widest run of consecutive drop x values that score at the
//                 best release frame (small = precise placement)
//   stuck       – shots where the ball never scored or fell out within the
//                 frame cap (a ball resting on a flat bar = soft-lock)
//
// Usage:
//   node scripts/level-sim.mjs                 # every level in manifest.json
//   node scripts/level-sim.mjs 13 27           # only those campaign level numbers
//   node scripts/level-sim.mjs path/to.json    # a single level file (+ heatmap)
//   node scripts/level-sim.mjs --builtin       # hardcoded levels 1–9 for calibration
//   node scripts/level-sim.mjs --trace path/to.json <dropX> <releaseFrame>   # print ball path
//
// Keep this file in sync with GameScreen.tsx if the physics constants change.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMPAIGN_DIR = path.join(__dirname, '..', 'public', 'levels', 'campaign');

// ---- constants copied from GameScreen.tsx ---------------------------------
const CW = 390;
const CH = 844;          // iPhone-class canvas height; the editor caps at 844 too
const BALL_R = 14;
const GRAVITY = 0.38;
const BOUNCE = 0.42;
const DROP_H = 90;
const SUBSTEPS = 3;

// Sampling resolution. Finer = slower but more accurate.
const X_MIN = BALL_R + 2, X_MAX = CW - BALL_R - 2;
const X_STEP = 3;
const FRAME_SPAN = 720;  // release frames sampled: 0 … FRAME_SPAN (12 s at 60 fps)
const FRAME_STEP = 4;
const MAX_FRAMES = 1500; // per-shot cap → "stuck"

// Deterministic replacement for Math.random() in the rim anti-stick nudge.
let seed = 1;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

// ---- level → runtime instances (levelDataToHoops / levelDataToObstacles) ---
function toHoops(ld) {
  return (ld.hoops ?? []).map(th => ({
    x: th.baseX, y: th.baseY, prevX: th.baseX, prevY: th.baseY,
    baseX: th.baseX, baseY: th.baseY,
    pattern: th.pattern, speed: th.speed, innerHalf: th.innerHalf, rimThick: th.rimThick,
    scored: false,
    ampX: th.ampX || undefined, ampY: th.ampY || undefined,
    frameOffset: th.frameOffset || undefined,
    rotation: th.rotation ? th.rotation * Math.PI / 180 : 0,
  }));
}
function toObstacles(ld) {
  return (ld.obstacles ?? []).map(o => ({
    x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, thick: o.thick,
    restitution: o.restitution, friction: o.friction,
    type: o.type === 'trampoline' ? 'trampoline' : undefined,
  }));
}

// ---- positionHoops (verbatim port) -----------------------------------------
function positionHoops(hoops, frame) {
  for (const hoop of hoops) {
    const f = frame - (hoop.frameOffset ?? 0);
    const spd = hoop.speed * 0.018;
    const amp = CW / 2 - (hoop.innerHalf + hoop.rimThick) - 22;
    if (hoop.pattern === 'still') {
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

// ---- one shot: returns 'make' | 'miss' | 'stuck' ---------------------------
export function simulateShot(ld, x0, releaseFrame, trace) {
  const hoops = toHoops(ld);
  const obstacles = toObstacles(ld);
  let frame = releaseFrame;
  positionHoops(hoops, frame);
  const ball = { x: x0, y: DROP_H / 2 + 15, vx: 0, vy: 0 };
  seed = (x0 * 7919 + releaseFrame * 104729) >>> 0 || 1;

  for (let n = 0; n < MAX_FRAMES; n++) {
    frame++;
    for (const h of hoops) { h.prevX = h.x; h.prevY = h.y; }
    positionHoops(hoops, frame);
    if (trace) trace.push({ f: frame, x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, hoops: hoops.map(h => [Math.round(h.x), Math.round(h.y), h.scored ? 1 : 0]) });

    for (let sub = 0; sub < SUBSTEPS; sub++) {
      const subPrevBallX = ball.x, subPrevBallY = ball.y;
      ball.vy += GRAVITY / SUBSTEPS;
      ball.x += ball.vx / SUBSTEPS;
      ball.y += ball.vy / SUBSTEPS;

      // scoring (first, before collisions)
      for (const hoop of hoops) {
        if (hoop.scored) continue;
        const th = hoop.rotation ?? 0;
        const nx = -Math.sin(th), ny = Math.cos(th);
        const tx = Math.cos(th), ty = Math.sin(th);
        let crossed = false, t = 0, hx = hoop.x, hy = hoop.y;
        if (sub === 0) {
          const relPrev = (subPrevBallX - hoop.prevX) * nx + (subPrevBallY - hoop.prevY) * ny;
          const relCurr = (ball.x - hoop.x) * nx + (ball.y - hoop.y) * ny;
          if ((relPrev < 0 && relCurr >= 0) || (relPrev > 0 && relCurr <= 0)) {
            crossed = true;
            if (Math.abs(relCurr - relPrev) > 0.001) t = -relPrev / (relCurr - relPrev);
            hx = hoop.prevX + t * (hoop.x - hoop.prevX);
            hy = hoop.prevY + t * (hoop.y - hoop.prevY);
          }
        } else {
          const relPrev = (subPrevBallX - hoop.x) * nx + (subPrevBallY - hoop.y) * ny;
          const relCurr = (ball.x - hoop.x) * nx + (ball.y - hoop.y) * ny;
          if ((relPrev < 0 && relCurr >= 0) || (relPrev > 0 && relCurr <= 0)) {
            crossed = true;
            if (Math.abs(relCurr - relPrev) > 0.001) t = -relPrev / (relCurr - relPrev);
          }
        }
        if (crossed) {
          const xc = subPrevBallX + t * (ball.x - subPrevBallX);
          const yc = subPrevBallY + t * (ball.y - subPrevBallY);
          const along = (xc - hx) * tx + (yc - hy) * ty;
          if (Math.abs(along) < hoop.innerHalf - BALL_R * 0.5) {
            hoop.scored = true;
            if (hoops.every(h => h.scored)) return 'make';
          }
        }
      }

      // rim collisions
      for (const hoop of hoops) {
        const RIM_R = hoop.rimThick / 2;
        const th = hoop.rotation ?? 0;
        const c = Math.cos(th), s = Math.sin(th);
        const off = hoop.innerHalf + hoop.rimThick / 2;
        for (const rim of [{ x: hoop.x - off * c, y: hoop.y - off * s }, { x: hoop.x + off * c, y: hoop.y + off * s }]) {
          const dx = ball.x - rim.x, dy = ball.y - rim.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = BALL_R + RIM_R;
          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist, ny = dy / dist;
            ball.x = rim.x + nx * (minDist + 0.5);
            ball.y = rim.y + ny * (minDist + 0.5);
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE;
            ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE;
            if (Math.abs(ball.vx) < 0.5) ball.vx = (rand() < 0.5 ? -1.0 : 1.0);
          }
        }
      }

      // obstacle collisions
      for (const obs of obstacles) {
        const restitution = obs.restitution ?? BOUNCE;
        const friction = obs.friction ?? 0.85;
        const odx = obs.x2 - obs.x1, ody = obs.y2 - obs.y1;
        const len2 = odx * odx + ody * ody;
        if (len2 === 0) continue;
        let t = ((ball.x - obs.x1) * odx + (ball.y - obs.y1) * ody) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = obs.x1 + t * odx, cy = obs.y1 + t * ody;
        const ex = ball.x - cx, ey = ball.y - cy;
        const dist = Math.sqrt(ex * ex + ey * ey);
        if (dist < BALL_R && dist > 0.001) {
          const nx = ex / dist, ny = ey / dist;
          ball.x = cx + nx * (BALL_R + 0.5);
          ball.y = cy + ny * (BALL_R + 0.5);
          const dot = ball.vx * nx + ball.vy * ny;
          const tvx = ball.vx - dot * nx, tvy = ball.vy - dot * ny;
          ball.vx = tvx * friction + (-dot * nx) * restitution;
          ball.vy = tvy * friction + (-dot * ny) * restitution;
        }
        const endR = obs.thick / 2;
        const minDist = BALL_R + endR;
        for (const ep of [{ x: obs.x1, y: obs.y1 }, { x: obs.x2, y: obs.y2 }]) {
          const dx = ball.x - ep.x, dy = ball.y - ep.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist && d > 0.001) {
            const nx = dx / d, ny = dy / d;
            ball.x = ep.x + nx * (minDist + 0.5);
            ball.y = ep.y + ny * (minDist + 0.5);
            const dot = ball.vx * nx + ball.vy * ny;
            const tvx = ball.vx - dot * nx, tvy = ball.vy - dot * ny;
            ball.vx = tvx * friction + (-dot * nx) * restitution;
            ball.vy = tvy * friction + (-dot * ny) * restitution;
            if (obs.type !== 'trampoline' && Math.abs(ball.vx) < 0.5) {
              const midX = (obs.x1 + obs.x2) / 2;
              ball.vx += ball.x <= midX ? -1.2 : 1.2;
            }
          }
        }
      }

      if (ball.y > CH + BALL_R * 2) return 'miss';
    }
  }
  return 'stuck';
}

// ---- level analysis --------------------------------------------------------
export function analyzeLevel(ld) {
  const xs = [];
  for (let x = X_MIN; x <= X_MAX; x += X_STEP) xs.push(x);
  const frames = [];
  for (let f = 0; f <= FRAME_SPAN; f += FRAME_STEP) frames.push(f);

  const grid = xs.map(() => new Array(frames.length).fill(0)); // 1 = make
  // A ball dropped exactly onto an obstacle endpoint bounces straight up and
  // down forever in this idealised sim (the game's rest-timeout turns it into a
  // miss). Those columns are reported separately from genuine traps.
  const endpointXs = (ld.obstacles ?? []).flatMap(o => [o.x1, o.x2]);
  let makes = 0, stuck = 0, endpointStuck = 0;
  for (let i = 0; i < xs.length; i++) {
    const onEndpoint = endpointXs.some(ex => Math.abs(ex - xs[i]) < 1);
    for (let j = 0; j < frames.length; j++) {
      const r = simulateShot(ld, xs[i], frames[j]);
      if (r === 'make') { grid[i][j] = 1; makes++; }
      else if (r === 'stuck') { grid[i][j] = 2; if (onEndpoint) endpointStuck++; else stuck++; }
    }
  }
  const total = xs.length * frames.length;

  // best x = highest success over frames
  let bestI = 0, bestCount = -1;
  for (let i = 0; i < xs.length; i++) {
    const c = grid[i].filter(v => v === 1).length;
    if (c > bestCount) { bestCount = c; bestI = i; }
  }
  const bestXRate = bestCount / frames.length;
  // longest run of consecutive successful frames at bestX
  let run = 0, maxRun = 0;
  for (let j = 0; j < frames.length; j++) { if (grid[bestI][j] === 1) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
  const timingWindow = maxRun === frames.length ? Infinity : maxRun * FRAME_STEP;
  // widest run of consecutive successful x at the best frame
  let bestJ = 0, bestJCount = -1;
  for (let j = 0; j < frames.length; j++) {
    let c = 0; for (let i = 0; i < xs.length; i++) if (grid[i][j] === 1) c++;
    if (c > bestJCount) { bestJCount = c; bestJ = j; }
  }
  run = 0; maxRun = 0;
  for (let i = 0; i < xs.length; i++) { if (grid[i][bestJ] === 1) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
  const xWindow = maxRun * X_STEP;

  return {
    solvable: makes > 0,
    rate: makes / total,
    bestX: xs[bestI], bestXRate,
    timingWindow, xWindow,
    stuck, stuckRate: stuck / total,
    endpointStuck, endpointStuckRate: endpointStuck / total,
    grid, xs, frames,
  };
}

// A single "difficulty" number for sorting/curve checks: higher = harder.
// Blends raw luck (rate) with skill windows (timing + placement).
export function difficultyScore(a) {
  if (!a.solvable) return Infinity;
  const timing = a.timingWindow === Infinity ? 1 : Math.min(1, a.timingWindow / 120);
  const place = Math.min(1, a.xWindow / 120);
  return Math.round(10 * (-Math.log10(Math.max(a.rate, 1e-4)) + (1 - timing) * 2 + (1 - place) * 2)) / 10;
}

function heatmap(a) {
  // rows = x (top = left edge), cols = release frame
  const lines = [];
  for (let i = 0; i < a.xs.length; i += 2) {
    let row = String(a.xs[i]).padStart(3) + ' ';
    for (let j = 0; j < a.frames.length; j += 2) row += a.grid[i][j] === 1 ? '#' : a.grid[i][j] === 2 ? '!' : '.';
    lines.push(row);
  }
  return lines.join('\n');
}

// ---- hardcoded levels 1–9 (setupHoops / setupObstacles at shot 0) ----------
function builtinLevel(level) {
  const ch = CH;
  const h = (baseX, baseY, pattern, speed, innerHalf = 50, ampX, ampY, frameOffset) =>
    ({ baseX, baseY, pattern, speed, innerHalf, rimThick: 10, ampX, ampY, frameOffset, rotation: 0 });
  const cfg = {
    1: { p: 'still', s: 0 }, 2: { p: 'linear', s: 1.5 }, 3: { p: 'rectangle', s: 1.5 },
    4: { p: 'circle', s: 1.8 }, 6: { p: 'figure8', s: 2.0 },
  };
  let hoops, obstacles = [];
  if (level === 1) hoops = [h(CW / 2, DROP_H + 80, 'still', 0)];
  else if (level === 5) hoops = [h(CW / 2, ch - 235, 'still', 0), h(CW / 2, ch - 120, 'still', 0)];
  else if (level === 7) hoops = [h(CW / 2, ch - 260, 'linear', 1.0), h(CW / 2, ch - 120, 'linear', 2.0)];
  else if (level === 8) {
    const mid = DROP_H + (ch - DROP_H) / 2;
    hoops = [h(CW / 2, mid, 'rectangle', 2.0, 50, 125, 230), h(CW / 2, mid, 'rectangle', 2.0, 50, 125, 230, 30)];
  } else if (level === 9) {
    hoops = [h(CW * 0.84, ch * 0.56, 'linear_v', 0.5, 50, undefined, ch * 0.27)];
    obstacles = [
      { x1: CW / 2, y1: DROP_H + 40, x2: CW - 5, y2: ch * 0.25, thick: 5, restitution: 0.80, friction: 0.95 },
      { x1: 20, y1: ch * 0.78, x2: CW * 0.42, y2: ch * 0.78 + 8, thick: 10, type: 'trampoline', restitution: 0.89, friction: 1.0 },
    ];
  } else hoops = [h(CW / 2, ch - 170, cfg[level].p, cfg[level].s, 50)];
  return { name: `Built-in ${level}`, makesNeeded: 3, hoops, obstacles };
}

// ---- CLI -------------------------------------------------------------------
function fmtRow(label, ld, a) {
  const t = a.timingWindow === Infinity ? '  ∞ ' : String(a.timingWindow).padStart(4);
  const flags = [];
  if (!a.solvable) flags.push('UNSOLVABLE');
  if (a.stuck > 0) flags.push(`STUCK ${(a.stuckRate * 100).toFixed(1)}%`);
  if (a.endpointStuck > 0) flags.push(`(endpoint-rest ${(a.endpointStuckRate * 100).toFixed(1)}%)`);
  return `${String(label).padStart(4)}  ${(a.rate * 100).toFixed(1).padStart(5)}%  ` +
    `x=${String(a.bestX).padStart(3)} ${(a.bestXRate * 100).toFixed(0).padStart(3)}%  ` +
    `timing ${t}f  xwin ${String(a.xWindow).padStart(3)}px  ` +
    `diff ${String(difficultyScore(a)).padStart(4)}  ` +
    `${String(ld.makesNeeded)}mk ${String(ld.hoops.length)}h ${String((ld.obstacles ?? []).length)}o  ` +
    `${(ld.name ?? '').slice(0, 28).padEnd(28)} ${flags.join(' ')}`;
}

function main() {
  const args = process.argv.slice(2);
  console.log(' lvl   rate   bestX rate  timing      xwin       diff   layout  name');
  if (args.includes('--builtin')) {
    for (let l = 1; l <= 9; l++) {
      const ld = builtinLevel(l);
      console.log(fmtRow(l, ld, analyzeLevel(ld)));
    }
    return;
  }
  if (args[0] === '--trace') {
    const ld = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const trace = [];
    const result = simulateShot(ld, Number(args[2]), Number(args[3]), trace);
    console.log(`result: ${result}`);
    for (const t of trace) if (t.f % 4 === 0 || t === trace[trace.length - 1])
      console.log(`f${String(t.f).padStart(4)}  ball (${t.x.toFixed(0).padStart(4)},${t.y.toFixed(0).padStart(4)})  v (${t.vx.toFixed(1).padStart(5)},${t.vy.toFixed(1).padStart(5)})  hoops ${JSON.stringify(t.hoops)}`);
    return;
  }
  const fileArgs = args.filter(a => a.endsWith('.json'));
  if (fileArgs.length) {
    for (const f of fileArgs) {
      const ld = JSON.parse(fs.readFileSync(f, 'utf8'));
      const a = analyzeLevel(ld);
      console.log(fmtRow(path.basename(f, '.json'), ld, a));
      console.log('\nheatmap: rows = drop x, columns = release frame, # = make, ! = stuck\n');
      console.log(heatmap(a));
    }
    return;
  }
  const only = new Set(args.map(Number).filter(n => !Number.isNaN(n)));
  const manifest = JSON.parse(fs.readFileSync(path.join(CAMPAIGN_DIR, 'manifest.json'), 'utf8'));
  let problems = 0;
  manifest.levels.forEach((file, i) => {
    const level = 10 + i;
    if (only.size && !only.has(level)) return;
    const ld = JSON.parse(fs.readFileSync(path.join(CAMPAIGN_DIR, file), 'utf8'));
    const a = analyzeLevel(ld);
    if (!a.solvable || a.stuck > 0) problems++;
    console.log(fmtRow(level, ld, a));
  });
  if (problems) { console.error(`\n${problems} level(s) flagged`); process.exitCode = 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
