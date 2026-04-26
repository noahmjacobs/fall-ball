import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, push, query,
  orderByChild, limitToLast, onValue,
  type DataSnapshot
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAv8s0vErAwc3KZaRF55isbKTzhgjuwGNE',
  authDomain: 'pivision-28ddb.firebaseapp.com',
  databaseURL: 'https://pivision-28ddb-default-rtdb.firebaseio.com',
  projectId: 'pivision-28ddb',
  storageBucket: 'pivision-28ddb.appspot.com',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  timestamp: number;
}

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  const monthKey = getMonthKey();
  const leaderboardRef = ref(db, `fallball/leaderboard/${monthKey}`);
  await push(leaderboardRef, { name, score, level, timestamp: Date.now() });
}

export function subscribeLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  const monthKey = getMonthKey();
  const leaderboardRef = query(
    ref(db, `fallball/leaderboard/${monthKey}`),
    orderByChild('score'),
    limitToLast(200)
  );

  const unsub = onValue(leaderboardRef, (snapshot: DataSnapshot) => {
    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((child) => {
      entries.push(child.val() as LeaderboardEntry);
    });
    const best = new Map<string, LeaderboardEntry>();
    entries.forEach(e => {
      if (!best.has(e.name) || best.get(e.name)!.score < e.score) {
        best.set(e.name, e);
      }
    });
    const sorted = Array.from(best.values()).sort((a, b) => b.score - a.score);
    callback(sorted.slice(0, 20));
  });

  return unsub;
}

export function getDaysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}
