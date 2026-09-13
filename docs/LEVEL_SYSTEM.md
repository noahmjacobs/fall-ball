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
4. Run `npm run levels:check` (see below) to confirm it is solvable and fits the difficulty curve
5. Commit and push

Both Campaign and Arcade update automatically — no code changes needed.

## Level Simulator (`npm run levels:check`)

`scripts/level-sim.mjs` is a headless copy of the GameScreen physics (gravity, substeps,
CCD scoring, rim + obstacle collisions). It brute-forces every drop position × release
frame for each campaign level and prints one row per level:

```
 lvl   rate   bestX rate  timing      xwin       diff   layout  name
  47   11.3%  x=136  35%  timing   68f  xwin  69px  diff  2.7  2mk 2h 0o  Orbit Pair
```

| Column | Meaning |
|---|---|
| `rate` | % of all sampled shots that score (pure luck factor) |
| `bestX rate` | best drop x, and % of release frames that score from there |
| `timing` | longest run of consecutive release frames that score at bestX (`∞` = still hoop; under ~15f is very hard) |
| `xwin` | widest run of drop-x values that score at the best frame (under ~20px is pixel-hunting) |
| `diff` | one heuristic difficulty number (higher = harder). Levels 1–6 sit around 1, level 12 is 3.9, level 100 is 4.6 |
| `STUCK` | shots where the ball never scored or fell out — a design trap (see rules below) |
| `(endpoint-rest)` | shots dropped exactly on an obstacle endpoint; expected, handled by the game's rest timeout |

Other modes:

```bash
node scripts/level-sim.mjs 13 27                    # only those levels
node scripts/level-sim.mjs --builtin                # hardcoded levels 1–9 for calibration
node scripts/level-sim.mjs path/to/level.json       # one file + an x/frame heatmap
node scripts/level-sim.mjs --trace file.json 120 100   # ball path for drop x=120, release frame 100
```

If the physics constants in `GameScreen.tsx` change, update the copies at the top of the script.

## Design Rules Learned the Hard Way

- **No flat bars.** A ball landing on a perfectly horizontal metal bar or trampoline has no
  sideways velocity and would rest there forever. Tilt every bar by at least a few pixels.
- **Metal bounciness matters more than angle.** At the default 0.8 a bar is a bumper and a
  30° ramp launches the ball clean off the canvas. Use ~0.3 for slides (the ball rolls to the
  end and every drop exits at the same spot, so add a moving hoop for challenge) and ~0.6 for
  shallow bumpers where the landing point should matter.
- **Trampoline ends need an exit.** Full-width trampolines run off-canvas (`x1: -10`, `x2: 400`)
  so the ball can roll off the side. Never put a vertical post at a trampoline's low end — the
  corner becomes a pit the ball never leaves.
- **Multi-hoop levels require every hoop in one drop**, so keep chained hoops on the same
  vertical line or on a path the simulator confirms.
- **Vertical hoops (`rotation: 90`) cannot be entered by a straight drop** — they need a
  trampoline or ramp, which makes them natural "the obvious shot doesn't work" levels.
- Keep every hoop above `y ≈ 620` and every obstacle above `y ≈ 640` so levels fit smaller phones.

## Campaign Levels 13–100

Levels 13–100 were designed with the simulator; each world introduces a mechanic and the
difficulty (`diff` above) climbs from about 1.5 to about 5 with breathers between spikes.

**Levels 13–22 — Every pattern, shrinking hoops, first deflectors**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 13 | Slow Orbit | 3 | circle ×96 | — |
| 14 | Elevator | 3 | linear_v ×92 | — |
| 15 | Sidestep | 3 | linear ×88 | — |
| 16 | Figure Eight | 3 | figure8 ×88 | — |
| 17 | Skylight | 2 | still ×88 | 2 metal |
| 18 | Box Step | 2 | rectangle ×84 | — |
| 19 | Slide | 3 | still ×92 | 2 metal |
| 20 | Tandem | 2 | linear ×92, linear ×92 | — |
| 21 | Off Beat | 2 | linear ×92, linear ×92 | — |
| 22 | Fast Lane | 2 | linear ×92 | — |

**Levels 23–32 — Trampolines and ricochets**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 23 | Springboard | 2 | still 180° ×92 | 1 tramp, 1 metal |
| 24 | Pop Fly | 2 | linear ×92 | 1 tramp, 1 metal |
| 25 | Rebound | 2 | linear ×80 | 2 metal |
| 26 | The Window | 2 | still 90° ×92 | 1 tramp |
| 27 | Stairs | 2 | linear ×84 | 2 metal |
| 28 | Pop Up | 2 | linear ×92 | 1 tramp, 1 metal |
| 29 | Kicker | 2 | still 90° ×88 | 1 tramp |
| 30 | Metronome | 2 | linear ×96, still ×92 | — |
| 31 | Half Pipe | 3 | linear ×88 | 2 tramp |
| 32 | Crossfire | 2 | circle_cw ×80, circle_cw ×80 | — |

**Levels 33–42 — Tilted hoops, walls, chimneys**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 33 | Leaning Tower | 3 | still 25° ×96 | — |
| 34 | Tilt-a-Whirl | 2 | linear 30° ×92 | — |
| 35 | Bank Shot | 2 | still 330° ×92 | 2 metal |
| 36 | Chimney | 2 | still 90° ×92 | 3 metal |
| 37 | See-Saw | 2 | linear 20° ×88, linear 340° ×88 | — |
| 38 | Vertical Drop | 2 | linear_v 90° ×92 | 1 tramp |
| 39 | Slalom | 2 | still ×88 | 6 metal |
| 40 | Blind Spot | 2 | linear ×88 | 1 metal |
| 41 | Twister | 2 | figure8 20° ×84 | — |
| 42 | Spinner | 2 | circle ×84 | — |

**Levels 43–52 — Chains: every hoop in one drop**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 43 | Triple Stack | 3 | still ×84, still ×84, still ×84 | — |
| 44 | Stagger | 2 | still ×92, still ×92, still ×92 | — |
| 45 | Convoy | 2 | linear ×88, linear ×88, linear ×88 | — |
| 46 | Scissors | 2 | linear ×92, linear ×92 | — |
| 47 | Orbit Pair | 2 | circle ×88, circle ×88 | — |
| 48 | Ramp Chain | 2 | still 330° ×92, still ×92 | 2 metal |
| 49 | Bounce Chain | 2 | still 180° ×92, still 90° ×92 | 1 tramp |
| 50 | Lift and Shift | 2 | linear_v ×88, linear ×88 | — |
| 51 | Box and Ball | 2 | rectangle ×88, still ×88 | — |
| 52 | Three Rings | 1 | circle_cw ×92, circle_cw ×92, circle_cw ×92 | — |

**Levels 53–62 — Pinball: slides, funnels, walls**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 53 | Funnel | 2 | linear ×76 | 2 metal |
| 54 | Waterslide | 2 | linear ×84 | 1 metal |
| 55 | Gutter | 2 | linear_v 90° ×76 | 1 metal |
| 56 | Ricochet | 2 | still ×88 | 2 metal |
| 57 | Zigzag | 2 | linear ×80 | 3 metal |
| 58 | Trapdoor | 2 | rectangle ×84 | 2 metal |
| 59 | Wall Ball | 2 | still 30° ×88 | 2 metal |
| 60 | Pendulum | 2 | linear ×84, still ×88 | — |
| 61 | Double Window | 2 | still 90° ×80, still 90° ×80 | 1 tramp |
| 62 | Bumper Cars | 2 | circle ×80 | 3 metal |

**Levels 63–72 — Precision: small hoops, fast patterns**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 63 | Pinhole | 3 | still ×52 | — |
| 64 | Quickstep | 2 | linear ×76 | — |
| 65 | Hummingbird | 2 | figure8 ×76 | — |
| 66 | Tight Orbit | 2 | circle ×60 | — |
| 67 | Speed Box | 2 | rectangle ×60 | — |
| 68 | Bumper Orbit | 2 | circle ×68 | 3 metal |
| 69 | Needle | 2 | linear ×68 | 2 metal |
| 70 | Tilted Sprint | 2 | linear 30° ×80 | — |
| 71 | Small Stack | 2 | still ×72, linear ×72, still ×72 | — |
| 72 | Comet | 1 | circle ×64 | — |

**Levels 73–82 — Combos: bounce + move + tilt**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 73 | Moving Springboard | 2 | linear_v 180° ×76 | 1 tramp, 1 metal |
| 74 | Moving Window | 2 | linear_v 90° ×84 | 1 tramp |
| 75 | Skylight II | 1 | linear ×88, linear ×88 | 2 metal |
| 76 | Skylight Orbit | 2 | circle ×80 | 2 metal |
| 77 | Pop Fly II | 2 | circle ×84 | 1 tramp, 1 metal |
| 78 | Chimney II | 2 | linear_v 90° ×80 | 3 metal |
| 79 | Waterslide II | 2 | linear ×68 | 1 metal |
| 80 | Rebound II | 2 | linear ×64 | 2 metal |
| 81 | Stairs II | 2 | linear ×72 | 2 metal |
| 82 | Half Pipe II | 2 | circle ×68 | 2 tramp |

**Levels 83–92 — The gauntlet**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 83 | Scissors II | 2 | linear ×84, linear ×84 | — |
| 84 | Convoy II | 2 | linear ×80, linear ×80, linear ×80 | — |
| 85 | Funnel II | 2 | circle ×68 | 2 metal |
| 86 | Orbit Trio | 1 | circle_cw ×80, circle_cw ×80, circle_cw ×80 | — |
| 87 | Ramp Chain II | 2 | still 330° ×80, linear ×72 | 2 metal |
| 88 | Blind Spot II | 2 | linear ×72 | 1 metal |
| 89 | Trapdoor II | 1 | rectangle ×72 | 2 metal |
| 90 | Elevator Trio | 2 | linear_v ×80, linear ×80, still ×80 | — |
| 91 | Zigzag II | 2 | linear ×68 | 3 metal |
| 92 | Springboard II | 1 | circle 180° ×72 | 1 tramp, 1 metal |

**Levels 93–100 — The final stretch**

| Lvl | Name | Makes | Hoops | Obstacles |
|---|---|---|---|---|
| 93 | Hummingbird II | 1 | figure8 ×56 | — |
| 94 | Speed Box II | 1 | rectangle ×52 | — |
| 95 | Needle II | 1 | linear ×60 | 2 metal |
| 96 | Double Comet | 1 | circle ×76, circle ×76 | — |
| 97 | Yo-Yo Stack | 1 | linear_v ×68, linear ×68 | — |
| 98 | Cage | 1 | linear_v 90° ×60 | 1 tramp, 1 metal |
| 99 | Eye of the Needle | 1 | linear ×72, linear ×72, linear ×72 | — |
| 100 | Fall Ball | 1 | circle_cw ×72, circle_cw ×72, circle_cw ×72 | — |

