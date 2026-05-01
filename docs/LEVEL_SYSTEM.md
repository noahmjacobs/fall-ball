# Level System

Campaign levels 1–9 are hardcoded in `GameScreen.tsx`. Levels 10 and above are loaded from JSON files at runtime. Both campaign and arcade automatically reflect whatever levels exist.

## File Locations

```
public/
  levels/
    campaign/
      manifest.json          ← list of level filenames in play order
      Campaign_Level_10.json ← first JSON level
      Campaign_Level_11.json ← add more here
      ...
```

These files live in `/public/` so Vite serves them as static assets — no build step needed when adding new levels.

## manifest.json

Static apps can't list directory contents, so `manifest.json` acts as an explicit index:

```json
{
  "levels": [
    "Campaign_Level_10.json",
    "Campaign_Level_11.json"
  ]
}
```

**Order matters.** First entry = level 10, second = level 11, etc.

## Level JSON Structure

```json
{
  "name": "Campaign Level 10",
  "makesNeeded": 3,
  "hoops": [
    {
      "baseX": 167,
      "baseY": 432,
      "pattern": "linear",
      "speed": 2,
      "innerHalf": 44,
      "rimThick": 10,
      "ampX": 120,
      "ampY": 60,
      "frameOffset": 0,
      "rotation": 0
    }
  ],
  "obstacles": [
    {
      "x1": 80, "y1": 221,
      "x2": 237, "y2": 222,
      "type": "metal",
      "thick": 5,
      "restitution": 0.8,
      "friction": 0.95
    }
  ]
}
```

### Hoop fields

| Field | Type | Notes |
|---|---|---|
| `baseX`, `baseY` | number | Center position of hoop at rest |
| `pattern` | string | `still \| linear \| linear_v \| rectangle \| circle \| circle_cw \| circle_ccw \| figure8` |
| `speed` | number | Movement speed multiplier |
| `innerHalf` | number | Half the opening width in pixels (opening = innerHalf × 2) |
| `rimThick` | number | Thickness of each rim block in pixels |
| `ampX`, `ampY` | number | Amplitude of movement in X and Y directions |
| `frameOffset` | number | Phase offset (frames) — use to desync two hoops on the same pattern |
| `rotation` | number | Tilt in degrees. 0 = horizontal, 90 = vertical, 180 = upside down |

### Obstacle fields

| Field | Type | Notes |
|---|---|---|
| `x1, y1, x2, y2` | number | Start and end points of the bar |
| `type` | `"metal" \| "trampoline"` | Metal = grey, normal bounce. Trampoline = gold, high bounce |
| `thick` | number | Visual and collision thickness in pixels |
| `restitution` | number | Bounciness (0–1). Typical: metal 0.8, trampoline 0.89 |
| `friction` | number | Surface friction (0–1). Typical: 0.95 |

## TypeScript Types (`src/types/level.ts`)

```typescript
export type HoopPattern = 'still' | 'linear' | 'linear_v' | 'rectangle' |
  'circle' | 'circle_cw' | 'circle_ccw' | 'figure8';

export interface EditorHoop {
  id: string;
  baseX: number; baseY: number;
  pattern: HoopPattern;
  speed: number;
  innerHalf: number; rimThick: number;
  ampX: number; ampY: number;
  frameOffset: number;
  rotation?: number; // degrees
}

export interface EditorObstacle {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  type: 'metal' | 'trampoline';
  thick: number;
  restitution: number;
  friction: number;
}

export interface LevelData {
  name: string;
  makesNeeded: number;
  hoops: EditorHoop[];
  obstacles: EditorObstacle[];
}
```

`EditorHoop` and `EditorObstacle` use `id` (editor-only) which is stripped when the JSON is used in-game.

## levelLoader.ts

```typescript
loadCampaignLevels(): Promise<LevelData[]>
```

1. Fetches `/levels/campaign/manifest.json`
2. Fetches all listed files in parallel
3. Returns `LevelData[]` — empty array on any failure (graceful degradation)

Called once on app mount in `App.tsx` and stored in React state.

## How Levels Connect to the Game

```
App.tsx (mount)
  └─ loadCampaignLevels()
       └─ fetch manifest.json → fetch each file
            └─ setCampaignLevels(levels)
                  └─ passed as prop to <GameScreen campaignLevels={levels} />
                  └─ passed as prop to <LevelSelectScreen totalLevels={9 + levels.length} />
```

Inside `GameScreen`, when `level >= 10`:
- `campaignLevels[level - 10]` provides the level data
- `levelDataToHoops(ld)` converts JSON → `HoopInstance[]` (degrees → radians for rotation)
- `levelDataToObstacles(ld)` converts JSON → `Obstacle[]`

## Adding a New Level (No Code Required)

1. Build the level in the Level Editor and hit **SAVE** (downloads a JSON file)
2. Move the JSON into `/public/levels/campaign/`
3. Add the filename to `manifest.json` in the right position
4. Commit and push

Both Campaign and Arcade update automatically — no code changes needed.
