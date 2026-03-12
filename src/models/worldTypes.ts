// src/models/worldTypes.ts
// Shared world-definition types and helpers for canonical world metadata.

export interface WorldMetadata {
  worldName: string;
  worldPreset: string;
  customBiomes: string[];
  customMonsters: string[];
}

export interface WorldGenerationSelection {
  biomes: string[];
  monsters: string[];
}

export interface WorldLocationState {
  regionIndex: number;
  mapId: string | null;
  eventId: string | null;
  combatId: string | null;
}

export interface WorldMapPosition {
  x: number;
  y: number;
}

export interface WorldMapNode {
  regionId: string;
  x: number;
  y: number;
  tier: number;
  icon: string;
  landmark: string;
  accentColor: string;
  isStart: boolean;
  isGoal: boolean;
}

export interface WorldMapPath {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  kind: "road" | "hazard" | "secret";
}

export interface WorldMapLayout {
  width: number;
  height: number;
  startRegionId: string;
  goalRegionId: string;
  nodes: WorldMapNode[];
  paths: WorldMapPath[];
}

export interface WorldMapGenerationHints {
  regionBudget?: number;
  laneCount?: number;
  routeDensity?: number;
  preferredBiomes?: string[];
  narrativeTone?: string[];
}

export interface WorldRegion {
  id: string;
  name: string;
  biome: string;
  dangerLevel: number;
  description: string;
  enemyPool: string[];
  imageUrl?: string;
  icon?: string;
  landmark?: string;
  accentColor?: string;
  tier?: number;
  mapPosition?: WorldMapPosition;
  connections?: string[];
  isStart?: boolean;
  isGoal?: boolean;
}

export interface WorldDefinition {
  seed: number;
  metadata: WorldMetadata;
  regions: WorldRegion[];
  mapLayout: WorldMapLayout;
}

export const WORLD_META_PREFIX = "world_meta:";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function inferWorldPresetFromSeed(seed: number): string {
  if (seed === 500000000) return "balanced";
  if (seed === 696969420) return "inferno";
  if (seed === 111222333) return "cursed";
  if (seed === 987654321) return "ancient";
  return "custom";
}

export function defaultWorldNameFromPreset(
  preset: string,
  seed?: number,
): string {
  if (preset === "balanced") return "The Balanced Realm";
  if (preset === "inferno") return "The Scorched World";
  if (preset === "cursed") return "The Cursed Lands";
  if (preset === "ancient") return "The Ancient World";
  if (preset === "custom") return "Custom World";
  return seed ? `World ${seed}` : "Unknown World";
}

export function normalizeWorldMetadata(
  input: Partial<WorldMetadata> | null | undefined,
  seed?: number,
): WorldMetadata {
  const safeSeed = Number(seed || 0);
  const inferredPreset = inferWorldPresetFromSeed(safeSeed);
  const worldPreset =
    typeof input?.worldPreset === "string" && input.worldPreset.trim()
      ? input.worldPreset.trim()
      : inferredPreset;

  return {
    worldName:
      typeof input?.worldName === "string" && input.worldName.trim()
        ? input.worldName.trim()
        : defaultWorldNameFromPreset(worldPreset, safeSeed),
    worldPreset,
    customBiomes: normalizeStringArray(input?.customBiomes),
    customMonsters: normalizeStringArray(input?.customMonsters),
  };
}

export function parseWorldMeta(raw: unknown, seed?: number): WorldMetadata {
  if (typeof raw !== "string" || raw.length === 0) {
    return normalizeWorldMetadata(undefined, seed);
  }

  const payload = raw.startsWith(WORLD_META_PREFIX)
    ? raw.slice(WORLD_META_PREFIX.length)
    : raw;

  try {
    return normalizeWorldMetadata(JSON.parse(payload), seed);
  } catch {
    return normalizeWorldMetadata(undefined, seed);
  }
}

export function serializeWorldMeta(
  meta: Partial<WorldMetadata>,
  seed?: number,
): string {
  return `${WORLD_META_PREFIX}${JSON.stringify(
    normalizeWorldMetadata(meta, seed),
  )}`;
}
