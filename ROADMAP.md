# Fall Ball — Roadmap

Feature ideas and their current status. Update this as things get built.

---

## 🟡 In Progress / Next Up

### More Campaign Levels
- Level 10 is the first JSON-built level (linear hoop + metal bar)
- Goal: reach 100 campaign levels over time
- Workflow: build in Level Editor → SAVE → drop JSON in `/public/levels/campaign/` → add to `manifest.json` → push
- No code changes needed to add new levels

---

## 📋 Planned Features

### Player-Created Levels — Phase 3 (Future)
- Best community levels get promoted into the official Campaign
- Creator gets credited in-game ("Level designed by [name]")

### Daily Challenge Mode
- 1 life, sudden death — get as far as you can through levels
- Resets daily, same challenge for all players
- Separate leaderboard from all-time campaign
- Weekly leaderboard idea: total levels passed across all daily challenges in a week
- Players can only play once per day

### Hack Balls (Arcade Mode Only)
- Special balls with game-modifying properties, just for fun
- Scores with hack balls do NOT count toward leaderboard
- Ideas:
  - **Bouncy** — never loses energy, bounces forever
  - **Giant** — huge ball, harder to thread through hoops
  - **Multi-ball** — several balls active at once
  - **Ghost** — passes through rims, only scores dead-center shots

### More Ball Skins
- Drop a PNG into `/public/skins/` and register it in `BallSkinsScreen.tsx`
- Noah designs the artwork

### Ball Customization (Very Long-Term)
- Let players pick colors, patterns, or upload a custom image for their ball
- Revisit once other major features are shipped

### New Level Mechanics
The level editor currently supports: hoop (all 8 movement patterns), metal bar, trampoline.

Ideas for new mechanics to add to the editor and level system:
- Rotating bars (spin around a pivot point)
- Shrinking / expanding hoops
- Moving platforms the ball lands on
- Wind zones that push the ball horizontally
- Portals (enter one side, exit another)

---

## ✅ Shipped

### Core Game
- Campaign mode — levels 1–9 hardcoded, levels 10+ loaded from JSON files
- Arcade mode — pick any level, infinite lives, no leaderboard
- 3 lives per campaign run; lose all 3 → Game Over
- Win condition — beating the last available campaign level shows "YOU WIN!" screen with "More Levels Coming Soon"

### Level System
- JSON-based campaign levels in `/public/levels/campaign/` loaded via `manifest.json`
- Level Editor (admin, PIN-gated) — full canvas drag-and-drop editor with test and save
- Arcade level select is fully dynamic — shows exactly as many levels as exist, no hardcoding

### Levels Built
- L1: Tutorial — three fixed shots at different positions
- L2: Linear moving hoop
- L3: Rectangle-path hoop
- L4: Circle-path hoop
- L5: Multi-hoop shots (score through multiple hoops per shot)
- L6: Figure-8 hoop
- L7: Two hoops at different speeds
- L8: Two rectangle-path hoops offset by 30 frames (trailing effect)
- L9: Vertically moving hoop + metal bar + trampoline obstacle
- L10 (JSON): Linear hoop + metal bar (first JSON-built level)

### Physics & Scoring
- CCD scoring — works correctly even with fast-moving hoops
- Anti-stick nudge on rim circles and metal bar endpoints
- Trampoline obstacles (high restitution)
- Obstacle endpoint circle collisions (prevents ball sticking at corners)

### Leaderboard & Scoring
- Firebase Realtime Database leaderboard
- Deduped by player name — one entry per player, only updates on new personal best
- `gameOverFired` guard prevents duplicate submissions from the animation loop
- Level completion bonus = current level number added to score

### Community Levels System
- Players create levels in the same editor as admin, save to Firebase, share publicly
- Community Levels screen: horizontally scrollable card carousel, newest first
- My Levels screen: manage own levels (up to 10), edit or delete
- Community level cards show 1–5 star ratings (average + vote count); one immutable vote per player
- Community level completion/fail tracked separately from campaign

### UI / UX
- Mode Select screen: Daily Challenge (top, disabled) → Campaign → Arcade → Level Creator
- "YOU WIN!" game over screen variant (gold, with "More Levels Coming Soon")
- Ball skins: Basketball (canvas-drawn), Paper Ball (PNG)
- Pixel art aesthetic throughout (`Press Start 2P` font, canvas pixel rendering)
- PWA homescreen support — `env(safe-area-inset-top)` applied per-screen so content clears the iOS status bar in standalone mode
