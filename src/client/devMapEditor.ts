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

const state = {
  requiresKey: false,
  worlds: [] as ParsedWorldDefinitionRecord[],
  overrides: [] as Record<string, unknown>[],
  search: "",
  selectedWorldId: "",
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

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
  const regions = safeArray(definition.regions).map((entry) => safeObject(entry));
  const mapLayout = safeObject(definition.mapLayout);

  return {
    id,
    name:
      String(record.world_name || metadata.worldName || definitionMetadata.worldName || "Unnamed World").trim() ||
      "Unnamed World",
    preset:
      String(record.world_preset || metadata.worldPreset || definitionMetadata.worldPreset || "custom").trim() ||
      "custom",
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

function getWorldRegion(world: ParsedWorldDefinitionRecord | null, regionId: string) {
  if (!world) return null;
  return world.regions.find((region) => String(region.id || "") === regionId) || null;
}

function deriveTopologyLayoutDraft(world: ParsedWorldDefinitionRecord | null): TopologyLayoutDraft | null {
  if (!world) return null;

  const layout = safeObject(world.mapLayout);
  const rawNodes = safeArray(layout.nodes);
  const rawPaths = safeArray(layout.paths);
  const nodes: TopologyNodeDraft[] = rawNodes
    .map((entry) => safeObject(entry))
    .map((entry, index) => {
      const regionId = String(entry.regionId || world.regions[index]?.id || "").trim();
      if (!regionId) return null;
      return {
        regionId,
        x: Math.round(toFiniteNumber(entry.x, 120 + index * 120)),
        y: Math.round(toFiniteNumber(entry.y, 120 + (index % 4) * 90)),
        tier: Math.max(0, Math.round(toFiniteNumber(entry.tier, index))),
        icon: String(entry.icon || "🗺️"),
        landmark: String(entry.landmark || ""),
        accentColor: String(entry.accentColor || "#d4a65a"),
        isStart: entry.isStart === true,
        isGoal: entry.isGoal === true,
      } as TopologyNodeDraft;
    })
    .filter((entry): entry is TopologyNodeDraft => !!entry);

  const regionNodeIds = new Set(nodes.map((node) => node.regionId));
  world.regions.forEach((region, index) => {
    const regionId = String(region.id || "").trim();
    if (!regionId || regionNodeIds.has(regionId)) return;
    nodes.push({
      regionId,
      x: 160 + ((nodes.length + index) % 5) * 120,
      y: 160 + ((nodes.length + index) % 4) * 110,
      tier: Math.max(0, Number(region.tier || 0)),
      icon: String(region.icon || "🗺️"),
      landmark: String(region.landmark || ""),
      accentColor: String(region.accentColor || "#d4a65a"),
      isStart: region.isStart === true,
      isGoal: region.isGoal === true,
    });
  });

  const paths: TopologyPathDraft[] = rawPaths
    .map((entry) => safeObject(entry))
    .map((entry, index) => {
      const fromRegionId = String(entry.fromRegionId || "").trim();
      const toRegionId = String(entry.toRegionId || "").trim();
      if (!fromRegionId || !toRegionId) return null;
      const kind =
        entry.kind === "hazard" || entry.kind === "secret" ? entry.kind : "road";
      const visibility =
        entry.visibility === "hidden" || entry.visibility === "fogged"
          ? entry.visibility
          : "visible";
      return {
        id: String(entry.id || `${fromRegionId}::${toRegionId}::${index}`),
        fromRegionId,
        toRegionId,
        kind,
        difficulty: Math.max(1, Math.round(toFiniteNumber(entry.difficulty, 1))),
        visibility,
        requirements: Array.isArray(entry.requirements)
          ? entry.requirements.map((item) => String(item || "").trim()).filter(Boolean)
          : typeof entry.requirements === "string"
            ? entry.requirements.split(",").map((item) => item.trim()).filter(Boolean)
            : [],
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

function buildOverrideDraft() {
  if (!state.currentLayout || !state.selectedWorldId) return null;
  return {
    world_definition_id: state.selectedWorldId,
    override_type: "set_map_layout",
    scope_type: "world",
    scope_ref: "",
    payload_json: cloneRecord(state.currentLayout),
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

function renderWorldList() {
  const listEl = document.getElementById("map-editor-world-list");
  if (!listEl) return;
  const worlds = filteredWorlds();
  if (!worlds.length) {
    listEl.innerHTML = '<div class="dev-map-list-empty">No worlds match the current search.</div>';
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
  const worldSelect = document.getElementById("map-editor-world-select") as HTMLSelectElement | null;
  if (worldSelect) {
    worldSelect.innerHTML = state.worlds
      .map(
        (world) =>
          `<option value="${escapeHtml(world.id)}" ${world.id === state.selectedWorldId ? "selected" : ""}>${escapeHtml(world.name)}</option>`,
      )
      .join("");
  }

  const world = getSelectedWorld();
  const nameEl = document.getElementById("map-editor-world-name");
  const metaEl = document.getElementById("map-editor-world-meta");
  if (nameEl) nameEl.textContent = world?.name || "No world selected";
  if (metaEl) {
    metaEl.textContent = world
      ? `${world.mode} • ${world.preset} • ${world.regions.length} regions • ${countWorldOverrides(world.id)} overrides`
      : "Choose a canonical world to begin.";
  }
}

function buildValidation(layout: TopologyLayoutDraft | null): ValidationResult[] {
  if (!layout) return [];
  const results: ValidationResult[] = [];
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

  const duplicates = nodeIds.filter((nodeId, index) => nodeIds.indexOf(nodeId) !== index);
  if (duplicates.length) {
    results.push({
      severity: "error",
      message: `Duplicate region IDs detected: ${Array.from(new Set(duplicates)).join(", ")}.`,
    });
  } else {
    results.push({ severity: "ok", message: "All nodes have unique region IDs." });
  }

  layout.paths.forEach((path) => {
    if (!nodeIdSet.has(path.fromRegionId) || !nodeIdSet.has(path.toRegionId)) {
      results.push({
        severity: "error",
        message: `Path ${path.id} references a missing node.`,
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
  if (!state.currentLayout || !state.originalLayout) return [];
  const rows: string[] = [];
  const originalNodes = new Map(state.originalLayout.nodes.map((node) => [node.regionId, node] as const));
  const currentNodes = new Map(state.currentLayout.nodes.map((node) => [node.regionId, node] as const));
  const addedNodes = state.currentLayout.nodes.filter((node) => !originalNodes.has(node.regionId));
  const removedNodes = state.originalLayout.nodes.filter((node) => !currentNodes.has(node.regionId));
  const movedNodes = state.currentLayout.nodes.filter((node) => {
    const original = originalNodes.get(node.regionId);
    return original && (original.x !== node.x || original.y !== node.y);
  });
  const addedPaths = state.currentLayout.paths.filter(
    (path) => !state.originalLayout!.paths.some((original) => original.id === path.id),
  );
  const removedPaths = state.originalLayout.paths.filter(
    (path) => !state.currentLayout!.paths.some((current) => current.id === path.id),
  );

  if (addedNodes.length) rows.push(`+ ${addedNodes.length} node(s) added`);
  if (removedNodes.length) rows.push(`− ${removedNodes.length} node(s) removed`);
  if (movedNodes.length) rows.push(`↔ ${movedNodes.length} node(s) moved`);
  if (addedPaths.length) rows.push(`+ ${addedPaths.length} path(s) added`);
  if (removedPaths.length) rows.push(`− ${removedPaths.length} path(s) removed`);
  if (!rows.length) rows.push("No layout changes yet.");
  return rows;
}

function renderDraftPanel() {
  const draftMetaEl = document.getElementById("map-editor-draft-meta");
  const summaryEl = document.getElementById("map-editor-draft-summary");
  const jsonEl = document.getElementById("map-editor-draft-json") as HTMLTextAreaElement | null;
  const draft = buildOverrideDraft();
  if (draftMetaEl) {
    draftMetaEl.textContent = draft
      ? `Type: ${draft.override_type} • Scope: ${draft.scope_type} • Target world: ${state.selectedWorldId}`
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
  const world = getSelectedWorld();
  const layout = state.currentLayout;
  const selectionTitleEl = document.getElementById("map-editor-selection-title");
  const selectionCopyEl = document.getElementById("map-editor-selection-copy");
  const nodeCardEl = document.getElementById("map-editor-node-card");
  const pathCardEl = document.getElementById("map-editor-path-card");

  const selectedNode = layout?.nodes.find((node) => node.regionId === state.selectedNodeId) || null;
  const selectedPath = layout?.paths.find((path) => path.id === state.selectedPathId) || null;

  if (selectionTitleEl) {
    selectionTitleEl.textContent = selectedNode
      ? selectedNode.regionId
      : selectedPath
        ? selectedPath.id
        : "World Layout";
  }
  if (selectionCopyEl) {
    if (selectedNode) {
      const region = getWorldRegion(world, selectedNode.regionId);
      selectionCopyEl.textContent = `${String(region?.name || selectedNode.regionId)} • ${String(region?.biome || "unknown biome")} • danger ${String(region?.dangerLevel || 0)}`;
    } else if (selectedPath) {
      selectionCopyEl.textContent = `${selectedPath.kind} path • difficulty ${selectedPath.difficulty} • ${selectedPath.visibility}`;
    } else {
      selectionCopyEl.textContent = "Select a node or path to edit it. Layout fields below affect the full map.";
    }
  }

  nodeCardEl?.classList.toggle("is-disabled", !selectedNode);
  pathCardEl?.classList.toggle("is-disabled", !selectedPath);

  const bindSelect = (id: string, options: string[], selected = "") => {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    el.innerHTML = options
      .map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`)
      .join("");
  };

  const regionIds = layout?.nodes.map((node) => node.regionId) || [];
  bindSelect("map-editor-start-region", regionIds, layout?.startRegionId || "");
  bindSelect("map-editor-goal-region", regionIds, layout?.goalRegionId || "");
  bindSelect("map-editor-node-region", regionIds, selectedNode?.regionId || "");
  bindSelect("map-editor-path-from", regionIds, selectedPath?.fromRegionId || "");
  bindSelect("map-editor-path-to", regionIds, selectedPath?.toRegionId || "");

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
  setInput("map-editor-node-x", selectedNode?.x || 0, !selectedNode);
  setInput("map-editor-node-y", selectedNode?.y || 0, !selectedNode);
  setInput("map-editor-node-tier", selectedNode?.tier || 0, !selectedNode);
  setInput("map-editor-node-icon", selectedNode?.icon || "", !selectedNode);
  setInput("map-editor-node-landmark", selectedNode?.landmark || "", !selectedNode);
  setInput("map-editor-node-accent", selectedNode?.accentColor || "", !selectedNode);
  setInput("map-editor-node-start", selectedNode?.isStart || false, !selectedNode);
  setInput("map-editor-node-goal", selectedNode?.isGoal || false, !selectedNode);

  const pathKindEl = document.getElementById("map-editor-path-kind") as HTMLSelectElement | null;
  if (pathKindEl) {
    pathKindEl.value = selectedPath?.kind || "road";
    pathKindEl.disabled = !selectedPath;
  }
  const pathVisibilityEl = document.getElementById("map-editor-path-visibility") as HTMLSelectElement | null;
  if (pathVisibilityEl) {
    pathVisibilityEl.value = selectedPath?.visibility || "visible";
    pathVisibilityEl.disabled = !selectedPath;
  }
  setInput("map-editor-path-difficulty", selectedPath?.difficulty || 1, !selectedPath);
  setInput(
    "map-editor-path-requirements",
    selectedPath?.requirements.join(", ") || "",
    !selectedPath,
  );
}

function syncLayoutSelectors() {
  renderInspector();
  renderDraftPanel();
  renderValidation();
}

function renderCanvas() {
  const boardEl = document.getElementById("map-editor-canvas");
  if (!boardEl) return;
  const world = getSelectedWorld();
  const layout = state.currentLayout;
  if (!world || !layout) {
    boardEl.innerHTML = '<div class="dev-topology-empty">Select a canonical world to begin editing.</div>';
    return;
  }

  const regionMap = new Map(world.regions.map((region) => [String(region.id || ""), region] as const));
  const layoutWidth = Math.max(320, layout.width);
  const layoutHeight = Math.max(240, layout.height);
  const scaleX = 100 / layoutWidth;
  const scaleY = 100 / layoutHeight;

  const pathMarkup = state.layers.paths
    ? layout.paths
        .map((path) => {
          const fromNode = layout.nodes.find((node) => node.regionId === path.fromRegionId);
          const toNode = layout.nodes.find((node) => node.regionId === path.toRegionId);
          if (!fromNode || !toNode) return "";
          return `
            <g class="dev-topology-path-group">
              <line
                class="dev-topology-path-line kind-${escapeHtml(path.kind)} visibility-${escapeHtml(path.visibility)} ${path.id === state.selectedPathId ? "selected" : ""}"
                x1="${((fromNode.x / layoutWidth) * 100).toFixed(2)}%"
                y1="${((fromNode.y / layoutHeight) * 100).toFixed(2)}%"
                x2="${((toNode.x / layoutWidth) * 100).toFixed(2)}%"
                y2="${((toNode.y / layoutHeight) * 100).toFixed(2)}%"
              />
              <line
                class="dev-topology-path-hit"
                data-path-id="${escapeHtml(path.id)}"
                x1="${((fromNode.x / layoutWidth) * 100).toFixed(2)}%"
                y1="${((fromNode.y / layoutHeight) * 100).toFixed(2)}%"
                x2="${((toNode.x / layoutWidth) * 100).toFixed(2)}%"
                y2="${((toNode.y / layoutHeight) * 100).toFixed(2)}%"
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
            ? `danger ${String(region.dangerLevel || 0)}`
            : `tier ${String(node.tier)}`;
          return `
            <button
              type="button"
              class="dev-topology-node ${node.regionId === state.selectedNodeId ? "selected" : ""} ${pending ? "pending" : ""}"
              data-node-id="${escapeHtml(node.regionId)}"
              style="left: calc(${(node.x * scaleX).toFixed(4)}% - 28px); top: calc(${(node.y * scaleY).toFixed(4)}% - 28px); --node-accent: ${escapeHtml(node.accentColor)};"
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
    <svg class="dev-topology-path-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
      ${pathMarkup}
    </svg>
    ${nodeMarkup}
  `;

  boardEl.querySelectorAll<HTMLElement>("[data-path-id]").forEach((pathEl) => {
    pathEl.addEventListener("click", () => {
      const pathId = pathEl.dataset.pathId || "";
      if (state.toolMode === "delete") {
        state.currentLayout!.paths = state.currentLayout!.paths.filter((path) => path.id !== pathId);
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
          });
          state.pendingPathFrom = null;
          state.selectedNodeId = nodeId;
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

  boardEl.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement) || event.target.closest("[data-node-id],[data-path-id]")) return;
    if (state.toolMode !== "add-node" || !state.currentLayout || !world) return;
    const unusedRegion = world.regions.find(
      (region) => !state.currentLayout!.nodes.some((node) => node.regionId === String(region.id || "")),
    );
    if (!unusedRegion) {
      setStatus("No unused canonical region is available for a new node.", true);
      return;
    }
    const rect = boardEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * state.currentLayout.width;
    const y = ((event.clientY - rect.top) / rect.height) * state.currentLayout.height;
    state.currentLayout.nodes.push({
      regionId: String(unusedRegion.id || ""),
      x: Math.round(x),
      y: Math.round(y),
      tier: Math.max(0, Number(unusedRegion.tier || 0)),
      icon: String(unusedRegion.icon || "🗺️"),
      landmark: String(unusedRegion.landmark || ""),
      accentColor: String(unusedRegion.accentColor || "#d4a65a"),
      isStart: false,
      isGoal: false,
    });
    state.selectedNodeId = String(unusedRegion.id || "");
    state.toolMode = "select";
    renderAll();
  });
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

function selectWorld(worldId: string) {
  state.selectedWorldId = worldId;
  state.selectedNodeId = null;
  state.selectedPathId = null;
  state.pendingPathFrom = null;
  const world = getSelectedWorld();
  state.originalLayout = deriveTopologyLayoutDraft(world);
  state.currentLayout = state.originalLayout ? cloneRecord(state.originalLayout) : null;
  renderAll();
}

function autoLayout() {
  if (!state.currentLayout) return;
  const tiers = new Map<number, TopologyNodeDraft[]>();
  state.currentLayout.nodes.forEach((node) => {
    const group = tiers.get(node.tier) || [];
    group.push(node);
    tiers.set(node.tier, group);
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
  const world = getSelectedWorld();
  if (!world) return;
  const sourceNode = state.currentLayout.nodes.find((node) => node.regionId === state.selectedNodeId);
  if (!sourceNode) return;
  const unusedRegion = world.regions.find(
    (region) => !state.currentLayout!.nodes.some((node) => node.regionId === String(region.id || "")),
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
  const beforeNodeCount = state.currentLayout.nodes.length;
  duplicateNode();
  if (state.currentLayout.nodes.length === beforeNodeCount || !state.selectedNodeId) return;
  state.currentLayout.paths.push({
    id: `${state.selectedNodeId}::branch::${Date.now()}`,
    fromRegionId:
      state.currentLayout.nodes[beforeNodeCount - 1]?.regionId || state.currentLayout.startRegionId,
    toRegionId: state.selectedNodeId,
    kind: "road",
    difficulty: 1,
    visibility: "visible",
    requirements: [],
  });
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

  document.getElementById("map-editor-validate-btn")?.addEventListener("click", () => {
    renderValidation();
    setStatus("Validation refreshed.");
  });

  document.getElementById("map-editor-reset-btn")?.addEventListener("click", () => {
    if (!state.originalLayout) return;
    state.currentLayout = cloneRecord(state.originalLayout);
    state.selectedNodeId = null;
    state.selectedPathId = null;
    state.pendingPathFrom = null;
    renderAll();
    setStatus("Draft reset to the canonical world layout.");
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
    const res = await fetch(`${API}/panel/records/world_overrides`, {
      method: "POST",
      headers: panelHeaders(),
      body: JSON.stringify(draft),
    });
    const payload = await res.json();
    if (!payload.success) {
      setStatus(payload.error || "Could not save override.", true);
      return;
    }
    setStatus("Override saved to world_overrides.");
    await loadOverrides();
    state.originalLayout = state.currentLayout ? cloneRecord(state.currentLayout) : null;
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
    setStatus("The board recenters automatically to the current layout.");
    renderCanvas();
  });
  document.getElementById("map-editor-duplicate")?.addEventListener("click", () => {
    duplicateNode();
  });
  document.getElementById("map-editor-branch")?.addEventListener("click", () => {
    createBranch();
  });

  (document.getElementById("map-layer-paths") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      state.layers.paths = (event.target as HTMLInputElement).checked;
      renderCanvas();
    },
  );
  (document.getElementById("map-layer-nodes") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      state.layers.nodes = (event.target as HTMLInputElement).checked;
      renderCanvas();
    },
  );
  (document.getElementById("map-layer-labels") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      state.layers.labels = (event.target as HTMLInputElement).checked;
      renderCanvas();
    },
  );
  (document.getElementById("map-layer-regions") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      state.layers.regions = (event.target as HTMLInputElement).checked;
      renderCanvas();
    },
  );
  (document.getElementById("map-layer-locked") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      state.layers.locked = (event.target as HTMLInputElement).checked;
      renderCanvas();
    },
  );

  const updateNode = (mutator: (node: TopologyNodeDraft) => void) => {
    if (!state.currentLayout || !state.selectedNodeId) return;
    const node = state.currentLayout.nodes.find((entry) => entry.regionId === state.selectedNodeId);
    if (!node) return;
    mutator(node);
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
      state.currentLayout.width = Math.max(320, Math.round(toFiniteNumber((event.target as HTMLInputElement).value, state.currentLayout.width)));
      renderAll();
    },
  );
  (document.getElementById("map-editor-height") as HTMLInputElement | null)?.addEventListener(
    "change",
    (event) => {
      if (!state.currentLayout) return;
      state.currentLayout.height = Math.max(240, Math.round(toFiniteNumber((event.target as HTMLInputElement).value, state.currentLayout.height)));
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
        state.selectedNodeId = nextRegionId;
      });
    },
  );
  (document.getElementById("map-editor-node-x") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updateNode((node) => {
      node.x = Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.x));
    });
  });
  (document.getElementById("map-editor-node-y") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updateNode((node) => {
      node.y = Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.y));
    });
  });
  (document.getElementById("map-editor-node-tier") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updateNode((node) => {
      node.tier = Math.max(0, Math.round(toFiniteNumber((event.target as HTMLInputElement).value, node.tier)));
    });
  });
  (document.getElementById("map-editor-node-icon") as HTMLInputElement | null)?.addEventListener("input", (event) => {
    updateNode((node) => {
      node.icon = (event.target as HTMLInputElement).value || node.icon;
    });
  });
  (document.getElementById("map-editor-node-landmark") as HTMLInputElement | null)?.addEventListener("input", (event) => {
    updateNode((node) => {
      node.landmark = (event.target as HTMLInputElement).value || "";
    });
  });
  (document.getElementById("map-editor-node-accent") as HTMLInputElement | null)?.addEventListener("input", (event) => {
    updateNode((node) => {
      node.accentColor = (event.target as HTMLInputElement).value || node.accentColor;
    });
  });
  (document.getElementById("map-editor-node-start") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updateNode((node) => {
      node.isStart = (event.target as HTMLInputElement).checked;
    });
  });
  (document.getElementById("map-editor-node-goal") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updateNode((node) => {
      node.isGoal = (event.target as HTMLInputElement).checked;
    });
  });

  (document.getElementById("map-editor-path-from") as HTMLSelectElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      path.fromRegionId = (event.target as HTMLSelectElement).value;
    });
  });
  (document.getElementById("map-editor-path-to") as HTMLSelectElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      path.toRegionId = (event.target as HTMLSelectElement).value;
    });
  });
  (document.getElementById("map-editor-path-kind") as HTMLSelectElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      const next = (event.target as HTMLSelectElement).value;
      path.kind = next === "hazard" || next === "secret" ? next : "road";
    });
  });
  (document.getElementById("map-editor-path-difficulty") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      path.difficulty = Math.max(1, Math.round(toFiniteNumber((event.target as HTMLInputElement).value, path.difficulty)));
    });
  });
  (document.getElementById("map-editor-path-visibility") as HTMLSelectElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      const next = (event.target as HTMLSelectElement).value;
      path.visibility = next === "hidden" || next === "fogged" ? next : "visible";
    });
  });
  (document.getElementById("map-editor-path-requirements") as HTMLInputElement | null)?.addEventListener("change", (event) => {
    updatePath((path) => {
      path.requirements = (event.target as HTMLInputElement).value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    });
  });

  window.addEventListener("pointermove", (event) => {
    if (!state.dragNodeId || state.toolMode !== "move" || !state.currentLayout) return;
    const boardEl = document.getElementById("map-editor-canvas");
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * state.currentLayout.width;
    const y = ((event.clientY - rect.top) / rect.height) * state.currentLayout.height;
    const node = state.currentLayout.nodes.find((entry) => entry.regionId === state.dragNodeId);
    if (!node) return;
    node.x = Math.round(Math.max(36, Math.min(state.currentLayout.width - 36, x)));
    node.y = Math.round(Math.max(36, Math.min(state.currentLayout.height - 36, y)));
    renderAll();
  });

  window.addEventListener("pointerup", () => {
    state.dragNodeId = null;
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
    .filter((record: ParsedWorldDefinitionRecord | null): record is ParsedWorldDefinitionRecord => !!record);
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
