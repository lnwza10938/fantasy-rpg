// src/core/worldSystem.ts
// Procedural world generation using deterministic seed-based RNG and DB content.

import type { CharacterStats } from "../models/combatTypes.js";
import type {
  WorldDefinition,
  WorldGenerationSelection,
  WorldMapGenerationHints,
  WorldMapLayout,
  WorldMapNode,
  WorldMapPath,
  WorldMetadata,
  WorldRegion,
} from "../models/worldTypes.js";
import {
  defaultWorldNameFromPreset,
  inferWorldPresetFromSeed,
  normalizeWorldDefinitionShape,
  normalizeWorldMetadata,
} from "../models/worldTypes.js";
import {
  getFactions,
  getLoreSnippets,
  getMaps,
  getMonsters,
  getSpawnPoints,
} from "../db/contentRepositories.js";

interface MapRecord {
  id: string;
  name: string;
  biome?: string;
  danger_level: number;
  description?: string;
  image_url?: string;
}

interface SpawnPointRecord {
  map_id: string;
  monster_pool?: string[];
  spawn_rate?: number;
}

interface BiomeVisualStyle {
  icon: string;
  accentColor: string;
  landmarks: string[];
}

const DEFAULT_MAP_WIDTH = 1040;
const DEFAULT_MAP_HEIGHT = 560;
const DEFAULT_BIOME_STYLE: BiomeVisualStyle = {
  icon: "🗺️",
  accentColor: "#4fc3f7",
  landmarks: ["Outpost", "Crossing", "Frontier"],
};

const BIOME_VISUALS: Record<string, BiomeVisualStyle> = {
  forest: {
    icon: "🌲",
    accentColor: "#6cc56c",
    landmarks: ["Whispergrove", "Old Hollow", "Verdant Gate"],
  },
  coast: {
    icon: "🌊",
    accentColor: "#4fc3f7",
    landmarks: ["Tidewatch", "Foamreach", "Salt Beacon"],
  },
  mountain: {
    icon: "⛰️",
    accentColor: "#9fb3c8",
    landmarks: ["High Pass", "Stone Crown", "Sky Gate"],
  },
  desert: {
    icon: "🏜️",
    accentColor: "#f5c16c",
    landmarks: ["Sunspire", "Dune Gate", "Mirage Camp"],
  },
  volcanic: {
    icon: "🌋",
    accentColor: "#ff875f",
    landmarks: ["Ash Spire", "Cinder Gate", "Magma Scar"],
  },
  ruins: {
    icon: "🏛️",
    accentColor: "#b9a9ff",
    landmarks: ["Fallen Archive", "Broken Forum", "Pale Reliquary"],
  },
  swamp: {
    icon: "🪷",
    accentColor: "#7abf88",
    landmarks: ["Bog Lantern", "Mire Fork", "Fen Shrine"],
  },
  cursed_land: {
    icon: "💀",
    accentColor: "#d47cff",
    landmarks: ["Grief Gate", "Woe Hollow", "Black Reliquary"],
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBiomeKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function deterministicShuffle<T>(values: T[], rng: SeededRNG): T[] {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function biomeStyleFor(biome: string): BiomeVisualStyle {
  return BIOME_VISUALS[normalizeBiomeKey(biome)] || DEFAULT_BIOME_STYLE;
}

function pathKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function pickNearestByY<T extends { mapPosition?: { y: number } }>(
  origin: T,
  pool: T[],
): T[] {
  return [...pool].sort((a, b) => {
    const aY = a.mapPosition?.y ?? 0;
    const bY = b.mapPosition?.y ?? 0;
    const originY = origin.mapPosition?.y ?? 0;
    return Math.abs(aY - originY) - Math.abs(bY - originY);
  });
}

// --- Seeded PRNG (Deterministic) ---
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  public next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  public pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)]!;
  }
}

// --- World Instance (Cached Data) ---
export class WorldInstance {
  public ownerCharacterId: string | null = null;

  constructor(
    public definition: WorldDefinition,
    public monsterPool: any[],
    public factions: any[],
    public lore: any[],
  ) {}

  public get seed(): number {
    return this.definition.seed;
  }

  public get regions(): WorldRegion[] {
    return this.definition.regions;
  }

  public get metadata(): WorldMetadata {
    return this.definition.metadata;
  }

  public get mapLayout(): WorldMapLayout {
    return this.definition.mapLayout;
  }

  public getRegionById(regionId: string): WorldRegion | null {
    return this.definition.regions.find((region) => region.id === regionId) || null;
  }

  public setMetadata(metadata: Partial<WorldMetadata>): WorldDefinition {
    this.definition = {
      ...this.definition,
      metadata: normalizeWorldMetadata(metadata, this.definition.seed),
    };
    return this.definition;
  }

  public getRandomRegion(rng: SeededRNG): WorldRegion {
    return rng.pick(this.regions);
  }

  public bindToCharacter(characterId: string | null): WorldInstance {
    this.ownerCharacterId = characterId;
    return this;
  }
}

// --- World System ---
export class WorldSystem {
  private rng!: SeededRNG;
  private worldInstance: WorldInstance | null = null;

  private async fetchWorldSupportData() {
    const [allMonsters, allFactions, allLore] = await Promise.all([
      getMonsters(),
      getFactions(),
      getLoreSnippets(),
    ]);

    return {
      allMonsters,
      allFactions,
      allLore,
    };
  }

  private matchesBiomeSelection(
    map: MapRecord,
    selection: WorldGenerationSelection,
    hints?: WorldMapGenerationHints,
  ): boolean {
    const wanted = uniqueStrings([
      ...selection.biomes,
      ...(hints?.preferredBiomes || []),
    ]).map(normalizeBiomeKey);

    if (wanted.length === 0) return true;

    const biomeKey = normalizeBiomeKey(map.biome);
    const nameKey = normalizeBiomeKey(map.name);
    return wanted.includes(biomeKey) || wanted.includes(nameKey);
  }

  private buildEnemyPool(
    map: MapRecord,
    spawnPointRows: SpawnPointRecord[],
    allMonsters: any[],
    selection: WorldGenerationSelection,
  ): string[] {
    const dbPool = uniqueStrings(
      spawnPointRows
        .filter((row) => row.map_id === map.id)
        .flatMap((row) => row.monster_pool || []),
    );

    let candidates =
      dbPool.length > 0
        ? allMonsters.filter((monster) => dbPool.includes(monster.name))
        : allMonsters.filter((monster) => {
            const monsterBiome = normalizeBiomeKey(monster.biome || monster.type);
            const regionBiome = normalizeBiomeKey(map.biome);
            return !regionBiome || monsterBiome === regionBiome;
          });

    if (selection.monsters.length > 0) {
      const picked = candidates.filter((monster) =>
        selection.monsters.includes(monster.name),
      );
      if (picked.length > 0) candidates = picked;
    }

    if (candidates.length === 0) {
      candidates = allMonsters.filter((monster) =>
        dbPool.includes(monster.name) ||
        selection.monsters.includes(monster.name),
      );
    }

    if (candidates.length === 0) {
      candidates = allMonsters;
    }

    return uniqueStrings(
      deterministicShuffle(candidates, this.rng)
        .slice(0, clamp(candidates.length > 4 ? 4 : candidates.length, 2, 4))
        .map((monster) => monster.name),
    );
  }

  private buildRegionList(
    maps: MapRecord[],
    spawnPointRows: SpawnPointRecord[],
    allMonsters: any[],
    selection: WorldGenerationSelection,
  ): WorldRegion[] {
    return maps.map((map) => {
      const biome = normalizeBiomeKey(map.biome) || "unknown";
      const style = biomeStyleFor(biome);
      const landmark =
        style.landmarks[this.rng.nextInt(0, style.landmarks.length - 1)] ||
        "Waystation";

      return {
        id: map.id,
        name: map.name,
        biome,
        dangerLevel: map.danger_level || 1,
        description: map.description || "",
        enemyPool: this.buildEnemyPool(map, spawnPointRows, allMonsters, selection),
        imageUrl: map.image_url || "",
        icon: style.icon,
        landmark,
        accentColor: style.accentColor,
        connections: [],
      };
    });
  }

  private buildMapLayout(
    seed: number,
    regions: WorldRegion[],
    hints?: WorldMapGenerationHints,
  ): WorldMapLayout {
    const topologyRng = new SeededRNG(seed ^ 0x51f15e);
    const laneCount = clamp(
      hints?.laneCount ||
        (regions.length >= 10 ? 5 : regions.length >= 7 ? 4 : 3),
      3,
      5,
    );
    const routeDensity = clamp(hints?.routeDensity ?? 0.62, 0.4, 0.9);
    const width = DEFAULT_MAP_WIDTH;
    const height = DEFAULT_MAP_HEIGHT;

    const sortedRegions = [...regions].sort((a, b) => {
      if (a.dangerLevel !== b.dangerLevel) {
        return a.dangerLevel - b.dangerLevel;
      }
      return a.name.localeCompare(b.name);
    });

    const startRegionId = sortedRegions[0]?.id || "";
    const goalRegionId = sortedRegions[sortedRegions.length - 1]?.id || "";

    const regionsByTier = new Map<number, WorldRegion[]>();
    sortedRegions.forEach((region, index) => {
      const tier =
        sortedRegions.length === 1
          ? 0
          : Math.round((index / (sortedRegions.length - 1)) * (laneCount - 1));
      region.tier = tier;
      region.isStart = region.id === startRegionId;
      region.isGoal = region.id === goalRegionId;
      if (!regionsByTier.has(tier)) regionsByTier.set(tier, []);
      regionsByTier.get(tier)!.push(region);
    });

    for (let tier = 0; tier < laneCount; tier += 1) {
      const tierRegions = regionsByTier.get(tier) || [];
      const xBase =
        laneCount === 1
          ? width / 2
          : 120 + tier * ((width - 240) / Math.max(1, laneCount - 1));

      tierRegions.forEach((region, index) => {
        const total = tierRegions.length;
        const yBase =
          total === 1
            ? height / 2
            : 85 + index * ((height - 170) / Math.max(1, total - 1));
        const jitterX = topologyRng.nextInt(-22, 22);
        const jitterY = topologyRng.nextInt(-26, 26);
        region.mapPosition = {
          x: clamp(Math.round(xBase + jitterX), 90, width - 90),
          y: clamp(Math.round(yBase + jitterY), 70, height - 70),
        };
      });
    }

    const pathSet = new Set<string>();
    const paths: WorldMapPath[] = [];
    const connectRegions = (
      fromRegion: WorldRegion,
      toRegion: WorldRegion,
      kind: WorldMapPath["kind"] = "road",
    ) => {
      const key = pathKey(fromRegion.id, toRegion.id);
      if (fromRegion.id === toRegion.id || pathSet.has(key)) return;

      pathSet.add(key);
      const baseDifficulty = Math.max(
        1,
        Math.round((fromRegion.dangerLevel + toRegion.dangerLevel) / 2),
      );
      paths.push({
        id: key,
        fromRegionId: fromRegion.id,
        toRegionId: toRegion.id,
        kind,
        difficulty: kind === "hazard" ? baseDifficulty + 2 : baseDifficulty,
        visibility: kind === "secret" ? "hidden" : "visible",
        requirements: [],
      });
    };

    for (let tier = 0; tier < laneCount - 1; tier += 1) {
      const currentTier = regionsByTier.get(tier) || [];
      const nextTier = regionsByTier.get(tier + 1) || [];
      if (currentTier.length === 0 || nextTier.length === 0) continue;

      currentTier.forEach((region) => {
        const closest = pickNearestByY(region, nextTier);
        connectRegions(
          region,
          closest[0]!,
          closest[0]?.isGoal ? "hazard" : "road",
        );
        if (
          closest[1] &&
          nextTier.length > 1 &&
          topologyRng.next() < routeDensity - 0.25
        ) {
          connectRegions(region, closest[1]!, "road");
        }
      });

      nextTier.forEach((region) => {
        const hasIncoming = paths.some((path) => path.toRegionId === region.id);
        if (!hasIncoming) {
          const previous = pickNearestByY(region, currentTier)[0];
          if (previous) connectRegions(previous, region, "road");
        }
      });
    }

    if (routeDensity > 0.68) {
      for (let tier = 1; tier < laneCount - 1; tier += 1) {
        const tierRegions = regionsByTier.get(tier) || [];
        if (tierRegions.length < 2) continue;
        for (let i = 0; i < tierRegions.length - 1; i += 1) {
          if (topologyRng.next() < 0.32) {
            connectRegions(tierRegions[i]!, tierRegions[i + 1]!, "secret");
          }
        }
      }
    }

    const nodes: WorldMapNode[] = sortedRegions.map((region) => ({
      regionId: region.id,
      x: region.mapPosition?.x || 0,
      y: region.mapPosition?.y || 0,
      tier: region.tier || 0,
      icon: region.icon || DEFAULT_BIOME_STYLE.icon,
      landmark: region.landmark || "Waystation",
      accentColor: region.accentColor || DEFAULT_BIOME_STYLE.accentColor,
      isStart: !!region.isStart,
      isGoal: !!region.isGoal,
    }));

    return {
      width,
      height,
      startRegionId,
      goalRegionId,
      nodes,
      paths,
    };
  }

  public async generateWorld(
    seed: number,
    customSelection?: WorldGenerationSelection,
    hints?: WorldMapGenerationHints,
  ): Promise<WorldInstance> {
    console.log(`[WorldSystem] Loading world instance for seed ${seed}...`);
    this.rng = new SeededRNG(seed);

    let [allMaps, allSpawnPoints, supportData] =
      await Promise.all([
        getMaps(),
        getSpawnPoints(),
        this.fetchWorldSupportData(),
      ]);
    const { allMonsters, allFactions, allLore } = supportData;

    if (allMaps.length === 0) throw new Error("No maps found in database.");

    const selection: WorldGenerationSelection = {
      biomes: Array.isArray(customSelection?.biomes)
        ? customSelection.biomes
        : [],
      monsters: Array.isArray(customSelection?.monsters)
        ? customSelection.monsters
        : [],
    };

    let candidateMaps = (allMaps as MapRecord[]).filter((map) =>
      this.matchesBiomeSelection(map, selection, hints),
    );
    if (candidateMaps.length === 0) {
      candidateMaps = allMaps as MapRecord[];
    }

    const regionBudget = clamp(
      hints?.regionBudget || this.rng.nextInt(6, 9),
      4,
      Math.min(12, candidateMaps.length),
    );
    const selectedMaps = deterministicShuffle(candidateMaps, this.rng).slice(
      0,
      regionBudget,
    );
    const sortedMaps = [...selectedMaps].sort((a, b) => {
      if (a.danger_level !== b.danger_level) {
        return a.danger_level - b.danger_level;
      }
      return a.name.localeCompare(b.name);
    });

    const regions = this.buildRegionList(
      sortedMaps,
      allSpawnPoints as SpawnPointRecord[],
      allMonsters,
      selection,
    );
    const mapLayout = this.buildMapLayout(seed, regions, hints);

    const metadata: WorldMetadata = {
      worldName: defaultWorldNameFromPreset(inferWorldPresetFromSeed(seed), seed),
      worldPreset: inferWorldPresetFromSeed(seed),
      customBiomes: selection.biomes,
      customMonsters: selection.monsters,
    };

    const definition = normalizeWorldDefinitionShape({
      seed,
      metadata,
      regions,
      mapLayout,
    });

    this.worldInstance = new WorldInstance(
      definition,
      allMonsters,
      allFactions,
      allLore,
    );
    return this.worldInstance;
  }

  public async loadWorldDefinition(
    definition: WorldDefinition,
  ): Promise<WorldInstance> {
    const normalizedDefinition = normalizeWorldDefinitionShape(
      definition,
      definition.seed,
    );
    const { allMonsters, allFactions, allLore } =
      await this.fetchWorldSupportData();

    this.worldInstance = new WorldInstance(
      normalizedDefinition,
      allMonsters,
      allFactions,
      allLore,
    );
    return this.worldInstance;
  }

  public spawnEnemy(name: string, level: number): CharacterStats {
    if (!this.worldInstance) throw new Error("World not generated.");
    const baseMonster = this.worldInstance.monsterPool.find(
      (monster) => monster.name === name,
    );

    let nameSeed = 0;
    for (let i = 0; i < name.length; i += 1) {
      nameSeed = ((nameSeed << 5) - nameSeed + name.charCodeAt(i)) | 0;
    }
    const rng = new SeededRNG(nameSeed + level);

    const baseHP = baseMonster?.base_hp || 30 + level * 8;
    const baseAttack = baseMonster?.base_attack || 5 + Math.floor(level * 1.5);
    const baseDefense =
      baseMonster?.base_defense || 2 + Math.floor(level * 0.8);
    const baseSpeed = baseMonster?.speed || 5 + Math.floor(level / 2);
    const skillMain =
      baseMonster?.skill_id || rng.nextInt(100000000, 999999999);

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
