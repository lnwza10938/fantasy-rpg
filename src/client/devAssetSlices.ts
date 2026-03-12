interface SourceSnapshot {
  key: string;
  label: string;
  records: Record<string, unknown>[];
}

interface SliceAssetRecord extends Record<string, unknown> {
  sourceKey: string;
  sourceLabel: string;
}

const DEV_KEY_STORAGE = "rpg_dev_panel_key";

const state: {
  assets: SliceAssetRecord[];
  active: SliceAssetRecord | null;
  slices: Array<{ id: string; x: number; y: number; width: number; height: number; index: number }>;
} = {
  assets: [],
  active: null,
  slices: [],
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

function parseIntInput(id: string, fallback = 0) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const parsed = Number(el?.value || "");
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function setStatus(text: string, isError = false) {
  const el = document.getElementById("slice-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function getImageUrl(record: Record<string, unknown>) {
  return String(record.preview_url || record.file_url || "");
}

function getMetadata(record: Record<string, unknown>) {
  return safeObject(record.metadata_json);
}

function renderAssetList() {
  const listEl = document.getElementById("slice-asset-list");
  if (!listEl) return;
  listEl.innerHTML = state.assets
    .map((asset) => {
      const active = state.active?.id === asset.id;
      const metadata = getMetadata(asset);
      const kind = String(metadata.assetKind || "single");
      return `
        <button class="dev-category-btn ${active ? "active" : ""}" data-slice-asset="${escapeHtml(String(asset.id || ""))}">
          <strong>${escapeHtml(String(asset.title || "Untitled Asset"))}</strong>
          <span>${escapeHtml(asset.sourceLabel)} • ${escapeHtml(kind)}</span>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll<HTMLElement>("[data-slice-asset]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.sliceAsset || "";
      const asset = state.assets.find((entry) => String(entry.id || "") === id) || null;
      if (asset) {
        loadAssetIntoEditor(asset);
      }
    });
  });
}

function renderPreview() {
  const previewEl = document.getElementById("slice-preview");
  const outputEl = document.getElementById("slice-output");
  if (!previewEl || !outputEl) return;

  if (!state.active) {
    previewEl.innerHTML = '<div class="dev-assets-preview-empty">Choose an image asset to begin slicing.</div>';
    outputEl.innerHTML = "";
    return;
  }

  const imageUrl = getImageUrl(state.active);
  if (!imageUrl) {
    previewEl.innerHTML = '<div class="dev-assets-preview-empty">This asset does not have an image preview.</div>';
    outputEl.innerHTML = "";
    return;
  }

  const overlay = state.slices
    .map((slice) => {
      const width = parseIntInput("slice-frame-width", slice.width);
      const height = parseIntInput("slice-frame-height", slice.height);
      const canvasWidth = parseIntInput("slice-columns", 1) * width || slice.width;
      const canvasHeight = parseIntInput("slice-rows", 1) * height || slice.height;
      const left = canvasWidth > 0 ? (slice.x / canvasWidth) * 100 : 0;
      const top = canvasHeight > 0 ? (slice.y / canvasHeight) * 100 : 0;
      const widthPct = canvasWidth > 0 ? (slice.width / canvasWidth) * 100 : 0;
      const heightPct = canvasHeight > 0 ? (slice.height / canvasHeight) * 100 : 0;
      return `<div class="dev-slice-cell" style="left:${left}%;top:${top}%;width:${widthPct}%;height:${heightPct}%"><span>${slice.index + 1}</span></div>`;
    })
    .join("");

  previewEl.innerHTML = `
    <div class="dev-slice-preview-frame">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(String(state.active.title || "slice preview"))}" class="dev-assets-preview-image" />
      <div class="dev-slice-grid-overlay">${overlay}</div>
    </div>
  `;

  outputEl.innerHTML = state.slices.length
    ? state.slices
        .map(
          (slice) => `
            <div class="dev-slice-row">
              <strong>${escapeHtml(slice.id)}</strong>
              <span>x:${slice.x} y:${slice.y} w:${slice.width} h:${slice.height}</span>
            </div>
          `,
        )
        .join("")
    : '<div class="dev-assets-preview-empty">No slices generated yet.</div>';
}

function loadAssetIntoEditor(asset: SliceAssetRecord) {
  state.active = asset;
  const metadata = getMetadata(asset);
  const titleEl = document.getElementById("slice-title");
  const copyEl = document.getElementById("slice-copy");
  const metaEl = document.getElementById("slice-meta");
  const prefixEl = document.getElementById("slice-prefix") as HTMLInputElement | null;

  if (titleEl) titleEl.textContent = String(asset.title || "Untitled Asset");
  if (copyEl) {
    copyEl.textContent =
      String(asset.summary || "") ||
      "Adjust the grid and save the generated slice rectangles back into this asset record.";
  }
  if (metaEl) metaEl.textContent = `${asset.sourceLabel} • ${String(asset.mime_type || "image")}`;

  (document.getElementById("slice-mode") as HTMLSelectElement | null)!.value = String(
    metadata.sliceMode || "grid",
  );
  (document.getElementById("slice-frame-width") as HTMLInputElement | null)!.value = String(
    metadata.frameWidth || "",
  );
  (document.getElementById("slice-frame-height") as HTMLInputElement | null)!.value = String(
    metadata.frameHeight || "",
  );
  (document.getElementById("slice-columns") as HTMLInputElement | null)!.value = String(
    metadata.columns || "",
  );
  (document.getElementById("slice-rows") as HTMLInputElement | null)!.value = String(
    metadata.rows || "",
  );
  (document.getElementById("slice-padding") as HTMLInputElement | null)!.value = String(
    metadata.padding || 0,
  );
  (document.getElementById("slice-spacing") as HTMLInputElement | null)!.value = String(
    metadata.spacing || 0,
  );
  if (prefixEl) {
    prefixEl.value = String(metadata.slicePrefix || asset.slug || asset.title || "slice")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  state.slices = Array.isArray(metadata.slices)
    ? metadata.slices
        .map((entry, index) => {
          const slice = safeObject(entry);
          return {
            id: String(slice.id || `slice-${index + 1}`),
            x: Number(slice.x || 0),
            y: Number(slice.y || 0),
            width: Number(slice.width || metadata.frameWidth || 0),
            height: Number(slice.height || metadata.frameHeight || 0),
            index,
          };
        })
        .filter((entry) => entry.width > 0 && entry.height > 0)
    : [];

  renderAssetList();
  renderPreview();
}

function generateSlices() {
  if (!state.active) {
    setStatus("Choose an image asset first.", true);
    return;
  }

  const frameWidth = parseIntInput("slice-frame-width");
  const frameHeight = parseIntInput("slice-frame-height");
  const columns = parseIntInput("slice-columns");
  const rows = parseIntInput("slice-rows");
  const padding = parseIntInput("slice-padding", 0);
  const spacing = parseIntInput("slice-spacing", 0);
  const prefix = ((document.getElementById("slice-prefix") as HTMLInputElement | null)?.value || "slice")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!frameWidth || !frameHeight || !columns || !rows) {
    setStatus("Frame width, frame height, columns, and rows are required.", true);
    return;
  }

  const slices: Array<{ id: string; x: number; y: number; width: number; height: number; index: number }> = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      slices.push({
        id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
        x: padding + col * (frameWidth + spacing),
        y: padding + row * (frameHeight + spacing),
        width: frameWidth,
        height: frameHeight,
        index,
      });
      index += 1;
    }
  }
  state.slices = slices;
  renderPreview();
  setStatus(`Generated ${slices.length} grid slices.`);
}

async function saveSlices() {
  if (!state.active) {
    setStatus("Choose an asset before saving.", true);
    return;
  }

  const metadata = {
    ...getMetadata(state.active),
    assetKind: "sheet",
    sliceMode: (document.getElementById("slice-mode") as HTMLSelectElement | null)?.value || "grid",
    frameWidth: parseIntInput("slice-frame-width"),
    frameHeight: parseIntInput("slice-frame-height"),
    columns: parseIntInput("slice-columns"),
    rows: parseIntInput("slice-rows"),
    padding: parseIntInput("slice-padding", 0),
    spacing: parseIntInput("slice-spacing", 0),
    slicePrefix: (document.getElementById("slice-prefix") as HTMLInputElement | null)?.value || "",
    slices: state.slices,
  };

  const response = await fetch(
    `/dev/panel/records/${encodeURIComponent(state.active.sourceKey)}/${encodeURIComponent(String(state.active.id || ""))}`,
    {
      method: "PATCH",
      headers: panelHeaders(),
      body: JSON.stringify({
        record: {
          ...state.active,
          metadata_json: metadata,
        },
      }),
    },
  );
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.error || "Could not save slice metadata");
  }
  setStatus("Slice metadata saved to the asset record.");
}

async function loadAssets() {
  const response = await fetch("/dev/panel/assets/workbench?sort=latest", {
    headers: panelHeaders(),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Could not load assets");

  const sources = (payload.data?.sources || []) as SourceSnapshot[];
  state.assets = sources
    .filter((source) => source.key !== "audio_entries" && source.key !== "story_files")
    .flatMap((source) =>
      (source.records || []).map((record) => ({
        ...record,
        sourceKey: source.key,
        sourceLabel: source.label,
      }) as SliceAssetRecord),
    )
    .filter((record) => String(record.mime_type || "").startsWith("image/"));

  renderAssetList();
  if (state.assets[0]) {
    loadAssetIntoEditor(state.assets[0]);
  }
}

function bindControls() {
  document.getElementById("slice-generate")?.addEventListener("click", generateSlices);
  document.getElementById("slice-save")?.addEventListener("click", async () => {
    try {
      await saveSlices();
    } catch (error: any) {
      setStatus(error.message || "Could not save slice metadata", true);
    }
  });
}

async function bootstrap() {
  bindControls();
  await loadAssets();
}

void bootstrap();

export {};
