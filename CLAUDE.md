# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fall Ball is a mobile-first basketball arcade game built with React + TypeScript + Vite. Players drag and release a ball to shoot through moving hoops across progressively harder levels. Scores are submitted to a global Firebase leaderboard. The game runs entirely on an HTML5 Canvas with a custom physics engine — no game library.

**Live deployment:** Railway (auto-deploys from `main`). Dev server always runs from the **main repo** at `/Users/noahjacobs/Desktop/fall-ball`, never from a worktree.

## Commands

```bash
npm run dev      # local dev server (usually localhost:5173, increments if port is taken)
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

## Screen Flow

```
start → modeselect → campaign → game → gameover
                   → arcade   → levelselect → game → gameover
                   → levelcreator → (PIN 8161) → leveleditor → game (test) → leveleditor
start → leaderboard
start → skins
```

`App.tsx` is a pure state machine managing which screen is active. All screens are conditionally rendered; the `screen` state string drives everything.

## Architecture

### App.tsx — Screen Router

Manages: active screen, player name (localStorage), personal best (localStorage), ball skin (localStorage), arcade mode, arcade start level, test level data, editor draft, campaign levels array, and win state.

**Critical flows:**
- `loadCampaignLevels()` is called once on mount and stored in `campaignLevels` state — passed to both `GameScreen` (for play) and `LevelSelectScreen` (for arcade button count).
- `testLevelData` is set when the editor hits TEST. `arcadeMode` is forced `true` when a test level is active so lives don't apply.
- `editorDraft` saves the editor state when going to test mode so the editor restores exactly where you left off on return.
- `handleGameOver` sets `gameWon = false`; `handleGameWon` sets `gameWon = true`. `GameOverScreen` receives `didWin={gameWon}` to render the win variant.

**Git rule:** Always ask before `git push` unless the user explicitly asks you to push.

### GameScreen.tsx — The Entire Game

The most critical file. Everything runs inside a single `requestAnimationFrame` loop: `update(ctx)` then `render(ctx)`. All mutable game state lives in `stateRef` (a `useRef`) to avoid React re-renders mid-frame.

**Key constants:**
- `CW = 390` — fixed canvas width (matches iPhone viewport)
- `BALL_R = 14` — ball radius in pixels
- `DROP_H = 90` — height of the drop zone at the top where the ball is held
- `GRAVITY = 0.38`, `BOUNCE = 0.42`
- `SUBSTEPS = 3` — physics substeps per frame for collision accuracy

**Props:**
- `testLevel?: LevelData` — when set, loads a single editor-built level (no lives deducted, no score submission)
- `campaignLevels?: LevelData[]` — JSON-loaded levels for campaign levels 10+
- `onGameWon?` — fired when the player beats the last campaign level

**stateRef fields to know:**
- `gameOverFired` / `gameWonFired` / `wonPending` — prevent double-firing callbacks from the RAF loop
- `currentMakesNeeded` — makes required to advance the current level (set from JSON for levels 10+, defaults to 3 for levels 1–9)

**Game loop phases:** `aiming → dropping → scored | missed → (levelup?) → aiming`

**Scoring (CCD — Continuous Collision Detection):**
Runs **before** rim/obstacle collisions each substep — rim collision would otherwise push the ball back across the hoop plane, missing the crossing. On `sub === 0`, relative-motion CCD is used (both ball and hoop moved since last frame — critical for fast hoops). On `sub > 0`, standard CCD is used.

**Hoop movement patterns** (`HoopPattern`): `still | linear | linear_v | rectangle | circle | circle_cw | circle_ccw | figure8`. Computed in `positionHoops()` using `Math.sin/cos` against `s.frame`. Hoops store `prevX/prevY` for relative-motion CCD.

**Level routing:**
- Levels 1–9: hardcoded in `setupHoops()` / `setupObstacles()`
- Levels 10+: loaded from `campaignLevels[level - 10]` via `levelDataToHoops()` / `levelDataToObstacles()`
- Win condition: when leveling up would take the player to `level >= 10 + campaignLevels.length`, `wonPending` is set → `onGameWon` fires after the level-up animation

**Level progression:**
- 3 makes (or `makesNeeded` from JSON) = level complete
- Level bonus = current level number added to score
- Levels 1 and 5 have per-shot hoop layouts (rebuilt each shot); all others reset `scored` flags only

**Anti-stick nudge:** After any rim or metal endpoint collision where `|vx| < 0.5`, add a random lateral nudge. Prevents infinite vertical bouncing.

### JSON Level System

Campaign levels 10+ are defined as JSON files in `/public/levels/campaign/`.

**`manifest.json`** — lists filenames in play order:
```json
{ "levels": ["Campaign_Level_10.json", "Campaign_Level_11.json"] }
```
The order in this array is the order levels play. First entry = level 10, second = level 11, etc.

**Level JSON structure:**
```json
{
  "name": "Campaign Level 10",
  "makesNeeded": 3,
  "hoops": [{
    "baseX": 167, "baseY": 432,
    "pattern": "linear",
    "speed": 2, "innerHalf": 44, "rimThick": 10,
    "ampX": 120, "ampY": 60, "frameOffset": 0
  }],
  "obstacles": [{
    "x1": 80, "y1": 221, "x2": 237, "y2": 222,
    "type": "metal", "thick": 5,
    "restitution": 0.8, "friction": 0.95
  }]
}
```

**`levelLoader.ts`** fetches `manifest.json` then fetches each file in parallel. Returns `LevelData[]` (empty array on any failure — graceful degradation).

**Adding a new level (no code required):**
1. Build the level in the Level Editor and hit SAVE (downloads JSON)
2. Move the JSON into `/public/levels/campaign/`
3. Add the filename to `manifest.json`
4. Commit and push — Campaign and Arcade both update automatically

### Level Editor (Admin Only)

Access: Mode Select → Level Creator → ADMIN button (bottom of screen) → PIN 8161 → Level Editor

**`LevelCreatorScreen.tsx`** — public "Coming Soon" screen with a hidden ADMIN button at the bottom.

**`PinEntryModal.tsx`** — 4-digit numpad overlay, shake animation on wrong PIN.

**`LevelEditorScreen.tsx`** — full mobile canvas editor:
- Drag hoops and obstacles onto the canvas
- Tap an element to select it; properties panel appears in bottom drawer
- TEST button → plays the level in GameScreen with `testLevel` prop (no lives, no score)
- SAVE button → downloads the level as a JSON file
- `initialData` prop restores editor state when returning from a test session

### firebase.ts — Leaderboard

`submitScore()` uses a **deterministic key** (`name.toLowerCase().replace(/[^a-z0-9]/g, '_')`) so each player has exactly one entry. It reads first and only writes if the new score beats the stored one. `subscribeLeaderboard()` deduplicates by name client-side.

### BallSkinsScreen.tsx — Ball Skins

`drawBallSkin(ctx, skin, cx, cy, r)` is called from both `GameScreen` and `StartScreen`. PNG skins use a lazy-load cache (`getSkinImage()`), clip to a circle, and scale to fill. Add new skins by dropping a PNG into `/public/skins/` and registering it in `BallSkinsScreen.tsx`.

## Important Patterns

- **Never edit worktree files** — changes must be in `/Users/noahjacobs/Desktop/fall-ball/src/`.
- **Scoring before collisions:** The CCD check must remain first in each substep loop body. Moving it after rim collision breaks scoring.
- **Anti-stick pattern:** After any surface collision, check `Math.abs(s.ball.vx) < 0.5` and nudge. Used on rim circles and obstacle endpoints.
- **gameOverFired guard:** Any callback fired from the RAF loop must be wrapped with a `if (!s.flagFired) { s.flagFired = true; callback(); }` guard to prevent duplicate Firebase submissions.
