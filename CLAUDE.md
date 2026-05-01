# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fall Ball is a mobile-first basketball arcade game built with React + TypeScript + Vite. Players drag and release a ball to shoot through moving hoops across 10 progressively harder levels. Scores are submitted to a global Firebase leaderboard. The game runs entirely on an HTML5 Canvas with a custom physics engine — no game library.

**Live deployment:** Railway (auto-deploys from `main`). Dev server always runs from the **main repo** at `/Users/noahjacobs/Desktop/fall-ball`, never from a worktree.

## Commands

```bash
npm run dev      # local dev server at localhost:5173
npm run build    # tsc + vite build
npm run preview  # preview production build
```

No test runner is configured.

## Tech Stack

- React 18 + TypeScript + Vite
- HTML5 Canvas (all game rendering)
- Firebase Realtime Database (leaderboard)
- Web Audio API (synthesized sound effects — no audio files)
- `Press Start 2P` Google Font (pixel aesthetic)
- Deployed on Railway via Docker

## Architecture

### App.tsx — Screen Router
Pure state machine. Manages which screen is visible (`start | game | gameover | leaderboard | levelselect | skins`), player name (persisted to `localStorage`), personal best, arcade mode, and ball skin. Calls `submitScore()` in `handleGameOver` — guarded by `gameOverFired` flag in GameScreen to prevent duplicate submissions from the RAF loop firing multiple times before unmount.

### GameScreen.tsx — The Entire Game
The most critical file. Everything runs inside a single `requestAnimationFrame` loop: `update(ctx)` then `render(ctx)`. All mutable game state lives in `stateRef` (a `useRef`) to avoid React re-renders mid-frame.

**Key constants:**
- `CW = 390` — fixed canvas width (matches iPhone viewport)
- `BALL_R = 14` — ball radius in pixels
- `DROP_H = 90` — height of the "drop zone" at the top where the ball is held
- `GRAVITY = 0.38`, `BOUNCE = 0.42`
- `SUBSTEPS = 3` — physics substeps per frame for collision accuracy

**Game loop phases:** `aiming → dropping → scored | missed → (levelup?) → aiming`

**Scoring (CCD — Continuous Collision Detection):**
Scoring runs **before** rim/obstacle collisions each substep, or rim collision would push the ball back across the hoop plane and miss the crossing. On `sub === 0`, relative motion CCD is used (both ball and hoop moved since last frame — critical for fast hoops on level 8 that can skip past the ball between frames). On `sub > 0`, standard CCD is used.

**Hoop movement patterns** (`HoopPattern`): `still | linear | linear_v | rectangle | circle | circle_cw | circle_ccw | figure8`. Each pattern is computed in `positionHoops()` using `Math.sin/cos` against `s.frame`. Hoops store `prevX/prevY` (saved before `positionHoops()` each frame) for the relative-motion CCD.

**Obstacles** (level 9 only): a metal bar + trampoline. Segment collision with endpoint circle collisions to prevent ball sticking at corners. Trampolines use higher `restitution`.

**Anti-stick nudges:** After any rim or metal endpoint collision where `|vx| < 0.5`, the ball gets a random lateral nudge so it never balances perfectly on a surface.

**Level progression:** 3 makes = level complete. Level bonus = current level number added to score. Levels 1 and 5 have per-shot hoop layouts (rebuilt each shot). All other levels reuse the same hoop but reset `scored` flags.

**Level highlights:**
- L1: Tutorial — three fixed shots at different positions
- L5: Multi-hoop shots (score through multiple hoops per shot)
- L7: Two hoops at different speeds
- L8: Two rectangle-pattern hoops offset by 30 frames (trailing effect)
- L9: Vertically moving hoop + metal bar + trampoline obstacle
- L10: Tiny 24px still hoop in center

### firebase.ts — Leaderboard
`submitScore()` uses a **deterministic key** (`name.toLowerCase().replace(/[^a-z0-9]/g, '_')`) so each player has exactly one entry. It reads first and only writes if the new score beats the stored one. `subscribeLeaderboard()` deduplicates by name client-side (older push-ID entries from a previous schema may still exist in the DB but won't cause visual duplicates).

### BallSkinsScreen.tsx — Ball Skins
`drawBallSkin(ctx, skin, cx, cy, r)` is called from both `GameScreen` and `StartScreen`. PNG skins use a lazy-load cache (`getSkinImage()`), clip to a circle, and scale to fill. Current skins: `basketball` (drawn with canvas), `paperball` (PNG at `/public/skins/paperball.png`).

## Planned Features (Future)

- **Daily level** — a special level that rotates each day, same for all players
- **Hacks / achievements** — unlockable modifiers or cosmetic rewards players can earn

## Important Patterns

- **Never edit worktree files** — the dev server runs from the main repo. Worktrees are created by Claude Code for isolation but changes must be in `/Users/noahjacobs/Desktop/fall-ball/src/`.
- **Ask before pushing to GitHub.** The user wants explicit confirmation before any `git push`.
- **Anti-stick pattern:** After any surface collision, check `Math.abs(s.ball.vx) < 0.5` and nudge the ball away from the surface center. This pattern is used on both rim circles and obstacle endpoints.
- **Scoring before collisions:** The scoring CCD check must remain the first thing in each substep loop body. Moving it after rim collision breaks scoring.
