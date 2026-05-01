# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Fall Ball is a mobile-first basketball arcade game. Players drag and release a ball to shoot through moving hoops across progressively harder levels. Scores go to a global Firebase leaderboard. No game library — custom physics engine on HTML5 Canvas.

**Live deployment:** Railway (auto-deploys from `main`).
**Dev server:** always run from `/Users/noahjacobs/Desktop/fall-ball`, never from a worktree.

## Commands

```bash
npm run dev      # local dev server (localhost:5173, increments if port taken)
npm run build    # tsc + vite build (run this to check for type errors)
npm run preview  # preview production build
```

No test runner configured.

## Tech Stack

React 18 · TypeScript · Vite · HTML5 Canvas · Firebase Realtime Database · Web Audio API · `Press Start 2P` font · Railway/Docker

## Read These First

Each major system has its own doc. **Read the relevant doc before touching that system.**

| System | Doc | Key Files |
|---|---|---|
| Game engine, physics, scoring | `docs/GAME_ENGINE.md` | `src/components/GameScreen.tsx` |
| JSON level format, loading, deployment | `docs/LEVEL_SYSTEM.md` | `src/levelLoader.ts`, `src/types/level.ts`, `public/levels/campaign/` |
| Level Editor, PIN gate, test mode | `docs/LEVEL_EDITOR.md` | `src/components/LevelEditorScreen.tsx`, `LevelCreatorScreen.tsx`, `PinEntryModal.tsx` |
| Firebase leaderboard | `docs/FIREBASE.md` | `src/firebase.ts` |
| All screens and navigation | `docs/SCREENS.md` | `src/App.tsx` |
| Ball skins, adding new skins | `docs/BALL_SKINS.md` | `src/components/BallSkinsScreen.tsx` |

## Critical Rules

- **Never push to GitHub without being asked.** The user pushes manually or asks explicitly.
- **Never edit files in a worktree** — changes must be in `/Users/noahjacobs/Desktop/fall-ball/src/`.
- **Run `npm run build` before committing** to catch TypeScript errors.
- **Scoring check must stay first** in each substep loop in `GameScreen.tsx` — moving it after rim collision breaks scoring.
- **gameOverFired guard** — any callback fired from the RAF loop must be wrapped with a one-shot boolean flag to prevent duplicate Firebase submissions.

## Quick Reference

**Adding a campaign level (no code):**
1. Build in editor → SAVE → move JSON to `public/levels/campaign/`
2. Add filename to `manifest.json`
3. Commit and push

**Adding a ball skin:**
1. Drop PNG in `public/skins/`
2. Add to `BallSkin` type and `SKINS` array in `BallSkinsScreen.tsx`

**Level routing:**
- Levels 1–9 → `setupHoops()` / `setupObstacles()` in `GameScreen.tsx` (hardcoded)
- Levels 10+ → loaded from `campaignLevels[level - 10]` (JSON)
