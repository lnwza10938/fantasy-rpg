// src/api/gameRoutes.ts
// Developer API routes for content management + AI generation

import { Router } from "express";
import {
  createMonster,
  getMonsters,
  createItem,
  getItems,
  createEquipment,
  getEquipment,
  createMap,
  getMaps,
  createSpawnPoint,
  getSpawnPoints,
  createDialogue,
  getDialogues,
} from "../db/contentRepositories.js";
import { contentValidator } from "../core/contentValidator.js";
import {
  worldGenerator,
  setAIConfig,
  getAIConfig,
  isAIConfigured,
} from "../core/worldGenerator.js";
import {
  createSourceRecord,
  deleteSourceRecord,
  getDevPanelCatalog,
  getSourceSnapshot,
  updateSourceRecord,
  type DevSortOrder,
} from "../db/devPanelRepositories.js";
import {
  getAssetWorkbenchSourceConfigs,
  getDevSourceConfig,
} from "../models/devPanelCatalog.js";
import { planAssetSlicing, reviewAssetAgainstFilename } from "../core/assetReview.js";
import {
  listAudioAssetEntries,
  listTerrainFacingAssets,
  listTerrainRecipeEntries,
} from "../db/assetRepositories.js";

const router = Router();
const DEV_PANEL_KEY = process.env.DEV_PANEL_KEY || "";

function getRequestedSortOrder(value: unknown): DevSortOrder {
  return value === "oldest" ? "oldest" : "latest";
}

function inferDraftFieldType(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "array";
    return `array<${inferDraftFieldType(value[0])}>`;
  }
  if (value === null) return "null";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  if (value && typeof value === "object") return "object";
  return "unknown";
}

function buildDevRecordDraftPrompt(
  sourceKey: string,
  userText: string,
  currentRecord: Record<string, unknown>,
) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) throw new Error(`Unknown dev source: ${sourceKey}`);

  const baseRecord = {
    ...(source.defaultRecord || {}),
    ...(source.fixedValues || {}),
  };

  const fieldGuide = Object.entries(baseRecord)
    .map(([key, value]) => `- ${key}: ${inferDraftFieldType(value)}`)
    .join("\n");

  return `You convert natural-language design notes into ONE valid JSON object for a game database editor.

Target source:
- key: ${source.key}
- label: ${source.label}
- description: ${source.description}
- table: ${source.table}

Rules:
- Return ONLY a JSON object.
- Use exactly the field names from the schema below.
- Keep the output practical for direct database editing.
- Preserve fixed values exactly where provided.
- Fill missing text with concise useful defaults.
- Keep arrays as arrays and nested objects as objects.
- Do not include markdown, comments, or explanation text.
- Do not invent extra top-level fields outside the schema.

Field schema:
${fieldGuide}

Default record example:
${JSON.stringify(baseRecord, null, 2)}

Current editor JSON:
${JSON.stringify(currentRecord || {}, null, 2)}

User brief:
${userText}`;
}

function normalizeAIDraftRecord(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4 || value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return normalizeAIDraftRecord(JSON.parse(trimmed), depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 1) {
      return normalizeAIDraftRecord(value[0], depth + 1);
    }

    const firstObject = value.find(
      (entry) => entry && typeof entry === "object" && !Array.isArray(entry),
    );
    return firstObject ? normalizeAIDraftRecord(firstObject, depth + 1) : null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const unwrapKeys = ["record", "data", "result", "payload", "item", "entry", "object"];
  for (const key of unwrapKeys) {
    if (key in record) {
      const unwrapped = normalizeAIDraftRecord(record[key], depth + 1);
      if (unwrapped) return unwrapped;
    }
  }

  for (const key of ["records", "items", "entries", "results", "objects"]) {
    if (key in record) {
      const unwrapped = normalizeAIDraftRecord(record[key], depth + 1);
      if (unwrapped) return unwrapped;
    }
  }

  return record;
}

function coerceFieldByTemplate(
  value: unknown,
  template: unknown,
  fallbackValue: unknown,
): unknown {
  if (Array.isArray(template)) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return Array.isArray(fallbackValue) ? fallbackValue : template;
  }

  if (template && typeof template === "object") {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    return fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? fallbackValue
      : template;
  }

  if (typeof template === "number") {
    const nextNumber =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    return Number.isFinite(nextNumber)
      ? nextNumber
      : typeof fallbackValue === "number"
        ? fallbackValue
        : template;
  }

  if (typeof template === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return typeof fallbackValue === "boolean" ? fallbackValue : template;
  }

  if (typeof template === "string") {
    if (typeof value === "string") return value;
    if (value != null && !Array.isArray(value) && typeof value !== "object") {
      return String(value);
    }
    return typeof fallbackValue === "string" ? fallbackValue : template;
  }

  return value ?? fallbackValue ?? template;
}

function sanitizeDraftRecordForSource(
  sourceKey: string,
  record: Record<string, unknown>,
  currentRecord: Record<string, unknown>,
) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) return record;

  const template = {
    ...(source.defaultRecord || {}),
    ...(source.fixedValues || {}),
  };

  const sanitized = Object.fromEntries(
    Object.keys(template).map((key) => [
      key,
      coerceFieldByTemplate(record[key], template[key], currentRecord[key]),
    ]),
  ) as Record<string, unknown>;

  return {
    ...sanitized,
    ...(source.fixedValues || {}),
  };
}

function inferFallbackDraftRecord(
  sourceKey: string,
  promptText: string,
  currentRecord: Record<string, unknown>,
) {
  const source = getDevSourceConfig(sourceKey);
  if (!source) return currentRecord;

  const baseRecord = {
    ...(source.defaultRecord || {}),
    ...(source.fixedValues || {}),
    ...(currentRecord || {}),
  } as Record<string, unknown>;
  const text = promptText.trim();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] || "";

  const detectName = () => {
    const quoted = text.match(/"([^"]{2,80})"/);
    if (quoted) return quoted[1];
    const named = text.match(/\b(?:named|called)\s+([A-Z][A-Za-z' -]{1,80})/i);
    if (named) return named[1].trim();
    const titleish =
      firstLine &&
      !/[.:]/.test(firstLine) &&
      firstLine.length <= 80 &&
      /[A-Za-z]/.test(firstLine)
        ? firstLine
        : "";
    return titleish || String(baseRecord.name || baseRecord.title || "Draft Record");
  };

  const detectNumber = (field: string) => {
    const patterns: Record<string, RegExp[]> = {
      level: [/\blevel\s*(\d{1,3})/i, /\blv\.?\s*(\d{1,3})/i],
      danger_level: [/\bdanger(?:\s*level)?\s*(\d{1,2})/i, /\blv\.?\s*(\d{1,2})/i],
      spawn_rate: [/\bspawn(?:\s*rate)?\s*(0(?:\.\d+)?|1(?:\.0+)?)\b/i],
    };
    for (const pattern of patterns[field] || []) {
      const match = text.match(pattern);
      if (match) return Number(match[1]);
    }
    return undefined;
  };

  const detectEnum = (options: string[]) => {
    const lower = text.toLowerCase();
    return options.find((entry) => lower.includes(entry.toLowerCase()));
  };

  if ("name" in baseRecord) baseRecord.name = detectName();
  if ("title" in baseRecord && (!baseRecord.title || String(baseRecord.title).startsWith("New "))) {
    baseRecord.title = detectName();
  }
  if ("description" in baseRecord && text) {
    baseRecord.description =
      lines.slice(1).join(" ").trim() || firstLine || String(baseRecord.description || "");
  }
  if ("summary" in baseRecord && text) {
    baseRecord.summary = firstLine || String(baseRecord.summary || "");
  }
  if ("body_text" in baseRecord && text && !String(baseRecord.body_text || "").trim()) {
    baseRecord.body_text = text;
  }
  if ("dialogue_text" in baseRecord && text) {
    baseRecord.dialogue_text = text;
  }
  if ("content" in baseRecord && text) {
    baseRecord.content = text;
  }
  if ("danger_level" in baseRecord) {
    baseRecord.danger_level =
      detectNumber("danger_level") ?? Number(baseRecord.danger_level || 1);
  }
  if ("level" in baseRecord) {
    baseRecord.level = detectNumber("level") ?? Number(baseRecord.level || 1);
  }
  if ("spawn_rate" in baseRecord) {
    baseRecord.spawn_rate = detectNumber("spawn_rate") ?? Number(baseRecord.spawn_rate || 0.5);
  }
  if ("biome" in baseRecord) {
    baseRecord.biome =
      detectEnum([
        "forest",
        "swamp",
        "desert",
        "mountain",
        "coast",
        "tundra",
        "volcanic",
        "ruins",
        "cursed_land",
        "void",
      ]) || String(baseRecord.biome || "forest");
  }
  if ("rarity" in baseRecord) {
    baseRecord.rarity =
      detectEnum(["common", "uncommon", "rare", "elite", "legendary"]) ||
      String(baseRecord.rarity || "common");
  }
  if ("type" in baseRecord) {
    baseRecord.type =
      detectEnum([
        "beast",
        "undead",
        "humanoid",
        "construct",
        "spirit",
        "consumable",
        "material",
        "quest",
        "key",
      ]) || String(baseRecord.type || "");
  }
  if ("tags" in baseRecord && Array.isArray(baseRecord.tags)) {
    const extraTags = text.match(/\b[a-z][a-z0-9_-]{2,}\b/gi) || [];
    baseRecord.tags = Array.from(
      new Set([
        ...((baseRecord.tags as string[]) || []),
        ...extraTags.slice(0, 6).map((entry) => entry.toLowerCase()),
      ]),
    );
  }

  return sanitizeDraftRecordForSource(sourceKey, baseRecord, currentRecord);
}

function isDevPanelAuthorized(req: any) {
  if (!DEV_PANEL_KEY) return true;
  const providedKey =
    req.header("x-dev-key") ||
    req.query.devKey ||
    req.body?.devKey ||
    req.header("authorization")?.replace(/^Bearer\s+/i, "");
  return providedKey === DEV_PANEL_KEY;
}

function requireDevPanelAccess(req: any, res: any, next: any) {
  if (isDevPanelAuthorized(req)) {
    next();
    return;
  }
  res.status(401).json({
    success: false,
    error: "Dev panel key required",
    code: "DEV_PANEL_KEY_REQUIRED",
  });
}

// --- Monsters ---
router.post("/monster", async (req, res) => {
  const v = contentValidator.validateMonster(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createMonster(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/monsters", async (_req, res) => {
  try {
    res.json({ success: true, data: await getMonsters() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Items ---
router.post("/item", async (req, res) => {
  const v = contentValidator.validateItem(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createItem(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/items", async (_req, res) => {
  try {
    res.json({ success: true, data: await getItems() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Equipment ---
router.post("/equipment", async (req, res) => {
  const v = contentValidator.validateEquipment(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createEquipment(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/equipment", async (_req, res) => {
  try {
    res.json({ success: true, data: await getEquipment() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Maps ---
router.post("/map", async (req, res) => {
  const v = contentValidator.validateMap(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createMap(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/maps", async (_req, res) => {
  try {
    res.json({ success: true, data: await getMaps() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Spawn Points ---
router.post("/spawn", async (req, res) => {
  const v = contentValidator.validateSpawnPoint(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createSpawnPoint(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/spawns", async (req, res) => {
  try {
    const mapId = req.query.map_id as string | undefined;
    res.json({ success: true, data: await getSpawnPoints(mapId) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Dialogues ---
router.post("/dialogue", async (req, res) => {
  const v = contentValidator.validateDialogue(req.body);
  if (!v.valid) {
    res.status(400).json({ success: false, error: v.errors.join("; ") });
    return;
  }
  try {
    const result = await createDialogue(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router.get("/dialogues", async (_req, res) => {
  try {
    res.json({ success: true, data: await getDialogues() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === AI GENERATOR ===

// Set AI config (API key, model, baseUrl) at runtime
router.post("/ai/config", (req, res) => {
  const { apiKey, model, baseUrl, provider } = req.body;
  setAIConfig({ apiKey, model, baseUrl, provider });
  res.json({
    success: true,
    configured: isAIConfigured(),
    config: {
      provider: getAIConfig().provider,
      model: getAIConfig().model,
      baseUrl: getAIConfig().baseUrl,
    },
  });
});

router.get("/ai/config", (_req, res) => {
  const c = getAIConfig();
  res.json({
    success: true,
    configured: isAIConfigured(),
    provider: c.provider,
    model: c.model,
    baseUrl: c.baseUrl,
  });
});

// Generate content via AI
router.post("/ai/generate", async (req, res) => {
  const { type, context } = req.body;
  if (!type) {
    res.status(400).json({
      success: false,
      error: "type required (monster, item, region, dialogue, lore, skill)",
    });
    return;
  }
  if (type === "skill") {
    try {
      const interpretation = await worldGenerator.interpretSkill(
        String(context || "000000000"),
        { timeoutMs: 3200 },
      );
      res.json({
        success: true,
        data: interpretation.data,
        meta: {
          fallback: interpretation.fallback,
          cached: !!interpretation.cached,
          reason: interpretation.reason || null,
        },
      });
      return;
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
  }
  if (!isAIConfigured()) {
    res.status(400).json({
      success: false,
      error: "AI not configured. Set API key first via /dev/ai/config",
    });
    return;
  }
  try {
    const generated = await worldGenerator.generate(type, context);
    if (!generated) {
      res.status(500).json({ success: false, error: "AI generation failed" });
      return;
    }
    res.json({ success: true, data: generated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate and auto-insert content
router.post("/ai/generate-and-save", async (req, res) => {
  const { type, context } = req.body;
  if (!type || !isAIConfigured()) {
    res.status(400).json({
      success: false,
      error: "type required and AI must be configured",
    });
    return;
  }
  try {
    const generated = await worldGenerator.generate(type, context);
    if (!generated) {
      res.status(500).json({ success: false, error: "AI generation failed" });
      return;
    }

    let saved: any;
    if (type === "monster") {
      const v = contentValidator.validateMonster(generated);
      if (!v.valid) {
        res.json({ success: false, error: v.errors.join("; "), generated });
        return;
      }
      saved = await createMonster(generated);
    } else if (type === "item") {
      saved = await createItem(generated);
    } else if (type === "dialogue") {
      saved = await createDialogue(generated);
    } else if (type === "region") {
      saved = await createMap(generated);
    }

    res.json({ success: true, data: { generated, saved } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- DEV PANEL UI ---
router.get("/", (req, res) => {
  res.redirect("/dev-panel");
});

router.get("/panel/status", (_req, res) => {
  res.json({
    success: true,
    data: {
      requiresKey: !!DEV_PANEL_KEY,
    },
  });
});

router.get("/panel/catalog", requireDevPanelAccess, async (req, res) => {
  try {
    const sortOrder = getRequestedSortOrder(req.query.sort);
    const data = await getDevPanelCatalog(sortOrder);
    res.json({ success: true, data, sort: sortOrder });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/panel/source/:sourceKey", requireDevPanelAccess, async (req, res) => {
  try {
    const sortOrder = getRequestedSortOrder(req.query.sort);
    const data = await getSourceSnapshot(req.params.sourceKey, sortOrder);
    res.json({ success: true, data, sort: sortOrder });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/panel/assets/workbench", requireDevPanelAccess, async (req, res) => {
  try {
    const sortOrder = getRequestedSortOrder(req.query.sort);
    const sources = await Promise.all(
      getAssetWorkbenchSourceConfigs().map((source) =>
        getSourceSnapshot(source.key, sortOrder),
      ),
    );
    res.json({
      success: true,
      data: {
        sort: sortOrder,
        sources,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/panel/assets/terrain-context", requireDevPanelAccess, async (_req, res) => {
  try {
    const [assets, audio, recipes] = await Promise.all([
      listTerrainFacingAssets(),
      listAudioAssetEntries(),
      listTerrainRecipeEntries(),
    ]);
    res.json({
      success: true,
      data: {
        assets,
        audio,
        recipes,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Could not load terrain asset context",
    });
  }
});

router.post("/panel/records/:sourceKey", requireDevPanelAccess, async (req, res) => {
  try {
    const record = await createSourceRecord(req.params.sourceKey, req.body.record || {});
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch(
  "/panel/records/:sourceKey/:recordId",
  requireDevPanelAccess,
  async (req, res) => {
    try {
      const record = await updateSourceRecord(
        req.params.sourceKey,
        req.params.recordId,
        req.body.record || {},
      );
      res.json({ success: true, data: record });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

router.delete(
  "/panel/records/:sourceKey/:recordId",
  requireDevPanelAccess,
  async (req, res) => {
    try {
      const data = await deleteSourceRecord(
        req.params.sourceKey,
        req.params.recordId,
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/panel/ai/draft/:sourceKey",
  requireDevPanelAccess,
  async (req, res) => {
    const sourceKey = req.params.sourceKey;
    const promptText = String(req.body?.promptText || "").trim();
    const currentRecord =
      req.body?.currentRecord &&
      typeof req.body.currentRecord === "object" &&
      !Array.isArray(req.body.currentRecord)
        ? req.body.currentRecord
        : {};

    if (!promptText) {
      res.status(400).json({ success: false, error: "promptText is required" });
      return;
    }

    if (!isAIConfigured()) {
      res.status(400).json({
        success: false,
        error: "AI not configured. Set API key first via /dev/ai/config",
      });
      return;
    }

    try {
      const prompt = `${buildDevRecordDraftPrompt(sourceKey, promptText, currentRecord)}

Additional hard rule:
- If the user describes multiple entries, still produce only ONE record for this source.
- Never nest sibling records under fields like maps, records, entries, or items unless that field already exists in the schema.`;
      const generated = await worldGenerator.generateFromPrompt(prompt, {
        systemMsg:
          "You are a database shaping assistant for a fantasy RPG tool. Return only one valid JSON object.",
        temperature: 0.35,
        maxTokens: 1800,
      });
      const record = normalizeAIDraftRecord(generated);

      if (!record) {
        throw new Error(
          `AI did not return a valid JSON object. Received ${Array.isArray(generated) ? "array" : typeof generated}.`,
        );
      }

      res.json({
        success: true,
        data: {
          record: sanitizeDraftRecordForSource(sourceKey, record, currentRecord),
        },
      });
    } catch (error: any) {
      const message = error.message || "Could not generate AI draft";
      if (/rate limit/i.test(message)) {
        res.json({
          success: true,
          data: {
            record: inferFallbackDraftRecord(sourceKey, promptText, currentRecord),
            fallback: true,
            warning:
              "AI rate limit hit. A local schema-safe draft was created from your text instead.",
          },
        });
        return;
      }
      res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  "/panel/assets/review",
  requireDevPanelAccess,
  async (req, res) => {
    const record =
      req.body?.record && typeof req.body.record === "object" && !Array.isArray(req.body.record)
        ? req.body.record
        : {};
    const filename = String(req.body?.filename || record.title || "").trim();
    const mimeType = String(
      req.body?.mimeType || record.mime_type || "application/octet-stream",
    ).trim();
    const dataUrl = String(
      req.body?.dataUrl || record.preview_url || record.file_url || "",
    ).trim();
    const sourceKey = String(req.body?.sourceKey || "").trim();

    if (!filename) {
      res.status(400).json({ success: false, error: "filename is required" });
      return;
    }

    try {
      const review = await reviewAssetAgainstFilename({
        filename,
        title: String(record.title || ""),
        sourceKey,
        mimeType,
        dataUrl,
        tags: Array.isArray(record.tags) ? record.tags.map((entry: unknown) => String(entry)) : [],
        metadata:
          record.metadata_json &&
          typeof record.metadata_json === "object" &&
          !Array.isArray(record.metadata_json)
            ? record.metadata_json
            : {},
      });

      res.json({
        success: true,
        data: review,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

router.post(
  "/panel/assets/slice-plan",
  requireDevPanelAccess,
  async (req, res) => {
    const record =
      req.body?.record && typeof req.body.record === "object" && !Array.isArray(req.body.record)
        ? req.body.record
        : {};
    const filename = String(req.body?.filename || record.title || "").trim();
    const mimeType = String(
      req.body?.mimeType || record.mime_type || "application/octet-stream",
    ).trim();
    const dataUrl = String(
      req.body?.dataUrl || record.preview_url || record.file_url || "",
    ).trim();
    const sourceKey = String(req.body?.sourceKey || "").trim();

    if (!filename) {
      res.status(400).json({ success: false, error: "filename is required" });
      return;
    }

    try {
      const plan = await planAssetSlicing({
        filename,
        title: String(record.title || ""),
        sourceKey,
        mimeType,
        dataUrl,
        tags: Array.isArray(record.tags) ? record.tags.map((entry: unknown) => String(entry)) : [],
        metadata:
          record.metadata_json &&
          typeof record.metadata_json === "object" &&
          !Array.isArray(record.metadata_json)
            ? record.metadata_json
            : {},
      });

      res.json({
        success: true,
        data: plan,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

export default router;
