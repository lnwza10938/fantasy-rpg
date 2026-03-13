import { contentValidator } from "../core/contentValidator.js";
import {
  DEV_PANEL_CATEGORIES,
  DEV_PANEL_SOURCES,
  getDevSourceConfig,
  type DevCategoryConfig,
  type DevSourceConfig,
} from "../models/devPanelCatalog.js";
import { normalizeContentEntriesError } from "./schemaSupport.js";
import { supabase } from "./supabase.js";

export type DevSortOrder = "latest" | "oldest";

export interface DevSourceSnapshot {
  key: string;
  label: string;
  description: string;
  table: string;
  orderField: string;
  titleField: string;
  summaryFields: string[];
  defaultRecord: Record<string, unknown>;
  records: Record<string, unknown>[];
  count: number;
  error: string | null;
}

export interface DevCategorySnapshot extends DevCategoryConfig {
  sources: DevSourceSnapshot[];
}

const TABLE_UPDATED_AT_FIELDS: Record<string, string | null> = {
  world_definitions: "updated_at",
  world_overrides: "updated_at",
  player_states: "updated_at",
  content_entries: "updated_at",
};

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSourceError(source: DevSourceConfig, error: unknown) {
  if (source.table === "content_entries") {
    return normalizeContentEntriesError(error);
  }
  if (error instanceof Error) return error.message || "Unknown error";
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "Unknown error");
  }
  return String(error || "Unknown error");
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function normalizeSourceRecord(
  source: DevSourceConfig,
  record: Record<string, unknown>,
  mode: "create" | "update",
) {
  const nextRecord = {
    ...(cloneRecord(record) as Record<string, unknown>),
    ...(source.fixedValues || {}),
  };

  if (mode === "create") {
    delete nextRecord.id;
    delete nextRecord.created_at;
    delete nextRecord.updated_at;
  }

  if (source.table === "content_entries") {
    nextRecord.title = String(nextRecord.title || "").trim() || "Untitled Entry";
    nextRecord.category =
      String(nextRecord.category || source.fixedValues?.category || "asset").trim() ||
      "asset";
    nextRecord.content_kind =
      String(
        nextRecord.content_kind || source.fixedValues?.content_kind || "text",
      ).trim() || "text";
    nextRecord.slug =
      String(nextRecord.slug || "").trim() || slugify(String(nextRecord.title || ""));
    nextRecord.tags = Array.isArray(nextRecord.tags)
      ? nextRecord.tags
      : typeof nextRecord.tags === "string"
        ? String(nextRecord.tags)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
    nextRecord.metadata_json =
      nextRecord.metadata_json &&
      typeof nextRecord.metadata_json === "object" &&
      !Array.isArray(nextRecord.metadata_json)
        ? nextRecord.metadata_json
        : {};
    nextRecord.is_active = nextRecord.is_active !== false;
  }

  if (source.key === "world_definitions") {
    nextRecord.world_seed = Number(nextRecord.world_seed || 0);
    nextRecord.generation_mode =
      String(nextRecord.generation_mode || "procedural").trim() || "procedural";
    nextRecord.world_name =
      String(nextRecord.world_name || "New World").trim() || "New World";
    nextRecord.world_preset =
      String(nextRecord.world_preset || "balanced").trim() || "balanced";
    nextRecord.custom_biomes = normalizeStringArray(nextRecord.custom_biomes);
    nextRecord.custom_monsters = normalizeStringArray(nextRecord.custom_monsters);
    nextRecord.metadata_json = safeObject(nextRecord.metadata_json);
    nextRecord.definition_json = safeObject(nextRecord.definition_json);
    nextRecord.definition_version = Number(nextRecord.definition_version || 1);
  }

  if (source.key === "world_overrides") {
    nextRecord.world_definition_id = String(nextRecord.world_definition_id || "").trim();
    nextRecord.override_type =
      String(nextRecord.override_type || "patch_region").trim() || "patch_region";
    nextRecord.scope_type =
      String(
        nextRecord.scope_type ||
          (nextRecord.override_type === "patch_region" ? "region" : "world"),
      ).trim() || "world";
    nextRecord.scope_ref =
      nextRecord.scope_type === "region"
        ? String(nextRecord.scope_ref || "").trim()
        : "";
    nextRecord.payload_json = safeObject(nextRecord.payload_json);
  }

  const updatedAtField = TABLE_UPDATED_AT_FIELDS[source.table];
  if (updatedAtField) {
    nextRecord[updatedAtField] = new Date().toISOString();
  }

  return nextRecord;
}

function validateSourceRecord(source: DevSourceConfig, record: Record<string, unknown>) {
  if (source.key === "monsters") return contentValidator.validateMonster(record);
  if (source.key === "items") return contentValidator.validateItem(record);
  if (source.key === "equipment") return contentValidator.validateEquipment(record);
  if (source.key === "maps") return contentValidator.validateMap(record);
  if (source.key === "spawn_points") return contentValidator.validateSpawnPoint(record);
  if (source.key === "dialogues") return contentValidator.validateDialogue(record);

  if (source.key === "world_definitions") {
    const errors: string[] = [];
    if (!record.character_id || typeof record.character_id !== "string") {
      errors.push("character_id is required");
    }
    if (!record.world_name || typeof record.world_name !== "string") {
      errors.push("world_name is required");
    }
    if (
      record.generation_mode !== "procedural" &&
      record.generation_mode !== "custom"
    ) {
      errors.push("generation_mode must be procedural or custom");
    }
    if (
      !record.definition_json ||
      typeof record.definition_json !== "object" ||
      Array.isArray(record.definition_json)
    ) {
      errors.push("definition_json must be an object");
    }
    return { valid: errors.length === 0, errors };
  }

  if (source.key === "world_overrides") {
    const errors: string[] = [];
    const allowedTypes = new Set([
      "patch_region",
      "set_map_layout",
      "patch_metadata",
      "replace_definition",
    ]);
    if (!record.world_definition_id || typeof record.world_definition_id !== "string") {
      errors.push("world_definition_id is required");
    }
    if (!allowedTypes.has(String(record.override_type || ""))) {
      errors.push("override_type is invalid");
    }
    if (
      !record.payload_json ||
      typeof record.payload_json !== "object" ||
      Array.isArray(record.payload_json)
    ) {
      errors.push("payload_json must be an object");
    }
    if (record.override_type === "patch_region") {
      if (record.scope_type !== "region") {
        errors.push("patch_region overrides must use scope_type=region");
      }
      if (!record.scope_ref || typeof record.scope_ref !== "string") {
        errors.push("patch_region overrides require scope_ref");
      }
    }
    return { valid: errors.length === 0, errors };
  }

  if (source.table === "content_entries") {
    const errors: string[] = [];
    if (!record.title || typeof record.title !== "string")
      errors.push("title is required");
    if (!record.category || typeof record.category !== "string")
      errors.push("category is required");
    if (!record.content_kind || typeof record.content_kind !== "string")
      errors.push("content_kind is required");
    return { valid: errors.length === 0, errors };
  }

  return { valid: true, errors: [] };
}

function applySourceFilters(
  query: ReturnType<typeof supabase.from>,
  source: DevSourceConfig,
) {
  let nextQuery: any = query;
  Object.entries(source.fixedValues || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      nextQuery = nextQuery.eq(key, value as any);
    }
  });
  return nextQuery;
}

async function listSourceRecords(
  source: DevSourceConfig,
  sortOrder: DevSortOrder,
): Promise<DevSourceSnapshot> {
  try {
    let query: any = supabase.from(source.table).select("*");
    query = applySourceFilters(query, source);
    query = query.order(source.orderField, { ascending: sortOrder === "oldest" });
    const { data, error } = await query;
    if (error) {
      return {
        key: source.key,
        label: source.label,
        description: source.description,
        table: source.table,
        orderField: source.orderField,
        titleField: source.titleField || "id",
        summaryFields: source.summaryFields || [],
        defaultRecord: cloneRecord(source.defaultRecord),
        records: [],
        count: 0,
        error: normalizeSourceError(source, error),
      };
    }
    return {
      key: source.key,
      label: source.label,
      description: source.description,
      table: source.table,
      orderField: source.orderField,
      titleField: source.titleField || "id",
      summaryFields: source.summaryFields || [],
      defaultRecord: cloneRecord(source.defaultRecord),
      records: (data || []) as Record<string, unknown>[],
      count: Array.isArray(data) ? data.length : 0,
      error: null,
    };
  } catch (error: any) {
    return {
      key: source.key,
      label: source.label,
      description: source.description,
      table: source.table,
      orderField: source.orderField,
      titleField: source.titleField || "id",
      summaryFields: source.summaryFields || [],
      defaultRecord: cloneRecord(source.defaultRecord),
      records: [],
      count: 0,
      error: normalizeSourceError(source, error),
    };
  }
}

export async function getDevPanelCatalog(
  sortOrder: DevSortOrder,
): Promise<DevCategorySnapshot[]> {
  const sourceSnapshots = await Promise.all(
    DEV_PANEL_SOURCES.map((source) => listSourceRecords(source, sortOrder)),
  );

  return DEV_PANEL_CATEGORIES.map((category) => ({
    ...category,
    sources: sourceSnapshots.filter((source) =>
      DEV_PANEL_SOURCES.find((entry) => entry.key === source.key)?.categoryKey ===
      category.key,
    ),
  }));
}

export async function getSourceSnapshot(
  sourceKey: string,
  sortOrder: DevSortOrder,
): Promise<DevSourceSnapshot> {
  const source = getDevSourceConfig(sourceKey);
  if (!source) {
    throw new Error(`Unknown dev source: ${sourceKey}`);
  }
  return listSourceRecords(source, sortOrder);
}

export async function createSourceRecord(
  sourceKey: string,
  record: Record<string, unknown>,
) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) throw new Error(`Unknown dev source: ${sourceKey}`);
  const nextRecord = normalizeSourceRecord(source, record, "create");
  const validation = validateSourceRecord(source, nextRecord);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const { data, error } = await supabase
    .from(source.table)
    .insert([nextRecord])
    .select("*")
    .single();
  if (error) throw new Error(normalizeSourceError(source, error));
  return data;
}

export async function updateSourceRecord(
  sourceKey: string,
  recordId: string,
  record: Record<string, unknown>,
) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) throw new Error(`Unknown dev source: ${sourceKey}`);
  const nextRecord = normalizeSourceRecord(source, record, "update");
  const validation = validateSourceRecord(source, nextRecord);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const { data, error } = await supabase
    .from(source.table)
    .update(nextRecord)
    .eq("id", recordId)
    .select("*")
    .single();
  if (error) throw new Error(normalizeSourceError(source, error));
  return data;
}

export async function deleteSourceRecord(sourceKey: string, recordId: string) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) throw new Error(`Unknown dev source: ${sourceKey}`);
  const { error } = await supabase.from(source.table).delete().eq("id", recordId);
  if (error) throw new Error(normalizeSourceError(source, error));
  return { id: recordId };
}
