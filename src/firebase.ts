import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, get, push, remove, query,
  orderByChild, limitToLast, onValue,
  type DataSnapshot
} from 'firebase/database';
import type { LevelData, UserLevel } from './types/level';

const firebaseConfig = {
  apiKey: 'AIzaSyAltuIRIU-fdIlWTzyIRhhrKGTyQAKwqRU',
  authDomain: 'fall-ball-ec207.firebaseapp.com',
  databaseURL: 'https://fall-ball-ec207-default-rtdb.firebaseio.com',
  projectId: 'fall-ball-ec207',
  storageBucket: 'fall-ball-ec207.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── Leaderboard ────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  timestamp: number;
}

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const entryRef = ref(db, `fallball/leaderboard/alltime/${key}`);
  const snapshot = await get(entryRef);
  if (!snapshot.exists() || snapshot.val().score < score) {
    await set(entryRef, { name, score, level, timestamp: Date.now() });
  }
}

export function subscribeLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  const leaderboardRef = query(
    ref(db, 'fallball/leaderboard/alltime'),
    orderByChild('score'),
    limitToLast(1000)
  );
  const unsub = onValue(leaderboardRef, (snapshot: DataSnapshot) => {
    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((child) => { entries.push(child.val() as LeaderboardEntry); });
    const best = new Map<string, LeaderboardEntry>();
    entries.forEach(e => {
      if (!best.has(e.name) || best.get(e.name)!.score < e.score) best.set(e.name, e);
    });
    callback(Array.from(best.values()).sort((a, b) => b.score - a.score));
  });
  return unsub;
}

// ─── User Levels ─────────────────────────────────────────────────────────────
// DB paths:
//   fallball/user_levels/[creatorKey]/[levelId]  ← owned by creator
//   fallball/community_feed/[levelId]             ← denormalized feed for fast community query

export const MAX_USER_LEVELS = 10;

function creatorKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/** Save (create or update) a user level. Returns the level ID. */
export async function saveUserLevel(
  playerName: string,
  data: LevelData,
  existingId?: string
): Promise<string> {
  const key = creatorKey(playerName);
  const now = Date.now();

  const payload = {
    name: data.name,
    makesNeeded: data.makesNeeded,
    hoops: data.hoops,
    obstacles: data.obstacles,
    creatorName: playerName,
    creatorKey: key,
    updatedAt: now,
  };

  if (existingId) {
    // Preserve original createdAt
    const snap = await get(ref(db, `fallball/user_levels/${key}/${existingId}/createdAt`));
    const createdAt = snap.exists() ? snap.val() : now;
    const full = { ...payload, createdAt, id: existingId };
    await set(ref(db, `fallball/user_levels/${key}/${existingId}`), full);
    await set(ref(db, `fallball/community_feed/${existingId}`), full);
    return existingId;
  } else {
    const newRef = push(ref(db, `fallball/user_levels/${key}`));
    const id = newRef.key!;
    const full = { ...payload, createdAt: now, id };
    await set(newRef, full);
    await set(ref(db, `fallball/community_feed/${id}`), full);
    return id;
  }
}

/** Get all levels created by a player, newest first. */
export async function getUserLevels(playerName: string): Promise<UserLevel[]> {
  const key = creatorKey(playerName);
  const snap = await get(ref(db, `fallball/user_levels/${key}`));
  if (!snap.exists()) return [];
  const levels: UserLevel[] = [];
  snap.forEach(child => {
    const val = child.val();
    levels.push({ ...val, id: child.key, hoops: val.hoops ?? [], obstacles: val.obstacles ?? [] } as UserLevel);
  });
  return levels.sort((a, b) => b.createdAt - a.createdAt);
}

/** Delete a user level (removes from both user_levels and community_feed). */
export async function deleteUserLevel(playerName: string, levelId: string): Promise<void> {
  const key = creatorKey(playerName);
  await Promise.all([
    remove(ref(db, `fallball/user_levels/${key}/${levelId}`)),
    remove(ref(db, `fallball/community_feed/${levelId}`)),
  ]);
}

// ─── Level Completions ────────────────────────────────────────────────────────
// DB path: fallball/level_completions/[levelId]/[playerKey]

export interface LevelCompletion {
  playerName: string;
  completedAt: number;
}

/** Record that a player completed a community level (idempotent — updates their existing entry). */
export async function recordLevelCompletion(levelId: string, playerName: string): Promise<void> {
  const key = creatorKey(playerName);
  await set(ref(db, `fallball/level_completions/${levelId}/${key}`), {
    playerName,
    completedAt: Date.now(),
  });
}

/** Fetch all completions for a level, sorted oldest first. */
export async function getLevelCompletions(levelId: string): Promise<LevelCompletion[]> {
  const snap = await get(ref(db, `fallball/level_completions/${levelId}`));
  if (!snap.exists()) return [];
  const result: LevelCompletion[] = [];
  snap.forEach(child => { result.push(child.val() as LevelCompletion); });
  return result.sort((a, b) => a.completedAt - b.completedAt);
}

// ─── Level Ratings ────────────────────────────────────────────────────────────
// DB path: fallball/level_ratings/[levelId]/[playerKey] → { playerName, rating, ratedAt }

export interface RatingSummary {
  avg: number;
  count: number;
  userRating: number | null;
}

/** Fetch rating summary for a level, optionally including the current player's rating. */
export async function getLevelRatingSummary(levelId: string, playerKey?: string): Promise<RatingSummary> {
  const snap = await get(ref(db, `fallball/level_ratings/${levelId}`));
  if (!snap.exists()) return { avg: 0, count: 0, userRating: null };
  let sum = 0, count = 0, userRating: number | null = null;
  snap.forEach(child => {
    const val = child.val();
    sum += val.rating;
    count++;
    if (playerKey && child.key === playerKey) userRating = val.rating;
  });
  return { avg: count > 0 ? sum / count : 0, count, userRating };
}

/** Submit a rating (1–5). Silently no-ops if the player has already rated. */
export async function submitLevelRating(levelId: string, playerName: string, rating: number): Promise<void> {
  const key = creatorKey(playerName);
  const ratingRef = ref(db, `fallball/level_ratings/${levelId}/${key}`);
  const snap = await get(ratingRef);
  if (snap.exists()) return; // already rated — immutable
  await set(ratingRef, { playerName, rating, ratedAt: Date.now() });
}

/** Subscribe to community feed, newest first, up to 200 levels. */
export function subscribeCommunityLevels(
  callback: (levels: UserLevel[]) => void
): () => void {
  const feedRef = query(
    ref(db, 'fallball/community_feed'),
    orderByChild('createdAt'),
    limitToLast(200)
  );
  const unsub = onValue(feedRef, snap => {
    const levels: UserLevel[] = [];
    snap.forEach(child => {
      const val = child.val();
      levels.push({ ...val, id: child.key, hoops: val.hoops ?? [], obstacles: val.obstacles ?? [] } as UserLevel);
    });
    callback(levels.reverse()); // newest first
  });
  return unsub;
}
