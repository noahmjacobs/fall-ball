# Screens & Navigation

`App.tsx` is the single source of truth for which screen is visible. It's a pure state machine — one `screen` string variable drives everything.

## Screen Map

```
'start'
  ├─► 'modeselect'
  │     ├─► 'game'         (Campaign)
  │     ├─► 'levelselect'
  │     │     └─► 'game'   (Arcade)
  │     └─► 'levelcreator'
  │           ├─► 'communitylevels'
  │           │     └─► 'game'  (Play community level)
  │           ├─► 'mylevels'
  │           │     └─► 'leveleditor' (Edit existing)
  │           └─► 'leveleditor' (Create new / Admin)
  │                 └─► 'game'  (Test mode)
  ├─► 'leaderboard'
  └─► 'skins'

'game' ──► 'gameover'
'game' ──► 'gameover' (win variant)
```

## App.tsx State

| State | Purpose |
|---|---|
| `screen` | Which screen is active |
| `playerName` | Set once at name entry, persisted to `localStorage` |
| `personalBest` | Highest score ever, persisted to `localStorage` |
| `ballSkin` | Selected skin, persisted to `localStorage` |
| `arcadeMode` | `true` when playing from Arcade level select |
| `arcadeStartLevel` | Which level arcade mode starts at |
| `testLevelData` | Set when editor hits TEST or community level PLAY; cleared when test game exits |
| `editorDraft` | Saves editor state so it can be restored after a test |
| `campaignLevels` | `LevelData[]` loaded from JSON on mount via `loadCampaignLevels()` |
| `gameWon` | `true` when the last JSON level was beaten; drives `GameOverScreen` win variant |
| `showNameEntry` | Controls whether `NameEntryModal` is overlaid |
| `lastResult` | `{score, level}` stored at game end, used by `GameOverScreen` |
| `editorMode` | `'admin'\|'user'` — passed to LevelEditorScreen |
| `editorBackDest` | Where editor's ← BACK button goes (`'levelcreator'` or `'mylevels'`) |
| `editingUserLevelId` | Firebase ID for the level being edited; `null` = new level |
| `testLevelReturnScreen` | Where EXIT returns after playing a test/community level |

## Each Screen

### StartScreen
Canvas background with twinkling stars and animated pixel ball. Three buttons: PLAY, LEADERBOARD, SKINS. Shows the currently selected ball skin on screen.

**Props:** `onPlay`, `onLeaderboard`, `onSkins`, `ballSkin`

---

### ModeSelectScreen
Four buttons in order (top to bottom): DAILY CHALLENGE (disabled, coming soon), CAMPAIGN (active), ARCADE (active), LEVEL CREATOR (active).

**Props:** `onCampaign`, `onArcade`, `onLevelCreator`, `onBack`

---

### GameScreen
The entire game. See `docs/GAME_ENGINE.md` for full details.

**Key props:** `onGameOver`, `onGameWon`, `testLevel`, `campaignLevels`, `arcadeMode`, `startLevel`, `ballSkin`, `onExit`

**Exit behavior:**
- Test mode → back to `'leveleditor'`, clears `testLevelData`
- Arcade → back to `'levelselect'`
- Campaign → back to `'modeselect'`

---

### GameOverScreen
Shown after both losses and wins. Two visual variants:

| `didWin = false` | `didWin = true` |
|---|---|
| "GAME OVER" in red | "YOU WIN!" in gold |
| "TRY AGAIN" button | "PLAY AGAIN" button |
| Red dashed divider | Gold dashed divider |
| "MORE LEVELS COMING SOON" subtitle | (win only) |

Shows final score, level reached, personal best, and a "★ NEW BEST! ★" banner if applicable.

**Props:** `score`, `level`, `personalBest`, `playerName`, `didWin`, `onTryAgain`, `onLeaderboard`, `onHome`

---

### LeaderboardScreen
Live-updating list of all players sorted by score. Top 3 get medal emojis. Current player is highlighted in cyan with "◄ YOU" tag.

Subscribes to Firebase on mount, unsubscribes on unmount.

**Props:** `playerName`, `onBack`

---

### LevelSelectScreen (Arcade)
Grid of level buttons, one per available level. Count is dynamic: `9 + campaignLevels.length` — grows automatically as JSON levels are added.

**Props:** `onSelect(level)`, `onBack`, `totalLevels`

---

### BallSkinsScreen
Grid of available skins. Tapping a skin calls `onSelect` immediately (no confirm step). Selected skin is highlighted. Skin is persisted to `localStorage` in App.tsx.

**Props:** `currentSkin`, `onSelect(skin)`, `onBack`

---

### LevelCreatorScreen
Hub screen with three main buttons (COMMUNITY, CREATE LEVEL, MY LEVELS) and a hidden ADMIN button. See `docs/COMMUNITY_LEVELS.md` and `docs/LEVEL_EDITOR.md`.

**Props:** `playerName`, `onAdminAccess`, `onCreateLevel`, `onCommunityLevels`, `onMyLevels`, `onBack`

---

### CommunityLevelsScreen
Horizontally scrollable card carousel of all published levels, newest first. Each card shows level name, creator, date, hoop count, makes count, a 1–5 star rating row, and a ▶ PLAY button. See `docs/COMMUNITY_LEVELS.md`.

**Props:** `playerName`, `onPlay(level: UserLevel)`, `onBack`

---

### MyLevelsScreen
Vertical list of the current player's levels with edit/delete controls and a progress bar (x / 10). See `docs/COMMUNITY_LEVELS.md`.

**Props:** `playerName`, `onEdit(level: UserLevel)`, `onBack`

---

### LevelEditorScreen
Full level editor. Supports `mode='admin'` (JSON download + open file) and `mode='user'` (cloud save button). See `docs/LEVEL_EDITOR.md` and `docs/COMMUNITY_LEVELS.md`.

**Props:** `onBack`, `onTest(levelData)`, `initialData?`, `mode?`, `onSaveToCloud?`

## PWA Safe Area

The app is installable to the iOS homescreen (`apple-mobile-web-app-capable`, `viewport-fit=cover`, `black-translucent` status bar). In standalone PWA mode `env(safe-area-inset-top)` resolves to ~50px; in the browser it resolves to 0.

**Each screen's root div** has `paddingTop: 'env(safe-area-inset-top, 0px)'` and `boxSizing: 'border-box'` so content clears the status bar without clipping anything at the bottom.

**GameScreen** is the exception — it uses the canvas `marginTop: env(safe-area-inset-top, 0px)` approach instead, and reads the safe area in JS to subtract from the canvas height so drawing coordinates stay correct.

If you add a new screen, add `paddingTop: 'env(safe-area-inset-top, 0px)'` and `boxSizing: 'border-box'` to its root div.

## Name Entry

`NameEntryModal` is a modal overlay (not a separate screen). It appears over `ModeSelectScreen` when a player starts Campaign without a name set. On submit it saves the name, closes the modal, and starts the game.

`playerName` being set is required before Campaign scores are submitted to Firebase.

## How App State Flows Into the Game

```
App.tsx
  campaignLevels ──────────────────────────────► GameScreen (levels 10+)
  campaignLevels.length ──► LevelSelectScreen (arcade button count)
  testLevelData ───────────────────────────────► GameScreen (editor test)
  arcadeMode + arcadeStartLevel ───────────────► GameScreen (arcade config)
  gameWon ─────────────────────────────────────► GameOverScreen (win variant)
  personalBest ────────────────────────────────► GameScreen (display) + GameOverScreen
  ballSkin ────────────────────────────────────► GameScreen + StartScreen
```
