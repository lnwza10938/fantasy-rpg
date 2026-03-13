import { supabase } from "./supabase.js";
import { normalizeContentEntriesError } from "./schemaSupport.js";

export interface ContentEntryRecord {
  id: string;
  category: string;
  subcategory: string | null;
  content_kind: string;
  title: string;
  slug: string;
  summary: string | null;
  body_text: string | null;
  file_url: string | null;
  preview_url: string | null;
  mime_type: string | null;
  tags: string[] | null;
  metadata_json: Record<string, unknown> | null;
  world_definition_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

function normalizeRecord(record: any): ContentEntryRecord {
  return {
    id: String(record?.id || ""),
    category: String(record?.category || ""),
    subcategory: record?.subcategory ? String(record.subcategory) : null,
    content_kind: String(record?.content_kind || "text"),
    title: String(record?.title || "Untitled"),
    slug: String(record?.slug || ""),
    summary: record?.summary ? String(record.summary) : null,
    body_text: record?.body_text ? String(record.body_text) : null,
    file_url: record?.file_url ? String(record.file_url) : null,
    preview_url: record?.preview_url ? String(record.preview_url) : null,
    mime_type: record?.mime_type ? String(record.mime_type) : null,
    tags: Array.isArray(record?.tags) ? record.tags.map((entry: unknown) => String(entry)) : [],
    metadata_json:
      record?.metadata_json &&
      typeof record.metadata_json === "object" &&
      !Array.isArray(record.metadata_json)
        ? (record.metadata_json as Record<string, unknown>)
        : {},
    world_definition_id: record?.world_definition_id ? String(record.world_definition_id) : null,
    is_active: record?.is_active !== false,
    created_at: record?.created_at ? String(record.created_at) : undefined,
    updated_at: record?.updated_at ? String(record.updated_at) : undefined,
  };
}

export async function listContentEntriesByCategory(
  category: string,
  subcategory?: string,
): Promise<ContentEntryRecord[]> {
  let query = supabase
    .from("content_entries")
    .select("*")
    .eq("category", category)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (subcategory) {
    query = query.eq("subcategory", subcategory);
  }

  const { data, error } = await query;
  if (error) {
    const normalized = normalizeContentEntriesError(error);
    if (normalized !== (error as { message?: string })?.message) {
      throw new Error(normalized);
    }
    console.warn(
      `[assetRepositories] Failed to load content_entries for ${category}/${subcategory || "*"}`,
      normalized,
    );
    return [];
  }
  return Array.isArray(data) ? data.map(normalizeRecord) : [];
}

export async function listTerrainFacingAssets(): Promise<ContentEntryRecord[]> {
  const subcategories = ["terrain", "structure", "background", "effect", "monster", "character-part"];
  const results = await Promise.all(
    subcategories.map((subcategory) => listContentEntriesByCategory("asset", subcategory)),
  );
  return results.flat();
}

export async function listAudioAssetEntries(): Promise<ContentEntryRecord[]> {
  return listContentEntriesByCategory("audio");
}

export async function listTerrainRecipeEntries(): Promise<ContentEntryRecord[]> {
  return listContentEntriesByCategory("recipe", "terrain");
}
