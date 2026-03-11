// src/core/contentSpawner.ts
// Dynamically populates encounters based on region, map, danger level, and spawn pool

import { spawnSystem } from "./spawnSystem.js";
import { worldConsistency } from "./worldConsistency.js";
import { worldSystem } from "./worldSystem.js";
import type { CharacterStats } from "../models/combatTypes.js";
import type { Region } from "./worldSystem.js";

export interface SpawnedEncounter {
  enemy: CharacterStats;
  regionName: string;
  dangerLevel: number;
}

export class ContentSpawner {
  /**
   * Generate a full encounter for a region.
   * Uses DB content if available, falls back to procedural.
   * Applies world consistency rules.
   */
  public async generateEncounter(
    region: Region,
    playerLevel: number,
    mapId?: string,
  ): Promise<SpawnedEncounter> {
    // 1. Get spawn pool (DB-first, then fallback)
    let pool = await spawnSystem.getSpawnPool(mapId);

    // 2. Filter by world consistency rules
    pool = pool.filter((p) =>
      worldConsistency.canSpawnIn(p.monsterName, region.name),
    );

    // 3. If nothing passes consistency, use recommended monsters
    if (pool.length === 0) {
      const recommended = worldConsistency.getRecommended(region.name);
      pool = recommended.map((name) => ({
        monsterName: name,
        weight: 1.0 / recommended.length,
      }));
    }

    // 4. Select from pool by weighted probability
    const monsterName = spawnSystem.selectFromPool(pool);

    // 5. Scale enemy level based on danger + player level
    const enemyLevel = Math.max(1, playerLevel + region.dangerLevel - 5);

    // 6. Spawn the monster (DB-first stats, then procedural)
    const enemy = await spawnSystem.spawnMonster(monsterName, enemyLevel);

    return {
      enemy,
      regionName: region.name,
      dangerLevel: region.dangerLevel,
    };
  }
}

export const contentSpawner = new ContentSpawner();
