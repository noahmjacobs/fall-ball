import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, push, query,
  orderByChild, limitToLast, onValue,
  type DataSnapshot
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAltuIRIU-fdIlWTzyIRhhrKGTyQAKwqRU',
  authDomain: 'fall-ball-ec207.firebaseapp.com',
  databaseURL: 'https://fall-ball-ec207-default-rtdb.firebaseio.com',
  projectId: 'fall-ball-ec207',
  storageBucket: 'fall-ball-ec207.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  timestamp: number;
}

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  const leaderboardRef = ref(db, 'fallball/leaderboard/alltime');
  await push(leaderboardRef, { name, score, level, timestamp: Date.now() });
}

export function subscribeLeaderboard(
  callback: (entries: LeaderboardEntry[]) => void
): () => void {
  const leaderboardRef = query(
    ref(db, 'fallball/leaderboard/alltime'),
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
