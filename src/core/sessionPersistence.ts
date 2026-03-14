// src/core/sessionPersistence.ts
// Helpers that separate persisted runtime rows from canonical world/session state.

import {
  GamePhase,
  GameStateManager,
  type EquipmentSlots,
  type InventorySlot,
  type StructuredGameStateData,
} from "./gameState.js";
import type { WorldMetadata } from "../models/worldTypes.js";
import type { TraversalRuntimeState } from "../models/worldTraversal.js";
import {
  normalizeWorldMetadata,
  parseWorldMeta,
} from "../models/worldTypes.js";
import { normalizeTraversalRuntimeState } from "../models/worldTraversal.js";

const WORLD_SESSION_PREFIX = "world_session:";

interface PersistedWorldSessionEnvelope {
  metadata?: Partial<WorldMetadata>;
  location?: {
    regionId?: string | null;
  };
  traversal?: Partial<TraversalRuntimeState>;
}

export interface PersistedPlayerStateRecord {
  character_id: string;
  current_region?: number | null;
  current_map?: string | null;
  hp?: number | null;
  mana?: number | null;
  max_hp?: number | null;
  max_mana?: number | null;
  exp?: number | null;
  level?: number | null;
  gold?: number | null;
  inventory_json?: unknown;
  equipment_json?: unknown;
  world_seed?: number | string | null;
  phase?: string | null;
  character_name?: string | null;
  last_event?: string | null;
  last_action_log?: string | null;
  updated_at?: string | null;
}

export interface PersistedPlayerStateUpsert {
  character_id: string;
  current_region: number;
  current_map: string | null;
  hp: number;
  mana: number;
  max_hp: number;
  max_mana: number;
  exp: number;
  level: number;
  gold: number;
  inventory_json: InventorySlot[];
  equipment_json: EquipmentSlots;
  world_seed: number;
  phase: GamePhase;
  character_name: string;
  last_event: string;
  last_action_log: string | null;
  updated_at: string;
}

export interface WorldArchiveRecord {
  characterId: string;
  characterName: string;
  worldSeed: number;
  worldName: string;
  worldPreset: string;
  customBiomes: string[];
  customMonsters: string[];
  regionIndex: number;
  phase: string;
  lastActionLog: string | null;
  updatedAt: string | null;
}

function normalizePhase(raw: unknown): GamePhase {
  return Object.values(GamePhase).includes(raw as GamePhase)
    ? (raw as GamePhase)
    : GamePhase.IDLE;
}

function parseInventory(raw: unknown): InventorySlot[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (entry): entry is { itemId: string; qty: number } =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as any).itemId === "string" &&
        typeof (entry as any).qty === "number",
    )
    .map((entry) => ({
      itemId: entry.itemId,
      qty: Math.max(0, Math.floor(entry.qty)),
    }))
    .filter((entry) => entry.qty > 0);
}

function parseEquipment(raw: unknown): EquipmentSlots {
  if (!raw || typeof raw !== "object") {
    return { weapon: null, armor: null, accessory: null };
  }

  const value = raw as Record<string, unknown>;
  return {
    weapon: typeof value.weapon === "string" ? value.weapon : null,
    armor: typeof value.armor === "string" ? value.armor : null,
    accessory: typeof value.accessory === "string" ? value.accessory : null,
  };
}

interface StoredTraversalLike {
  currentRegionId?: unknown;
  discoveredRegionIds?: unknown;
  visitedRegionIds?: unknown;
  clearedRegionIds?: unknown;
  lockedRegionIds?: unknown;
  revealedPathIds?: unknown;
  traversedPathIds?: unknown;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function validateStoredTraversalState(
  traversal: StoredTraversalLike | null | undefined,
  worldDefinition?: { regions?: Array<{ id: string }>; mapLayout?: { paths?: Array<{ id: string }> } } | null,
) {
  if (!traversal || typeof traversal !== "object") {
    throw new Error("Missing traversal state");
  }

  const currentRegionId = typeof traversal.currentRegionId === "string" ? traversal.currentRegionId : null;
  if (!currentRegionId) {
    throw new Error("Missing currentRegionId");
  }

  const discoveredRegionIds = asStringArray(traversal.discoveredRegionIds);
  const visitedRegionIds = asStringArray(traversal.visitedRegionIds);
  const clearedRegionIds = asStringArray(traversal.clearedRegionIds);
  const lockedRegionIds = asStringArray(traversal.lockedRegionIds);
  const revealedPathIds = asStringArray(traversal.revealedPathIds);
  const traversedPathIds = asStringArray(traversal.traversedPathIds);

  if (!worldDefinition) {
    return {
      currentRegionId,
      discoveredRegionIds,
      visitedRegionIds,
      clearedRegionIds,
      lockedRegionIds,
      revealedPathIds,
      traversedPathIds,
    };
  }

  const validRegionIds = new Set(
    Array.isArray(worldDefinition.regions)
      ? worldDefinition.regions
          .map((region) => region?.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  );

  const validPathIds = new Set(
    Array.isArray(worldDefinition.mapLayout?.paths)
      ? worldDefinition.mapLayout!.paths!
          .map((path) => path?.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  );

  if (!validRegionIds.has(currentRegionId)) {
    throw new Error(`Invalid currentRegionId: ${currentRegionId}`);
  }

  const assertKnownRegions = (label: string, ids: string[]) => {
    for (const id of ids) {
      if (!validRegionIds.has(id)) {
        throw new Error(`Unknown region id in ${label}: ${id}`);
      }
    }
  };

  const assertKnownPaths = (label: string, ids: string[]) => {
    for (const id of ids) {
      if (!validPathIds.has(id)) {
        throw new Error(`Unknown path id in ${label}: ${id}`);
      }
    }
  };

  assertKnownRegions("discoveredRegionIds", discoveredRegionIds);
  assertKnownRegions("visitedRegionIds", visitedRegionIds);
  assertKnownRegions("clearedRegionIds", clearedRegionIds);
  assertKnownRegions("lockedRegionIds", lockedRegionIds);
  assertKnownPaths("revealedPathIds", revealedPathIds);
  assertKnownPaths("traversedPathIds", traversedPathIds);

  return {
    currentRegionId,
    discoveredRegionIds,
    visitedRegionIds,
    clearedRegionIds,
    lockedRegionIds,
    revealedPathIds,
    traversedPathIds,
  };
}

function parseStoredWorldSession(
  raw: unknown,
  seed: number,
  worldDefinition?: any,
): {
  metadata: WorldMetadata;
  location: { regionId: string | null };
  traversal: TraversalRuntimeState;
} {
  if (typeof raw !== "string" || raw.length === 0) {
    return {
      metadata: normalizeWorldMetadata(undefined, seed),
      location: { regionId: null },
      traversal: normalizeTraversalRuntimeState(undefined),
    };
  }

  if (raw.startsWith(WORLD_SESSION_PREFIX)) {
    try {
      const jsonStr = raw.substring(WORLD_SESSION_PREFIX.length);
      const parsed = JSON.parse(jsonStr);

      const validatedTraversal = validateStoredTraversalState(
        parsed.traversal,
        worldDefinition,
      );

      return {
        metadata: normalizeWorldMetadata(parsed.metadata, seed),
        location: {
          regionId:
            typeof parsed.location?.regionId === "string" &&
            parsed.location.regionId.trim()
              ? parsed.location.regionId.trim()
              : null,
        },
        traversal: normalizeTraversalRuntimeState(validatedTraversal),
      };
    } catch (err) {
      console.warn("[SessionRestore] traversal validation failed:", err);
      /* fall through to default */
    }
  }

  return {
    metadata: parseWorldMeta(raw, seed),
    location: { regionId: null },
    traversal: normalizeTraversalRuntimeState(undefined),
  };
}

function serializeStoredWorldSession(
  world: StructuredGameStateData["world"],
): string {
  return `${WORLD_SESSION_PREFIX}${JSON.stringify({
    metadata: world.metadata,
    location: {
      regionId: world.location.regionId,
    },
    traversal: world.traversal,
  })}`;
}

export function hydrateGameStateFromSave(
  save: PersistedPlayerStateRecord,
  worldMetadata?: Partial<WorldMetadata> | null,
): GameStateManager {
  const seed = Number(save.world_seed || 0);
  const gsm = new GameStateManager(save.character_id, save.character_id, seed);
  const storedWorld = parseStoredWorldSession(save.last_event, seed);

  gsm.setPhase(normalizePhase(save.phase));
  gsm.updateCharacter({
    hp: Number(save.hp ?? 100),
    maxHP: Number(save.max_hp ?? 100),
    mana: Number(save.mana ?? 50),
    maxMana: Number(save.max_mana ?? 50),
    exp: Number(save.exp ?? 0),
    level: Number(save.level ?? 1),
    gold: Number(save.gold ?? 0),
    characterName: save.character_name || "Hero",
  });
  gsm.setLocation(
    Number(save.current_region ?? 0),
    typeof save.current_map === "string" ? save.current_map : undefined,
    storedWorld.location.regionId,
  );
  gsm.setWorldMeta(
    normalizeWorldMetadata(
      worldMetadata || storedWorld.metadata,
      seed,
    ),
  );
  gsm.setTraversalState(storedWorld.traversal);
  gsm.setInventory(parseInventory(save.inventory_json));
  gsm.setEquipment(parseEquipment(save.equipment_json));

  return gsm;
}

export function serializeSessionForSave(
  session: StructuredGameStateData,
  lastLog?: string,
): PersistedPlayerStateUpsert {
  return {
    character_id: session.characterId,
    current_region: session.world.location.regionIndex,
    current_map: session.world.location.mapId,
    hp: session.runtime.hp,
    mana: session.runtime.mana,
    max_hp: session.runtime.maxHP,
    max_mana: session.runtime.maxMana,
    exp: session.runtime.exp,
    level: session.runtime.level,
    gold: session.runtime.gold,
    inventory_json: session.runtime.inventory,
    equipment_json: session.runtime.equipment,
    world_seed: session.world.seed,
    phase: session.phase,
    character_name: session.runtime.characterName,
    last_event: serializeStoredWorldSession(session.world),
    last_action_log: lastLog || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSaveToWorldArchive(
  save: Pick<
    PersistedPlayerStateRecord,
    | "character_id"
    | "character_name"
    | "world_seed"
    | "current_region"
    | "phase"
    | "last_action_log"
    | "updated_at"
    | "last_event"
  >,
  fallbackCharacterName?: string,
  worldMetadata?: Partial<WorldMetadata> | null,
): WorldArchiveRecord {
  const worldSeed = Number(save.world_seed || 0);
  const storedWorld = parseStoredWorldSession(save.last_event, worldSeed);
  const meta = normalizeWorldMetadata(
    worldMetadata || storedWorld.metadata,
    worldSeed,
  );

  return {
    characterId: save.character_id,
    characterName: save.character_name || fallbackCharacterName || "Hero",
    worldSeed,
    worldName: meta.worldName,
    worldPreset: meta.worldPreset,
    customBiomes: meta.customBiomes,
    customMonsters: meta.customMonsters,
    regionIndex: Number(save.current_region ?? 0),
    phase: save.phase || GamePhase.IDLE,
    lastActionLog: save.last_action_log || null,
    updatedAt: save.updated_at || null,
  };
}
