# Level Editor

The Level Editor lets an admin build levels visually and export them as JSON files for the campaign. It is gated behind a PIN so regular players see a "Coming Soon" screen.

## Access Flow

```
Mode Select → Level Creator → (Coming Soon screen)
                                    └─ ADMIN button (bottom, subtle)
                                          └─ PinEntryModal (PIN: 8161)
                                                └─ Level Editor
```

## Components

### LevelCreatorScreen.tsx
The public-facing screen. Shows a "Coming Soon" canvas animation with stars. Has a very subtle ADMIN button at the bottom of the screen that opens `PinEntryModal`.

### PinEntryModal.tsx
A modal overlay with a 4-digit numpad. Shows dots for entered digits. Shakes on wrong PIN. Supports keyboard input (digits, backspace, escape). Correct PIN calls `onAdminAccess()` which navigates to the editor.

**PIN: 8161**

### LevelEditorScreen.tsx
The main editor. Full-screen layout: canvas on top, collapsible bottom drawer.

## Editor Layout

```
┌──────────────────────────────────┐
│ ← BACK  [Level Name]  ▶TEST ↓SAVE│  ← top bar
├──────────────────────────────────┤
│                                  │
│          CANVAS                  │  ← tap/drag to place/move elements
│     (stars + drop zone)          │
│                                  │
├──────────────────────────────────┤
│ ▼  HOOP PROPERTIES               │  ← collapsible bottom drawer
│   pattern / speed / size / tilt  │
└──────────────────────────────────┘
```

## Canvas Interaction

| Action | Result |
|---|---|
| Tool = HOOP, tap canvas | Places a new hoop at that position |
| Tool = METAL/TRAMP, drag canvas | Draws an obstacle bar |
| Tool = SELECT, tap element | Selects it (shows properties) |
| Tool = SELECT, drag selected hoop | Moves the hoop |

Tap in the drop zone (top 90px) is ignored — hoops must be placed below it.

## Bottom Drawer

**When nothing is selected:** shows the asset picker (HOOP, METAL, TRAMP, CANCEL) and the MAKES TO ADVANCE buttons (1, 2, or 3).

**When a hoop is selected:**

| Control | What it does |
|---|---|
| PATTERN buttons | Sets movement pattern |
| SPEED slider | How fast the hoop moves |
| SIZE slider | Width of the opening (`innerHalf × 2` px) |
| TILT slider | Rotation in degrees (0–359°). 0 = horizontal, 90 = vertical, 180 = upside down |
| AMP X slider | Horizontal movement range (shown for patterns that use it) |
| AMP Y slider | Vertical movement range (shown for patterns that use it) |
| OFFSET slider | Phase offset in frames (desync multiple hoops) |

**When an obstacle is selected:**

| Control | What it does |
|---|---|
| BOUNCINESS slider | `restitution` — how bouncy the surface is (0.2–1.0) |
| THICKNESS slider | Visual and physics thickness in pixels |

## Testing a Level

Clicking **▶ TEST** calls `onTest(levelData)` in App.tsx, which:
1. Saves the current editor state to `editorDraft` in App state
2. Sets `testLevelData` to the level data
3. Navigates to the game screen

`GameScreen` receives the level via `testLevel` prop. `arcadeMode` is forced `true` (infinite lives, no score submission).

When the player exits the test game, App.tsx:
1. Clears `testLevelData`
2. Navigates back to `'leveleditor'`
3. Passes `initialData={editorDraft}` to `LevelEditorScreen` — restoring the editor exactly where you left off

## Saving a Level

Clicking **↓ SAVE** calls `saveJSON()` which:
1. Builds a `LevelData` object from current state
2. Creates a `Blob` with `JSON.stringify`
3. Triggers a browser download of `[level-name].json`

The downloaded file is ready to drop into `/public/levels/campaign/` — see `docs/LEVEL_SYSTEM.md` for the full deployment flow.

## How the Editor Draws Hoops

The editor has its own `drawHoop()` function (not imported from the game) that mirrors the game's visual exactly. Both use `ctx.save/translate/rotate/restore` so rotation is visually accurate in both the editor and the game.

When a hoop is selected, a dashed gold bounding box is drawn around it in the editor canvas.
