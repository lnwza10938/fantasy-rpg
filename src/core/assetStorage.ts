import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_UPLOAD_PUBLIC_PREFIX = "/dev/uploads";
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const DEV_ASSET_UPLOAD_ROOT = path.join(LOCAL_UPLOAD_ROOT, "dev-assets");
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "dev-assets";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdminClient: SupabaseClient | null = null;

export interface StoredAssetFile {
  storageProvider: "local" | "supabase-storage";
  storagePath: string;
  fileUrl: string;
  previewUrl: string;
  mimeType: string;
  contentKind: "image" | "audio" | "text" | "binary";
  originalName: string;
  sizeBytes: number;
  warning?: string;
}

function sanitizeSegment(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function inferExtension(originalName: string, mimeType: string) {
  const ext = path.extname(originalName || "").trim();
  if (ext) return ext.toLowerCase();

  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("svg")) return ".svg";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3";
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("json")) return ".json";
  if (normalized.startsWith("text/")) return ".txt";
  return ".bin";
}

function inferMimeTypeFromPath(filePath: string) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".json") return "application/json";
  if (ext === ".txt" || ext === ".md" || ext === ".story") return "text/plain";
  return "application/octet-stream";
}

function inferContentKind(mimeType: string): StoredAssetFile["contentKind"] {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("xml")
  ) {
    return "text";
  }
  return "binary";
}

function getRelativeLocalUploadPath(storagePath: string) {
  return `${LOCAL_UPLOAD_PUBLIC_PREFIX}/${storagePath.replace(/\\/g, "/")}`;
}

function getSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdminClient;
}

function buildStoragePath(
  originalName: string,
  sourceKey?: string,
  preferredSlug?: string,
  mimeType?: string,
) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const sourceSegment = sanitizeSegment(sourceKey || "misc") || "misc";
  const stem =
    sanitizeSegment(preferredSlug || path.basename(originalName || "", path.extname(originalName || ""))) ||
    "asset";
  const ext = inferExtension(originalName, mimeType || "");
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${stem}${ext}`;
  return path.posix.join(year, month, day, sourceSegment, uniqueName);
}

async function uploadToLocalStorage(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  sourceKey?: string;
  preferredSlug?: string;
}): Promise<StoredAssetFile> {
  const storagePath = buildStoragePath(
    input.originalName,
    input.sourceKey,
    input.preferredSlug,
    input.mimeType,
  );
  const absolutePath = path.join(DEV_ASSET_UPLOAD_ROOT, storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.buffer);

  const mimeType = input.mimeType || inferMimeTypeFromPath(absolutePath);
  return {
    storageProvider: "local",
    storagePath,
    fileUrl: getRelativeLocalUploadPath(storagePath),
    previewUrl: getRelativeLocalUploadPath(storagePath),
    mimeType,
    contentKind: inferContentKind(mimeType),
    originalName: input.originalName,
    sizeBytes: input.buffer.byteLength,
  };
}

async function uploadToSupabaseStorage(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  sourceKey?: string;
  preferredSlug?: string;
}): Promise<StoredAssetFile> {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase storage is not configured");
  }

  const storagePath = buildStoragePath(
    input.originalName,
    input.sourceKey,
    input.preferredSlug,
    input.mimeType,
  );
  const mimeType = input.mimeType || inferMimeTypeFromPath(input.originalName);

  const { error } = await client.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = String(data?.publicUrl || "").trim();
  if (!publicUrl) {
    throw new Error("Supabase storage did not return a public URL");
  }

  return {
    storageProvider: "supabase-storage",
    storagePath,
    fileUrl: publicUrl,
    previewUrl: publicUrl,
    mimeType,
    contentKind: inferContentKind(mimeType),
    originalName: input.originalName,
    sizeBytes: input.buffer.byteLength,
  };
}

export async function storeDevAssetFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  sourceKey?: string;
  preferredSlug?: string;
}): Promise<StoredAssetFile> {
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      return await uploadToSupabaseStorage(input);
    } catch (error: any) {
      const localResult = await uploadToLocalStorage(input);
      return {
        ...localResult,
        warning:
          error?.message ||
          "Supabase storage upload failed. The file was stored on the local server instead.",
      };
    }
  }

  return uploadToLocalStorage(input);
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

function localUploadUrlToAbsolutePath(assetRef: string) {
  if (!assetRef.startsWith(LOCAL_UPLOAD_PUBLIC_PREFIX)) return null;
  const relative = assetRef.slice(LOCAL_UPLOAD_PUBLIC_PREFIX.length).replace(/^\/+/, "");
  if (!relative) return null;
  const absolute = path.resolve(DEV_ASSET_UPLOAD_ROOT, relative);
  const root = path.resolve(DEV_ASSET_UPLOAD_ROOT);
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

export async function readAssetBinaryFromReference(assetRef: string, mimeHint = "") {
  const trimmed = String(assetRef || "").trim();
  if (!trimmed) {
    throw new Error("No asset reference provided");
  }

  const parsedDataUrl = parseDataUrl(trimmed);
  if (parsedDataUrl) {
    return parsedDataUrl;
  }

  const localPath = localUploadUrlToAbsolutePath(trimmed);
  if (localPath) {
    const buffer = await fs.readFile(localPath);
    return {
      mimeType: mimeHint || inferMimeTypeFromPath(localPath),
      buffer,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Could not fetch asset reference: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      mimeType:
        response.headers.get("content-type") || mimeHint || "application/octet-stream",
      buffer: Buffer.from(arrayBuffer),
    };
  }

  throw new Error("Unsupported asset reference format");
}
