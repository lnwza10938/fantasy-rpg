import type { WorldDefinition, WorldMapPath } from "./worldTypes.js";

export interface TraversalRuntimeState {
  currentRegionId: string | null;
  discoveredRegionIds: string[];
  visitedRegionIds: string[];
  clearedRegionIds: string[];
  lockedRegionIds: string[];
}

export interface TraversalPathEvaluation {
  path: WorldMapPath;
  targetRegionId: string;
  visible: boolean;
  traversable: boolean;
  blockedReason: string | null;
}

function uniqueStrings(values: string[] = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasRequirement(
  requirement: string,
  runtime: TraversalRuntimeState,
  playerLevel = 1,
): boolean {
  if (requirement.startsWith("level:")) {
    return playerLevel >= Number(requirement.split(":")[1] || 0);
  }
  if (requirement.startsWith("visited:")) {
    return runtime.visitedRegionIds.includes(requirement.slice("visited:".length));
  }
  if (requirement.startsWith("cleared:")) {
    return runtime.clearedRegionIds.includes(requirement.slice("cleared:".length));
  }
  if (requirement.startsWith("discovered:")) {
    return runtime.discoveredRegionIds.includes(
      requirement.slice("discovered:".length),
    );
  }
  return false;
}

export function normalizeTraversalRuntimeState(
  value: Partial<TraversalRuntimeState> | null | undefined,
): TraversalRuntimeState {
  return {
    currentRegionId:
      typeof value?.currentRegionId === "string" && value.currentRegionId.trim()
        ? value.currentRegionId.trim()
        : null,
    discoveredRegionIds: uniqueStrings(value?.discoveredRegionIds || []),
    visitedRegionIds: uniqueStrings(value?.visitedRegionIds || []),
    clearedRegionIds: uniqueStrings(value?.clearedRegionIds || []),
    lockedRegionIds: uniqueStrings(value?.lockedRegionIds || []),
  };
}

export function getRegionIndexById(
  definition: WorldDefinition,
  regionId: string | null | undefined,
): number {
  if (!regionId) return -1;
  return definition.regions.findIndex((region) => region.id === regionId);
}

export function getRegionById(
  definition: WorldDefinition,
  regionId: string | null | undefined,
) {
  if (!regionId) return null;
  return definition.regions.find((region) => region.id === regionId) || null;
}

export function getAdjacentPaths(
  definition: WorldDefinition,
  regionId: string | null | undefined,
): WorldMapPath[] {
  if (!regionId) return [];
  return definition.mapLayout.paths.filter(
    (path) => path.fromRegionId === regionId || path.toRegionId === regionId,
  );
}

export function hydrateTraversalRuntimeState(
  definition: WorldDefinition,
  value: Partial<TraversalRuntimeState> | null | undefined,
  fallbackRegionId?: string | null,
): TraversalRuntimeState {
  const normalized = normalizeTraversalRuntimeState(value);
  const startRegionId =
    fallbackRegionId ||
    normalized.currentRegionId ||
    definition.mapLayout.startRegionId ||
    definition.regions[0]?.id ||
    null;

  return {
    ...normalized,
    currentRegionId: startRegionId,
    discoveredRegionIds: uniqueStrings([
      ...normalized.discoveredRegionIds,
      ...(startRegionId ? [startRegionId] : []),
    ]),
    visitedRegionIds: uniqueStrings([
      ...normalized.visitedRegionIds,
      ...(startRegionId ? [startRegionId] : []),
    ]),
    clearedRegionIds: uniqueStrings(normalized.clearedRegionIds),
    lockedRegionIds: uniqueStrings(normalized.lockedRegionIds),
  };
}

export function evaluatePathTraversal(
  definition: WorldDefinition,
  runtime: TraversalRuntimeState,
  path: WorldMapPath,
  playerLevel = 1,
): TraversalPathEvaluation {
  const currentRegionId =
    runtime.currentRegionId || definition.mapLayout.startRegionId || null;
  const targetRegionId =
    path.fromRegionId === currentRegionId
      ? path.toRegionId
      : path.toRegionId === currentRegionId
        ? path.fromRegionId
        : path.toRegionId;
  const visible =
    path.visibility !== "hidden" ||
    runtime.discoveredRegionIds.includes(path.fromRegionId) ||
    runtime.discoveredRegionIds.includes(path.toRegionId) ||
    runtime.currentRegionId === path.fromRegionId ||
    runtime.currentRegionId === path.toRegionId;

  if (!currentRegionId) {
    return {
      path,
      targetRegionId,
      visible,
      traversable: false,
      blockedReason: "No current region",
    };
  }

  if (
    path.fromRegionId !== currentRegionId &&
    path.toRegionId !== currentRegionId
  ) {
    return {
      path,
      targetRegionId,
      visible,
      traversable: false,
      blockedReason: "Path is not adjacent",
    };
  }

  if (runtime.lockedRegionIds.includes(targetRegionId)) {
    return {
      path,
      targetRegionId,
      visible,
      traversable: false,
      blockedReason: "Path is locked",
    };
  }

  const unmetRequirement = (path.requirements || []).find(
    (requirement) => !hasRequirement(requirement, runtime, playerLevel),
  );

  return {
    path,
    targetRegionId,
    visible,
    traversable: !unmetRequirement,
    blockedReason: unmetRequirement || null,
  };
}

export function getReachableRegionIds(
  definition: WorldDefinition,
  runtime: TraversalRuntimeState,
  playerLevel = 1,
): string[] {
  const activeState = hydrateTraversalRuntimeState(definition, runtime);
  return uniqueStrings(
    getAdjacentPaths(definition, activeState.currentRegionId)
      .map((path) => evaluatePathTraversal(definition, activeState, path, playerLevel))
      .filter((entry) => entry.traversable)
      .map((entry) => entry.targetRegionId),
  );
}

export function getVisiblePathIds(
  definition: WorldDefinition,
  runtime: TraversalRuntimeState,
): string[] {
  const activeState = hydrateTraversalRuntimeState(definition, runtime);
  return definition.mapLayout.paths
    .filter(
      (path) =>
        path.visibility !== "hidden" ||
        activeState.discoveredRegionIds.includes(path.fromRegionId) ||
        activeState.discoveredRegionIds.includes(path.toRegionId) ||
        activeState.currentRegionId === path.fromRegionId ||
        activeState.currentRegionId === path.toRegionId,
    )
    .map((path) => path.id);
}
