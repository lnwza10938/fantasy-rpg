import {
  buildNameDrivenAutofillPrompt,
  mergeAutofillRecord,
  requestDevAIDraft,
} from "./devAIAutofill.js";

interface TerrainContextRecord extends Record<string, unknown> {}

const DEV_KEY_STORAGE = "rpg_dev_panel_key";

const state: {
  recipes: TerrainContextRecord[];
  assets: TerrainContextRecord[];
  audio: TerrainContextRecord[];
  mode: "create" | "edit";
  recordId: string | null;
} = {
  recipes: [],
  assets: [],
  audio: [],
  mode: "create",
  recordId: null,
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

function metadataNumber(metadata: Record<string, unknown>, key: string, fallback: number | null = null) {
  const value = metadata[key];
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? String(metadata[key]).trim() : "";
}

function inputValue(id: string) {
  return (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value?.trim() || "";
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
  const el = document.getElementById("terrain-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function setAIStatus(text: string, isError = false) {
  const el = document.getElementById("terrain-ai-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function renderRecipeList() {
  const listEl = document.getElementById("terrain-recipe-list");
  if (!listEl) return;
  listEl.innerHTML = state.recipes
    .map(
      (recipe) => `
        <button class="dev-category-btn ${String(recipe.id || "") === state.recordId ? "active" : ""}" data-terrain-recipe="${escapeHtml(String(recipe.id || ""))}">
          <strong>${escapeHtml(String(recipe.title || "Untitled Recipe"))}</strong>
          <span>${escapeHtml(String(recipe.summary || "No summary"))}</span>
        </button>
      `,
    )
    .join("");

  listEl.querySelectorAll<HTMLElement>("[data-terrain-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      const recipe = state.recipes.find((entry) => String(entry.id || "") === (button.dataset.terrainRecipe || ""));
      if (recipe) {
        fillForm(recipe, "edit");
      }
    });
  });
}

function renderPickList(targetId: string, records: TerrainContextRecord[], selectedIds: string[]) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = records
    .map((record) => {
      const id = String(record.id || "");
      const checked = selectedIds.includes(id) ? "checked" : "";
      return `
        <label class="dev-topology-check dev-terrain-pick">
          <input type="checkbox" data-terrain-pick="${escapeHtml(id)}" data-pick-target="${escapeHtml(targetId)}" ${checked} />
          <span>${escapeHtml(String(record.title || "Untitled"))}</span>
        </label>
      `;
    })
    .join("");
}

function getSelectedIds(targetId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(`[data-pick-target="${targetId}"]:checked`),
  ).map((input) => input.dataset.terrainPick || "");
}

function collectSliceOptions(records: TerrainContextRecord[]) {
  return records.flatMap((record) => {
    const metadata = safeObject(record.metadata_json);
    return Array.isArray(metadata.slices)
      ? metadata.slices.map((entry: unknown) => {
          const slice = safeObject(entry);
          return {
            id: `${String(record.id || "")}:${String(slice.id || "slice")}`,
            title: `${String(record.title || "Asset")} • ${String(slice.id || "slice")}`,
          };
        })
      : [];
  });
}

function renderAllPickers(selected: {
  assetRefs?: string[];
  structureRefs?: string[];
  effectRefs?: string[];
  audioRefs?: string[];
  sliceRefs?: string[];
}) {
  const visualAssets = state.assets.filter((record) => {
    const subcategory = String(record.subcategory || "");
    return ["terrain", "background", "structure", "effect", "monster", "character-part"].includes(subcategory);
  });
  renderPickList(
    "terrain-asset-picks",
    visualAssets,
    [...(selected.assetRefs || []), ...(selected.structureRefs || []), ...(selected.effectRefs || [])],
  );
  renderPickList("terrain-audio-picks", state.audio, selected.audioRefs || []);

  const sliceOptions = collectSliceOptions(visualAssets);
  const sliceEl = document.getElementById("terrain-slice-picks");
  if (sliceEl) {
    sliceEl.innerHTML = sliceOptions
      .map(
        (slice) => `
          <label class="dev-topology-check dev-terrain-pick">
            <input type="checkbox" data-terrain-slice="${escapeHtml(slice.id)}" ${selected.sliceRefs?.includes(slice.id) ? "checked" : ""} />
            <span>${escapeHtml(slice.title)}</span>
          </label>
        `,
      )
      .join("");
  }
}

function getCurrentRecord() {
  const zoneColor = inputValue("terrain-zone-color");
  const flowColor = inputValue("terrain-flow-color");
  return {
    category: "recipe",
    subcategory: "terrain",
    content_kind: "json",
    title: (document.getElementById("terrain-title") as HTMLInputElement | null)?.value?.trim() || "Untitled Terrain Recipe",
    slug:
      (document.getElementById("terrain-slug") as HTMLInputElement | null)?.value?.trim() ||
      slugify((document.getElementById("terrain-title") as HTMLInputElement | null)?.value || ""),
    summary: (document.getElementById("terrain-summary") as HTMLTextAreaElement | null)?.value || "",
    body_text: (document.getElementById("terrain-body-text") as HTMLTextAreaElement | null)?.value || "",
    file_url: "",
    preview_url: "",
    mime_type: "application/json",
    tags: ["terrain-recipe"],
    metadata_json: {
      biome: (document.getElementById("terrain-biome") as HTMLInputElement | null)?.value?.trim() || "",
      terrainType: (document.getElementById("terrain-type") as HTMLInputElement | null)?.value?.trim() || "",
      appliesTo: (document.getElementById("terrain-applies-to") as HTMLSelectElement | null)?.value || "zone",
      renderLayer: (document.getElementById("terrain-render-layer") as HTMLSelectElement | null)?.value || "midground",
      intendedUse: (document.getElementById("terrain-use") as HTMLInputElement | null)?.value?.trim() || "",
      selectionWeight: Number((document.getElementById("terrain-weight") as HTMLInputElement | null)?.value || 100) || 100,
      minDanger: metadataNumber(
        { value: (document.getElementById("terrain-min-danger") as HTMLInputElement | null)?.value || null },
        "value",
      ),
      maxDanger: metadataNumber(
        { value: (document.getElementById("terrain-max-danger") as HTMLInputElement | null)?.value || null },
        "value",
      ),
      assetRefs: getSelectedIds("terrain-asset-picks"),
      structureRefs: [],
      effectRefs: [],
      audioRefs: getSelectedIds("terrain-audio-picks"),
      sliceRefs: Array.from(document.querySelectorAll<HTMLInputElement>("[data-terrain-slice]:checked")).map((input) => input.dataset.terrainSlice || ""),
      paletteOverride: {
        zoneColor,
        flowColor,
      },
    },
    is_active: true,
  };
}

function validateRecord(record: Record<string, unknown>) {
  const metadata = safeObject(record.metadata_json);
  const biome = metadataString(metadata, "biome");
  const terrainType = metadataString(metadata, "terrainType");
  const intendedUse = metadataString(metadata, "intendedUse");
  const assetRefs = Array.isArray(metadata.assetRefs) ? metadata.assetRefs : [];
  const audioRefs = Array.isArray(metadata.audioRefs) ? metadata.audioRefs : [];
  const sliceRefs = Array.isArray(metadata.sliceRefs) ? metadata.sliceRefs : [];
  const palette = safeObject(metadata.paletteOverride);
  const hasPalette = !!metadataString(palette, "zoneColor") || !!metadataString(palette, "flowColor");
  const notes = String(record.body_text || "").trim();

  if (!biome && !terrainType && !intendedUse) {
    throw new Error("Recipe needs at least a biome, terrain type, or intended use.");
  }
  if (!assetRefs.length && !audioRefs.length && !sliceRefs.length && !hasPalette && !notes) {
    throw new Error("Attach assets, slices, audio, palette colors, or notes before saving the recipe.");
  }
}

function fillForm(record?: TerrainContextRecord, mode: "create" | "edit" = "create") {
  const next = record || {
    title: "New Terrain Recipe",
    slug: "new-terrain-recipe",
    summary: "",
    body_text: "",
    metadata_json: {
      biome: "forest",
      terrainType: "plains",
      appliesTo: "zone",
      renderLayer: "midground",
      intendedUse: "world-geography",
      selectionWeight: 100,
      minDanger: null,
      maxDanger: null,
      assetRefs: [],
      structureRefs: [],
      effectRefs: [],
      audioRefs: [],
      sliceRefs: [],
      paletteOverride: {
        zoneColor: "",
        flowColor: "",
      },
    },
  };
  const metadata = safeObject(next.metadata_json);
  state.mode = mode;
  state.recordId = record ? String(record.id || "") : null;

  (document.getElementById("terrain-title") as HTMLInputElement | null)!.value = String(next.title || "");
  (document.getElementById("terrain-slug") as HTMLInputElement | null)!.value = String(next.slug || "");
  (document.getElementById("terrain-biome") as HTMLInputElement | null)!.value = String(metadata.biome || "");
  (document.getElementById("terrain-type") as HTMLInputElement | null)!.value = String(metadata.terrainType || "");
  (document.getElementById("terrain-applies-to") as HTMLSelectElement | null)!.value = String(metadata.appliesTo || "zone");
  (document.getElementById("terrain-render-layer") as HTMLSelectElement | null)!.value = String(metadata.renderLayer || "midground");
  (document.getElementById("terrain-weight") as HTMLInputElement | null)!.value = String(metadataNumber(metadata, "selectionWeight", 100) ?? 100);
  (document.getElementById("terrain-min-danger") as HTMLInputElement | null)!.value = String(metadataNumber(metadata, "minDanger", null) ?? "");
  (document.getElementById("terrain-max-danger") as HTMLInputElement | null)!.value = String(metadataNumber(metadata, "maxDanger", null) ?? "");
  (document.getElementById("terrain-use") as HTMLInputElement | null)!.value = String(metadata.intendedUse || "");
  const palette = safeObject(metadata.paletteOverride);
  (document.getElementById("terrain-zone-color") as HTMLInputElement | null)!.value = String(palette.zoneColor || "");
  (document.getElementById("terrain-flow-color") as HTMLInputElement | null)!.value = String(palette.flowColor || "");
  (document.getElementById("terrain-summary") as HTMLTextAreaElement | null)!.value = String(next.summary || "");
  (document.getElementById("terrain-body-text") as HTMLTextAreaElement | null)!.value = String(next.body_text || "");
  (document.getElementById("terrain-editor-title") as HTMLElement | null)!.textContent =
    mode === "create" ? "New Terrain Recipe" : `Edit ${String(next.title || "Terrain Recipe")}`;
  (document.getElementById("terrain-delete") as HTMLButtonElement | null)!.style.display =
    mode === "edit" ? "inline-flex" : "none";

  renderRecipeList();
  renderAllPickers({
    assetRefs: Array.isArray(metadata.assetRefs) ? metadata.assetRefs.map((entry) => String(entry)) : [],
    structureRefs: Array.isArray(metadata.structureRefs) ? metadata.structureRefs.map((entry) => String(entry)) : [],
    effectRefs: Array.isArray(metadata.effectRefs) ? metadata.effectRefs.map((entry) => String(entry)) : [],
    audioRefs: Array.isArray(metadata.audioRefs) ? metadata.audioRefs.map((entry) => String(entry)) : [],
    sliceRefs: Array.isArray(metadata.sliceRefs) ? metadata.sliceRefs.map((entry) => String(entry)) : [],
  });
}

async function loadContext() {
  const response = await fetch("/dev/panel/assets/terrain-context", {
    headers: panelHeaders(),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Could not load terrain context");
  state.assets = payload.data?.assets || [];
  state.audio = payload.data?.audio || [];
  state.recipes = payload.data?.recipes || [];
  renderRecipeList();
  fillForm(undefined, "create");
}

async function saveRecipe() {
  const record = getCurrentRecord();
  validateRecord(record);
  const url =
    state.mode === "create"
      ? "/dev/panel/records/terrain_recipes"
      : `/dev/panel/records/terrain_recipes/${encodeURIComponent(state.recordId || "")}`;
  const response = await fetch(url, {
    method: state.mode === "create" ? "POST" : "PATCH",
    headers: panelHeaders(),
    body: JSON.stringify({ record }),
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error || "Could not save terrain recipe");
  setStatus(state.mode === "create" ? "Terrain recipe created." : "Terrain recipe updated.");
  await loadContext();
}

async function autofillRecipe() {
  const currentRecord = getCurrentRecord();
  const anchorName = String(currentRecord.title || "").trim();
  if (!anchorName) {
    setAIStatus("Enter a title first so AI can infer the terrain recipe.", true);
    return;
  }

  const buttonEl = document.getElementById("terrain-autofill") as HTMLButtonElement | null;
  if (buttonEl) buttonEl.disabled = true;
  setAIStatus("AI is filling the terrain recipe...");

  try {
    const metadata = safeObject(currentRecord.metadata_json);
    const response = await requestDevAIDraft(
      "terrain_recipes",
      buildNameDrivenAutofillPrompt({
        entityLabel: "terrain recipe",
        anchorName,
        summary: String(currentRecord.summary || ""),
        notes: String(currentRecord.body_text || ""),
        extraLines: [
          `Biome hint: ${String(metadata.biome || "")}`,
          `Terrain type hint: ${String(metadata.terrainType || "")}`,
          `Applies to hint: ${String(metadata.appliesTo || "")}`,
          `Render layer hint: ${String(metadata.renderLayer || "")}`,
          `Intended use hint: ${String(metadata.intendedUse || "")}`,
          "Keep existing linked assets, slices, audio references, and palette colors unless the AI has a clearly better filled value.",
        ],
      }),
      currentRecord,
    );

    const mergedRecord = mergeAutofillRecord(currentRecord, response.record);
    fillForm(mergedRecord, state.mode);
    setAIStatus(
      response.warning || "Terrain recipe fields filled from the current title.",
      !!response.fallback,
    );
    setStatus("Terrain recipe updated with AI suggestions.");
  } catch (error: any) {
    setAIStatus(error.message || "Could not autofill the terrain recipe", true);
  } finally {
    if (buttonEl) buttonEl.disabled = false;
  }
}

function bindControls() {
  document.getElementById("terrain-autofill")?.addEventListener("click", async () => {
    await autofillRecipe();
  });
  document.getElementById("terrain-save")?.addEventListener("click", async () => {
    try {
      await saveRecipe();
    } catch (error: any) {
      setStatus(error.message || "Could not save terrain recipe", true);
    }
  });
  document.getElementById("terrain-reset")?.addEventListener("click", () => fillForm(undefined, "create"));
  document.getElementById("terrain-delete")?.addEventListener("click", async () => {
    if (state.mode !== "edit" || !state.recordId) return;
    const response = await fetch(`/dev/panel/records/terrain_recipes/${encodeURIComponent(state.recordId)}`, {
      method: "DELETE",
      headers: panelHeaders(),
    });
    const payload = await response.json();
    if (!payload.success) {
      setStatus(payload.error || "Could not delete terrain recipe", true);
      return;
    }
    await loadContext();
  });
  document.getElementById("terrain-title")?.addEventListener("input", () => {
    const titleEl = document.getElementById("terrain-title") as HTMLInputElement | null;
    const slugEl = document.getElementById("terrain-slug") as HTMLInputElement | null;
    if (titleEl && slugEl && !slugEl.dataset.manual) {
      slugEl.value = slugify(titleEl.value);
    }
  });
  document.getElementById("terrain-slug")?.addEventListener("input", () => {
    const slugEl = document.getElementById("terrain-slug") as HTMLInputElement | null;
    if (slugEl) slugEl.dataset.manual = "true";
  });
}

async function bootstrap() {
  bindControls();
  await loadContext();
}

void bootstrap();

export {};
