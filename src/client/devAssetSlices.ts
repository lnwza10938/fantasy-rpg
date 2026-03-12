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
  naturalWidth: number;
  naturalHeight: number;
  dragRect: { x: number; y: number; width: number; height: number } | null;
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
} = {
  assets: [],
  active: null,
  slices: [],
  naturalWidth: 0,
  naturalHeight: 0,
  dragRect: null,
  dragStart: null,
  dragCurrent: null,
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

function slugify(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

function currentPrefix() {
  return ((document.getElementById("slice-prefix") as HTMLInputElement | null)?.value || "slice")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextSliceId() {
  const prefix = currentPrefix();
  return `${prefix}-${String(state.slices.length + 1).padStart(3, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function setManualInputs(slice: { x: number; y: number; width: number; height: number }) {
  const xEl = document.getElementById("slice-manual-x") as HTMLInputElement | null;
  const yEl = document.getElementById("slice-manual-y") as HTMLInputElement | null;
  const widthEl = document.getElementById("slice-manual-width") as HTMLInputElement | null;
  const heightEl = document.getElementById("slice-manual-height") as HTMLInputElement | null;
  if (xEl) xEl.value = String(slice.x);
  if (yEl) yEl.value = String(slice.y);
  if (widthEl) widthEl.value = String(slice.width);
  if (heightEl) heightEl.value = String(slice.height);
}

function slicePreviewStyle(slice: { x: number; y: number; width: number; height: number }) {
  if (!state.naturalWidth || !state.naturalHeight) return "";
  const scaleX = 100 / Math.max(slice.width, 1);
  const scaleY = 100 / Math.max(slice.height, 1);
  return [
    `background-image:url(${JSON.stringify(getImageUrl(state.active || {}))})`,
    `background-size:${state.naturalWidth * scaleX}% ${state.naturalHeight * scaleY}%`,
    `background-position:-${slice.x * scaleX}% -${slice.y * scaleY}%`,
  ].join(";");
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
      const canvasWidth = state.naturalWidth || parseIntInput("slice-columns", 1) * parseIntInput("slice-frame-width", slice.width) || slice.width;
      const canvasHeight = state.naturalHeight || parseIntInput("slice-rows", 1) * parseIntInput("slice-frame-height", slice.height) || slice.height;
      const left = canvasWidth > 0 ? (slice.x / canvasWidth) * 100 : 0;
      const top = canvasHeight > 0 ? (slice.y / canvasHeight) * 100 : 0;
      const widthPct = canvasWidth > 0 ? (slice.width / canvasWidth) * 100 : 0;
      const heightPct = canvasHeight > 0 ? (slice.height / canvasHeight) * 100 : 0;
      return `<div class="dev-slice-cell" style="left:${left}%;top:${top}%;width:${widthPct}%;height:${heightPct}%"><span>${slice.index + 1}</span></div>`;
    })
    .join("");

  const dragOverlay =
    state.dragRect && (state.naturalWidth || state.naturalHeight)
      ? (() => {
          const canvasWidth = state.naturalWidth || 1;
          const canvasHeight = state.naturalHeight || 1;
          const left = (state.dragRect.x / canvasWidth) * 100;
          const top = (state.dragRect.y / canvasHeight) * 100;
          const widthPct = (state.dragRect.width / canvasWidth) * 100;
          const heightPct = (state.dragRect.height / canvasHeight) * 100;
          return `<div class="dev-slice-drag-box" style="left:${left}%;top:${top}%;width:${widthPct}%;height:${heightPct}%"></div>`;
        })()
      : "";

  previewEl.innerHTML = `
    <div class="dev-slice-preview-frame">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(String(state.active.title || "slice preview"))}" class="dev-assets-preview-image" />
      <div class="dev-slice-grid-overlay">${overlay}${dragOverlay}</div>
    </div>
  `;

  outputEl.innerHTML = state.slices.length
    ? state.slices
        .map(
          (slice) => `
            <button class="dev-slice-row" type="button" data-slice-row="${slice.index}">
              <span class="dev-slice-thumb" style="${slicePreviewStyle(slice)}"></span>
              <span class="dev-slice-row-main">
              <strong>${escapeHtml(slice.id)}</strong>
              <span>x:${slice.x} y:${slice.y} w:${slice.width} h:${slice.height}</span>
              </span>
            </button>
          `,
        )
        .join("")
    : '<div class="dev-assets-preview-empty">No slices generated yet.</div>';

  outputEl.querySelectorAll<HTMLElement>("[data-slice-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.sliceRow || "-1");
      const slice = state.slices[index];
      if (!slice) return;
      setManualInputs(slice);
      setStatus(`Loaded ${slice.id} into the manual controls.`);
    });
  });

  const frameEl = previewEl.querySelector(".dev-slice-preview-frame") as HTMLDivElement | null;
  const imageEl = previewEl.querySelector(".dev-assets-preview-image") as HTMLImageElement | null;
  if (frameEl && imageEl) {
    const bindPreview = () => {
      state.naturalWidth = imageEl.naturalWidth || state.naturalWidth;
      state.naturalHeight = imageEl.naturalHeight || state.naturalHeight;
      attachDragHandlers(frameEl, imageEl);
    };
    if (imageEl.complete) {
      bindPreview();
    } else {
      imageEl.addEventListener("load", bindPreview, { once: true });
    }
  }
}

function clientToImagePoint(
  event: PointerEvent,
  imageEl: HTMLImageElement,
) {
  const rect = imageEl.getBoundingClientRect();
  const normalizedX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const normalizedY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
  return {
    x: Math.round(normalizedX * (imageEl.naturalWidth || state.naturalWidth || rect.width)),
    y: Math.round(normalizedY * (imageEl.naturalHeight || state.naturalHeight || rect.height)),
  };
}

function updateDragRect() {
  if (!state.dragStart || !state.dragCurrent) {
    state.dragRect = null;
    return;
  }
  const x = Math.min(state.dragStart.x, state.dragCurrent.x);
  const y = Math.min(state.dragStart.y, state.dragCurrent.y);
  const width = Math.abs(state.dragCurrent.x - state.dragStart.x);
  const height = Math.abs(state.dragCurrent.y - state.dragStart.y);
  state.dragRect = { x, y, width, height };
}

function paintDragBox(frameEl: HTMLDivElement) {
  const overlayEl = frameEl.querySelector(".dev-slice-grid-overlay") as HTMLDivElement | null;
  if (!overlayEl) return;
  const existing = overlayEl.querySelector(".dev-slice-drag-box") as HTMLDivElement | null;
  if (!state.dragRect || !state.naturalWidth || !state.naturalHeight) {
    existing?.remove();
    return;
  }
  const left = (state.dragRect.x / state.naturalWidth) * 100;
  const top = (state.dragRect.y / state.naturalHeight) * 100;
  const width = (state.dragRect.width / state.naturalWidth) * 100;
  const height = (state.dragRect.height / state.naturalHeight) * 100;
  const dragBox = existing || document.createElement("div");
  dragBox.className = "dev-slice-drag-box";
  dragBox.style.left = `${left}%`;
  dragBox.style.top = `${top}%`;
  dragBox.style.width = `${width}%`;
  dragBox.style.height = `${height}%`;
  if (!existing) overlayEl.appendChild(dragBox);
}

function commitDragSlice() {
  if (!state.dragRect || state.dragRect.width < 2 || state.dragRect.height < 2) {
    state.dragRect = null;
    renderPreview();
    return;
  }
  const slice = {
    id: nextSliceId(),
    x: state.dragRect.x,
    y: state.dragRect.y,
    width: state.dragRect.width,
    height: state.dragRect.height,
    index: state.slices.length,
  };
  state.slices.push(slice);
  setManualInputs(slice);
  state.dragRect = null;
  renderPreview();
  setStatus(`Added dragged slice ${slice.id}.`);
}

function attachDragHandlers(frameEl: HTMLDivElement, imageEl: HTMLImageElement) {
  const manualMode = ((document.getElementById("slice-mode") as HTMLSelectElement | null)?.value || "grid") === "manual";
  frameEl.classList.toggle("is-manual", manualMode);
  if (!manualMode) {
    frameEl.onpointerdown = null;
    frameEl.onpointermove = null;
    frameEl.onpointerup = null;
    frameEl.onpointerleave = null;
    frameEl.onpointercancel = null;
    return;
  }

  frameEl.onpointerdown = (event: PointerEvent) => {
    const start = clientToImagePoint(event, imageEl);
    state.dragStart = start;
    state.dragCurrent = start;
    updateDragRect();
    paintDragBox(frameEl);
    frameEl.setPointerCapture(event.pointerId);
  };

  frameEl.onpointermove = (event: PointerEvent) => {
    if (!state.dragStart) return;
    state.dragCurrent = clientToImagePoint(event, imageEl);
    updateDragRect();
    paintDragBox(frameEl);
  };

  frameEl.onpointerup = (event: PointerEvent) => {
    if (!state.dragStart) return;
    state.dragCurrent = clientToImagePoint(event, imageEl);
    updateDragRect();
    state.dragStart = null;
    state.dragCurrent = null;
    frameEl.releasePointerCapture(event.pointerId);
    commitDragSlice();
  };

  frameEl.onpointerleave = (event: PointerEvent) => {
    if (!state.dragStart || !frameEl.hasPointerCapture(event.pointerId)) return;
    state.dragCurrent = clientToImagePoint(event, imageEl);
    updateDragRect();
    paintDragBox(frameEl);
  };

  frameEl.onpointercancel = () => {
    state.dragStart = null;
    state.dragCurrent = null;
    state.dragRect = null;
    renderPreview();
  };
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
  state.dragRect = null;
  state.dragStart = null;
  state.dragCurrent = null;

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
  if (!frameWidth || !frameHeight || !columns || !rows) {
    setStatus("Frame width, frame height, columns, and rows are required.", true);
    return;
  }

  const slices: Array<{ id: string; x: number; y: number; width: number; height: number; index: number }> = [];
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      slices.push({
        id: `${currentPrefix()}-${String(index + 1).padStart(3, "0")}`,
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

function addManualSlice() {
  if (!state.active) {
    setStatus("Choose an asset before adding manual slices.", true);
    return;
  }
  const x = parseIntInput("slice-manual-x", 0);
  const y = parseIntInput("slice-manual-y", 0);
  const width = parseIntInput("slice-manual-width", 32);
  const height = parseIntInput("slice-manual-height", 32);
  const index = state.slices.length;
  state.slices.push({
    id: nextSliceId(),
    x,
    y,
    width,
    height,
    index,
  });
  renderPreview();
  setStatus(`Added manual slice ${index + 1}.`);
}

function removeLastSlice() {
  if (!state.slices.length) {
    setStatus("No slices to remove.", true);
    return;
  }
  state.slices.pop();
  renderPreview();
  setStatus("Removed the last slice.");
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

async function promoteSlices() {
  if (!state.active) {
    setStatus("Choose an asset before promoting slices.", true);
    return;
  }
  if (!state.slices.length) {
    setStatus("Generate or add slices before promoting.", true);
    return;
  }

  const metadata = getMetadata(state.active);
  const sourceKey = state.active.sourceKey;
  const baseTitle = String(state.active.title || "Slice Asset");
  const baseSlug = slugify(String(state.active.slug || state.active.title || "slice-asset"));
  let created = 0;

  for (const slice of state.slices) {
    const record = {
      title: `${baseTitle} ${slice.id}`,
      slug: `${baseSlug}-${slice.id}`,
      summary: `Derived from ${baseTitle} at x:${slice.x} y:${slice.y} w:${slice.width} h:${slice.height}.`,
      body_text: "",
      file_url: state.active.file_url || "",
      preview_url: state.active.preview_url || state.active.file_url || "",
      mime_type: state.active.mime_type || "image/png",
      tags: Array.from(
        new Set([...(Array.isArray(state.active.tags) ? state.active.tags : []), "slice", "derived-asset"]),
      ),
      world_definition_id: state.active.world_definition_id || null,
      metadata_json: {
        ...metadata,
        assetKind: "single",
        derivedFromSheet: true,
        sourceSheetId: state.active.id,
        parentAssetId: state.active.id,
        sliceRect: {
          x: slice.x,
          y: slice.y,
          width: slice.width,
          height: slice.height,
        },
        sourceSliceId: slice.id,
      },
    };

    const response = await fetch(`/dev/panel/records/${encodeURIComponent(sourceKey)}`, {
      method: "POST",
      headers: panelHeaders(),
      body: JSON.stringify({ record }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || `Could not promote ${slice.id}`);
    }
    created += 1;
  }

  setStatus(`Promoted ${created} slices into standalone asset records.`);
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
  document.getElementById("slice-mode")?.addEventListener("change", () => renderPreview());
  document.getElementById("slice-add-manual")?.addEventListener("click", addManualSlice);
  document.getElementById("slice-remove-last")?.addEventListener("click", removeLastSlice);
  document.getElementById("slice-promote")?.addEventListener("click", async () => {
    try {
      await promoteSlices();
    } catch (error: any) {
      setStatus(error.message || "Could not promote slices", true);
    }
  });
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
