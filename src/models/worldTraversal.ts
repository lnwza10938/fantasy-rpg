import type { WorldDefinition, WorldMapPath } from "./worldTypes.js";

export interface TraversalRuntimeState {
  currentRegionId: string | null;
  discoveredRegionIds: string[];
  visitedRegionIds: string[];
  clearedRegionIds: string[];
  lockedRegionIds: string[];
  revealedPathIds: string[];
  traversedPathIds: string[];
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

function humanizeRegionRef(regionRef: string): string {
  return regionRef
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPathBetweenRegions(
  definition: WorldDefinition,
  fromRegionId: string | null | undefined,
  toRegionId: string | null | undefined,
): WorldMapPath | null {
  if (!fromRegionId || !toRegionId) return null;
  return (
    definition.mapLayout.paths.find(
      (path) =>
        (path.fromRegionId === fromRegionId && path.toRegionId === toRegionId) ||
        (path.fromRegionId === toRegionId && path.toRegionId === fromRegionId),
    ) || null
  );
}

export function getOtherPathRegionId(
  path: WorldMapPath,
  regionId: string | null | undefined,
): string {
  return path.fromRegionId === regionId ? path.toRegionId : path.fromRegionId;
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
    revealedPathIds: uniqueStrings(value?.revealedPathIds || []),
    traversedPathIds: uniqueStrings(value?.traversedPathIds || []),
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

export function isPathVisible(
  path: WorldMapPath,
  runtime: TraversalRuntimeState,
): boolean {
  if (path.visibility === "visible") return true;

  const explicitlyRevealed =
    runtime.revealedPathIds.includes(path.id) ||
    runtime.traversedPathIds.includes(path.id);

  if (path.visibility === "hidden") {
    return explicitlyRevealed;
  }

  return (
    explicitlyRevealed ||
    runtime.discoveredRegionIds.includes(path.fromRegionId) ||
    runtime.discoveredRegionIds.includes(path.toRegionId) ||
    runtime.currentRegionId === path.fromRegionId ||
    runtime.currentRegionId === path.toRegionId
  );
}

export function revealPathsFromRegion(
  definition: WorldDefinition,
  runtime: TraversalRuntimeState,
  regionId: string | null | undefined,
  options?: {
    includeHidden?: boolean;
  },
): TraversalRuntimeState {
  if (!regionId) return normalizeTraversalRuntimeState(runtime);

  const adjacentPaths = getAdjacentPaths(definition, regionId).filter(
    (path) => path.visibility !== "hidden" || options?.includeHidden,
  );

  return normalizeTraversalRuntimeState({
    ...runtime,
    discoveredRegionIds: [
      ...runtime.discoveredRegionIds,
      regionId,
      ...adjacentPaths.map((path) => getOtherPathRegionId(path, regionId)),
    ],
    revealedPathIds: [
      ...runtime.revealedPathIds,
      ...adjacentPaths.map((path) => path.id),
    ],
  });
}

export function syncTraversalKnowledge(
  definition: WorldDefinition,
  runtime: Partial<TraversalRuntimeState> | null | undefined,
): TraversalRuntimeState {
  let next = normalizeTraversalRuntimeState(runtime);
  const revealAnchors = uniqueStrings([
    next.currentRegionId || "",
    ...next.visitedRegionIds,
  ]);

  revealAnchors.forEach((regionId) => {
    next = revealPathsFromRegion(definition, next, regionId);
  });

  next.clearedRegionIds.forEach((regionId) => {
    next = revealPathsFromRegion(definition, next, regionId, {
      includeHidden: true,
    });
  });

  return next;
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

  return syncTraversalKnowledge(definition, {
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
    revealedPathIds: uniqueStrings(normalized.revealedPathIds),
    traversedPathIds: uniqueStrings(normalized.traversedPathIds),
  });
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
  const visible = isPathVisible(path, runtime);

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

  if (!visible) {
    return {
      path,
      targetRegionId,
      visible: false,
      traversable: false,
      blockedReason: "Path is hidden",
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

  if (path.kind === "hazard" && path.difficulty > playerLevel + 3) {
    return {
      path,
      targetRegionId,
      visible,
      traversable: false,
      blockedReason: `danger:${path.difficulty}`,
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
    .filter((path) => isPathVisible(path, activeState))
    .map((path) => path.id);
}

export function formatTraversalRequirement(requirement: string): string {
  if (requirement.startsWith("level:")) {
    return `Requires level ${Number(requirement.split(":")[1] || 0)}`;
  }
  if (requirement.startsWith("visited:")) {
    return `Visit ${humanizeRegionRef(requirement.slice("visited:".length))} first`;
  }
  if (requirement.startsWith("cleared:")) {
    return `Clear ${humanizeRegionRef(requirement.slice("cleared:".length))} first`;
  }
  if (requirement.startsWith("discovered:")) {
    return `Discover ${humanizeRegionRef(requirement.slice("discovered:".length))} first`;
  }
  return requirement;
}

export function formatTraversalBlockedReason(reason: string | null): string {
  if (!reason) return "Route unavailable";
  if (reason === "Path is hidden") return "This is still a hidden route.";
  if (reason === "Path is locked") return "This route is locked right now.";
  if (reason === "Path is not adjacent") {
    return "Travel only works across directly connected routes.";
  }
  if (reason.startsWith("danger:")) {
    return `This route is too dangerous right now. Recommended level ${reason.split(":")[1] || "?"}.`;
  }
  if (
    reason.startsWith("level:") ||
    reason.startsWith("visited:") ||
    reason.startsWith("cleared:") ||
    reason.startsWith("discovered:")
  ) {
    return formatTraversalRequirement(reason);
  }
  return reason;
}
