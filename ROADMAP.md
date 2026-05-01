# Fall Ball — Roadmap

Feature ideas and their current status. Update this as things get built.

---

## 🟡 In Progress / Next Up

_Nothing currently in progress._

---

## 📋 Planned Features

### Daily Challenge Mode
- New game mode: 1 life, sudden death — get as far as you can through the levels
- Resets daily (same challenge for all players on a given day)
- Separate leaderboard from the all-time campaign leaderboard
- **Weekly leaderboard idea:** total levels passed across all daily challenges in a week = weekly score
- Leaderboard UI: toggle between All-Time / Daily / Weekly views
- Players can only play the daily challenge once per day

### More Campaign Levels (Goal: 100)
- Currently levels 1–9 are hand-crafted; 10+ are placeholders
- Before adding new levels, build out the **mechanic/asset library** so new levels have more variety
- Existing mechanics: hoop (still, linear, linear_v, rectangle, circle, figure8), metal bar, trampoline
- Ideas for new mechanics: moving platforms, rotating bars, shrinking/expanding hoops, portals, wind zones
- Levels should introduce one new mechanic at a time

### Hack Balls (Arcade Mode Only)
- Special balls with game-modifying properties — just for fun, not for leaderboard scores
- Only available in Arcade Mode
- Ideas:
  - **Bouncy** — never loses energy, bounces off screen corners forever
  - **Giant** — huge ball, makes shots harder to thread
  - **Multi-ball** — multiple balls active at once
  - **Ghost** — passes through rims, only scores clean center shots
  - More TBD
- Scores with hack balls do NOT count toward leaderboard

### More Ball Skins
- Noah designs additional PNG skins to add to the skin selector
- Drop the PNG into `/public/skins/` and add the skin to `BallSkinsScreen.tsx`

### Ball Customization (Long-Term)
- Let players design their own ball (colors, patterns, maybe upload an image)
- Probably hard as a pure web app — revisit when other features are done

---

## ✅ Shipped

- Campaign mode (levels 1–10, 3 lives, global all-time leaderboard)
- Arcade mode (pick any level, infinite lives, no leaderboard)
- Ball skins system (basketball default, Paper Ball PNG)
- Firebase leaderboard (deduped by player name, one entry per player)
- Levels: static hoop, linear, rectangle path, circle, figure-8, multi-hoop (L5), dual-speed (L7), rectangle-path pair (L8), trampoline + metal bar (L9), tiny still hoop (L10)
- Anti-stick nudge on rim and metal bar endpoints
- Scoring CCD (continuous collision detection) — works even with fast-moving hoops
- Daily challenge leaderboard concept (planned, not built)
