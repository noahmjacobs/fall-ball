import type { LevelData } from './types/level';

export async function loadCampaignLevels(): Promise<LevelData[]> {
  try {
    const manifestRes = await fetch(`/levels/campaign/manifest.json?v=${Date.now()}`);
    if (!manifestRes.ok) return [];
    const manifest: { levels: string[] } = await manifestRes.json();

    const results = await Promise.all(
      manifest.levels.map(async (filename) => {
        try {
          const res = await fetch(`/levels/campaign/${filename}`);
          if (!res.ok) return null;
          return await res.json() as LevelData;
        } catch {
          return null;
        }
      })
    );

    return results.filter((l): l is LevelData => l !== null);
  } catch {
    return [];
  }
}
