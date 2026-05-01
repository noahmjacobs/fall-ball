# Ball Skins

Ball skins are managed entirely in `BallSkinsScreen.tsx`. The selected skin is passed as a prop to `GameScreen` and `StartScreen` and is persisted to `localStorage`.

## Adding a New Skin

1. Drop a square PNG into `/public/skins/` (e.g. `fireball.png`)
2. Open `BallSkinsScreen.tsx` and add to the `BallSkin` union type:
   ```typescript
   export type BallSkin = 'basketball' | 'paperball' | 'fireball';
   ```
3. Add an entry to the `SKINS` array:
   ```typescript
   { id: 'fireball', label: 'FIRE BALL', src: '/skins/fireball.png' }
   ```
4. That's it — the skin appears in the selector and works in the game

PNG skins are loaded lazily via `getSkinImage()` which caches the `Image` object after first load to avoid re-fetching on every frame.

## drawBallSkin()

```typescript
drawBallSkin(ctx, skin, cx, cy, r)
```

This function is exported and called from both `GameScreen` (during the game loop) and `StartScreen` (on the title screen). It handles all skin types:

- **`basketball`** — drawn entirely with canvas shapes (orange circle, black seam lines, highlight). No image file needed.
- **PNG skins** — the image is clipped to a circle using `ctx.clip()` and scaled to fill the radius. If the image isn't loaded yet, falls back to the basketball skin for that frame.

## Current Skins

| ID | Display Name | Source |
|---|---|---|
| `basketball` | BASKETBALL | Canvas-drawn |
| `paperball` | PAPER BALL | `/public/skins/paperball.png` |

## Persistence

`App.tsx` reads `fallball_skin` from `localStorage` on mount and writes it whenever `handleSkinSelect` is called. The skin is passed down as a prop — no context or global state involved.
