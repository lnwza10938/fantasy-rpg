// src/core/worldConsistency.ts
// Ensures logical consistency between regions, biomes, and monster types

export type Biome =
  | "volcanic"
  | "tundra"
  | "forest"
  | "desert"
  | "swamp"
  | "mountain"
  | "coast"
  | "void";

export interface BiomeRule {
  allowed: string[]; // Monsters that CAN spawn here
  forbidden: string[]; // Monsters that CANNOT spawn here
  temperature: "hot" | "cold" | "temperate";
}

const BIOME_RULES: Record<Biome, BiomeRule> = {
  volcanic: {
    allowed: ["Fire Imp", "Stone Golem", "Shadow Fiend"],
    forbidden: ["Frost Wraith", "Wolf"],
    temperature: "hot",
  },
  tundra: {
    allowed: ["Frost Wraith", "Wolf", "Skeleton"],
    forbidden: ["Fire Imp", "Slime"],
    temperature: "cold",
  },
  forest: {
    allowed: ["Goblin", "Wolf", "Orc", "Slime"],
    forbidden: [],
    temperature: "temperate",
  },
  desert: {
    allowed: ["Skeleton", "Stone Golem", "Slime"],
    forbidden: ["Frost Wraith", "Wolf"],
    temperature: "hot",
  },
  swamp: {
    allowed: ["Slime", "Goblin", "Shadow Fiend"],
    forbidden: ["Stone Golem"],
    temperature: "temperate",
  },
  mountain: {
    allowed: ["Orc", "Dark Knight", "Stone Golem"],
    forbidden: ["Slime"],
    temperature: "cold",
  },
  coast: {
    allowed: ["Goblin", "Fire Imp", "Wolf"],
    forbidden: [],
    temperature: "temperate",
  },
  void: {
    allowed: ["Shadow Fiend", "Dark Knight", "Frost Wraith"],
    forbidden: ["Goblin", "Slime"],
    temperature: "cold",
  },
};

// Map region names to biomes
const REGION_BIOMES: Record<string, Biome> = {
  "Ash Valley": "volcanic",
  "Crystal Cavern": "mountain",
  "Shadow Forest": "forest",
  "Iron Peaks": "mountain",
  "Moonlit Marsh": "swamp",
  "Infernal Rift": "volcanic",
  "Frozen Tundra": "tundra",
  "Golden Desert": "desert",
  "Crimson Coast": "coast",
  "Void Abyss": "void",
};

export class WorldConsistency {
  /** Get biome for a region name */
  public getBiome(regionName: string): Biome {
    return REGION_BIOMES[regionName] ?? "forest";
  }

  /** Get biome rules */
  public getRules(biome: Biome): BiomeRule {
    return BIOME_RULES[biome];
  }

  /** Check if a monster can spawn in a given region */
  public canSpawnIn(monsterName: string, regionName: string): boolean {
    const biome = this.getBiome(regionName);
    const rules = BIOME_RULES[biome];
    return !rules.forbidden.includes(monsterName);
  }

  /** Filter an enemy list to only those consistent with a region */
  public filterConsistent(enemies: string[], regionName: string): string[] {
    return enemies.filter((e) => this.canSpawnIn(e, regionName));
  }

  /** Get recommended monsters for a region */
  public getRecommended(regionName: string): string[] {
    const biome = this.getBiome(regionName);
    return BIOME_RULES[biome].allowed;
  }
}

export const worldConsistency = new WorldConsistency();
