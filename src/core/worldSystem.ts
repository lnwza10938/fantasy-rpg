// src/core/worldSystem.ts
// Procedural world generation using deterministic seed-based RNG and DB content

import type { CharacterStats } from "../models/combatTypes.js";
import {
  getMaps,
  getMonsters,
  getFactions,
  getLoreSnippets,
} from "../db/contentRepositories.js";

// --- Seeded PRNG (Deterministic) ---
// Uses a simple mulberry32 algorithm for fast, reproducible randomness.
// No external dependencies. Pure math.

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a deterministic float between 0 and 1 */
  public next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a deterministic integer between min (inclusive) and max (inclusive) */
  public nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Picks a random element from an array */
  public pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)]!;
  }
}

// --- Interfaces ---

export interface Region {
  id: string; // Map ID from DB
  name: string;
  biome: string;
  dangerLevel: number;
  description: string;
  enemyPool: string[]; // Monster names
}

export interface WorldState {
  worldSeed: number;
  regions: Region[];
}

// --- World Instance (Cached Data) ---
export class WorldInstance {
  constructor(
    public seed: number,
    public regions: Region[],
    public monsterPool: any[],
    public factions: any[],
    public lore: any[],
  ) {}

  public getRandomRegion(rng: SeededRNG): Region {
    return rng.pick(this.regions);
  }
}

// --- World System ---

export class WorldSystem {
  private rng!: SeededRNG;
  private worldInstance: WorldInstance | null = null;

  /**
   * Generates or retrieves a full deterministic world from a numeric seed.
   * Caches all content-heavy data in a WorldInstance.
   */
  public async generateWorld(
    seed: number,
    customSelection?: { biomes: string[]; monsters: string[] },
  ): Promise<WorldInstance> {
    console.log(`[WorldSystem] Loading world instance for seed ${seed}...`);
    this.rng = new SeededRNG(seed);

    // Fetch all possible maps, monsters, factions, and lore from DB ONCE
    let [allMaps, allMonsters, allFactions, allLore] = await Promise.all([
      getMaps(),
      getMonsters(),
      getFactions(),
      getLoreSnippets(),
    ]);

    if (allMaps.length === 0) throw new Error("No maps found in database.");

    // Filter maps/monsters if custom selection exists
    if (customSelection) {
      if (customSelection.biomes && customSelection.biomes.length > 0) {
        const filteredMaps = allMaps.filter(
          (m) =>
            customSelection.biomes.includes(m.name) ||
            (m.biome && customSelection.biomes.includes(m.biome)),
        );
        if (filteredMaps.length > 0) allMaps = filteredMaps;
      }
      if (customSelection.monsters && customSelection.monsters.length > 0) {
        const filteredMonsters = allMonsters.filter((m) =>
          customSelection.monsters.includes(m.name),
        );
        if (filteredMonsters.length > 0) allMonsters = filteredMonsters;
      }
    }

    const regionCount = Math.min(allMaps.length, this.rng.nextInt(8, 12));
    const selectedMaps = [...allMaps]
      .sort(() => this.rng.next() - 0.5)
      .slice(0, regionCount);

    const regions: Region[] = selectedMaps.map((m) => {
      // Pick monsters that match the map's biome
      let biomeMonsters = allMonsters.filter(
        (mon: any) => !m.biome || mon.biome === m.biome,
      );

      // If we have custom monsters, prefer them even if they don't strictly match the biome for Custom Worlds
      if (customSelection?.monsters?.length) {
        const customInBiome = biomeMonsters.filter((mon) =>
          customSelection.monsters.includes(mon.name),
        );
        if (customInBiome.length > 0) biomeMonsters = customInBiome;
      }

      const poolSize = this.rng.nextInt(3, 5);
      const pool = (biomeMonsters.length > 0 ? biomeMonsters : allMonsters)
        .sort(() => this.rng.next() - 0.5)
        .slice(0, poolSize)
        .map((mon: any) => mon.name);

      return {
        id: m.id,
        name: m.name,
        biome: m.biome || "unknown",
        dangerLevel: m.danger_level,
        description: m.description || "",
        enemyPool: pool,
      };
    });

    this.worldInstance = new WorldInstance(
      seed,
      regions,
      allMonsters,
      allFactions,
      allLore,
    );
    return this.worldInstance;
  }

  /**
   * Spawns a CharacterStats enemy scaled to the given level based on DB data.
   */
  public spawnEnemy(name: string, level: number): CharacterStats {
    if (!this.worldInstance) throw new Error("World not generated.");
    const baseMonster = this.worldInstance.monsterPool.find(
      (m) => m.name === name,
    );

    // Mini-seed for stat variance
    let nameSeed = 0;
    for (let i = 0; i < name.length; i++) {
      nameSeed = ((nameSeed << 5) - nameSeed + name.charCodeAt(i)) | 0;
    }
    const rng = new SeededRNG(nameSeed + level);

    // Default or DB-sourced base stats
    const baseHP = baseMonster?.base_hp || 30 + level * 8;
    const baseAttack = baseMonster?.base_attack || 5 + Math.floor(level * 1.5);
    const baseDefense =
      baseMonster?.base_defense || 2 + Math.floor(level * 0.8);
    const baseSpeed = baseMonster?.speed || 5 + Math.floor(level / 2);
    const skillMain =
      baseMonster?.skill_id || rng.nextInt(100000000, 999999999);

    // Scale based on level
    const scaleFactor = 1 + (level - 1) * 0.15;

    return {
      id: `enemy_${name.toLowerCase().replace(/\s/g, "_")}_lv${level}`,
      name,
      imageUrl: baseMonster?.image_url || "",
      level,
      hp: Math.floor(baseHP * scaleFactor) + rng.nextInt(0, 10),
      maxHP: Math.floor(baseHP * scaleFactor) + rng.nextInt(0, 10),
      mana: 50 + level * 5,
      maxMana: 50 + level * 5,
      attack: Math.floor(baseAttack * scaleFactor) + rng.nextInt(0, 3),
      defense: Math.floor(baseDefense * scaleFactor) + rng.nextInt(0, 2),
      speed: baseSpeed + rng.nextInt(0, Math.floor(level / 5)),
      skillMain: Number(skillMain),
    };
  }

  public getInstance(): WorldInstance | null {
    return this.worldInstance;
  }
}

export const worldSystem = new WorldSystem();
