import {
  DEV_PANEL_CATEGORIES,
  getDevSourceConfig,
  type DevCategoryConfig,
} from "../models/devPanelCatalog.js";

type SortOrder = "latest" | "oldest";

interface DevSourceSnapshot {
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

interface DevCategorySnapshot extends DevCategoryConfig {
  sources: DevSourceSnapshot[];
}

interface EditorState {
  mode: "create" | "edit";
  sourceKey: string;
  source: DevSourceSnapshot | null;
  recordId: string | null;
}

const DEV_KEY_STORAGE = "rpg_dev_panel_key";
const DEV_SORT_STORAGE = "rpg_dev_panel_sort";
const DEV_CATEGORY_STORAGE = "rpg_dev_panel_category";

const state: {
  requiresKey: boolean;
  sortOrder: SortOrder;
  categories: DevCategorySnapshot[];
  activeCategoryKey: string;
  editor: EditorState;
} = {
  requiresKey: false,
  sortOrder: (localStorage.getItem(DEV_SORT_STORAGE) as SortOrder) || "latest",
  categories: [],
  activeCategoryKey: localStorage.getItem(DEV_CATEGORY_STORAGE) || "creatures",
  editor: {
    mode: "create",
    sourceKey: "",
    source: null,
    recordId: null,
  },
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: unknown, max = 140) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function prettyValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
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

function getActiveCategory() {
  return (
    state.categories.find((category) => category.key === state.activeCategoryKey) ||
    state.categories[0] ||
    null
  );
}

function getSourceSnapshot(sourceKey: string) {
  return (
    state.categories
      .flatMap((category) => category.sources)
      .find((source) => source.key === sourceKey) || null
  );
}

function getRecordTitle(source: DevSourceSnapshot, record: Record<string, unknown>) {
  const titleCandidate =
    record[source.titleField] || record.name || record.title || record.id || "Untitled";
  return String(titleCandidate);
}

function getRecordTimestamp(source: DevSourceSnapshot, record: Record<string, unknown>) {
  const value =
    record[source.orderField] ||
    record.updated_at ||
    record.created_at ||
    record.updatedAt ||
    record.createdAt;
  if (!value) return "No timestamp";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function getRecordPreview(source: DevSourceSnapshot, record: Record<string, unknown>) {
  const imageUrl =
    typeof record.image_url === "string"
      ? record.image_url
      : typeof record.preview_url === "string"
        ? record.preview_url
        : typeof record.file_url === "string" &&
            String(record.mime_type || "").startsWith("image/")
          ? record.file_url
          : "";
  if (imageUrl) {
    return `<img class="dev-record-preview-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(getRecordTitle(source, record))}" />`;
  }

  const audioUrl =
    typeof record.file_url === "string" &&
    String(record.mime_type || "").startsWith("audio/")
      ? record.file_url
      : "";
  if (audioUrl) {
    return `<audio class="dev-record-preview-audio" controls src="${escapeHtml(audioUrl)}"></audio>`;
  }

  return "";
}

function buildSummaryList(source: DevSourceSnapshot, record: Record<string, unknown>) {
  return (source.summaryFields || [])
    .map((field) => {
      const value = record[field];
      if (value === undefined || value === null || value === "") return "";
      return `
        <div class="dev-record-summary-line">
          <span>${escapeHtml(field)}</span>
          <strong>${escapeHtml(truncate(prettyValue(value), 120))}</strong>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");
}

function renderCategories() {
  const listEl = document.getElementById("dev-category-list");
  if (!listEl) return;
  listEl.innerHTML = state.categories
    .map((category) => {
      const count = category.sources.reduce(
        (total, source) => total + (source.count || 0),
        0,
      );
      return `
        <button
          class="dev-category-btn ${category.key === state.activeCategoryKey ? "active" : ""}"
          data-category-key="${escapeHtml(category.key)}"
        >
          <strong>${escapeHtml(category.label)}</strong>
          <span>${count} records</span>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll<HTMLButtonElement>("[data-category-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategoryKey = button.dataset.categoryKey || state.activeCategoryKey;
      localStorage.setItem(DEV_CATEGORY_STORAGE, state.activeCategoryKey);
      renderCategories();
      renderActiveCategory();
    });
  });
}

function renderActiveCategory() {
  const category = getActiveCategory();
  const titleEl = document.getElementById("dev-section-title");
  const copyEl = document.getElementById("dev-section-copy");
  const kickerEl = document.getElementById("dev-section-kicker");
  const metaEl = document.getElementById("dev-section-meta");
  const gridEl = document.getElementById("dev-source-grid");
  if (!titleEl || !copyEl || !kickerEl || !metaEl || !gridEl) return;

  if (!category) {
    titleEl.textContent = "No category";
    copyEl.textContent = "No data available yet.";
    kickerEl.textContent = "Developer Console";
    metaEl.textContent = "0 sources";
    gridEl.innerHTML = "";
    return;
  }

  const totalRecords = category.sources.reduce(
    (total, source) => total + source.count,
    0,
  );
  titleEl.textContent = category.label;
  copyEl.textContent = category.description;
  kickerEl.textContent =
    state.sortOrder === "latest" ? "Latest First" : "Oldest First";
  metaEl.textContent = `${category.sources.length} sources • ${totalRecords} records`;

  gridEl.innerHTML = category.sources
    .map((source) => {
      const rows = source.error
        ? `<div class="dev-source-error">${escapeHtml(source.error)}</div>`
        : source.records.length === 0
          ? `<div class="dev-source-empty">No records found yet.</div>`
          : source.records
              .map((record) => {
                const recordId = String(record.id || "");
                const preview = getRecordPreview(source, record);
                return `
                  <article class="dev-record-card">
                    <div class="dev-record-card-top">
                      <div>
                        <div class="dev-record-title">${escapeHtml(getRecordTitle(source, record))}</div>
                        <div class="dev-record-meta">${escapeHtml(getRecordTimestamp(source, record))}</div>
                      </div>
                      <div class="dev-record-actions">
                        <button class="btn btn-action dev-mini-btn" data-edit-record="${escapeHtml(source.key)}::${escapeHtml(recordId)}">Edit</button>
                        <button class="btn btn-action dev-mini-btn" data-delete-record="${escapeHtml(source.key)}::${escapeHtml(recordId)}">Delete</button>
                      </div>
                    </div>
                    ${preview}
                    <div class="dev-record-summary">
                      ${buildSummaryList(source, record)}
                    </div>
                  </article>
                `;
              })
              .join("");

      return `
        <section class="dev-source-card">
          <div class="dev-source-head">
            <div>
              <div class="dev-source-title">${escapeHtml(source.label)}</div>
              <div class="dev-source-copy">${escapeHtml(source.description)}</div>
            </div>
            <div class="dev-source-pill">${source.count}</div>
          </div>
          <div class="dev-source-toolbar">
            <div class="dev-source-toolbar-meta">${escapeHtml(source.table)} • ordered by ${escapeHtml(source.orderField)}</div>
            <div class="dev-source-toolbar-actions">
              <button class="btn btn-action dev-mini-btn" data-refresh-source="${escapeHtml(source.key)}">Refresh</button>
              <button class="btn btn-primary dev-mini-btn" data-new-record="${escapeHtml(source.key)}">New</button>
            </div>
          </div>
          <div class="dev-record-list">${rows}</div>
        </section>
      `;
    })
    .join("");

  bindSourceActions();
}

function bindSourceActions() {
  document.querySelectorAll<HTMLElement>("[data-new-record]").forEach((button) => {
    button.addEventListener("click", () => {
      openEditor(button.dataset.newRecord || "", "create");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-refresh-source]").forEach((button) => {
    button.addEventListener("click", async () => {
      await refreshSingleSource(button.dataset.refreshSource || "");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-edit-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sourceKey] = String(button.dataset.editRecord || "").split("::");
      const recordId = String(button.dataset.editRecord || "").split("::")[1];
      openEditor(sourceKey, "edit", recordId);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [sourceKey] = String(button.dataset.deleteRecord || "").split("::");
      const recordId = String(button.dataset.deleteRecord || "").split("::")[1];
      await deleteRecord(sourceKey, recordId);
    });
  });
}

async function loadPanelStatus() {
  const response = await fetch("/dev/panel/status");
  const payload = await response.json();
  state.requiresKey = !!payload?.data?.requiresKey;
  const copyEl = document.getElementById("dev-key-copy");
  const formEl = document.getElementById("dev-key-form");
  if (copyEl) {
    copyEl.textContent = state.requiresKey
      ? "This panel requires the dev key configured on the server."
      : "No dev key is required right now. You can browse immediately.";
  }
  if (formEl) {
    formEl.classList.toggle("hidden", !state.requiresKey);
  }
}

async function loadAIConfig() {
  try {
    const response = await fetch("/dev/ai/config");
    const payload = await response.json();
    if (!payload.success) return;
    const providerEl = document.getElementById("dev-ai-provider") as HTMLSelectElement;
    const modelEl = document.getElementById("dev-ai-model") as HTMLInputElement;
    const baseUrlEl = document.getElementById("dev-ai-base-url") as HTMLInputElement;
    const keyEl = document.getElementById("dev-ai-key") as HTMLInputElement;
    if (providerEl) providerEl.value = payload.provider || "openai";
    if (modelEl) modelEl.value = payload.model || modelEl.value;
    if (baseUrlEl) baseUrlEl.value = payload.baseUrl || baseUrlEl.value;
    if (keyEl && payload.configured) {
      keyEl.placeholder = "Key already configured";
    }
    setInlineStatus(
      "dev-ai-status",
      payload.configured
        ? `Configured • ${payload.provider} • ${payload.model}`
        : "AI config not set yet",
    );
  } catch (error) {
    setInlineStatus("dev-ai-status", "Could not load AI config", true);
  }
}

async function loadCatalog() {
  const gridEl = document.getElementById("dev-source-grid");
  if (gridEl) {
    gridEl.innerHTML =
      '<div class="dev-source-empty">Loading database catalog...</div>';
  }

  try {
    const response = await fetch(`/dev/panel/catalog?sort=${state.sortOrder}`, {
      headers: panelHeaders(),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not load dev catalog");
    }
    state.categories = payload.data || [];
    if (!state.categories.some((category) => category.key === state.activeCategoryKey)) {
      state.activeCategoryKey = state.categories[0]?.key || DEV_PANEL_CATEGORIES[0]?.key;
    }
    renderCategories();
    renderActiveCategory();
    setInlineStatus("dev-key-copy", state.requiresKey ? "Dev key accepted." : "Ready.");
  } catch (error: any) {
    if (gridEl) {
      gridEl.innerHTML = `<div class="dev-source-error">${escapeHtml(error.message || "Could not load catalog")}</div>`;
    }
    setInlineStatus(
      "dev-key-copy",
      error.message || "Could not load dev catalog",
      true,
    );
  }
}

async function refreshSingleSource(sourceKey: string) {
  if (!sourceKey) return;
  try {
    const response = await fetch(
      `/dev/panel/source/${encodeURIComponent(sourceKey)}?sort=${state.sortOrder}`,
      {
        headers: panelHeaders(),
      },
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not refresh source");
    }
    state.categories = state.categories.map((category) => ({
      ...category,
      sources: category.sources.map((source) =>
        source.key === sourceKey ? payload.data : source,
      ),
    }));
    renderActiveCategory();
  } catch (error: any) {
    alert(error.message || "Could not refresh source");
  }
}

function openEditor(sourceKey: string, mode: "create" | "edit", recordId?: string) {
  const source = getSourceSnapshot(sourceKey);
  if (!source) return;

  const overlayEl = document.getElementById("dev-editor-overlay");
  const titleEl = document.getElementById("dev-editor-title");
  const copyEl = document.getElementById("dev-editor-copy");
  const textareaEl = document.getElementById("dev-editor-json") as HTMLTextAreaElement;
  const fileMetaEl = document.getElementById("dev-editor-file-meta");
  const aiStatusEl = document.getElementById("dev-editor-ai-status");
  const aiBriefEl = document.getElementById("dev-editor-ai-brief") as HTMLTextAreaElement;
  const deleteBtn = document.getElementById("dev-editor-delete") as HTMLButtonElement;
  if (!overlayEl || !titleEl || !copyEl || !textareaEl || !deleteBtn) return;

  state.editor = {
    mode,
    sourceKey,
    source,
    recordId: recordId || null,
  };

  const record =
    mode === "edit"
      ? source.records.find((entry) => String(entry.id || "") === String(recordId || ""))
      : source.defaultRecord;
  textareaEl.value = JSON.stringify(record || source.defaultRecord, null, 2);
  titleEl.textContent =
    mode === "create" ? `Create ${source.label}` : `Edit ${source.label}`;
  copyEl.textContent = source.description;
  deleteBtn.style.display = mode === "edit" ? "inline-flex" : "none";
  if (fileMetaEl) fileMetaEl.textContent = "";
  if (aiStatusEl) aiStatusEl.textContent = "";
  if (aiBriefEl) aiBriefEl.value = "";
  overlayEl.classList.add("open");
}

function closeEditor() {
  document.getElementById("dev-editor-overlay")?.classList.remove("open");
}

async function saveEditorRecord() {
  const textareaEl = document.getElementById("dev-editor-json") as HTMLTextAreaElement;
  const saveBtn = document.getElementById("dev-editor-save") as HTMLButtonElement;
  if (!textareaEl || !state.editor.source) return;

  let record: Record<string, unknown>;
  try {
    record = JSON.parse(textareaEl.value);
  } catch (error: any) {
    alert(`Invalid JSON: ${error.message}`);
    return;
  }

  saveBtn.disabled = true;
  try {
    const response = await fetch(
      state.editor.mode === "create"
        ? `/dev/panel/records/${encodeURIComponent(state.editor.sourceKey)}`
        : `/dev/panel/records/${encodeURIComponent(state.editor.sourceKey)}/${encodeURIComponent(state.editor.recordId || "")}`,
      {
        method: state.editor.mode === "create" ? "POST" : "PATCH",
        headers: panelHeaders(),
        body: JSON.stringify({ record }),
      },
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not save record");
    }
    await refreshSingleSource(state.editor.sourceKey);
    closeEditor();
  } catch (error: any) {
    alert(error.message || "Could not save record");
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteRecord(sourceKey: string, recordId: string) {
  const source = getSourceSnapshot(sourceKey);
  if (!source || !recordId) return;
  const record = source.records.find((entry) => String(entry.id || "") === recordId);
  const title = record ? getRecordTitle(source, record) : recordId;
  if (!confirm(`Delete "${title}" from ${source.label}?`)) return;

  try {
    const response = await fetch(
      `/dev/panel/records/${encodeURIComponent(sourceKey)}/${encodeURIComponent(recordId)}`,
      {
        method: "DELETE",
        headers: panelHeaders(),
      },
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not delete record");
    }
    await refreshSingleSource(sourceKey);
  } catch (error: any) {
    alert(error.message || "Could not delete record");
  }
}

async function deleteEditorRecord() {
  if (state.editor.mode !== "edit" || !state.editor.recordId) return;
  await deleteRecord(state.editor.sourceKey, state.editor.recordId);
  closeEditor();
}

function mergeEditorJson(nextRecord: Record<string, unknown>) {
  const textareaEl = document.getElementById("dev-editor-json") as HTMLTextAreaElement;
  if (!textareaEl) return;
  let currentRecord: Record<string, unknown> = {};
  try {
    currentRecord = JSON.parse(textareaEl.value);
  } catch {
    currentRecord = {};
  }
  textareaEl.value = JSON.stringify(
    {
      ...currentRecord,
      ...nextRecord,
    },
    null,
    2,
  );
}

function collectDraftTextFromRecord(record: Record<string, unknown>) {
  const candidateKeys = [
    "body_text",
    "dialogue_text",
    "description",
    "summary",
    "content",
    "event_text",
    "title",
    "name",
    "npc_name",
    "role",
    "ideology",
    "personality",
    "biome",
    "type",
    "subcategory",
  ];

  return candidateKeys
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

async function generateEditorDraftWithAI() {
  const textareaEl = document.getElementById("dev-editor-json") as HTMLTextAreaElement;
  const briefEl = document.getElementById("dev-editor-ai-brief") as HTMLTextAreaElement;
  const buttonEl = document.getElementById("dev-editor-ai-draft") as HTMLButtonElement;
  if (!textareaEl || !buttonEl || !state.editor.source) return;

  let currentRecord: Record<string, unknown> = {};
  try {
    currentRecord = JSON.parse(textareaEl.value || "{}");
  } catch (error: any) {
    setInlineStatus(
      "dev-editor-ai-status",
      `Fix JSON before using AI: ${error.message}`,
      true,
    );
    return;
  }

  const directBrief = briefEl?.value?.trim() || "";
  const promptText = directBrief || collectDraftTextFromRecord(currentRecord);
  if (!promptText) {
    setInlineStatus(
      "dev-editor-ai-status",
      "Add a short brief or put text into the current JSON first.",
      true,
    );
    return;
  }

  buttonEl.disabled = true;
  setInlineStatus("dev-editor-ai-status", "AI is shaping the draft...");

  try {
    const response = await fetch(
      `/dev/panel/ai/draft/${encodeURIComponent(state.editor.sourceKey)}`,
      {
        method: "POST",
        headers: panelHeaders(),
        body: JSON.stringify({
          promptText,
          currentRecord,
        }),
      },
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not generate AI draft");
    }

    mergeEditorJson(payload.data?.record || {});
    setInlineStatus(
      "dev-editor-ai-status",
      payload.data?.warning || "AI draft merged into the editor.",
      !!payload.data?.fallback,
    );
  } catch (error: any) {
    setInlineStatus(
      "dev-editor-ai-status",
      error.message || "Could not generate AI draft",
      true,
    );
  } finally {
    buttonEl.disabled = false;
  }
}

async function importEditorFile(file: File) {
  const source = state.editor.source;
  if (!source) return;
  const fileMetaEl = document.getElementById("dev-editor-file-meta");
  const text = await file.text().catch(() => "");

  if (file.type === "application/json" || file.name.endsWith(".json")) {
    try {
      const parsed = JSON.parse(text);
      mergeEditorJson(parsed);
      if (fileMetaEl) fileMetaEl.textContent = `Imported JSON: ${file.name}`;
      return;
    } catch {
      /* fall through to text upload */
    }
  }

  if (file.type.startsWith("text/") || /\.(txt|md|story|json)$/i.test(file.name)) {
    const draft = cloneRecord(source.defaultRecord);
    if ("body_text" in draft) {
      mergeEditorJson({
        body_text: text,
        title: draft.title || file.name.replace(/\.[^.]+$/, ""),
        slug:
          draft.slug ||
          file.name
            .replace(/\.[^.]+$/, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-"),
      });
    } else if ("dialogue_text" in draft) {
      mergeEditorJson({
        dialogue_text: text,
        npc_name: draft.npc_name || "Narrator",
      });
    } else if ("description" in draft) {
      mergeEditorJson({
        description: text,
      });
    }
    if (fileMetaEl) fileMetaEl.textContent = `Imported text: ${file.name}`;
    return;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const draft = cloneRecord(source.defaultRecord);
  const fileName = file.name.replace(/\.[^.]+$/, "");
  const nextRecord: Record<string, unknown> = {
    title: draft.title || fileName,
  };

  if ("file_url" in draft) {
    nextRecord.file_url = dataUrl;
    nextRecord.mime_type = file.type || draft.mime_type || "";
    if (file.type.startsWith("image/")) {
      nextRecord.preview_url = dataUrl;
    }
    if (!("slug" in draft)) {
      nextRecord.slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    } else {
      nextRecord.slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
  }

  if ("image_url" in draft) {
    nextRecord.image_url = dataUrl;
  }

  mergeEditorJson(nextRecord);
  if (fileMetaEl) fileMetaEl.textContent = `Imported media: ${file.name}`;
}

async function saveAIConfig() {
  const provider = (document.getElementById("dev-ai-provider") as HTMLSelectElement)?.value;
  const model = (document.getElementById("dev-ai-model") as HTMLInputElement)?.value;
  const baseUrl = (document.getElementById("dev-ai-base-url") as HTMLInputElement)?.value;
  const apiKey = (document.getElementById("dev-ai-key") as HTMLInputElement)?.value;

  try {
    const response = await fetch("/dev/ai/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        baseUrl,
        apiKey,
      }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Could not save AI config");
    }
    setInlineStatus(
      "dev-ai-status",
      `Saved • ${payload.config.provider} • ${payload.config.model}`,
    );
    const keyEl = document.getElementById("dev-ai-key") as HTMLInputElement;
    if (keyEl) keyEl.value = "";
  } catch (error: any) {
    setInlineStatus("dev-ai-status", error.message || "Could not save AI config", true);
  }
}

function bindGlobalControls() {
  const keyInput = document.getElementById("dev-key-input") as HTMLInputElement;
  if (keyInput) {
    keyInput.value = getDevKey();
  }

  const sortEl = document.getElementById("dev-sort-order") as HTMLSelectElement;
  if (sortEl) {
    sortEl.value = state.sortOrder;
    sortEl.addEventListener("change", async () => {
      state.sortOrder = (sortEl.value as SortOrder) || "latest";
      localStorage.setItem(DEV_SORT_STORAGE, state.sortOrder);
      await loadCatalog();
    });
  }

  document.getElementById("dev-key-save")?.addEventListener("click", async () => {
    const value = keyInput?.value.trim() || "";
    if (value) {
      localStorage.setItem(DEV_KEY_STORAGE, value);
    } else {
      localStorage.removeItem(DEV_KEY_STORAGE);
    }
    await loadCatalog();
  });

  document.getElementById("dev-refresh")?.addEventListener("click", async () => {
    await loadCatalog();
  });

  document.getElementById("dev-ai-save")?.addEventListener("click", async () => {
    await saveAIConfig();
  });

  document.getElementById("dev-editor-close")?.addEventListener("click", closeEditor);
  document.getElementById("dev-editor-template")?.addEventListener("click", () => {
    if (!state.editor.source) return;
    mergeEditorJson(state.editor.source.defaultRecord);
  });
  document.getElementById("dev-editor-ai-draft")?.addEventListener("click", async () => {
    await generateEditorDraftWithAI();
  });
  document.getElementById("dev-editor-save")?.addEventListener("click", async () => {
    await saveEditorRecord();
  });
  document.getElementById("dev-editor-delete")?.addEventListener("click", async () => {
    await deleteEditorRecord();
  });

  const fileInput = document.getElementById("dev-editor-file") as HTMLInputElement;
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    await importEditorFile(file);
    fileInput.value = "";
  });

  document.getElementById("dev-editor-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeEditor();
    }
  });
}

async function bootstrapDevPanel() {
  bindGlobalControls();
  await loadPanelStatus();
  await loadAIConfig();
  await loadCatalog();
}

void bootstrapDevPanel();
