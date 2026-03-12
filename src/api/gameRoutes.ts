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

const router = Router();
const DEV_PANEL_KEY = process.env.DEV_PANEL_KEY || "";

function getRequestedSortOrder(value: unknown): DevSortOrder {
  return value === "oldest" ? "oldest" : "latest";
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

export default router;
