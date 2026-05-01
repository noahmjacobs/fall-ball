# Firebase — Leaderboard & User Levels

Firebase Realtime Database stores all-time high scores. There is no authentication — players identify themselves by name only.

## File

`src/firebase.ts`

## Database Structure

```
fallball/
  leaderboard/
    alltime/
      [player_key]/
        name: "Noah"
        score: 42
        level: 7
        timestamp: 1714000000000
```

The `player_key` is derived deterministically from the player's name:
```typescript
name.toLowerCase().replace(/[^a-z0-9]/g, '_')
```

Examples: `"Noah"` → `noah`, `"Noah J"` → `noah_j`

This means each player gets **exactly one entry** — no duplicates, no matter how many times they play.

## submitScore()

```typescript
submitScore(name: string, score: number, level: number): Promise<void>
```

1. Derives the key from the player's name
2. Reads the existing entry from Firebase
3. Only writes if the new score is **higher** than the stored score (or no entry exists)

This prevents accidental score regression and reduces unnecessary writes.

**Important:** `submitScore` is only called from `handleGameOver` and `handleGameWon` in `App.tsx`, and only when `playerName` is set. The call is wrapped in a `try/catch` so a Firebase error never crashes the game.

### Duplicate Submission Guard

The RAF loop fires continuously. Without a guard, `onGameOver` could be called multiple times before React unmounts `GameScreen`. `GameScreen` uses a `gameOverFired` / `gameWonFired` boolean in `stateRef` to ensure callbacks fire exactly once:

```typescript
if (!s.gameOverFired) {
  s.gameOverFired = true;
  onGameOver(s.score, s.level);
}
```

## subscribeLeaderboard()

```typescript
subscribeLeaderboard(callback: (entries: LeaderboardEntry[]) => void): () => void
```

Returns an unsubscribe function (call on component unmount to stop listening).

The query fetches up to **1000 entries** ordered by score:

```typescript
query(ref(db, 'fallball/leaderboard/alltime'), orderByChild('score'), limitToLast(1000))
```

The callback receives entries sorted **highest score first** with no cap — every player who has ever submitted a score appears on the leaderboard.

Client-side deduplication (by name, case-insensitive) handles any legacy push-key entries that may exist from an older schema.

## LeaderboardEntry Type

```typescript
interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  timestamp: number;
}
```

## Connection to the Rest of the App

```
Player finishes game
  └─ GameScreen fires onGameOver(score, level)  [guarded by gameOverFired flag]
        └─ App.tsx handleGameOver()
              ├─ updates personalBest in state + localStorage
              ├─ calls submitScore(playerName, score, level)  [only if playerName set]
              └─ navigates to 'gameover' screen

LeaderboardScreen mounts
  └─ subscribeLeaderboard(callback)
        └─ Firebase pushes live updates
              └─ callback updates entries state → re-renders list
```

## User Levels

See `docs/COMMUNITY_LEVELS.md` for the full user levels API and database structure.

**DB paths:**
- `fallball/user_levels/[creatorKey]/[levelId]` — per-player storage
- `fallball/community_feed/[levelId]` — denormalized for fast community queries

**Key functions:**
- `saveUserLevel(playerName, data, existingId?)` → returns level ID
- `getUserLevels(playerName)` → `UserLevel[]` newest first
- `deleteUserLevel(playerName, levelId)` → removes from both paths
- `subscribeCommunityLevels(callback)` → live feed, newest first, up to 200

## Config

The Firebase config (API key, database URL, etc.) is hardcoded in `firebase.ts`. This is safe for Firebase Realtime Database — the API key is a project identifier, not a secret. Security is enforced by Firebase Database Rules, not by hiding the key.
