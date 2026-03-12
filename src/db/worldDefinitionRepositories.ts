import { supabase } from "./supabase.js";
import type {
  WorldDefinition,
  WorldMetadata,
  WorldRegion,
} from "../models/worldTypes.js";
import {
  normalizeWorldDefinitionShape,
  normalizeWorldMetadata,
  normalizeWorldRegion,
} from "../models/worldTypes.js";

export interface PersistedWorldDefinitionRecord {
  id: string;
  character_id: string;
  world_seed: number | string;
  generation_mode: "procedural" | "custom" | string;
  world_name: string;
  world_preset: string;
  custom_biomes: string[] | null;
  custom_monsters: string[] | null;
  metadata_json: unknown;
  definition_json: unknown;
  source_lore?: string | null;
  definition_version?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PersistedWorldOverrideRecord {
  id: string;
  world_definition_id: string;
  override_type: string;
  scope_type?: string | null;
  scope_ref?: string | null;
  payload_json?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CanonicalWorldDefinitionRecord {
  id: string;
  characterId: string;
  mode: "procedural" | "custom";
  definition: WorldDefinition;
  metadata: WorldMetadata;
  sourceLore: string | null;
  definitionVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface UpsertWorldDefinitionInput {
  characterId: string;
  mode: "procedural" | "custom";
  definition: WorldDefinition;
  sourceLore?: string | null;
  definitionVersion?: number;
}

interface WorldDefinitionSummary {
  characterId: string;
  mode: "procedural" | "custom";
  seed: number;
  metadata: WorldMetadata;
  updatedAt: string | null;
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeMode(value: unknown): "procedural" | "custom" {
  return value === "custom" ? "custom" : "procedural";
}

function applyRegionOverride(
  definition: WorldDefinition,
  scopeRef: string | null | undefined,
  payload: Record<string, unknown>,
): WorldDefinition {
  if (!scopeRef) return definition;

  return {
    ...definition,
    regions: definition.regions.map((region) =>
      region.id === scopeRef
        ? normalizeWorldRegion(
            {
              ...region,
              ...payload,
            } as Partial<WorldRegion>,
            definition.regions.findIndex((entry) => entry.id === region.id),
          )
        : region,
    ),
  };
}

function applyMapLayoutOverride(
  definition: WorldDefinition,
  payload: Record<string, unknown>,
): WorldDefinition {
  return normalizeWorldDefinitionShape({
    ...definition,
    mapLayout: {
      ...definition.mapLayout,
      ...payload,
    },
  }, definition.seed);
}

function applyMetadataOverride(
  definition: WorldDefinition,
  payload: Record<string, unknown>,
): WorldDefinition {
  return normalizeWorldDefinitionShape(
    {
      ...definition,
      metadata: {
        ...definition.metadata,
        ...payload,
      },
    },
    definition.seed,
  );
}

function applyWorldOverrides(
  definition: WorldDefinition,
  overrides: PersistedWorldOverrideRecord[],
): WorldDefinition {
  return overrides.reduce((currentDefinition, override) => {
    const payload = safeJsonObject(override.payload_json);

    if (override.override_type === "replace_definition") {
      return normalizeWorldDefinitionShape(
        {
          ...currentDefinition,
          ...payload,
        } as Partial<WorldDefinition>,
        currentDefinition.seed,
      );
    }

    if (override.override_type === "patch_region") {
      return applyRegionOverride(currentDefinition, override.scope_ref, payload);
    }

    if (override.override_type === "set_map_layout") {
      return applyMapLayoutOverride(currentDefinition, payload);
    }

    if (override.override_type === "patch_metadata") {
      return applyMetadataOverride(currentDefinition, payload);
    }

    return currentDefinition;
  }, definition);
}

function hydrateWorldDefinitionRecord(
  record: PersistedWorldDefinitionRecord,
  overrides: PersistedWorldOverrideRecord[] = [],
): CanonicalWorldDefinitionRecord {
  const seed = Number(record.world_seed || 0);
  const metadata = normalizeWorldMetadata(
    {
      worldName: record.world_name,
      worldPreset: record.world_preset,
      customBiomes: record.custom_biomes || [],
      customMonsters: record.custom_monsters || [],
      ...safeJsonObject(record.metadata_json),
    },
    seed,
  );

  const baseDefinition = normalizeWorldDefinitionShape(
    {
      ...(safeJsonObject(record.definition_json) as Partial<WorldDefinition>),
      seed,
      metadata,
    },
    seed,
  );

  const definition = applyWorldOverrides(baseDefinition, overrides);

  return {
    id: record.id,
    characterId: record.character_id,
    mode: normalizeMode(record.generation_mode),
    definition,
    metadata: definition.metadata,
    sourceLore: record.source_lore || null,
    definitionVersion: Number(record.definition_version || 1),
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
  };
}

export async function upsertWorldDefinition(
  input: UpsertWorldDefinitionInput,
): Promise<CanonicalWorldDefinitionRecord> {
  const definition = normalizeWorldDefinitionShape(
    input.definition,
    input.definition.seed,
  );
  const payload = {
    character_id: input.characterId,
    world_seed: definition.seed,
    generation_mode: input.mode,
    world_name: definition.metadata.worldName,
    world_preset: definition.metadata.worldPreset,
    custom_biomes: definition.metadata.customBiomes,
    custom_monsters: definition.metadata.customMonsters,
    metadata_json: definition.metadata,
    definition_json: definition,
    source_lore: input.sourceLore || null,
    definition_version: input.definitionVersion || 1,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("world_definitions")
    .upsert(payload, { onConflict: "character_id" })
    .select("*")
    .single();

  if (error) throw error;
  return hydrateWorldDefinitionRecord(data as PersistedWorldDefinitionRecord);
}

export async function getWorldDefinitionByCharacterId(
  characterId: string,
): Promise<CanonicalWorldDefinitionRecord | null> {
  const { data, error } = await supabase
    .from("world_definitions")
    .select("*")
    .eq("character_id", characterId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  const { data: overrides, error: overrideError } = await supabase
    .from("world_overrides")
    .select("*")
    .eq("world_definition_id", data.id);

  if (overrideError && overrideError.code !== "PGRST116") throw overrideError;

  return hydrateWorldDefinitionRecord(
    data as PersistedWorldDefinitionRecord,
    (overrides || []) as PersistedWorldOverrideRecord[],
  );
}

export async function listWorldDefinitionSummaries(
  characterIds: string[],
): Promise<Map<string, WorldDefinitionSummary>> {
  if (characterIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("world_definitions")
    .select(
      "character_id, world_seed, generation_mode, world_name, world_preset, custom_biomes, custom_monsters, metadata_json, updated_at",
    )
    .in("character_id", characterIds);

  if (error) throw error;

  return new Map(
    ((data || []) as PersistedWorldDefinitionRecord[]).map((record) => {
      const seed = Number(record.world_seed || 0);
      const metadata = normalizeWorldMetadata(
        {
          worldName: record.world_name,
          worldPreset: record.world_preset,
          customBiomes: record.custom_biomes || [],
          customMonsters: record.custom_monsters || [],
          ...safeJsonObject(record.metadata_json),
        },
        seed,
      );

      return [
        record.character_id,
        {
          characterId: record.character_id,
          mode: normalizeMode(record.generation_mode),
          seed,
          metadata,
          updatedAt: record.updated_at || null,
        },
      ];
    }),
  );
}

export async function deleteWorldDefinitionByCharacterId(
  characterId: string,
): Promise<void> {
  const { error } = await supabase
    .from("world_definitions")
    .delete()
    .eq("character_id", characterId);

  if (error) throw error;
}
