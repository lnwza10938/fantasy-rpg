const DEV_KEY_STORAGE = "rpg_dev_panel_key";

export interface UploadedDevFilePayload {
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

function getDevKey() {
  return localStorage.getItem(DEV_KEY_STORAGE) || "";
}

export async function uploadDevFile(
  file: File,
  options: {
    sourceKey?: string;
    preferredSlug?: string;
  } = {},
): Promise<UploadedDevFilePayload> {
  const headers = new Headers();
  const devKey = getDevKey();
  if (devKey) headers.set("x-dev-key", devKey);
  headers.set("Content-Type", "application/octet-stream");
  headers.set("x-file-name", encodeURIComponent(file.name));
  headers.set("x-file-mime-type", file.type || "application/octet-stream");
  if (options.sourceKey) headers.set("x-source-key", options.sourceKey);
  if (options.preferredSlug) headers.set("x-preferred-slug", options.preferredSlug);

  const response = await fetch("/dev/panel/assets/upload", {
    method: "POST",
    headers,
    body: file,
  });

  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || "Could not upload file to server");
  }

  return payload.data as UploadedDevFilePayload;
}
