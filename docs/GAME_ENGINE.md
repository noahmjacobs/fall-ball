# Game Engine — GameScreen.tsx

The entire game runs inside one React component (`GameScreen.tsx`). There is no game library — physics, rendering, input, and state are all hand-written.

## How the Loop Works

On mount, a single `requestAnimationFrame` loop starts and never stops until the component unmounts:

```
requestAnimationFrame → update(ctx) → render(ctx) → repeat
```

All mutable game state lives in `stateRef` (a `useRef`) so it can be read and written inside the RAF loop without triggering React re-renders. The canvas is drawn directly via the 2D context.

## stateRef — What's In It

| Field | Type | Purpose |
|---|---|---|
| `phase` | `'aiming' \| 'dropping' \| 'scored' \| 'missed' \| 'levelup'` | Controls what the update loop does each frame |
| `ball` | `{x, y, vx, vy}` | Ball position and velocity |
| `prevBall` | `{x, y}` | Ball position last frame (for CCD scoring) |
| `hoops` | `HoopInstance[]` | All hoops currently on screen |
| `obstacles` | `Obstacle[]` | Metal bars and trampolines |
| `score` | `number` | Current score |
| `level` | `number` | Current level (1-based) |
| `lives` | `number` | Lives remaining (campaign only) |
| `makesThisLevel` | `number` | Baskets made so far this level |
| `currentMakesNeeded` | `number` | Baskets required to advance (from JSON for levels 10+) |
| `gameOverFired` | `boolean` | Prevents duplicate `onGameOver` calls |
| `gameWonFired` | `boolean` | Prevents duplicate `onGameWon` calls |
| `wonPending` | `boolean` | Set when last JSON level is beaten; triggers win after animation |
| `frame` | `number` | Increments every frame, drives hoop movement animations |

## Phase State Machine

```
aiming ──(drag released)──► dropping
                                │
               ┌────────────────┴────────────────┐
               │                                  │
            scored                             missed
               │                                  │
        (makesThisLevel++)             (lives-- unless arcade)
               │                                  │
        enough makes?                          lives <= 0?
          yes ──► levelup                      yes ──► onGameOver
          no  ──► aiming                       no  ──► aiming
               │
          levelup ──► (animation) ──► aiming
                               └── more JSON levels? no ──► onGameWon
```

## Physics

**Constants:** `BALL_R = 14`, `GRAVITY = 0.38`, `BOUNCE = 0.42`, `SUBSTEPS = 3`

Each frame the ball runs through 3 physics substeps for accuracy. Within each substep:
1. **Scoring check first** — must run before rim/obstacle collisions (rim bounce can push ball back across the hoop plane and cause a false miss)
2. Rim collision (circle vs circle)
3. Obstacle collision (circle vs line segment + endpoint circles)
4. Floor/ceiling check (ball exits bottom → miss)

**Anti-stick nudge:** After any rim or obstacle endpoint collision, if `|ball.vx| < 0.5`, a random lateral nudge is added so the ball never balances vertically on a surface.

## Scoring — CCD (Continuous Collision Detection)

The ball scores when it crosses the hoop's plane. Because both the ball and hoop move each frame, a naive check (`if ball.y > hoop.y`) can miss fast-moving hoops. CCD handles this correctly:

**sub === 0 (first substep — relative motion CCD):**
- Both the ball and hoop moved since last frame
- Compute the ball's position relative to the hoop at start and end of frame
- If the relative position crosses zero, the ball passed through the plane

**sub > 0 (later substeps — standard CCD):**
- Hoop position is fixed within a frame; only ball moves
- Standard parametric crossing check

**Rotated hoop scoring** (after hoop rotation feature):
- Instead of checking `ball.y - hoop.y`, project onto the hoop's normal vector: `dot(ball - hoopCenter, normal)`
- Normal = `(-sin θ, cos θ)` where θ is the hoop's rotation in radians
- At crossing, check position along the hoop tangent `(cos θ, sin θ)` — must be within `innerHalf - BALL_R * 0.5`

## Hoop Movement Patterns

Computed in `positionHoops()` using `s.frame` as a time counter. Each hoop stores `prevX/prevY` (saved before position update) for relative-motion CCD.

| Pattern | Motion |
|---|---|
| `still` | No movement |
| `linear` | Side to side (sin wave on X) |
| `linear_v` | Up and down (sin wave on Y) |
| `rectangle` | Rectangular path |
| `circle` / `circle_cw` / `circle_ccw` | Circular/elliptical orbit |
| `figure8` | Figure-eight (Lissajous) |

`ampX` and `ampY` control movement range. `frameOffset` shifts the phase so two hoops on the same pattern can be offset from each other (used on level 8).

## Level Routing

```
level 1–9  →  setupHoops() + setupObstacles()  (hardcoded)
level 10+  →  levelDataToHoops() + levelDataToObstacles()  (from JSON)
```

When loading JSON levels, `levelDataToHoops()` converts degrees → radians for rotation. `currentMakesNeeded` is pulled from the JSON's `makesNeeded` field.

**Win condition:** when leveling up would move past the last JSON level (`level - 10 >= campaignLevels.length`), `wonPending = true`. After the level-up animation finishes, `onGameWon` fires.

## Props

| Prop | Purpose |
|---|---|
| `onGameOver(score, level)` | Called when lives run out |
| `onGameWon(score, level)` | Called when last JSON level is beaten |
| `testLevel?: LevelData` | When set, loads a single editor-built level (arcade mode forced, no score saved) |
| `campaignLevels?: LevelData[]` | JSON levels array loaded in App.tsx, used for levels 10+ |
| `arcadeMode` | Infinite lives, no leaderboard submission |
| `startLevel` | Which level to begin at (arcade mode) |
| `ballSkin` | Which skin to draw the ball with |

## Drawing

`drawHoop(ctx, x, y, innerHalf, rimThick, rotation)` — uses `ctx.save/translate/rotate/restore` so it can draw a hoop at any angle. The net, rims, and opening line are all drawn relative to origin (0,0) inside the saved context.

`drawBallSkin(ctx, skin, cx, cy, r)` — imported from `BallSkinsScreen.tsx`, handles both canvas-drawn and PNG skins.
