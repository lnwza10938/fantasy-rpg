interface AssetSourceSnapshot {
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

interface AssetReviewResult {
  provider: "huggingface" | "heuristic";
  caption: string | null;
  assetKindGuess: "single" | "sheet" | "atlas" | "gif" | "audio" | "unknown";
  verdict: "match" | "partial" | "mismatch" | "unverified";
  confidence: number;
  matchedTerms: string[];
  missingTerms: string[];
  expectedTerms: string[];
  recommendedTitle: string;
  recommendedTags: string[];
  warning?: string;
}

const DEV_KEY_STORAGE = "rpg_dev_panel_key";
const DEV_SORT_STORAGE = "rpg_dev_panel_sort";

const state: {
  sortOrder: "latest" | "oldest";
  sources: AssetSourceSnapshot[];
  activeSourceKey: string;
  editorMode: "create" | "edit";
  recordId: string | null;
  selectedFileName: string;
  review: AssetReviewResult | null;
} = {
  sortOrder: (localStorage.getItem(DEV_SORT_STORAGE) as "latest" | "oldest") || "latest",
  sources: [],
  activeSourceKey: "terrain_assets",
  editorMode: "create",
  recordId: null,
  selectedFileName: "",
  review: null,
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: unknown, max = 120) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getDevKey() {
  return localStorage.getItem(DEV_KEY_STORAGE) || "";
}

function panelHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const devKey = getDevKey();
  if (devKey) headers["x-dev-key"] = devKey;
  return headers;
}

function setInlineStatus(id: string, text: string, isError = false) {
  const el = document.getElementById(id);
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

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function getSource(sourceKey = state.activeSourceKey) {
  return state.sources.find((source) => source.key === sourceKey) || null;
}

function inferTitleFromFilename(filename: string) {
  return String(filename || "")
    .replace(/\.[^.]+$/, "")
    .split(/[_-]+/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getCurrentRecordFromForm(): Record<string, unknown> {
  const source = getSource();
  if (!source) return {};

  const metadata_json: Record<string, unknown> = {
    ...safeObject(source.defaultRecord.metadata_json),
    biome: (document.getElementById("asset-biome") as HTMLInputElement)?.value?.trim() || "",
    terrainType:
      (document.getElementById("asset-terrain-type") as HTMLInputElement)?.value?.trim() || "",
    structureType:
      (document.getElementById("asset-structure-type") as HTMLInputElement)?.value?.trim() || "",
    renderLayer:
      (document.getElementById("asset-render-layer") as HTMLSelectElement)?.value?.trim() || "",
    intendedUse:
      (document.getElementById("asset-intended-use") as HTMLInputElement)?.value?.trim() || "",
    paletteHints: ((document.getElementById("asset-palette-hints") as HTMLInputElement)?.value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    assetKind:
      (document.getElementById("asset-kind") as HTMLSelectElement)?.value?.trim() || "single",
    sliceMode:
      (document.getElementById("asset-slice-mode") as HTMLSelectElement)?.value?.trim() || "none",
    frameWidth: parsePositiveInt(
      (document.getElementById("asset-frame-width") as HTMLInputElement)?.value || "",
    ),
    frameHeight: parsePositiveInt(
      (document.getElementById("asset-frame-height") as HTMLInputElement)?.value || "",
    ),
    columns: parsePositiveInt(
      (document.getElementById("asset-columns") as HTMLInputElement)?.value || "",
    ),
    rows: parsePositiveInt(
      (document.getElementById("asset-rows") as HTMLInputElement)?.value || "",
    ),
    padding: parsePositiveInt(
      (document.getElementById("asset-padding") as HTMLInputElement)?.value || "",
    ),
    spacing: parsePositiveInt(
      (document.getElementById("asset-spacing") as HTMLInputElement)?.value || "",
    ),
    width: parsePositiveInt(
      (document.getElementById("asset-canvas-width") as HTMLInputElement)?.value || "",
    ),
    height: parsePositiveInt(
      (document.getElementById("asset-canvas-height") as HTMLInputElement)?.value || "",
    ),
    tileable: (document.getElementById("asset-tileable") as HTMLInputElement)?.checked === true,
    seamless: (document.getElementById("asset-seamless") as HTMLInputElement)?.checked === true,
  };

  if (state.review) {
    metadata_json.aiReview = {
      ...state.review,
      reviewedAt: new Date().toISOString(),
    };
  }

  return {
    ...cloneRecord(source.defaultRecord),
    title: (document.getElementById("asset-title") as HTMLInputElement)?.value?.trim() || "Untitled Asset",
    slug:
      (document.getElementById("asset-slug") as HTMLInputElement)?.value?.trim() ||
      slugify((document.getElementById("asset-title") as HTMLInputElement)?.value || ""),
    summary: (document.getElementById("asset-summary") as HTMLTextAreaElement)?.value || "",
    body_text: (document.getElementById("asset-body-text") as HTMLTextAreaElement)?.value || "",
    tags: ((document.getElementById("asset-tags") as HTMLInputElement)?.value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    world_definition_id:
      (document.getElementById("asset-world-binding") as HTMLInputElement)?.value?.trim() || null,
    metadata_json,
    mime_type: safeObject((window as any).__asset_working_record).mime_type || source.defaultRecord.mime_type || "",
    file_url: safeObject((window as any).__asset_working_record).file_url || "",
    preview_url: safeObject((window as any).__asset_working_record).preview_url || "",
    content_kind:
      safeObject((window as any).__asset_working_record).content_kind ||
      source.defaultRecord.content_kind ||
      "image",
    category:
      safeObject((window as any).__asset_working_record).category ||
      source.defaultRecord.category ||
      "asset",
    subcategory:
      safeObject((window as any).__asset_working_record).subcategory ||
      source.defaultRecord.subcategory ||
      "",
    is_active: true,
  };
}

function setWorkingRecord(record: Record<string, unknown>) {
  (window as any).__asset_working_record = cloneRecord(record);
}

function getWorkingRecord() {
  return safeObject((window as any).__asset_working_record);
}

function renderPreview(record: Record<string, unknown> = getCurrentRecordFromForm()) {
  const previewEl = document.getElementById("asset-preview");
  if (!previewEl) return;

  const mimeType = String(record.mime_type || "");
  const fileUrl = String(record.preview_url || record.file_url || "");
  const bodyText = String(record.body_text || "");

  if (fileUrl && mimeType.startsWith("image/")) {
    previewEl.innerHTML = `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(record.title || "Asset preview")}" class="dev-assets-preview-image" />`;
    return;
  }

  if (fileUrl && mimeType.startsWith("audio/")) {
    previewEl.innerHTML = `<audio controls class="dev-assets-preview-audio" src="${escapeHtml(fileUrl)}"></audio>`;
    return;
  }

  if (bodyText.trim()) {
    previewEl.innerHTML = `<div class="dev-assets-preview-text">${escapeHtml(truncate(bodyText, 320))}</div>`;
    return;
  }

  previewEl.innerHTML =
    '<div class="dev-assets-preview-empty">Choose a file or load an asset record to preview it here.</div>';
}

function renderReview() {
  const resultEl = document.getElementById("asset-review-result");
  if (!resultEl) return;

  const review = state.review;
  if (!review) {
    resultEl.innerHTML =
      '<div class="dev-assets-review-empty">No review yet. Run the filename match check after choosing an image.</div>';
    return;
  }

  resultEl.innerHTML = `
    <div class="dev-assets-review-pill verdict-${escapeHtml(review.verdict)}">
      ${escapeHtml(review.verdict)} • ${Math.round(review.confidence * 100)}%
    </div>
    <div class="dev-assets-review-grid">
      <div>
        <span>Provider</span>
        <strong>${escapeHtml(review.provider)}</strong>
      </div>
      <div>
        <span>Caption</span>
        <strong>${escapeHtml(review.caption || "No caption")}</strong>
      </div>
      <div>
        <span>Asset Kind</span>
        <strong>${escapeHtml(review.assetKindGuess || "unknown")}</strong>
      </div>
      <div>
        <span>Matched Terms</span>
        <strong>${escapeHtml(review.matchedTerms.join(", ") || "None")}</strong>
      </div>
      <div>
        <span>Missing Terms</span>
        <strong>${escapeHtml(review.missingTerms.join(", ") || "None")}</strong>
      </div>
      <div>
        <span>Suggested Title</span>
        <strong>${escapeHtml(review.recommendedTitle || "None")}</strong>
      </div>
      <div>
        <span>Suggested Tags</span>
        <strong>${escapeHtml(review.recommendedTags.join(", ") || "None")}</strong>
      </div>
    </div>
    ${review.warning ? `<div class="dev-inline-status">${escapeHtml(review.warning)}</div>` : ""}
  `;
}

function applyReviewSuggestions() {
  if (!state.review) return;
  const titleEl = document.getElementById("asset-title") as HTMLInputElement | null;
  const tagsEl = document.getElementById("asset-tags") as HTMLInputElement | null;
  const slugEl = document.getElementById("asset-slug") as HTMLInputElement | null;

  if (titleEl && !titleEl.value.trim()) {
    titleEl.value = state.review.recommendedTitle || titleEl.value;
  }

  const kindEl = document.getElementById("asset-kind") as HTMLSelectElement | null;
  if (kindEl && state.review.assetKindGuess && state.review.assetKindGuess !== "unknown") {
    kindEl.value = state.review.assetKindGuess;
  }

  if (tagsEl) {
    const current = tagsEl.value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    tagsEl.value = Array.from(
      new Set([...current, ...(state.review.recommendedTags || [])]),
    ).join(", ");
  }

  if (slugEl && !slugEl.value.trim() && titleEl) {
    slugEl.value = slugify(titleEl.value);
  }

  setInlineStatus("asset-review-status", "Applied AI review suggestions to the intake form.");
}

function fillFormFromRecord(sourceKey: string, record?: Record<string, unknown>, mode: "create" | "edit" = "create") {
  const source = getSource(sourceKey);
  if (!source) return;

  state.activeSourceKey = sourceKey;
  state.editorMode = mode;
  state.recordId = record ? String(record.id || "") : null;
  state.selectedFileName = "";
  state.review = null;

  const nextRecord = cloneRecord(record || source.defaultRecord);
  setWorkingRecord(nextRecord);

  (document.getElementById("asset-source-select") as HTMLSelectElement | null)!.value = sourceKey;
  (document.getElementById("asset-title") as HTMLInputElement | null)!.value = String(nextRecord.title || "");
  (document.getElementById("asset-slug") as HTMLInputElement | null)!.value = String(nextRecord.slug || "");
  (document.getElementById("asset-summary") as HTMLTextAreaElement | null)!.value = String(nextRecord.summary || "");
  (document.getElementById("asset-tags") as HTMLInputElement | null)!.value = Array.isArray(nextRecord.tags)
    ? nextRecord.tags.join(", ")
    : "";
  (document.getElementById("asset-world-binding") as HTMLInputElement | null)!.value = String(nextRecord.world_definition_id || "");
  (document.getElementById("asset-body-text") as HTMLTextAreaElement | null)!.value = String(nextRecord.body_text || "");

  const metadata = safeObject(nextRecord.metadata_json);
  (document.getElementById("asset-kind") as HTMLSelectElement | null)!.value = String(
    metadata.assetKind || "single",
  );
  (document.getElementById("asset-biome") as HTMLInputElement | null)!.value = String(metadata.biome || "");
  (document.getElementById("asset-terrain-type") as HTMLInputElement | null)!.value = String(metadata.terrainType || "");
  (document.getElementById("asset-structure-type") as HTMLInputElement | null)!.value = String(metadata.structureType || "");
  (document.getElementById("asset-render-layer") as HTMLSelectElement | null)!.value = String(metadata.renderLayer || "background");
  (document.getElementById("asset-intended-use") as HTMLInputElement | null)!.value = String(metadata.intendedUse || "");
  (document.getElementById("asset-palette-hints") as HTMLInputElement | null)!.value = Array.isArray(metadata.paletteHints)
    ? metadata.paletteHints.join(", ")
    : "";
  (document.getElementById("asset-slice-mode") as HTMLSelectElement | null)!.value = String(
    metadata.sliceMode || "none",
  );
  (document.getElementById("asset-frame-width") as HTMLInputElement | null)!.value = String(
    metadata.frameWidth || "",
  );
  (document.getElementById("asset-frame-height") as HTMLInputElement | null)!.value = String(
    metadata.frameHeight || "",
  );
  (document.getElementById("asset-columns") as HTMLInputElement | null)!.value = String(
    metadata.columns || "",
  );
  (document.getElementById("asset-rows") as HTMLInputElement | null)!.value = String(
    metadata.rows || "",
  );
  (document.getElementById("asset-padding") as HTMLInputElement | null)!.value = String(
    metadata.padding || "",
  );
  (document.getElementById("asset-spacing") as HTMLInputElement | null)!.value = String(
    metadata.spacing || "",
  );
  (document.getElementById("asset-canvas-width") as HTMLInputElement | null)!.value = String(
    metadata.width || "",
  );
  (document.getElementById("asset-canvas-height") as HTMLInputElement | null)!.value = String(
    metadata.height || "",
  );
  (document.getElementById("asset-tileable") as HTMLInputElement | null)!.checked = metadata.tileable === true;
  (document.getElementById("asset-seamless") as HTMLInputElement | null)!.checked = metadata.seamless === true;

  const title = document.getElementById("asset-intake-title");
  const copy = document.getElementById("asset-intake-copy");
  const fileMeta = document.getElementById("asset-file-meta");
  const deleteBtn = document.getElementById("asset-intake-delete") as HTMLButtonElement | null;
  if (title) {
    title.textContent = mode === "create" ? `New ${source.label}` : `Edit ${source.label}`;
  }
  if (copy) {
    copy.textContent = source.description;
  }
  if (fileMeta) {
    fileMeta.textContent = nextRecord.file_url
      ? `Loaded record ${String(nextRecord.title || nextRecord.id || "asset")}`
      : "No file selected yet.";
  }
  if (deleteBtn) {
    deleteBtn.style.display = mode === "edit" ? "inline-flex" : "none";
  }

  renderPreview(nextRecord);
  renderReview();
  renderSources();
  renderActiveSource();
}

function renderSources() {
  const sourceListEl = document.getElementById("asset-source-list");
  const sourceSelectEl = document.getElementById("asset-source-select") as HTMLSelectElement | null;
  if (!sourceListEl || !sourceSelectEl) return;

  sourceListEl.innerHTML = state.sources
    .map(
      (source) => `
        <button class="dev-category-btn ${source.key === state.activeSourceKey ? "active" : ""}" data-asset-source="${escapeHtml(source.key)}">
          <strong>${escapeHtml(source.label)}</strong>
          <span>${source.count} records</span>
        </button>
      `,
    )
    .join("");

  sourceSelectEl.innerHTML = state.sources
    .map(
      (source) => `<option value="${escapeHtml(source.key)}">${escapeHtml(source.label)}</option>`,
    )
    .join("");
  sourceSelectEl.value = state.activeSourceKey;

  sourceListEl.querySelectorAll<HTMLElement>("[data-asset-source]").forEach((button) => {
    button.addEventListener("click", () => {
      const sourceKey = button.dataset.assetSource || state.activeSourceKey;
      state.activeSourceKey = sourceKey;
      fillFormFromRecord(sourceKey, undefined, "create");
    });
  });
}

function renderActiveSource() {
  const source = getSource();
  const gridEl = document.getElementById("asset-record-grid");
  const titleEl = document.getElementById("asset-section-title");
  const copyEl = document.getElementById("asset-section-copy");
  const kickerEl = document.getElementById("asset-section-kicker");
  const metaEl = document.getElementById("asset-section-meta");
  if (!source || !gridEl || !titleEl || !copyEl || !kickerEl || !metaEl) return;

  titleEl.textContent = source.label;
  copyEl.textContent = source.description;
  kickerEl.textContent = state.sortOrder === "latest" ? "Latest First" : "Oldest First";
  metaEl.textContent = `${source.count} records • ${source.table}`;

  gridEl.innerHTML = source.error
    ? `<div class="dev-source-error">${escapeHtml(source.error)}</div>`
    : source.records.length === 0
      ? '<div class="dev-source-empty">No assets recorded yet for this source.</div>'
      : source.records
          .map((record) => {
            const fileUrl = String(record.preview_url || record.file_url || "");
            const mimeType = String(record.mime_type || "");
            const tags = Array.isArray(record.tags) ? record.tags : [];
            const preview = fileUrl && mimeType.startsWith("image/")
              ? `<img src="${escapeHtml(fileUrl)}" class="dev-assets-card-image" alt="${escapeHtml(record.title || "asset")}" />`
              : fileUrl && mimeType.startsWith("audio/")
                ? `<audio controls class="dev-assets-card-audio" src="${escapeHtml(fileUrl)}"></audio>`
                : `<div class="dev-assets-card-text">${escapeHtml(truncate(record.body_text || record.summary || "No preview available.", 180))}</div>`;
            return `
              <article class="dev-record-card dev-assets-card">
                <div class="dev-record-card-top">
                  <div>
                    <div class="dev-record-title">${escapeHtml(record.title || record.name || "Untitled Asset")}</div>
                    <div class="dev-record-meta">${escapeHtml(String(record.updated_at || record.created_at || "No timestamp"))}</div>
                  </div>
                  <div class="dev-record-actions">
                    <button class="btn btn-action dev-mini-btn" data-asset-edit="${escapeHtml(String(record.id || ""))}">Edit</button>
                    <button class="btn btn-action dev-mini-btn" data-asset-delete="${escapeHtml(String(record.id || ""))}">Delete</button>
                  </div>
                </div>
                ${preview}
                <div class="dev-assets-card-summary">${escapeHtml(truncate(record.summary || record.body_text || "", 140))}</div>
                <div class="dev-assets-tag-list">
                  ${tags
                    .slice(0, 6)
                    .map((tag) => `<span class="dev-assets-tag">${escapeHtml(tag)}</span>`)
                    .join("")}
                </div>
              </article>
            `;
          })
          .join("");

  gridEl.querySelectorAll<HTMLElement>("[data-asset-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.assetEdit || "";
      const record =
        source.records.find((entry) => String(entry.id || "") === recordId) || undefined;
      fillFormFromRecord(source.key, record, "edit");
    });
  });
  gridEl.querySelectorAll<HTMLElement>("[data-asset-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const recordId = button.dataset.assetDelete || "";
      const record =
        source.records.find((entry) => String(entry.id || "") === recordId) || undefined;
      const label = String(record?.title || recordId);
      if (!confirm(`Delete "${label}" from ${source.label}?`)) return;
      await fetch(
        `/dev/panel/records/${encodeURIComponent(source.key)}/${encodeURIComponent(recordId)}`,
        {
          method: "DELETE",
          headers: panelHeaders(),
        },
      );
      await loadWorkbench();
      fillFormFromRecord(source.key, undefined, "create");
    });
  });
}

async function loadWorkbench() {
  const response = await fetch(
    `/dev/panel/assets/workbench?sort=${encodeURIComponent(state.sortOrder)}`,
    {
      headers: panelHeaders(),
    },
  );
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || "Could not load asset workbench");
  }
  state.sources = payload.data?.sources || [];
  if (!getSource()) {
    state.activeSourceKey = state.sources[0]?.key || state.activeSourceKey;
  }
  renderSources();
  renderActiveSource();
}

async function saveCurrentAsset() {
  const source = getSource();
  if (!source) return;
  const record = getCurrentRecordFromForm();

  const url =
    state.editorMode === "create"
      ? `/dev/panel/records/${encodeURIComponent(source.key)}`
      : `/dev/panel/records/${encodeURIComponent(source.key)}/${encodeURIComponent(
          state.recordId || "",
        )}`;

  const response = await fetch(url, {
    method: state.editorMode === "create" ? "POST" : "PATCH",
    headers: panelHeaders(),
    body: JSON.stringify({ record }),
  });
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || "Could not save asset");
  }

  setInlineStatus(
    "asset-file-meta",
    state.editorMode === "create" ? "Asset created." : "Asset updated.",
  );
  await loadWorkbench();
  const refreshedSource = getSource(source.key);
  const refreshedRecord =
    refreshedSource?.records.find((entry) => String(entry.id || "") === String(payload.data?.id || "")) ||
    payload.data;
  fillFormFromRecord(source.key, refreshedRecord, "edit");
}

async function reviewCurrentAsset() {
  const source = getSource();
  if (!source) return;
  const record = getCurrentRecordFromForm();
  const buttonEl = document.getElementById("asset-review-btn") as HTMLButtonElement | null;
  if (buttonEl) buttonEl.disabled = true;
  setInlineStatus("asset-review-status", "Reviewing image against filename...");
  try {
    const response = await fetch("/dev/panel/assets/review", {
      method: "POST",
      headers: panelHeaders(),
      body: JSON.stringify({
        sourceKey: source.key,
        filename: state.selectedFileName || record.title || "asset.png",
        mimeType: record.mime_type,
        dataUrl: record.preview_url || record.file_url,
        record,
      }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not review asset");
    }
    state.review = payload.data || null;
    renderReview();
    setInlineStatus(
      "asset-review-status",
      payload.data?.warning ||
        `Review complete • ${payload.data?.provider || "unknown"} • ${Math.round(
          Number(payload.data?.confidence || 0) * 100,
        )}%`,
      payload.data?.verdict === "mismatch",
    );
  } catch (error: any) {
    setInlineStatus(
      "asset-review-status",
      error.message || "Could not review asset",
      true,
    );
  } finally {
    if (buttonEl) buttonEl.disabled = false;
  }
}

function bindFileInput() {
  const fileInput = document.getElementById("asset-file-input") as HTMLInputElement | null;
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    state.selectedFileName = file.name;
    state.review = null;
    renderReview();

    const source = getSource();
    if (!source) return;

    const working = getWorkingRecord();
    const title = inferTitleFromFilename(file.name);
    const titleEl = document.getElementById("asset-title") as HTMLInputElement | null;
    const slugEl = document.getElementById("asset-slug") as HTMLInputElement | null;
    if (titleEl && !titleEl.value.trim()) titleEl.value = title;
    if (slugEl && !slugEl.value.trim()) slugEl.value = slugify(title);

    if (file.type.startsWith("text/") || /\.(txt|md|story|json)$/i.test(file.name)) {
      const text = await file.text();
    setWorkingRecord({
      ...working,
      mime_type: file.type || "text/plain",
      body_text: text,
      content_kind: source.defaultRecord.content_kind || "text",
      });
      const bodyTextEl = document.getElementById("asset-body-text") as HTMLTextAreaElement | null;
      if (bodyTextEl) bodyTextEl.value = text;
      setInlineStatus("asset-file-meta", `Loaded text file: ${file.name}`);
      renderPreview({
        ...getCurrentRecordFromForm(),
        body_text: text,
        mime_type: file.type || "text/plain",
      });
      fileInput.value = "";
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    let width = 0;
    let height = 0;
    if (file.type.startsWith("image/")) {
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          width = image.naturalWidth || 0;
          height = image.naturalHeight || 0;
          resolve();
        };
        image.onerror = () => resolve();
        image.src = dataUrl;
      });
    }

    setWorkingRecord({
      ...working,
      file_url: dataUrl,
      preview_url: file.type.startsWith("image/") ? dataUrl : working.preview_url || "",
      mime_type: file.type || working.mime_type || "application/octet-stream",
      content_kind:
        source.defaultRecord.content_kind ||
        (file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("image/")
            ? "image"
            : "text"),
    });

    if (width > 0) {
      const widthEl = document.getElementById("asset-canvas-width") as HTMLInputElement | null;
      const heightEl = document.getElementById("asset-canvas-height") as HTMLInputElement | null;
      if (widthEl && !widthEl.value) widthEl.value = String(width);
      if (heightEl && !heightEl.value) heightEl.value = String(height);
    }

    setInlineStatus("asset-file-meta", `Loaded media file: ${file.name}`);
    renderPreview({
      ...getCurrentRecordFromForm(),
      file_url: dataUrl,
      preview_url: file.type.startsWith("image/") ? dataUrl : "",
      mime_type: file.type || "",
    });
    fileInput.value = "";
  });
}

function bindGlobalControls() {
  const sortEl = document.getElementById("asset-sort-order") as HTMLSelectElement | null;
  if (sortEl) {
    sortEl.value = state.sortOrder;
    sortEl.addEventListener("change", async () => {
      state.sortOrder = (sortEl.value as "latest" | "oldest") || "latest";
      localStorage.setItem(DEV_SORT_STORAGE, state.sortOrder);
      await loadWorkbench();
      fillFormFromRecord(state.activeSourceKey, undefined, "create");
    });
  }

  document.getElementById("asset-workbench-refresh")?.addEventListener("click", async () => {
    await loadWorkbench();
    fillFormFromRecord(state.activeSourceKey, undefined, "create");
  });
  document.getElementById("asset-intake-reset")?.addEventListener("click", () => {
    fillFormFromRecord(state.activeSourceKey, undefined, "create");
  });
  document.getElementById("asset-save-btn")?.addEventListener("click", async () => {
    try {
      await saveCurrentAsset();
    } catch (error: any) {
      setInlineStatus("asset-file-meta", error.message || "Could not save asset", true);
    }
  });
  document.getElementById("asset-review-btn")?.addEventListener("click", async () => {
    await reviewCurrentAsset();
  });
  document.getElementById("asset-apply-ai-btn")?.addEventListener("click", () => {
    applyReviewSuggestions();
    renderPreview();
  });
  document.getElementById("asset-source-select")?.addEventListener("change", (event) => {
    const nextSourceKey = String((event.target as HTMLSelectElement).value || state.activeSourceKey);
    fillFormFromRecord(nextSourceKey, undefined, "create");
  });
  document.getElementById("asset-title")?.addEventListener("input", () => {
    const title = (document.getElementById("asset-title") as HTMLInputElement | null)?.value || "";
    const slugEl = document.getElementById("asset-slug") as HTMLInputElement | null;
    if (slugEl && !slugEl.dataset.manual) {
      slugEl.value = slugify(title);
    }
  });
  document.getElementById("asset-slug")?.addEventListener("input", () => {
    const slugEl = document.getElementById("asset-slug") as HTMLInputElement | null;
    if (slugEl) slugEl.dataset.manual = "true";
  });
  document.getElementById("asset-intake-delete")?.addEventListener("click", async () => {
    if (state.editorMode !== "edit" || !state.recordId) return;
    const source = getSource();
    if (!source) return;
    const title = (document.getElementById("asset-title") as HTMLInputElement | null)?.value || state.recordId;
    if (!confirm(`Delete "${title}" from ${source.label}?`)) return;
    const response = await fetch(
      `/dev/panel/records/${encodeURIComponent(source.key)}/${encodeURIComponent(state.recordId)}`,
      {
        method: "DELETE",
        headers: panelHeaders(),
      },
    );
    const payload = await response.json();
    if (!payload.success) {
      setInlineStatus("asset-file-meta", payload.error || "Could not delete asset", true);
      return;
    }
    await loadWorkbench();
    fillFormFromRecord(source.key, undefined, "create");
  });

  [
    "asset-summary",
    "asset-body-text",
    "asset-tags",
    "asset-biome",
    "asset-kind",
    "asset-terrain-type",
    "asset-structure-type",
    "asset-render-layer",
    "asset-intended-use",
    "asset-palette-hints",
    "asset-slice-mode",
    "asset-frame-width",
    "asset-frame-height",
    "asset-columns",
    "asset-rows",
    "asset-padding",
    "asset-spacing",
    "asset-canvas-width",
    "asset-canvas-height",
    "asset-tileable",
    "asset-seamless",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderPreview();
    });
    document.getElementById(id)?.addEventListener("change", () => {
      renderPreview();
    });
  });

  bindFileInput();
}

async function bootstrap() {
  bindGlobalControls();
  await loadWorkbench();
  fillFormFromRecord(state.activeSourceKey, undefined, "create");
}

void bootstrap();

export {};
