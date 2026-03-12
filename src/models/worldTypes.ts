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
  regionId: string | null;
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
  difficulty: number;
  visibility: "visible" | "hidden" | "fogged";
  requirements: string[];
}

export interface WorldMapLayout {
  width: number;
  height: number;
  startRegionId: string;
  goalRegionId: string;
  nodes: WorldMapNode[];
  paths: WorldMapPath[];
}

export interface WorldGeographyZone {
  id: string;
  regionId: string | null;
  biome: string;
  terrain:
    | "plains"
    | "forest"
    | "coast"
    | "highlands"
    | "desert"
    | "swamp"
    | "volcanic"
    | "ruins"
    | "cursed"
    | "tundra"
    | "void";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  opacity: number;
  recipeId?: string | null;
  assetRefs?: string[];
  sliceRefs?: string[];
}

export interface WorldGeographyFlow {
  id: string;
  kind: "river" | "ridge" | "mist";
  points: WorldMapPosition[];
  width: number;
  color: string;
  opacity: number;
  recipeId?: string | null;
  assetRefs?: string[];
}

export interface WorldGeographyLayer {
  palette: {
    sea: string;
    fog: string;
    glow: string;
  };
  zones: WorldGeographyZone[];
  flows: WorldGeographyFlow[];
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
  geography: WorldGeographyLayer;
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

function normalizePathVisibility(
  value: unknown,
): "visible" | "hidden" | "fogged" {
  return value === "hidden" || value === "fogged" ? value : "visible";
}

function normalizeTerrainKind(
  biome: unknown,
): WorldGeographyZone["terrain"] {
  switch (String(biome || "").trim().toLowerCase()) {
    case "forest":
      return "forest";
    case "coast":
      return "coast";
    case "mountain":
      return "highlands";
    case "desert":
      return "desert";
    case "swamp":
      return "swamp";
    case "volcanic":
      return "volcanic";
    case "ruins":
      return "ruins";
    case "cursed_land":
      return "cursed";
    case "tundra":
      return "tundra";
    case "abyss":
    case "void":
      return "void";
    default:
      return "plains";
  }
}

function normalizeGeographyPointList(value: unknown): WorldMapPosition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => normalizePosition(point))
    .filter((point): point is WorldMapPosition => !!point);
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
    difficulty: 1,
    visibility: "visible" as const,
    requirements: [],
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
          difficulty:
            typeof path.difficulty === "number" &&
            Number.isFinite(path.difficulty)
              ? Math.max(1, Math.round(path.difficulty))
              : 1,
          visibility: normalizePathVisibility(path.visibility),
          requirements: normalizeStringArray(path.requirements),
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

export function buildFallbackWorldGeographyLayer(
  regions: WorldRegion[],
  mapLayout: WorldMapLayout,
): WorldGeographyLayer {
  const nodeById = new Map(
    mapLayout.nodes.map((node) => [node.regionId, node] as const),
  );

  const zones = regions.map((region, index) => {
    const node = nodeById.get(region.id);
    const x = node?.x ?? region.mapPosition?.x ?? mapLayout.width / 2;
    const y = node?.y ?? region.mapPosition?.y ?? mapLayout.height / 2;
    const tier = Number.isFinite(region.tier) ? Number(region.tier) : 0;
    return {
      id: `zone-${region.id}`,
      regionId: region.id,
      biome: region.biome,
      terrain: normalizeTerrainKind(region.biome),
      x,
      y,
      width: Math.max(150, 180 + tier * 24 + ((index % 3) - 1) * 16),
      height: Math.max(96, 112 + ((index + tier) % 4) * 18),
      rotation: ((index % 5) - 2) * 8,
      color: region.accentColor || "#5fa8d3",
      opacity: 0.24,
    };
  });

  const flows = mapLayout.paths
    .map((path, index) => {
      const from = nodeById.get(path.fromRegionId);
      const to = nodeById.get(path.toRegionId);
      if (!from || !to) return null;

      return {
        id: `flow-${path.id}`,
        kind:
          path.kind === "hazard"
            ? ("ridge" as const)
            : path.visibility === "fogged"
              ? ("mist" as const)
              : ("river" as const),
        points: [
          { x: from.x, y: from.y },
          {
            x: Math.round((from.x + to.x) / 2),
            y: Math.round((from.y + to.y) / 2 + (((index % 3) - 1) * 18)),
          },
          { x: to.x, y: to.y },
        ],
        width:
          path.kind === "hazard" ? 16 : path.visibility === "fogged" ? 28 : 10,
        color:
          path.kind === "hazard"
            ? "rgba(98, 83, 76, 0.8)"
            : path.visibility === "fogged"
              ? "rgba(232, 242, 255, 0.72)"
              : "rgba(132, 197, 231, 0.8)",
        opacity:
          path.kind === "hazard" ? 0.3 : path.visibility === "fogged" ? 0.18 : 0.36,
      };
    })
    .filter((flow): flow is WorldGeographyFlow => !!flow);

  return {
    palette: {
      sea: "#7fbde2",
      fog: "rgba(228, 241, 255, 0.56)",
      glow: "rgba(179, 224, 255, 0.2)",
    },
    zones,
    flows,
  };
}

export function normalizeWorldGeographyLayer(
  input: Partial<WorldGeographyLayer> | null | undefined,
  regions: WorldRegion[],
  mapLayout: WorldMapLayout,
): WorldGeographyLayer {
  const fallback = buildFallbackWorldGeographyLayer(regions, mapLayout);
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const zones = Array.isArray(input.zones)
    ? input.zones
        .filter((zone) => !!zone && typeof zone === "object")
        .map<WorldGeographyZone>((zone, index) => {
          const record = zone as unknown as Record<string, unknown>;
          return {
            id:
              typeof record.id === "string" && record.id.trim()
                ? record.id.trim()
                : `zone-${index}`,
            regionId:
              typeof record.regionId === "string" && record.regionId.trim()
                ? record.regionId.trim()
                : null,
            biome:
              typeof record.biome === "string" && record.biome.trim()
                ? record.biome.trim()
                : "unknown",
            terrain: normalizeTerrainKind(record.terrain || record.biome),
            x:
              typeof record.x === "number" && Number.isFinite(record.x)
                ? record.x
                : fallback.zones[index]?.x || mapLayout.width / 2,
            y:
              typeof record.y === "number" && Number.isFinite(record.y)
                ? record.y
                : fallback.zones[index]?.y || mapLayout.height / 2,
            width:
              typeof record.width === "number" && Number.isFinite(record.width)
                ? Math.max(40, record.width)
                : fallback.zones[index]?.width || 180,
            height:
              typeof record.height === "number" && Number.isFinite(record.height)
                ? Math.max(40, record.height)
                : fallback.zones[index]?.height || 120,
            rotation:
              typeof record.rotation === "number" && Number.isFinite(record.rotation)
                ? record.rotation
                : 0,
            color:
              typeof record.color === "string" && record.color.trim()
                ? record.color
                : fallback.zones[index]?.color || "#5fa8d3",
            opacity:
              typeof record.opacity === "number" && Number.isFinite(record.opacity)
                ? Math.max(0.05, Math.min(1, record.opacity))
                : fallback.zones[index]?.opacity || 0.24,
            recipeId:
              typeof record.recipeId === "string" && record.recipeId.trim()
                ? record.recipeId.trim()
                : null,
            assetRefs: normalizeStringArray(record.assetRefs),
            sliceRefs: normalizeStringArray(record.sliceRefs),
          };
        })
    : fallback.zones;

  const flows = Array.isArray(input.flows)
    ? input.flows
        .filter((flow) => !!flow && typeof flow === "object")
        .map<WorldGeographyFlow>((flow, index) => {
          const record = flow as unknown as Record<string, unknown>;
          return {
            id:
              typeof record.id === "string" && record.id.trim()
                ? record.id.trim()
                : `flow-${index}`,
            kind:
              record.kind === "ridge" || record.kind === "mist"
                ? record.kind
                : "river",
            points: normalizeGeographyPointList(record.points),
            width:
              typeof record.width === "number" && Number.isFinite(record.width)
                ? Math.max(2, record.width)
                : fallback.flows[index]?.width || 10,
            color:
              typeof record.color === "string" && record.color.trim()
                ? record.color
                : fallback.flows[index]?.color || "rgba(132, 197, 231, 0.8)",
            opacity:
              typeof record.opacity === "number" && Number.isFinite(record.opacity)
                ? Math.max(0.04, Math.min(1, record.opacity))
                : fallback.flows[index]?.opacity || 0.3,
            recipeId:
              typeof record.recipeId === "string" && record.recipeId.trim()
                ? record.recipeId.trim()
                : null,
            assetRefs: normalizeStringArray(record.assetRefs),
          };
        })
        .filter((flow) => flow.points.length >= 2)
    : fallback.flows;

  return {
    palette: {
      sea:
        typeof input.palette?.sea === "string" && input.palette.sea.trim()
          ? input.palette.sea
          : fallback.palette.sea,
      fog:
        typeof input.palette?.fog === "string" && input.palette.fog.trim()
          ? input.palette.fog
          : fallback.palette.fog,
      glow:
        typeof input.palette?.glow === "string" && input.palette.glow.trim()
          ? input.palette.glow
          : fallback.palette.glow,
    },
    zones: zones.length > 0 ? zones : fallback.zones,
    flows,
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

  const mapLayout = normalizeWorldMapLayout(input?.mapLayout, regions);
  const geography = normalizeWorldGeographyLayer(
    input?.geography,
    regions,
    mapLayout,
  );
  const nodeById = new Map(
    mapLayout.nodes.map((node) => [node.regionId, node] as const),
  );
  const connectionMap = new Map<string, Set<string>>();
  mapLayout.paths.forEach((path) => {
    if (!connectionMap.has(path.fromRegionId)) {
      connectionMap.set(path.fromRegionId, new Set());
    }
    if (!connectionMap.has(path.toRegionId)) {
      connectionMap.set(path.toRegionId, new Set());
    }
    connectionMap.get(path.fromRegionId)!.add(path.toRegionId);
    connectionMap.get(path.toRegionId)!.add(path.fromRegionId);
  });

  const normalizedRegions = regions.map((region) => {
    const node = nodeById.get(region.id);
    return {
      ...region,
      tier: node?.tier ?? region.tier ?? 0,
      mapPosition: node
        ? { x: node.x, y: node.y }
        : region.mapPosition,
      connections: Array.from(connectionMap.get(region.id) || []),
      isStart:
        typeof node?.isStart === "boolean"
          ? node.isStart
          : !!region.isStart || region.id === mapLayout.startRegionId,
      isGoal:
        typeof node?.isGoal === "boolean"
          ? node.isGoal
          : !!region.isGoal || region.id === mapLayout.goalRegionId,
      icon: node?.icon || region.icon,
      landmark: node?.landmark || region.landmark,
      accentColor: node?.accentColor || region.accentColor,
    };
  });

  return {
    seed: safeSeed,
    metadata: normalizeWorldMetadata(input?.metadata, safeSeed),
    regions: normalizedRegions,
    mapLayout,
    geography,
  };
}
