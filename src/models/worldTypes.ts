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
export const DEFAULT_WORLD_MAP_WIDTH = 1040;
export const DEFAULT_WORLD_MAP_HEIGHT = 560;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizePosition(value: unknown): WorldMapPosition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  if (typeof input.x !== "number" || typeof input.y !== "number") {
    return undefined;
  }
  return { x: input.x, y: input.y };
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
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

export function normalizeWorldRegion(
  input: Partial<WorldRegion> | null | undefined,
  index = 0,
): WorldRegion {
  const mapPosition = normalizePosition(input?.mapPosition);

  return {
    id:
      typeof input?.id === "string" && input.id.trim()
        ? input.id.trim()
        : `region-${index}`,
    name:
      typeof input?.name === "string" && input.name.trim()
        ? input.name.trim()
        : `Region ${index + 1}`,
    biome:
      typeof input?.biome === "string" && input.biome.trim()
        ? input.biome.trim()
        : "unknown",
    dangerLevel:
      typeof input?.dangerLevel === "number" && Number.isFinite(input.dangerLevel)
        ? input.dangerLevel
        : 1,
    description:
      typeof input?.description === "string" ? input.description : "",
    enemyPool: normalizeStringArray(input?.enemyPool),
    imageUrl: typeof input?.imageUrl === "string" ? input.imageUrl : "",
    icon: typeof input?.icon === "string" ? input.icon : "🗺️",
    landmark:
      typeof input?.landmark === "string" ? input.landmark : "Waystation",
    accentColor:
      typeof input?.accentColor === "string"
        ? input.accentColor
        : "#4fc3f7",
    tier:
      typeof input?.tier === "number" && Number.isFinite(input.tier)
        ? input.tier
        : 0,
    mapPosition,
    connections: normalizeStringArray(input?.connections),
    isStart: normalizeBoolean(input?.isStart),
    isGoal: normalizeBoolean(input?.isGoal),
  };
}

export function buildFallbackWorldMapLayout(
  regions: WorldRegion[],
  input?: Partial<WorldMapLayout> | null,
): WorldMapLayout {
  const width =
    typeof input?.width === "number" && Number.isFinite(input.width)
      ? input.width
      : DEFAULT_WORLD_MAP_WIDTH;
  const height =
    typeof input?.height === "number" && Number.isFinite(input.height)
      ? input.height
      : DEFAULT_WORLD_MAP_HEIGHT;
  const columns =
    regions.length <= 1 ? 1 : regions.length >= 10 ? 5 : regions.length >= 7 ? 4 : 3;

  const nodes = regions.map((region, index) => {
    const col =
      columns === 1
        ? 0
        : Math.round((index / Math.max(1, regions.length - 1)) * (columns - 1));
    const tierMembers = regions.filter((candidate, candidateIndex) => {
      const candidateCol =
        columns === 1
          ? 0
          : Math.round(
              (candidateIndex / Math.max(1, regions.length - 1)) * (columns - 1),
            );
      return candidateCol === col;
    });
    const row = Math.max(
      0,
      tierMembers.findIndex((entry) => entry.id === region.id),
    );
    const x =
      region.mapPosition?.x ??
      (columns === 1 ? width / 2 : 120 + col * ((width - 240) / (columns - 1)));
    const y =
      region.mapPosition?.y ??
      (tierMembers.length === 1
        ? height / 2
        : 90 + row * ((height - 180) / Math.max(1, tierMembers.length - 1)));

    return {
      regionId: region.id,
      x,
      y,
      tier:
        typeof region.tier === "number" && Number.isFinite(region.tier)
          ? region.tier
          : col,
      icon: region.icon || "🗺️",
      landmark: region.landmark || "Waystation",
      accentColor: region.accentColor || "#4fc3f7",
      isStart: region.isStart || index === 0,
      isGoal: region.isGoal || index === regions.length - 1,
    };
  });

  const paths = nodes.slice(0, -1).map((node, index) => ({
    id: `${node.regionId}::${nodes[index + 1]!.regionId}`,
    fromRegionId: node.regionId,
    toRegionId: nodes[index + 1]!.regionId,
    kind: "road" as const,
  }));

  return {
    width,
    height,
    startRegionId:
      typeof input?.startRegionId === "string" && input.startRegionId.trim()
        ? input.startRegionId
        : nodes[0]?.regionId || "",
    goalRegionId:
      typeof input?.goalRegionId === "string" && input.goalRegionId.trim()
        ? input.goalRegionId
        : nodes[nodes.length - 1]?.regionId || "",
    nodes,
    paths,
  };
}

export function normalizeWorldMapLayout(
  input: Partial<WorldMapLayout> | null | undefined,
  regions: WorldRegion[],
): WorldMapLayout {
  if (!input || !Array.isArray(input.nodes) || input.nodes.length === 0) {
    return buildFallbackWorldMapLayout(regions, input);
  }

  const nodes = input.nodes.map((node, index) => ({
    regionId:
      typeof node?.regionId === "string" && node.regionId.trim()
        ? node.regionId.trim()
        : regions[index]?.id || `region-${index}`,
    x:
      typeof node?.x === "number" && Number.isFinite(node.x)
        ? node.x
        : regions[index]?.mapPosition?.x || 0,
    y:
      typeof node?.y === "number" && Number.isFinite(node.y)
        ? node.y
        : regions[index]?.mapPosition?.y || 0,
    tier:
      typeof node?.tier === "number" && Number.isFinite(node.tier)
        ? node.tier
        : regions[index]?.tier || 0,
    icon:
      typeof node?.icon === "string" ? node.icon : regions[index]?.icon || "🗺️",
    landmark:
      typeof node?.landmark === "string"
        ? node.landmark
        : regions[index]?.landmark || "Waystation",
    accentColor:
      typeof node?.accentColor === "string"
        ? node.accentColor
        : regions[index]?.accentColor || "#4fc3f7",
    isStart: normalizeBoolean(node?.isStart),
    isGoal: normalizeBoolean(node?.isGoal),
  }));

  const paths = Array.isArray(input.paths)
    ? input.paths
        .filter(
          (path): path is WorldMapPath =>
            !!path &&
            typeof path === "object" &&
            typeof path.id === "string" &&
            typeof path.fromRegionId === "string" &&
            typeof path.toRegionId === "string",
        )
        .map<WorldMapPath>((path) => ({
          id: path.id,
          fromRegionId: path.fromRegionId,
          toRegionId: path.toRegionId,
          kind:
            path.kind === "hazard" || path.kind === "secret"
              ? path.kind
              : "road",
        }))
    : buildFallbackWorldMapLayout(regions, input).paths;

  return {
    width:
      typeof input.width === "number" && Number.isFinite(input.width)
        ? input.width
        : DEFAULT_WORLD_MAP_WIDTH,
    height:
      typeof input.height === "number" && Number.isFinite(input.height)
        ? input.height
        : DEFAULT_WORLD_MAP_HEIGHT,
    startRegionId:
      typeof input.startRegionId === "string" && input.startRegionId.trim()
        ? input.startRegionId
        : nodes[0]?.regionId || "",
    goalRegionId:
      typeof input.goalRegionId === "string" && input.goalRegionId.trim()
        ? input.goalRegionId
        : nodes[nodes.length - 1]?.regionId || "",
    nodes,
    paths,
  };
}

export function normalizeWorldDefinitionShape(
  input: Partial<WorldDefinition> | null | undefined,
  seed?: number,
): WorldDefinition {
  const safeSeed =
    typeof input?.seed === "number" && Number.isFinite(input.seed)
      ? input.seed
      : Number(seed || 0);
  const regions = Array.isArray(input?.regions)
    ? input.regions.map((region, index) => normalizeWorldRegion(region, index))
    : [];

  return {
    seed: safeSeed,
    metadata: normalizeWorldMetadata(input?.metadata, safeSeed),
    regions,
    mapLayout: normalizeWorldMapLayout(input?.mapLayout, regions),
  };
}
