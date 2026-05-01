# Community Levels System

This document covers the community level creation, storage, and playback system added in `feature/community-levels`.

## Overview

Players can design custom levels using the same editor as the admin, save them to Firebase, and share them with everyone. No login is required — identity is name-based (same key derivation as the leaderboard).

## Firebase Structure

```
fallball/
  user_levels/
    [creatorKey]/        ← e.g. "noah_jacobs"
      [levelId]/         ← Firebase push() key
        id, name, makesNeeded, hoops[], obstacles[]
        creatorName, creatorKey
        createdAt, updatedAt
  community_feed/
    [levelId]/           ← denormalized copy for fast community queries
      (same fields as above)
```

Writing to both paths keeps per-user queries (`user_levels/[key]`) and the community feed (`community_feed`) fast without cross-user scans. Deletes remove from both.

**Limits:** 10 levels per player (enforced in the UI; `MAX_USER_LEVELS = 10` exported from `firebase.ts`).

## Firebase API (`src/firebase.ts`)

| Function | Description |
|---|---|
| `saveUserLevel(playerName, data, existingId?)` | Create or update a level. Returns the level ID. On update preserves `createdAt`. |
| `getUserLevels(playerName)` | Fetch all levels for a player, newest first. |
| `deleteUserLevel(playerName, levelId)` | Remove from both `user_levels` and `community_feed`. |
| `subscribeCommunityLevels(callback)` | Live subscription, newest first, up to 200 levels. Returns unsubscribe fn. |

## Screens

### LevelCreatorScreen (`src/components/LevelCreatorScreen.tsx`)
Hub with three main buttons:
- **COMMUNITY** — browse all community levels
- **CREATE LEVEL** — open editor in user mode (requires name)
- **MY LEVELS** — manage own levels (requires name)
- **ADMIN** (hidden, bottom-right) — PIN entry → admin editor

Props: `playerName, onAdminAccess, onCreateLevel, onCommunityLevels, onMyLevels, onBack`

### CommunityLevelsScreen (`src/components/CommunityLevelsScreen.tsx`)
Horizontally scrollable card carousel (scroll-snap). Each card shows level name, creator, date, hoop count, makes count, and a ▶ PLAY button.

Props: `onPlay(level: UserLevel), onBack`

### MyLevelsScreen (`src/components/MyLevelsScreen.tsx`)
Vertical list of the current player's levels with level count progress bar (x / 10). Each row has EDIT and DEL buttons; DEL shows inline confirmation before deleting.

Props: `playerName, onEdit(level: UserLevel), onBack`

## Level Editor Modes (`src/components/LevelEditorScreen.tsx`)

The editor now accepts two additional props:

| Prop | Type | Description |
|---|---|---|
| `mode` | `'admin' \| 'user'` | Defaults to `'admin'` |
| `onSaveToCloud` | `(data: LevelData) => Promise<void>` | Only used in user mode |

**User mode:** The SAVE ▾ dropdown is replaced with a single `☁ SAVE` button. States: idle → saving (`...`) → saved (`✓ SAVED`) / error (`✗ ERR`). The OPEN FILE option is hidden.

**Admin mode:** Unchanged — SAVE ▾ dropdown with JSON download and Open File.

Any improvements to the shared editor (new patterns, properties, canvas rendering) automatically apply to both modes.

## App.tsx State

New state variables:

| Variable | Type | Purpose |
|---|---|---|
| `editorMode` | `'admin' \| 'user'` | Passed to `LevelEditorScreen` |
| `editorBackDest` | `Screen` | Where the editor's ← BACK goes |
| `editingUserLevelId` | `string \| null` | Existing Firebase ID for updates; `null` = new level |
| `testLevelReturnScreen` | `Screen` | Where game EXIT goes after testing/playing a level |

### Flow: Creating a New Level
1. User opens Level Creator hub → clicks CREATE LEVEL
2. `App` sets `editorMode='user'`, `editingUserLevelId=null`, `editorBackDest='levelcreator'`
3. Editor opens; user hits ☁ SAVE → `handleSaveToCloud(data)` → `saveUserLevel()` → stores returned ID in `editingUserLevelId`
4. Subsequent saves call `saveUserLevel(name, data, existingId)` — update, not create

### Flow: Editing an Existing Level
1. My Levels screen → EDIT → `handleEditUserLevel(level)`
2. `App` sets `editorDraft` to level data, `editingUserLevelId` to level's ID, `editorBackDest='mylevels'`
3. Editor opens pre-populated; saves go to same Firebase record

### Flow: Playing a Community Level
1. Community Levels → ▶ PLAY → `handlePlayCommunityLevel(level)`
2. `App` sets `testLevelData`, `testLevelReturnScreen='communitylevels'`, navigates to `game`
3. Game EXIT returns to `communitylevels` (not `leveleditor`)

## Types (`src/types/level.ts`)

```typescript
export interface UserLevel extends LevelData {
  id: string;
  creatorName: string;
  creatorKey: string;
  createdAt: number;   // ms timestamp
  updatedAt: number;
}
```

`creatorKey` is the sanitised name: `name.toLowerCase().replace(/[^a-z0-9]/g, '_')` — same as leaderboard.
