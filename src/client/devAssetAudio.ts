import { uploadDevFile } from "./devAssetUpload.js";

interface AudioSourceSnapshot {
  key: string;
  label: string;
  records: Record<string, unknown>[];
  error?: string | null;
}

const DEV_KEY_STORAGE = "rpg_dev_panel_key";

const state: {
  records: Record<string, unknown>[];
  mode: "create" | "edit";
  recordId: string | null;
  working: Record<string, unknown>;
} = {
  records: [],
  mode: "create",
  recordId: null,
  working: {},
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function panelHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const devKey = localStorage.getItem(DEV_KEY_STORAGE) || "";
  if (devKey) headers["x-dev-key"] = devKey;
  return headers;
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function setStatus(text: string, isError = false) {
  const el = document.getElementById("audio-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function renderList() {
  const listEl = document.getElementById("audio-record-list");
  if (!listEl) return;
  listEl.innerHTML = state.records
    .map(
      (record) => `
        <button class="dev-category-btn ${String(record.id || "") === state.recordId ? "active" : ""}" data-audio-record="${escapeHtml(String(record.id || ""))}">
          <strong>${escapeHtml(String(record.title || "Untitled Audio"))}</strong>
          <span>${escapeHtml(String(record.summary || record.mime_type || "audio"))}</span>
        </button>
      `,
    )
    .join("");

  listEl.querySelectorAll<HTMLElement>("[data-audio-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.audioRecord || "";
      const record = state.records.find((entry) => String(entry.id || "") === id);
      if (record) fillForm(record, "edit");
    });
  });
}

function renderPreview() {
  const previewEl = document.getElementById("audio-preview");
  if (!previewEl) return;
  const fileUrl = String(state.working.preview_url || state.working.file_url || "");
  if (!fileUrl) {
    previewEl.innerHTML = '<div class="dev-assets-preview-empty">Choose an audio file to preview it here.</div>';
    return;
  }
  previewEl.innerHTML = `<audio controls class="dev-assets-preview-audio" src="${escapeHtml(fileUrl)}"></audio>`;
}

function getCurrentRecord() {
  const metadata = {
    ...safeObject(state.working.metadata_json),
    biome: (document.getElementById("audio-biome") as HTMLInputElement | null)?.value?.trim() || "",
    audioType: (document.getElementById("audio-type") as HTMLSelectElement | null)?.value || "ambient",
    mood: (document.getElementById("audio-mood") as HTMLInputElement | null)?.value?.trim() || "",
    intensity: (document.getElementById("audio-intensity") as HTMLSelectElement | null)?.value || "low",
    intendedUse: (document.getElementById("audio-use") as HTMLInputElement | null)?.value?.trim() || "",
    loopable: (document.getElementById("audio-loopable") as HTMLInputElement | null)?.checked === true,
  };

  return {
    ...state.working,
    category: "audio",
    subcategory: metadata.audioType || "ambient",
    content_kind: "audio",
    title: (document.getElementById("audio-title") as HTMLInputElement | null)?.value?.trim() || "Untitled Audio",
    slug:
      (document.getElementById("audio-slug") as HTMLInputElement | null)?.value?.trim() ||
      slugify((document.getElementById("audio-title") as HTMLInputElement | null)?.value || ""),
    summary: (document.getElementById("audio-summary") as HTMLTextAreaElement | null)?.value || "",
    body_text: (document.getElementById("audio-body-text") as HTMLTextAreaElement | null)?.value || "",
    tags: ((document.getElementById("audio-tags") as HTMLInputElement | null)?.value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    metadata_json: metadata,
    is_active: true,
  };
}

function fillForm(record?: Record<string, unknown>, mode: "create" | "edit" = "create") {
  state.mode = mode;
  state.recordId = record ? String(record.id || "") : null;
  state.working = JSON.parse(JSON.stringify(record || {
    category: "audio",
    subcategory: "ambient",
    content_kind: "audio",
    title: "New Audio Asset",
    slug: "new-audio-asset",
    summary: "",
    body_text: "",
    file_url: "",
    preview_url: "",
    mime_type: "audio/mpeg",
    tags: ["audio", "ambient"],
    metadata_json: {
      audioType: "ambient",
      biome: "",
      mood: "mystic",
      intensity: "low",
      intendedUse: "world-map",
      loopable: true,
    },
  }));

  const metadata = safeObject(state.working.metadata_json);
  (document.getElementById("audio-title") as HTMLInputElement | null)!.value = String(state.working.title || "");
  (document.getElementById("audio-slug") as HTMLInputElement | null)!.value = String(state.working.slug || "");
  (document.getElementById("audio-biome") as HTMLInputElement | null)!.value = String(metadata.biome || "");
  (document.getElementById("audio-type") as HTMLSelectElement | null)!.value = String(metadata.audioType || "ambient");
  (document.getElementById("audio-mood") as HTMLInputElement | null)!.value = String(metadata.mood || "");
  (document.getElementById("audio-intensity") as HTMLSelectElement | null)!.value = String(metadata.intensity || "low");
  (document.getElementById("audio-use") as HTMLInputElement | null)!.value = String(metadata.intendedUse || "");
  (document.getElementById("audio-tags") as HTMLInputElement | null)!.value = Array.isArray(state.working.tags)
    ? state.working.tags.join(", ")
    : "";
  (document.getElementById("audio-summary") as HTMLTextAreaElement | null)!.value = String(state.working.summary || "");
  (document.getElementById("audio-body-text") as HTMLTextAreaElement | null)!.value = String(state.working.body_text || "");
  (document.getElementById("audio-loopable") as HTMLInputElement | null)!.checked = metadata.loopable === true;
  (document.getElementById("audio-intake-title") as HTMLElement | null)!.textContent =
    mode === "create" ? "New Audio Asset" : `Edit ${String(state.working.title || "Audio Asset")}`;
  (document.getElementById("audio-delete") as HTMLButtonElement | null)!.style.display =
    mode === "edit" ? "inline-flex" : "none";
  const fileMetaEl = document.getElementById("audio-file-meta");
  if (fileMetaEl) {
    fileMetaEl.textContent = state.working.file_url
      ? `Loaded record ${String(state.working.title || state.working.id || "audio")}`
      : "No audio file selected yet.";
  }

  renderList();
  renderPreview();
}

async function loadAudioRecords() {
  const response = await fetch("/dev/panel/assets/workbench?sort=latest", {
    headers: panelHeaders(),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Could not load audio assets");
  const sources = (payload.data?.sources || []) as AudioSourceSnapshot[];
  const audioSource = sources.find((entry) => entry.key === "audio_entries");
  if (audioSource?.error) {
    throw new Error(audioSource.error);
  }
  state.records = audioSource?.records || [];
  renderList();
  fillForm(undefined, "create");
}

async function saveAudioRecord() {
  const record = getCurrentRecord();
  const url =
    state.mode === "create"
      ? "/dev/panel/records/audio_entries"
      : `/dev/panel/records/audio_entries/${encodeURIComponent(state.recordId || "")}`;
  const response = await fetch(url, {
    method: state.mode === "create" ? "POST" : "PATCH",
    headers: panelHeaders(),
    body: JSON.stringify({ record }),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Could not save audio record");
  setStatus(state.mode === "create" ? "Audio asset created." : "Audio asset updated.");
  await loadAudioRecords();
}

function bindFileInput() {
  const fileInput = document.getElementById("audio-file") as HTMLInputElement | null;
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const titleEl = document.getElementById("audio-title") as HTMLInputElement | null;
      const slugEl = document.getElementById("audio-slug") as HTMLInputElement | null;
      if (titleEl && !titleEl.value.trim()) {
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        titleEl.value = title;
        if (slugEl && !slugEl.value.trim()) slugEl.value = slugify(title);
      }

      const metaEl = document.getElementById("audio-file-meta");
      if (metaEl) metaEl.textContent = `Uploading ${file.name} to the server...`;

      const uploaded = await uploadDevFile(file, {
        sourceKey: "audio_entries",
        preferredSlug: slugEl?.value?.trim() || "",
      });

      state.working = {
        ...state.working,
        file_url: uploaded.fileUrl,
        preview_url: uploaded.previewUrl || uploaded.fileUrl,
        mime_type: uploaded.mimeType || file.type || "audio/mpeg",
        content_kind: "audio",
        metadata_json: {
          ...safeObject(state.working.metadata_json),
          upload: {
            storageProvider: uploaded.storageProvider,
            storagePath: uploaded.storagePath,
            originalName: uploaded.originalName,
            sizeBytes: uploaded.sizeBytes,
            uploadedAt: new Date().toISOString(),
          },
        },
      };
      if (metaEl) {
        metaEl.textContent = uploaded.warning
          ? `Uploaded ${file.name} • ${uploaded.storageProvider} • ${uploaded.warning}`
          : `Uploaded ${file.name} to ${uploaded.storageProvider}.`;
      }
      renderPreview();
    } catch (error: any) {
      setStatus(error.message || `Could not upload ${file.name}`, true);
    } finally {
      fileInput.value = "";
    }
  });
}

function bindControls() {
  document.getElementById("audio-reset")?.addEventListener("click", () => fillForm(undefined, "create"));
  document.getElementById("audio-save")?.addEventListener("click", async () => {
    try {
      await saveAudioRecord();
    } catch (error: any) {
      setStatus(error.message || "Could not save audio asset", true);
    }
  });
  document.getElementById("audio-delete")?.addEventListener("click", async () => {
    if (state.mode !== "edit" || !state.recordId) return;
    const response = await fetch(`/dev/panel/records/audio_entries/${encodeURIComponent(state.recordId)}`, {
      method: "DELETE",
      headers: panelHeaders(),
    });
    const payload = await response.json();
    if (!payload.success) {
      setStatus(payload.error || "Could not delete audio asset", true);
      return;
    }
    await loadAudioRecords();
  });
  document.getElementById("audio-title")?.addEventListener("input", () => {
    const titleEl = document.getElementById("audio-title") as HTMLInputElement | null;
    const slugEl = document.getElementById("audio-slug") as HTMLInputElement | null;
    if (titleEl && slugEl && !slugEl.dataset.manual) {
      slugEl.value = slugify(titleEl.value);
    }
  });
  document.getElementById("audio-slug")?.addEventListener("input", () => {
    const slugEl = document.getElementById("audio-slug") as HTMLInputElement | null;
    if (slugEl) slugEl.dataset.manual = "true";
  });
  bindFileInput();
}

async function bootstrap() {
  bindControls();
  await loadAudioRecords();
}

void bootstrap();

export {};
