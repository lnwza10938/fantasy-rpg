interface ParsedWorldDefinitionRecord {
  id: string;
  name: string;
  preset: string;
  mode: string;
  record: Record<string, unknown>;
  metadata: Record<string, unknown>;
  definition: Record<string, unknown>;
  regions: Record<string, unknown>[];
  mapLayout: Record<string, unknown>;
}

interface TopologyNodeDraft {
  regionId: string;
  x: number;
  y: number;
  tier: number;
  icon: string;
  landmark: string;
  accentColor: string;
  isStart: boolean;
  isGoal: boolean;
}

interface TopologyPathDraft {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  kind: "road" | "hazard" | "secret";
  difficulty: number;
  visibility: "visible" | "hidden" | "fogged";
  requirements: string[];
  gated?: boolean;
  oneWay?: boolean;
  travelEffects?: string[];
}

interface TopologyLayoutDraft {
  width: number;
  height: number;
  startRegionId: string;
  goalRegionId: string;
  nodes: TopologyNodeDraft[];
  paths: TopologyPathDraft[];
}

interface ValidationResult {
  severity: "ok" | "warn" | "error";
  message: string;
}

const DEV_PANEL_KEY = "rpg_dev_panel_key";
const API = "/dev";
const LOCAL_DRAFT_PREFIX = "rpg_map_editor_draft";

const state = {
  requiresKey: false,
  worlds: [] as ParsedWorldDefinitionRecord[],
  overrides: [] as Record<string, unknown>[],
  search: "",
  selectedWorldId: "",
  selectedOverrideId: "new",
  originalDefinition: null as Record<string, unknown> | null,
  currentDefinition: null as Record<string, unknown> | null,
  originalLayout: null as TopologyLayoutDraft | null,
  currentLayout: null as TopologyLayoutDraft | null,
  toolMode: "select" as "select" | "move" | "add-node" | "add-path" | "delete" | "pan",
  selectedNodeId: null as string | null,
  selectedPathId: null as string | null,
  pendingPathFrom: null as string | null,
  dragNodeId: null as string | null,
  validation: [] as ValidationResult[],
  layers: {
    nodes: true,
    paths: true,
    labels: true,
    regions: true,
    locked: true,
    terrain: true,
  },
  viewport: {
    scale: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
  },
};

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toFiniteNumber(value: unknown, fallback: number) {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function getDevKey() {
  return localStorage.getItem(DEV_PANEL_KEY) || "";
}

function getLocalDraftKey(worldId: string) {
  return `${LOCAL_DRAFT_PREFIX}:${worldId}`;
}

function panelHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const devKey = getDevKey();
  if (devKey) headers["x-dev-key"] = devKey;
  return headers;
}

function setStatus(text: string, isError = false) {
  const el = document.getElementById("map-editor-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function parseWorldDefinitionRecord(
  record: Record<string, unknown>,
): ParsedWorldDefinitionRecord | null {
  const id = String(record.id || "").trim();
  if (!id) return null;

  const definition = safeObject(record.definition_json);
  const metadata = safeObject(record.metadata_json);
  const definitionMetadata = safeObject(definition.metadata);
  const regions = safeArray<Record<string, unknown>>(definition.regions).map((entry) =>
    safeObject(entry),
  );
  const mapLayout = safeObject(definition.mapLayout);

  return {
    id,
    name:
      String(
        record.world_name ||
          metadata.worldName ||
          definitionMetadata.worldName ||
          "Unnamed World",
      ).trim() || "Unnamed World",
    preset:
      String(
        record.world_preset ||
          metadata.worldPreset ||
          definitionMetadata.worldPreset ||
          "custom",
      ).trim() || "custom",
    mode: String(record.generation_mode || "procedural").trim() || "procedural",
    record,
    metadata,
    definition,
    regions,
    mapLayout,
  };
}

function getSelectedWorld() {
  return state.worlds.find((world) => world.id === state.selectedWorldId) || null;
}

function getSelectedOverrideRecord() {
  if (!state.selectedOverrideId || state.selectedOverrideId === "new") return null;
  return (
    state.overrides.find((record) => String(record.id || "") === state.selectedOverrideId) ||
    null
  );
}

function getWorldRegion(
  definition: Record<string, unknown> | null,
  regionId: string,
) {
  if (!definition) return null;
  return (
    safeArray<Record<string, unknown>>(definition.regions).find(
      (region) => String(region.id || "") === regionId,
    ) || null
  );
}

function getRegionOptions() {
  return safeArray<Record<string, unknown>>(state.currentDefinition?.regions).map((region) =>
    String(region.id || "").trim(),
  );
}

function normalizeRequirements(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

function normalizePathEffects(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [] as string[];
}

function deriveTopologyLayoutDraft(
  definition: Record<string, unknown> | null,
): TopologyLayoutDraft | null {
  if (!definition) return null;

  const layout = safeObject(definition.mapLayout);
  const regions = safeArray<Record<string, unknown>>(definition.regions);
  const rawNodes = safeArray<Record<string, unknown>>(layout.nodes);
  const rawPaths = safeArray<Record<string, unknown>>(layout.paths);
  const nodes: TopologyNodeDraft[] = rawNodes
    .map((entry, index) => {
      const region = regions[index] || {};
      const regionId = String(entry.regionId || region.id || "").trim();
      if (!regionId) return null;
      return {
        regionId,
        x: Math.round(toFiniteNumber(entry.x, 120 + index * 120)),
        y: Math.round(toFiniteNumber(entry.y, 120 + (index % 4) * 96)),
        tier: Math.max(0, Math.round(toFiniteNumber(entry.tier, Number(region.tier || 0)))),
        icon: String(entry.icon || region.icon || "🗺️"),
        landmark: String(entry.landmark || region.landmark || ""),
        accentColor: String(entry.accentColor || region.accentColor || "#d4a65a"),
        isStart: entry.isStart === true || region.isStart === true,
        isGoal: entry.isGoal === true || region.isGoal === true,
      } as TopologyNodeDraft;
    })
    .filter((entry): entry is TopologyNodeDraft => !!entry);

  const existingNodeIds = new Set(nodes.map((node) => node.regionId));
  regions.forEach((region, index) => {
    const regionId = String(region.id || "").trim();
    if (!regionId || existingNodeIds.has(regionId)) return;
    nodes.push({
      regionId,
      x: 160 + ((nodes.length + index) % 5) * 120,
      y: 160 + ((nodes.length + index) % 4) * 108,
      tier: Math.max(0, Math.round(toFiniteNumber(region.tier, 0))),
      icon: String(region.icon || "🗺️"),
      landmark: String(region.landmark || ""),
      accentColor: String(region.accentColor || "#d4a65a"),
      isStart: region.isStart === true,
      isGoal: region.isGoal === true,
    });
  });

  const paths: TopologyPathDraft[] = rawPaths
    .map((entry, index) => {
      const fromRegionId = String(entry.fromRegionId || "").trim();
      const toRegionId = String(entry.toRegionId || "").trim();
      if (!fromRegionId || !toRegionId) return null;
      return {
        id: String(entry.id || `${fromRegionId}::${toRegionId}::${index}`),
        fromRegionId,
        toRegionId,
        kind:
          entry.kind === "hazard" || entry.kind === "secret" ? entry.kind : "road",
        difficulty: Math.max(1, Math.round(toFiniteNumber(entry.difficulty, 1))),
        visibility:
          entry.visibility === "hidden" || entry.visibility === "fogged"
            ? entry.visibility
            : "visible",
        requirements: normalizeRequirements(entry.requirements),
        gated: entry.gated === true,
        oneWay: entry.oneWay === true,
        travelEffects: normalizePathEffects(entry.travelEffects),
      } as TopologyPathDraft;
    })
    .filter((entry): entry is TopologyPathDraft => !!entry);

  const startRegionId =
    String(layout.startRegionId || nodes.find((node) => node.isStart)?.regionId || nodes[0]?.regionId || "").trim();
  const goalRegionId =
    String(layout.goalRegionId || nodes.find((node) => node.isGoal)?.regionId || nodes[nodes.length - 1]?.regionId || "").trim();

  nodes.forEach((node) => {
    node.isStart = node.regionId === startRegionId;
    node.isGoal = node.regionId === goalRegionId;
  });

  return {
    width: Math.max(640, Math.round(toFiniteNumber(layout.width, 1040))),
    height: Math.max(420, Math.round(toFiniteNumber(layout.height, 620))),
    startRegionId,
    goalRegionId,
    nodes,
    paths,
  };
}

function resetViewport() {
  state.viewport.scale = 1;
  state.viewport.panX = 0;
  state.viewport.panY = 0;
  state.viewport.dragging = false;
}

function diffObject(
  current: Record<string, unknown>,
  original: Record<string, unknown>,
) {
  const changed: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(original)]);
  keys.forEach((key) => {
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      changed[key] = current[key];
    }
  });
  return changed;
}

function getChangedRegionRecords() {
  const originalRegions = new Map(
    safeArray<Record<string, unknown>>(state.originalDefinition?.regions).map((region) => [
      String(region.id || ""),
      region,
    ]),
  );
  return safeArray<Record<string, unknown>>(state.currentDefinition?.regions)
    .map((region) => {
      const id = String(region.id || "");
      const original = originalRegions.get(id) || {};
      const changes = diffObject(region, original);
      return {
        regionId: id,
        changes,
      };
    })
    .filter((entry) => Object.keys(entry.changes).length > 0);
}

function getMetadataChanges() {
  return diffObject(
    safeObject(state.currentDefinition?.metadata),
    safeObject(state.originalDefinition?.metadata),
  );
}

function applySingleOverrideToDefinition(
  definition: Record<string, unknown>,
  overrideRecord: Record<string, unknown>,
) {
  const next = cloneRecord(definition);
  const payload = safeObject(overrideRecord.payload_json);
  const overrideType = String(overrideRecord.override_type || "");
  const scopeRef = String(overrideRecord.scope_ref || "");

  if (overrideType === "replace_definition") {
    return {
      ...next,
      ...payload,
    };
  }

  if (overrideType === "patch_metadata") {
    return {
      ...next,
      metadata: {
        ...safeObject(next.metadata),
        ...payload,
      },
    };
  }

  if (overrideType === "set_map_layout") {
    return {
      ...next,
      mapLayout: {
        ...safeObject(next.mapLayout),
        ...payload,
      },
    };
  }

  if (overrideType === "patch_region" && scopeRef) {
    return {
      ...next,
      regions: safeArray<Record<string, unknown>>(next.regions).map((region) =>
        String(region.id || "") === scopeRef
          ? {
              ...region,
              ...payload,
            }
          : region,
      ),
    };
  }

  return next;
}

function buildOverrideDraft() {
  const world = getSelectedWorld();
  if (!world || !state.currentDefinition || !state.currentLayout || !state.originalDefinition) {
    return null;
  }

  const definitionWithLayout = cloneRecord(state.currentDefinition);
  definitionWithLayout.mapLayout = cloneRecord(state.currentLayout);

  const layoutChanged =
    JSON.stringify(state.currentLayout) !== JSON.stringify(state.originalLayout);
  const changedRegions = getChangedRegionRecords();
  const metadataChanges = getMetadataChanges();

  if (!layoutChanged && changedRegions.length === 1 && !Object.keys(metadataChanges).length) {
    return {
      world_definition_id: state.selectedWorldId,
      override_type: "patch_region",
      scope_type: "region",
      scope_ref: changedRegions[0].regionId,
      payload_json: changedRegions[0].changes,
    };
  }

  if (layoutChanged && changedRegions.length === 0 && !Object.keys(metadataChanges).length) {
    return {
      world_definition_id: state.selectedWorldId,
      override_type: "set_map_layout",
      scope_type: "world",
      scope_ref: "",
      payload_json: cloneRecord(state.currentLayout),
    };
  }

  if (!layoutChanged && changedRegions.length === 0 && Object.keys(metadataChanges).length) {
    return {
      world_definition_id: state.selectedWorldId,
      override_type: "patch_metadata",
      scope_type: "world",
      scope_ref: "",
      payload_json: metadataChanges,
    };
  }

  return {
    world_definition_id: state.selectedWorldId,
    override_type: "replace_definition",
    scope_type: "world",
    scope_ref: "",
    payload_json: definitionWithLayout,
  };
}

function filteredWorlds() {
  const query = state.search.trim().toLowerCase();
  if (!query) return state.worlds;
  return state.worlds.filter((world) =>
    `${world.name} ${world.preset} ${world.mode}`.toLowerCase().includes(query),
  );
}

function countWorldOverrides(worldId: string) {
  return state.overrides.filter(
    (record) => String(record.world_definition_id || "") === worldId,
  ).length;
}

function overridesForSelectedWorld() {
  return state.overrides.filter(
    (record) => String(record.world_definition_id || "") === state.selectedWorldId,
  );
}

function renderWorldList() {
  const listEl = document.getElementById("map-editor-world-list");
  if (!listEl) return;
  const worlds = filteredWorlds();
  if (!worlds.length) {
    listEl.innerHTML =
      '<div class="dev-map-list-empty">No worlds match the current search.</div>';
    return;
  }
  listEl.innerHTML = worlds
    .map((world) => {
      const active = world.id === state.selectedWorldId;
      return `
        <button type="button" class="dev-map-world-item ${active ? "active" : ""}" data-world-id="${escapeHtml(world.id)}">
          <strong>${escapeHtml(world.name)}</strong>
          <span>${escapeHtml(world.mode)} • ${escapeHtml(world.preset)}</span>
          <span>${escapeHtml(String(world.regions.length))} regions • ${escapeHtml(String(countWorldOverrides(world.id)))} overrides</span>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll<HTMLElement>("[data-world-id]").forEach((button) => {
    button.addEventListener("click", () => selectWorld(button.dataset.worldId || ""));
  });
}

function renderTopbar() {
  const worldSelect = document.getElementById(
    "map-editor-world-select",
  ) as HTMLSelectElement | null;
  if (worldSelect) {
    worldSelect.innerHTML = state.worlds
      .map(
        (world) =>
          `<option value="${escapeHtml(world.id)}" ${world.id === state.selectedWorldId ? "selected" : ""}>${escapeHtml(world.name)}</option>`,
      )
      .join("");
  }

  const overrideSelect = document.getElementById(
    "map-editor-override-select",
  ) as HTMLSelectElement | null;
  if (overrideSelect) {
    const localDraftExists =
      !!state.selectedWorldId && !!localStorage.getItem(getLocalDraftKey(state.selectedWorldId));
    overrideSelect.innerHTML = [
      `<option value="new"${state.selectedOverrideId === "new" ? " selected" : ""}>New Draft</option>`,
      localDraftExists
        ? `<option value="local-draft"${state.selectedOverrideId === "local-draft" ? " selected" : ""}>Local Draft</option>`
        : "",
      ...overridesForSelectedWorld().map((record, index) => {
        const id = String(record.id || "");
        const type = String(record.override_type || "override");
        const scopeRef = String(record.scope_ref || "").trim();
        const label = `${index + 1}. ${type}${scopeRef ? ` • ${scopeRef}` : ""}`;
        return `<option value="${escapeHtml(id)}"${state.selectedOverrideId === id ? " selected" : ""}>${escapeHtml(label)}</option>`;
      }),
    ].join("");
  }

  const world = getSelectedWorld();
  const nameEl = document.getElementById("map-editor-world-name");
  const metaEl = document.getElementById("map-editor-world-meta");
  if (nameEl) nameEl.textContent = world?.name || "No world selected";
  if (metaEl) {
    const overrideRecord = getSelectedOverrideRecord();
    const localDraftExists =
      !!state.selectedWorldId && !!localStorage.getItem(getLocalDraftKey(state.selectedWorldId));
    const overrideLabel =
      state.selectedOverrideId === "local-draft"
        ? "Local draft"
        : overrideRecord
          ? `Override ${String(overrideRecord.override_type || "draft")}`
          : localDraftExists
            ? "New draft (local draft available)"
            : "New draft";
    metaEl.textContent = world
      ? `${world.mode} • ${world.preset} • ${world.regions.length} regions • ${countWorldOverrides(world.id)} overrides • ${overrideLabel}`
      : "Choose a canonical world to begin.";
  }
}

function buildValidation(layout: TopologyLayoutDraft | null): ValidationResult[] {
  if (!layout) return [];
  const results: ValidationResult[] = [];
  const regionIds = new Set(getRegionOptions());
  const nodeIds = layout.nodes.map((node) => node.regionId);
  const nodeIdSet = new Set(nodeIds);

  if (layout.startRegionId && nodeIdSet.has(layout.startRegionId)) {
    results.push({ severity: "ok", message: "Start node exists." });
  } else {
    results.push({ severity: "error", message: "Start node is missing." });
  }

  if (layout.goalRegionId && nodeIdSet.has(layout.goalRegionId)) {
    results.push({ severity: "ok", message: "Goal node exists." });
  } else {
    results.push({ severity: "error", message: "Goal node is missing." });
  }

  const duplicateIds = nodeIds.filter((nodeId, index) => nodeIds.indexOf(nodeId) !== index);
  if (duplicateIds.length) {
    results.push({
      severity: "error",
      message: `Duplicate region IDs detected: ${Array.from(new Set(duplicateIds)).join(", ")}.`,
    });
  } else {
    results.push({ severity: "ok", message: "All nodes have unique region IDs." });
  }

  const unknownRegions = layout.nodes
    .map((node) => node.regionId)
    .filter((regionId) => !regionIds.has(regionId));
  if (unknownRegions.length) {
    results.push({
      severity: "error",
      message: `Unknown region references: ${Array.from(new Set(unknownRegions)).join(", ")}.`,
    });
  } else {
    results.push({ severity: "ok", message: "All node region IDs resolve." });
  }

  layout.paths.forEach((path) => {
    if (!nodeIdSet.has(path.fromRegionId) || !nodeIdSet.has(path.toRegionId)) {
      results.push({
        severity: "error",
        message: `Path ${path.id} references a missing endpoint.`,
      });
    }
    if (path.gated && path.requirements.length === 0) {
      results.push({
        severity: "warn",
        message: `Path ${path.id} is gated but has no requirements.`,
      });
    }
    if (path.kind === "secret" && path.visibility === "visible") {
      results.push({
        severity: "warn",
        message: `Secret path ${path.id} is visible immediately.`,
      });
    }
  });

  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 72) {
        results.push({
          severity: "warn",
          message: `Nodes ${a.regionId} and ${b.regionId} overlap too closely.`,
        });
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  layout.nodes.forEach((node) => adjacency.set(node.regionId, []));
  layout.paths.forEach((path) => {
    adjacency.get(path.fromRegionId)?.push(path.toRegionId);
    adjacency.get(path.toRegionId)?.push(path.fromRegionId);
  });

  const visited = new Set<string>();
  const startNode = layout.startRegionId || layout.nodes[0]?.regionId;
  if (startNode && adjacency.has(startNode)) {
    const queue = [startNode];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      (adjacency.get(current) || []).forEach((entry) => {
        if (!visited.has(entry)) queue.push(entry);
      });
    }
  }

  const disconnected = layout.nodes
    .map((node) => node.regionId)
    .filter((nodeId) => !visited.has(nodeId));
  if (disconnected.length) {
    results.push({
      severity: "warn",
      message: `Disconnected nodes: ${disconnected.join(", ")}.`,
    });
  } else {
    results.push({ severity: "ok", message: "The topology graph is connected." });
  }

  const draft = buildOverrideDraft();
  if (!draft || typeof draft.payload_json !== "object" || !draft.payload_json) {
    results.push({
      severity: "error",
      message: "Override payload is not in a valid object shape.",
    });
  } else {
    results.push({ severity: "ok", message: "Override payload shape is valid." });
  }

  return results;
}

function renderValidation() {
  const listEl = document.getElementById("map-editor-validation");
  if (!listEl) return;
  state.validation = buildValidation(state.currentLayout);
  listEl.innerHTML = state.validation
    .map(
      (entry) =>
        `<div class="dev-map-validation-item is-${entry.severity}"><span>${entry.severity === "ok" ? "✓" : entry.severity === "warn" ? "!" : "✕"}</span><strong>${escapeHtml(entry.message)}</strong></div>`,
    )
    .join("");
}

function draftSummaryRows() {
  const rows: string[] = [];
  const draft = buildOverrideDraft();
  if (!draft) return ["No draft loaded yet."];

  rows.push(`Type: ${String(draft.override_type || "override")}`);
  if (draft.scope_ref) rows.push(`Target: ${String(draft.scope_ref)}`);

  const changedRegions = getChangedRegionRecords();
  const metadataChanges = getMetadataChanges();
  const layoutChanged =
    JSON.stringify(state.currentLayout) !== JSON.stringify(state.originalLayout);

  if (layoutChanged) rows.push("Topology layout changed");
  if (changedRegions.length) rows.push(`${changedRegions.length} region record(s) changed`);
  if (Object.keys(metadataChanges).length) {
    rows.push(`${Object.keys(metadataChanges).length} metadata field(s) changed`);
  }
  if (rows.length === 1) rows.push("No layout changes yet.");
  return rows;
}

function renderDraftPanel() {
  const draftMetaEl = document.getElementById("map-editor-draft-meta");
  const summaryEl = document.getElementById("map-editor-draft-summary");
  const jsonEl = document.getElementById(
    "map-editor-draft-json",
  ) as HTMLTextAreaElement | null;
  const draft = buildOverrideDraft();
  if (draftMetaEl) {
    draftMetaEl.textContent = draft
      ? `Type: ${String(draft.override_type)} • Scope: ${String(draft.scope_type || "world")} • World: ${state.selectedWorldId}`
      : "No world selected.";
  }
  if (summaryEl) {
    summaryEl.innerHTML = draftSummaryRows()
      .map((row) => `<div class="dev-map-draft-row">${escapeHtml(row)}</div>`)
      .join("");
  }
  if (jsonEl) {
    jsonEl.value = draft ? JSON.stringify(draft, null, 2) : "";
  }
}

function renderInspector() {
  const layout = state.currentLayout;
  const definition = state.currentDefinition;
  const selectionTitleEl = document.getElementById("map-editor-selection-title");
  const selectionCopyEl = document.getElementById("map-editor-selection-copy");
  const nodeCardEl = document.getElementById("map-editor-node-card");
  const pathCardEl = document.getElementById("map-editor-path-card");

  const selectedNode = layout?.nodes.find((node) => node.regionId === state.selectedNodeId) || null;
  const selectedPath = layout?.paths.find((path) => path.id === state.selectedPathId) || null;
  const selectedRegion = selectedNode
    ? getWorldRegion(definition, selectedNode.regionId)
    : null;

  if (selectionTitleEl) {
    selectionTitleEl.textContent = selectedNode
      ? String(selectedRegion?.name || selectedNode.regionId)
      : selectedPath
        ? selectedPath.id
        : "World Layout";
  }
  if (selectionCopyEl) {
    if (selectedNode) {
      selectionCopyEl.textContent = `${String(selectedRegion?.biome || "unknown biome")} • danger ${String(selectedRegion?.dangerLevel || 0)} • tier ${String(selectedNode.tier)}`;
    } else if (selectedPath) {
      selectionCopyEl.textContent = `${selectedPath.kind} path • difficulty ${selectedPath.difficulty} • ${selectedPath.visibility}`;
    } else {
      selectionCopyEl.textContent =
        "Select a node or path to edit it. All visual edits update an override draft, not the canonical world directly.";
    }
  }

  nodeCardEl?.classList.toggle("is-disabled", !selectedNode);
  pathCardEl?.classList.toggle("is-disabled", !selectedPath);

  const bindSelect = (id: string, options: string[], selected = "") => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    el.innerHTML = options
      .map(
        (option) =>
          `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`,
      )
      .join("");
  };

  const layoutNodeIds = layout?.nodes.map((node) => node.regionId) || [];
  const allRegionIds = getRegionOptions();
  bindSelect("map-editor-start-region", layoutNodeIds, layout?.startRegionId || "");
  bindSelect("map-editor-goal-region", layoutNodeIds, layout?.goalRegionId || "");
  bindSelect("map-editor-node-region", allRegionIds, selectedNode?.regionId || "");
  bindSelect("map-editor-path-from", layoutNodeIds, selectedPath?.fromRegionId || "");
  bindSelect("map-editor-path-to", layoutNodeIds, selectedPath?.toRegionId || "");

  const setInput = (id: string, value: unknown, disabled = false) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) return;
    if ("checked" in el && typeof value === "boolean") {
      el.checked = value;
    } else {
      el.value = String(value ?? "");
    }
    el.disabled = disabled;
  };

  setInput("map-editor-width", layout?.width || 0, !layout);
  setInput("map-editor-height", layout?.height || 0, !layout);
  setInput("map-editor-node-name", selectedRegion?.name || "", !selectedNode);
  setInput("map-editor-node-biome", selectedRegion?.biome || "", !selectedNode);
  setInput("map-editor-node-danger", selectedRegion?.dangerLevel || 0, !selectedNode);
  setInput("map-editor-node-x", selectedNode?.x || 0, !selectedNode);
  setInput("map-editor-node-y", selectedNode?.y || 0, !selectedNode);
  setInput("map-editor-node-tier", selectedNode?.tier || 0, !selectedNode);
  setInput("map-editor-node-icon", selectedNode?.icon || selectedRegion?.icon || "", !selectedNode);
  setInput("map-editor-node-landmark", selectedNode?.landmark || selectedRegion?.landmark || "", !selectedNode);
  setInput("map-editor-node-accent", selectedNode?.accentColor || selectedRegion?.accentColor || "", !selectedNode);
  setInput("map-editor-node-start", selectedNode?.isStart || false, !selectedNode);
  setInput("map-editor-node-goal", selectedNode?.isGoal || false, !selectedNode);
  setInput(
    "map-editor-node-enemies",
    safeArray(selectedRegion?.enemyPool || selectedRegion?.enemyTypes).join(", "),
    !selectedNode,
  );

  setInput("map-editor-path-difficulty", selectedPath?.difficulty || 1, !selectedPath);
  setInput("map-editor-path-requirements", selectedPath?.requirements.join(", ") || "", !selectedPath);
  setInput("map-editor-path-gated", selectedPath?.gated === true, !selectedPath);
  setInput("map-editor-path-one-way", selectedPath?.oneWay === true, !selectedPath);
  setInput("map-editor-path-effects", selectedPath?.travelEffects?.join(", ") || "", !selectedPath);

  const pathKindEl = document.getElementById("map-editor-path-kind") as HTMLSelectElement | null;
  if (pathKindEl) {
    pathKindEl.value = selectedPath?.kind || "road";
    pathKindEl.disabled = !selectedPath;
  }
  const pathVisibilityEl = document.getElementById(
    "map-editor-path-visibility",
  ) as HTMLSelectElement | null;
  if (pathVisibilityEl) {
    pathVisibilityEl.value = selectedPath?.visibility || "visible";
    pathVisibilityEl.disabled = !selectedPath;
  }
}

function renderTerrainOverlay(definition: Record<string, unknown> | null) {
  if (!state.layers.terrain || !definition) return "";
  const geography = safeObject(definition.geography);
  const zones = safeArray<Record<string, unknown>>(geography.zones)
    .map((zone) => {
      const color = String(zone.color || "rgba(95, 168, 211, 0.74)");
      return `
        <ellipse
          cx="${toFiniteNumber(zone.x, 0)}"
          cy="${toFiniteNumber(zone.y, 0)}"
          rx="${Math.max(20, Math.round(toFiniteNumber(zone.width, 180) / 2))}"
          ry="${Math.max(20, Math.round(toFiniteNumber(zone.height, 120) / 2))}"
          transform="rotate(${toFiniteNumber(zone.rotation, 0)} ${toFiniteNumber(zone.x, 0)} ${toFiniteNumber(zone.y, 0)})"
          fill="${escapeHtml(color)}"
          fill-opacity="${Math.max(0.05, Math.min(1, toFiniteNumber(zone.opacity, 0.24)))}"
          class="dev-map-terrain-zone"
        />
      `;
    })
    .join("");
  const flows = safeArray<Record<string, unknown>>(geography.flows)
    .map((flow) => {
      const points = safeArray<Record<string, unknown>>(flow.points);
      if (points.length < 2) return "";
      const first = points[0];
      const rest = points.slice(1);
      const curve = rest
        .map((point, index) => {
          const previous = points[index];
          const controlX = Math.round((toFiniteNumber(previous.x, 0) + toFiniteNumber(point.x, 0)) / 2);
          const controlY = Math.round((toFiniteNumber(previous.y, 0) + toFiniteNumber(point.y, 0)) / 2);
          return `Q ${controlX} ${controlY} ${toFiniteNumber(point.x, 0)} ${toFiniteNumber(point.y, 0)}`;
        })
        .join(" ");
      return `
        <path
          d="M ${toFiniteNumber(first.x, 0)} ${toFiniteNumber(first.y, 0)} ${curve}"
          class="dev-map-terrain-flow"
          stroke="${escapeHtml(String(flow.color || "rgba(184, 239, 255, 0.8)"))}"
          stroke-width="${Math.max(2, toFiniteNumber(flow.width, 10))}"
          stroke-opacity="${Math.max(0.05, Math.min(1, toFiniteNumber(flow.opacity, 0.32)))}"
        />
      `;
    })
    .join("");

  if (!zones && !flows) return "";

  return `
    <svg class="dev-map-terrain-layer" viewBox="0 0 ${state.currentLayout?.width || 1040} ${state.currentLayout?.height || 620}" preserveAspectRatio="none">
      ${zones}
      ${flows}
    </svg>
  `;
}

function applyCanvasView(boardEl: HTMLElement) {
  boardEl.style.setProperty("--dev-map-pan-x", `${state.viewport.panX}px`);
  boardEl.style.setProperty("--dev-map-pan-y", `${state.viewport.panY}px`);
  boardEl.style.setProperty("--dev-map-scale", String(state.viewport.scale));
}

function screenPointToLayoutPoint(
  event: PointerEvent | MouseEvent,
  boardEl: HTMLElement,
) {
  if (!state.currentLayout) return { x: 0, y: 0 };
  const rect = boardEl.getBoundingClientRect();
  const normX =
    (event.clientX - rect.left - state.viewport.panX) /
    (rect.width * state.viewport.scale);
  const normY =
    (event.clientY - rect.top - state.viewport.panY) /
    (rect.height * state.viewport.scale);
  return {
    x: Math.round(normX * state.currentLayout.width),
    y: Math.round(normY * state.currentLayout.height),
  };
}

function renderCanvas() {
  const boardEl = document.getElementById("map-editor-canvas");
  if (!boardEl) return;
  const world = getSelectedWorld();
  const layout = state.currentLayout;
  if (!world || !layout) {
    boardEl.innerHTML =
      '<div class="dev-topology-empty">Select a canonical world to begin editing.</div>';
    return;
  }

  const regionMap = new Map(
    safeArray<Record<string, unknown>>(state.currentDefinition?.regions).map((region) => [
      String(region.id || ""),
      region,
    ]),
  );
  const terrainOverlay = renderTerrainOverlay(state.currentDefinition);
  const pathMarkup = state.layers.paths
    ? layout.paths
        .map((path) => {
          const fromNode = layout.nodes.find((node) => node.regionId === path.fromRegionId);
          const toNode = layout.nodes.find((node) => node.regionId === path.toRegionId);
          if (!fromNode || !toNode) return "";
          return `
            <g class="dev-topology-path-group">
              <line
                class="dev-topology-path-line kind-${escapeHtml(path.kind)} visibility-${escapeHtml(path.visibility)} ${path.id === state.selectedPathId ? "selected" : ""} ${path.gated ? "gated" : ""} ${path.oneWay ? "one-way" : ""}"
                x1="${((fromNode.x / layout.width) * 100).toFixed(2)}%"
                y1="${((fromNode.y / layout.height) * 100).toFixed(2)}%"
                x2="${((toNode.x / layout.width) * 100).toFixed(2)}%"
                y2="${((toNode.y / layout.height) * 100).toFixed(2)}%"
              />
              <line
                class="dev-topology-path-hit"
                data-path-id="${escapeHtml(path.id)}"
                x1="${((fromNode.x / layout.width) * 100).toFixed(2)}%"
                y1="${((fromNode.y / layout.height) * 100).toFixed(2)}%"
                x2="${((toNode.x / layout.width) * 100).toFixed(2)}%"
                y2="${((toNode.y / layout.height) * 100).toFixed(2)}%"
              />
            </g>
          `;
        })
        .join("")
    : "";

  const nodeMarkup = state.layers.nodes
    ? layout.nodes
        .map((node) => {
          const region = regionMap.get(node.regionId) || {};
          const pending = state.pendingPathFrom === node.regionId;
          const label = String(region.name || node.landmark || node.regionId);
          const meta = state.layers.regions
            ? `${String(region.biome || "unknown")} • danger ${String(region.dangerLevel || 0)}`
            : `tier ${String(node.tier)}`;
          const nodeClasses = [
            node.regionId === state.selectedNodeId ? "selected" : "",
            pending ? "pending" : "",
            node.isStart ? "is-start" : "",
            node.isGoal ? "is-goal" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
            <button
              type="button"
              class="dev-topology-node ${nodeClasses}"
              data-node-id="${escapeHtml(node.regionId)}"
              style="left: calc(${((node.x / layout.width) * 100).toFixed(4)}% - 28px); top: calc(${((node.y / layout.height) * 100).toFixed(4)}% - 28px); --node-accent: ${escapeHtml(node.accentColor)};"
            >
              <span class="dev-topology-node-icon">${escapeHtml(node.icon || "🗺️")}</span>
              ${state.layers.labels ? `<span class="dev-topology-node-name">${escapeHtml(label)}</span>` : ""}
              <span class="dev-topology-node-meta">${escapeHtml(meta)}</span>
            </button>
          `;
        })
        .join("")
    : "";

  boardEl.innerHTML = `
    <div class="dev-topology-board-sky"></div>
    <div class="dev-topology-board-land"></div>
    <div class="dev-topology-board-water"></div>
    <div class="dev-topology-board-label">${escapeHtml(world.name)}</div>
    <div class="dev-map-canvas-stage">
      ${terrainOverlay}
      <svg class="dev-topology-path-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
        ${pathMarkup}
      </svg>
      ${nodeMarkup}
    </div>
  `;
  applyCanvasView(boardEl);

  boardEl.querySelectorAll<HTMLElement>("[data-path-id]").forEach((pathEl) => {
    pathEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const pathId = pathEl.dataset.pathId || "";
      if (!state.currentLayout) return;
      if (state.toolMode === "delete") {
        state.currentLayout.paths = state.currentLayout.paths.filter((path) => path.id !== pathId);
        state.selectedPathId = null;
      } else {
        state.selectedPathId = pathId;
        state.selectedNodeId = null;
        state.toolMode = "select";
      }
      renderAll();
    });
  });

  boardEl.querySelectorAll<HTMLElement>("[data-node-id]").forEach((nodeEl) => {
    nodeEl.addEventListener("pointerdown", (event) => {
      const nodeId = nodeEl.dataset.nodeId || "";
      if (!state.currentLayout) return;
      if (state.toolMode === "delete") {
        state.currentLayout.nodes = state.currentLayout.nodes.filter((node) => node.regionId !== nodeId);
        state.currentLayout.paths = state.currentLayout.paths.filter(
          (path) => path.fromRegionId !== nodeId && path.toRegionId !== nodeId,
        );
        state.selectedNodeId = null;
        renderAll();
        return;
      }
      if (state.toolMode === "add-path") {
        if (!state.pendingPathFrom) {
          state.pendingPathFrom = nodeId;
          state.selectedNodeId = nodeId;
          state.selectedPathId = null;
          renderAll();
          return;
        }
        if (state.pendingPathFrom !== nodeId) {
          state.currentLayout.paths.push({
            id: `${state.pendingPathFrom}::${nodeId}::${Date.now()}`,
            fromRegionId: state.pendingPathFrom,
            toRegionId: nodeId,
            kind: "road",
            difficulty: 1,
            visibility: "visible",
            requirements: [],
            gated: false,
            oneWay: false,
            travelEffects: [],
          });
          state.pendingPathFrom = null;
          state.selectedNodeId = nodeId;
          state.selectedPathId = null;
          state.toolMode = "select";
          renderAll();
        }
        return;
      }
      state.selectedNodeId = nodeId;
      state.selectedPathId = null;
      if (state.toolMode === "move") {
        state.dragNodeId = nodeId;
        event.preventDefault();
      } else {
        state.toolMode = "select";
      }
      renderAll();
    });
  });

  boardEl.onwheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    state.viewport.scale = Math.max(0.55, Math.min(1.85, state.viewport.scale + direction));
    applyCanvasView(boardEl);
  };

  boardEl.onpointerdown = (event) => {
    const target = event.target as HTMLElement;
    const clickedInteractive = !!target.closest("[data-node-id],[data-path-id]");
    if (clickedInteractive) return;
    if (!state.currentLayout) return;

    if (state.toolMode === "pan") {
      state.viewport.dragging = true;
      state.viewport.lastPointerX = event.clientX;
      state.viewport.lastPointerY = event.clientY;
      return;
    }

    if (state.toolMode === "add-node") {
      const unusedRegion = safeArray<Record<string, unknown>>(state.currentDefinition?.regions).find(
        (region) =>
          !state.currentLayout!.nodes.some(
            (node) => node.regionId === String(region.id || ""),
          ),
      );
      if (!unusedRegion) {
        setStatus("No unused canonical region is available for a new node.", true);
        return;
      }
      const point = screenPointToLayoutPoint(event, boardEl);
      state.currentLayout.nodes.push({
        regionId: String(unusedRegion.id || ""),
        x: Math.max(32, Math.min(state.currentLayout.width - 32, point.x)),
        y: Math.max(32, Math.min(state.currentLayout.height - 32, point.y)),
        tier: Math.max(0, Math.round(toFiniteNumber(unusedRegion.tier, 0))),
        icon: String(unusedRegion.icon || "🗺️"),
        landmark: String(unusedRegion.landmark || ""),
        accentColor: String(unusedRegion.accentColor || "#d4a65a"),
        isStart: false,
        isGoal: false,
      });
      state.selectedNodeId = String(unusedRegion.id || "");
      state.selectedPathId = null;
      state.toolMode = "select";
      renderAll();
      return;
    }

    state.selectedNodeId = null;
    state.selectedPathId = null;
    renderAll();
  };
}

function renderAll() {
  renderWorldList();
  renderTopbar();
  renderCanvas();
  renderInspector();
  renderDraftPanel();
  renderValidation();
  document.querySelectorAll<HTMLElement>("[id^='map-tool-']").forEach((button) => {
    button.classList.toggle("active", button.id === `map-tool-${state.toolMode}`);
  });
}

function applyWorkingDefinition(definition: Record<string, unknown>) {
  state.currentDefinition = cloneRecord(definition);
  state.originalDefinition = cloneRecord(definition);
  state.currentLayout = deriveTopologyLayoutDraft(state.currentDefinition);
  state.originalLayout = state.currentLayout ? cloneRecord(state.currentLayout) : null;
}

function loadLocalDraft(worldId: string) {
  const raw = localStorage.getItem(getLocalDraftKey(worldId));
  if (!raw) return false;
  try {
    const draft = JSON.parse(raw);
    const baseDefinition = cloneRecord(getSelectedWorld()?.definition || {});
    const nextDefinition = applySingleOverrideToDefinition(baseDefinition, draft);
    state.currentDefinition = nextDefinition;
    state.currentLayout = deriveTopologyLayoutDraft(nextDefinition);
    state.selectedOverrideId = "local-draft";
    return true;
  } catch {
    localStorage.removeItem(getLocalDraftKey(worldId));
    return false;
  }
}

function loadPersistedOverride(overrideId: string) {
  const overrideRecord =
    state.overrides.find((record) => String(record.id || "") === overrideId) || null;
  const world = getSelectedWorld();
  if (!overrideRecord || !world) return false;
  const nextDefinition = applySingleOverrideToDefinition(
    cloneRecord(world.definition),
    overrideRecord,
  );
  state.currentDefinition = nextDefinition;
  state.currentLayout = deriveTopologyLayoutDraft(nextDefinition);
  state.selectedOverrideId = overrideId;
  return true;
}

function selectWorld(worldId: string) {
  state.selectedWorldId = worldId;
  state.selectedNodeId = null;
  state.selectedPathId = null;
  state.pendingPathFrom = null;
  resetViewport();
  const world = getSelectedWorld();
  if (!world) {
    state.originalDefinition = null;
    state.currentDefinition = null;
    state.originalLayout = null;
    state.currentLayout = null;
    renderAll();
    return;
  }
  applyWorkingDefinition(world.definition);
  state.selectedOverrideId = "new";
  renderAll();
}

function loadSelectedDraftSelection(nextValue: string) {
  const world = getSelectedWorld();
  if (!world) return;
  applyWorkingDefinition(world.definition);
  state.selectedOverrideId = "new";
  if (nextValue === "local-draft") {
    if (!loadLocalDraft(world.id)) {
      setStatus("No local draft was available for this world.", true);
    }
  } else if (nextValue && nextValue !== "new") {
    if (!loadPersistedOverride(nextValue)) {
      setStatus("Could not load the selected override draft.", true);
    }
  }
  state.selectedNodeId = null;
  state.selectedPathId = null;
  state.pendingPathFrom = null;
  renderAll();
}

function autoLayout() {
  if (!state.currentLayout) return;
  const tiers = new Map<number, TopologyNodeDraft[]>();
  state.currentLayout.nodes.forEach((node) => {
    const bucket = tiers.get(node.tier) || [];
    bucket.push(node);
    tiers.set(node.tier, bucket);
  });
  const tierKeys = Array.from(tiers.keys()).sort((a, b) => a - b);
  const colWidth = state.currentLayout.width / Math.max(1, tierKeys.length + 1);
  tierKeys.forEach((tier, tierIndex) => {
    const nodes = tiers.get(tier) || [];
    const rowHeight = state.currentLayout!.height / Math.max(1, nodes.length + 1);
    nodes.forEach((node, nodeIndex) => {
      node.x = Math.round(colWidth * (tierIndex + 1));
      node.y = Math.round(rowHeight * (nodeIndex + 1));
    });
  });
  renderAll();
}

function duplicateNode() {
  if (!state.currentLayout || !state.selectedNodeId) return;
  const sourceNode = state.currentLayout.nodes.find((node) => node.regionId === state.selectedNodeId);
  if (!sourceNode) return;
  const unusedRegion = safeArray<Record<string, unknown>>(state.currentDefinition?.regions).find(
    (region) =>
      !state.currentLayout!.nodes.some(
        (node) => node.regionId === String(region.id || ""),
      ),
  );
  if (!unusedRegion) {
    setStatus("No unused canonical region is available to duplicate into.", true);
    return;
  }
  state.currentLayout.nodes.push({
    regionId: String(unusedRegion.id || ""),
    x: sourceNode.x + 96,
    y: sourceNode.y + 48,
    tier: sourceNode.tier,
    icon: sourceNode.icon,
    landmark: sourceNode.landmark,
    accentColor: sourceNode.accentColor,
    isStart: false,
    isGoal: false,
  });
  state.selectedNodeId = String(unusedRegion.id || "");
  renderAll();
}

function createBranch() {
  if (!state.currentLayout || !state.selectedNodeId) return;
  const sourceNode = state.currentLayout.nodes.find((node) => node.regionId === state.selectedNodeId);
  if (!sourceNode) return;
  const unusedRegion = safeArray<Record<string, unknown>>(state.currentDefinition?.regions).find(
    (region) =>
      !state.currentLayout!.nodes.some(
        (node) => node.regionId === String(region.id || ""),
      ),
  );
  if (!unusedRegion) {
    setStatus("No unused canonical region is available to branch into.", true);
    return;
  }
  const branchRegionId = String(unusedRegion.id || "");
  state.currentLayout.nodes.push({
    regionId: branchRegionId,
    x: sourceNode.x + 128,
    y: sourceNode.y + 72,
    tier: sourceNode.tier + 1,
    icon: String(unusedRegion.icon || sourceNode.icon),
    landmark: String(unusedRegion.landmark || sourceNode.landmark),
    accentColor: String(unusedRegion.accentColor || sourceNode.accentColor),
    isStart: false,
    isGoal: false,
  });
  state.currentLayout.paths.push({
    id: `${sourceNode.regionId}::${branchRegionId}::${Date.now()}`,
    fromRegionId: sourceNode.regionId,
    toRegionId: branchRegionId,
    kind: "road",
    difficulty: 1,
    visibility: "visible",
    requirements: [],
    gated: false,
    oneWay: false,
    travelEffects: [],
  });
  state.selectedNodeId = branchRegionId;
  renderAll();
}

function bindControls() {
  (document.getElementById("map-editor-search") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      state.search = (event.target as HTMLInputElement).value || "";
      renderWorldList();
    },
  );

  (document.getElementById("map-editor-world-select") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => selectWorld((event.target as HTMLSelectElement).value),
  );

  (document.getElementById("map-editor-override-select") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => loadSelectedDraftSelection((event.target as HTMLSelectElement).value),
  );

  document.getElementById("map-editor-validate-btn")?.addEventListener("click", () => {
    renderValidation();
    setStatus("Validation refreshed.");
  });

  document.getElementById("map-editor-reset-btn")?.addEventListener("click", () => {
    const world = getSelectedWorld();
    if (!world) return;
    applyWorkingDefinition(world.definition);
    state.selectedNodeId = null;
    state.selectedPathId = null;
    state.pendingPathFrom = null;
    state.selectedOverrideId = "new";
    resetViewport();
    renderAll();
    setStatus("Draft reset to the canonical world layout.");
  });

  document.getElementById("map-editor-save-draft-btn")?.addEventListener("click", () => {
    const draft = buildOverrideDraft();
    if (!draft || !state.selectedWorldId) return;
    localStorage.setItem(getLocalDraftKey(state.selectedWorldId), JSON.stringify(draft));
    state.selectedOverrideId = "local-draft";
    renderTopbar();
    setStatus("Saved local override draft.");
  });

  document.getElementById("map-editor-save-key")?.addEventListener("click", () => {
    const input = document.getElementById("map-editor-dev-key") as HTMLInputElement | null;
    localStorage.setItem(DEV_PANEL_KEY, input?.value || "");
    setStatus("Saved dev key. Reloading world sources...");
    void initialize();
  });

  document.getElementById("map-editor-preview-btn")?.addEventListener("click", () => {
    const world = getSelectedWorld();
    if (!world) return;
    window.open(`/map?worldDefinitionId=${encodeURIComponent(world.id)}`, "_blank");
  });

  document.getElementById("map-editor-save-btn")?.addEventListener("click", async () => {
    const draft = buildOverrideDraft();
    if (!draft) return;
    setStatus("Saving override...");
    const existingOverrideId =
      state.selectedOverrideId &&
      state.selectedOverrideId !== "new" &&
      state.selectedOverrideId !== "local-draft"
        ? state.selectedOverrideId
        : "";
    const targetUrl = existingOverrideId
      ? `${API}/panel/records/world_overrides/${encodeURIComponent(existingOverrideId)}`
      : `${API}/panel/records/world_overrides`;
    const method = existingOverrideId ? "PATCH" : "POST";
    const res = await fetch(targetUrl, {
      method,
      headers: panelHeaders(),
      body: JSON.stringify(draft),
    });
    const payload = await res.json();
    if (!payload.success) {
      setStatus(payload.error || "Could not save override.", true);
      return;
    }
    setStatus(existingOverrideId ? "Override updated." : "Override saved to world_overrides.");
    if (state.selectedWorldId) {
      localStorage.removeItem(getLocalDraftKey(state.selectedWorldId));
    }
    await loadOverrides();
    const world = getSelectedWorld();
    if (world) {
      applyWorkingDefinition(cloneRecord(state.currentDefinition || world.definition));
    }
    state.selectedOverrideId = String(payload.data?.id || existingOverrideId || "new");
    renderAll();
  });

  const toolBindings: Array<[string, typeof state.toolMode]> = [
    ["map-tool-select", "select"],
    ["map-tool-move", "move"],
    ["map-tool-add-node", "add-node"],
    ["map-tool-add-path", "add-path"],
    ["map-tool-delete", "delete"],
    ["map-tool-pan", "pan"],
  ];
  toolBindings.forEach(([id, mode]) => {
    document.getElementById(id)?.addEventListener("click", () => {
      state.toolMode = mode;
      state.pendingPathFrom = null;
      renderAll();
    });
  });

  document.getElementById("map-editor-auto-layout")?.addEventListener("click", () => {
    autoLayout();
    setStatus("Auto layout applied.");
  });
  document.getElementById("map-editor-center")?.addEventListener("click", () => {
    resetViewport();
    const boardEl = document.getElementById("map-editor-canvas");
    if (boardEl) applyCanvasView(boardEl);
    setStatus("Map centered.");
  });
  document.getElementById("map-editor-duplicate")?.addEventListener("click", () => {
    duplicateNode();
  });
  document.getElementById("map-editor-branch")?.addEventListener("click", () => {
    createBranch();
  });

  [
    ["map-layer-paths", "paths"],
    ["map-layer-nodes", "nodes"],
    ["map-layer-labels", "labels"],
    ["map-layer-regions", "regions"],
    ["map-layer-locked", "locked"],
    ["map-layer-terrain", "terrain"],
  ].forEach(([id, key]) => {
    (document.getElementById(id) as HTMLInputElement | null)?.addEventListener(
      "change",
      (event) => {
        (state.layers as Record<string, boolean>)[key] = (event.target as HTMLInputElement).checked;
        renderCanvas();
      },
    );
  });

  const updateRegion = (mutator: (region: Record<string, unknown>) => void) => {
    if (!state.currentDefinition || !state.selectedNodeId) return;
    const regions = safeArray<Record<string, unknown>>(state.currentDefinition.regions);
    const region = regions.find((entry) => String(entry.id || "") === state.selectedNodeId);
    if (!region) return;
    mutator(region);
    renderAll();
  };

  const updateNode = (mutator: (node: TopologyNodeDraft) => void) => {
    if (!state.currentLayout || !state.selectedNodeId) return;
    const node = state.currentLayout.nodes.find((entry) => entry.regionId === state.selectedNodeId);
    if (!node) return;
    const previousId = node.regionId;
    mutator(node);
    if (node.regionId !== previousId) {
      state.currentLayout.paths.forEach((path) => {
        if (path.fromRegionId === previousId) path.fromRegionId = node.regionId;
        if (path.toRegionId === previousId) path.toRegionId = node.regionId;
      });
      if (state.currentLayout.startRegionId === previousId) state.currentLayout.startRegionId = node.regionId;
      if (state.currentLayout.goalRegionId === previousId) state.currentLayout.goalRegionId = node.regionId;
      state.selectedNodeId = node.regionId;
    }
    if (node.isStart) {
      state.currentLayout.startRegionId = node.regionId;
      state.currentLayout.nodes.forEach((entry) => {
        if (entry.regionId !== node.regionId) entry.isStart = false;
      });
    }
    if (node.isGoal) {
      state.currentLayout.goalRegionId = node.regionId;
      state.currentLayout.nodes.forEach((entry) => {
        if (entry.regionId !== node.regionId) entry.isGoal = false;
      });
    }
    renderAll();
  };

  const updatePath = (mutator: (path: TopologyPathDraft) => void) => {
    if (!state.currentLayout || !state.selectedPathId) return;
    const path = state.currentLayout.paths.find((entry) => entry.id === state.selectedPathId);
    if (!path) return;
    mutator(path);
    renderAll();
  };

  (document.getElementById("map-editor-width") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      if (!state.currentLayout) return;
      state.currentLayout.width = Math.max(
        320,
        Math.round(toFiniteNumber((event.target as HTMLInputElement).value, state.currentLayout.width)),
      );
      renderAll();
    },
  );
  (document.getElementById("map-editor-height") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      if (!state.currentLayout) return;
      state.currentLayout.height = Math.max(
        240,
        Math.round(toFiniteNumber((event.target as HTMLInputElement).value, state.currentLayout.height)),
      );
      renderAll();
    },
  );
  (document.getElementById("map-editor-start-region") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      if (!state.currentLayout) return;
      state.currentLayout.startRegionId = (event.target as HTMLSelectElement).value;
      state.currentLayout.nodes.forEach((node) => {
        node.isStart = node.regionId === state.currentLayout!.startRegionId;
      });
      renderAll();
    },
  );
  (document.getElementById("map-editor-goal-region") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      if (!state.currentLayout) return;
      state.currentLayout.goalRegionId = (event.target as HTMLSelectElement).value;
      state.currentLayout.nodes.forEach((node) => {
        node.isGoal = node.regionId === state.currentLayout!.goalRegionId;
      });
      renderAll();
    },
  );

  (document.getElementById("map-editor-node-region") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      const nextRegionId = (event.target as HTMLSelectElement).value;
      updateNode((node) => {
        node.regionId = nextRegionId;
      });
    },
  );
  (document.getElementById("map-editor-node-name") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      updateRegion((region) => {
        region.name = (event.target as HTMLInputElement).value || region.name;
      });
    },
  );
  (document.getElementById("map-editor-node-biome") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      updateRegion((region) => {
        region.biome = (event.target as HTMLInputElement).value || "";
      });
    },
  );
  (document.getElementById("map-editor-node-danger") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateRegion((region) => {
        region.dangerLevel = Math.max(
          0,
          Math.round(toFiniteNumber((event.target as HTMLInputElement).value, toFiniteNumber(region.dangerLevel, 0))),
        );
      });
    },
  );
  (document.getElementById("map-editor-node-x") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateNode((node) => {
        node.x = Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.x));
      });
    },
  );
  (document.getElementById("map-editor-node-y") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateNode((node) => {
        node.y = Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.y));
      });
    },
  );
  (document.getElementById("map-editor-node-tier") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateNode((node) => {
        node.tier = Math.max(
          0,
          Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.tier)),
        );
      });
    },
  );
  (document.getElementById("map-editor-node-icon") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      const nextValue = (event.target as HTMLInputElement).value || "";
      updateNode((node) => {
        node.icon = nextValue || node.icon;
      });
      updateRegion((region) => {
        region.icon = nextValue;
      });
    },
  );
  (document.getElementById("map-editor-node-landmark") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      const nextValue = (event.target as HTMLInputElement).value || "";
      updateNode((node) => {
        node.landmark = nextValue;
      });
      updateRegion((region) => {
        region.landmark = nextValue;
      });
    },
  );
  (document.getElementById("map-editor-node-accent") as HTMLInputElement | null)?.addEventListener(
    "input",
    (event) => {
      const nextValue = (event.target as HTMLInputElement).value || "";
      updateNode((node) => {
        node.accentColor = nextValue || node.accentColor;
      });
      updateRegion((region) => {
        region.accentColor = nextValue;
      });
    },
  );
  (document.getElementById("map-editor-node-start") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateNode((node) => {
        node.isStart = (event.target as HTMLInputElement).checked;
      });
    },
  );
  (document.getElementById("map-editor-node-goal") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateNode((node) => {
        node.isGoal = (event.target as HTMLInputElement).checked;
      });
    },
  );
  (document.getElementById("map-editor-node-enemies") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updateRegion((region) => {
        region.enemyPool = (event.target as HTMLInputElement).value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
      });
    },
  );

  (document.getElementById("map-editor-path-from") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.fromRegionId = (event.target as HTMLSelectElement).value;
      });
    },
  );
  (document.getElementById("map-editor-path-to") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.toRegionId = (event.target as HTMLSelectElement).value;
      });
    },
  );
  (document.getElementById("map-editor-path-kind") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        const next = (event.target as HTMLSelectElement).value;
        path.kind = next === "hazard" || next === "secret" ? next : "road";
      });
    },
  );
  (document.getElementById("map-editor-path-difficulty") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.difficulty = Math.max(
          1,
          Math.round(toFiniteNumber((event.target as HTMLInputElement).value, path.difficulty)),
        );
      });
    },
  );
  (document.getElementById("map-editor-path-visibility") as HTMLSelectElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        const next = (event.target as HTMLSelectElement).value;
        path.visibility = next === "hidden" || next === "fogged" ? next : "visible";
      });
    },
  );
  (document.getElementById("map-editor-path-requirements") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.requirements = normalizeRequirements((event.target as HTMLInputElement).value);
      });
    },
  );
  (document.getElementById("map-editor-path-gated") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.gated = (event.target as HTMLInputElement).checked;
      });
    },
  );
  (document.getElementById("map-editor-path-one-way") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.oneWay = (event.target as HTMLInputElement).checked;
      });
    },
  );
  (document.getElementById("map-editor-path-effects") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      updatePath((path) => {
        path.travelEffects = normalizePathEffects((event.target as HTMLInputElement).value);
      });
    },
  );

  window.addEventListener("pointermove", (event) => {
    if (state.dragNodeId && state.toolMode === "move" && state.currentLayout) {
      const boardEl = document.getElementById("map-editor-canvas");
      if (!boardEl) return;
      const node = state.currentLayout.nodes.find((entry) => entry.regionId === state.dragNodeId);
      if (!node) return;
      const point = screenPointToLayoutPoint(event, boardEl);
      node.x = Math.round(Math.max(36, Math.min(state.currentLayout.width - 36, point.x)));
      node.y = Math.round(Math.max(36, Math.min(state.currentLayout.height - 36, point.y)));
      renderAll();
      return;
    }

    if (state.viewport.dragging && state.toolMode === "pan") {
      state.viewport.panX += event.clientX - state.viewport.lastPointerX;
      state.viewport.panY += event.clientY - state.viewport.lastPointerY;
      state.viewport.lastPointerX = event.clientX;
      state.viewport.lastPointerY = event.clientY;
      const boardEl = document.getElementById("map-editor-canvas");
      if (boardEl) applyCanvasView(boardEl);
    }
  });

  window.addEventListener("pointerup", () => {
    state.dragNodeId = null;
    state.viewport.dragging = false;
  });
}

async function loadStatus() {
  const res = await fetch(`${API}/panel/status`);
  const payload = await res.json();
  state.requiresKey = payload.data?.requiresKey === true;
  const keyCopyEl = document.getElementById("map-editor-key-copy");
  if (keyCopyEl) {
    keyCopyEl.textContent = state.requiresKey
      ? "This page requires the configured dev key before it can load world data."
      : "No dev key is required right now.";
  }
}

async function loadWorlds() {
  const res = await fetch(`${API}/panel/source/world_definitions?sortOrder=latest`, {
    headers: panelHeaders(),
  });
  const payload = await res.json();
  if (!payload.success) throw new Error(payload.error || "Could not load world definitions");
  state.worlds = (payload.data?.records || [])
    .map((record: Record<string, unknown>) => parseWorldDefinitionRecord(record))
    .filter(
      (record: ParsedWorldDefinitionRecord | null): record is ParsedWorldDefinitionRecord =>
        !!record,
    );
}

async function loadOverrides() {
  const res = await fetch(`${API}/panel/source/world_overrides?sortOrder=latest`, {
    headers: panelHeaders(),
  });
  const payload = await res.json();
  if (!payload.success) throw new Error(payload.error || "Could not load world overrides");
  state.overrides = Array.isArray(payload.data?.records) ? payload.data.records : [];
}

async function initialize() {
  try {
    await loadStatus();
    await Promise.all([loadWorlds(), loadOverrides()]);
    if (!state.selectedWorldId && state.worlds[0]) {
      state.selectedWorldId = state.worlds[0].id;
    }
    selectWorld(state.selectedWorldId);
    renderAll();
    setStatus("Map editor ready.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load map editor";
    setStatus(message, true);
  }
}

bindControls();
void initialize();
