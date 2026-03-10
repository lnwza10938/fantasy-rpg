// src/api/gameRoutes.ts
// Developer API routes for content management + AI generation

import { Router } from 'express';
import {
    createMonster, getMonsters,
    createItem, getItems,
    createEquipment, getEquipment,
    createMap, getMaps,
    createSpawnPoint, getSpawnPoints,
    createDialogue, getDialogues
} from '../db/contentRepositories.js';
import { contentValidator } from '../core/contentValidator.js';
import { worldGenerator, setAIConfig, getAIConfig, isAIConfigured } from '../core/worldGenerator.js';

const router = Router();

// --- Monsters ---
router.post('/monster', async (req, res) => {
    const v = contentValidator.validateMonster(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createMonster(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/monsters', async (_req, res) => {
    try { res.json({ success: true, data: await getMonsters() }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- Items ---
router.post('/item', async (req, res) => {
    const v = contentValidator.validateItem(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createItem(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/items', async (_req, res) => {
    try { res.json({ success: true, data: await getItems() }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- Equipment ---
router.post('/equipment', async (req, res) => {
    const v = contentValidator.validateEquipment(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createEquipment(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/equipment', async (_req, res) => {
    try { res.json({ success: true, data: await getEquipment() }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- Maps ---
router.post('/map', async (req, res) => {
    const v = contentValidator.validateMap(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createMap(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/maps', async (_req, res) => {
    try { res.json({ success: true, data: await getMaps() }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- Spawn Points ---
router.post('/spawn', async (req, res) => {
    const v = contentValidator.validateSpawnPoint(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createSpawnPoint(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/spawns', async (req, res) => {
    try {
        const mapId = req.query.map_id as string | undefined;
        res.json({ success: true, data: await getSpawnPoints(mapId) });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- Dialogues ---
router.post('/dialogue', async (req, res) => {
    const v = contentValidator.validateDialogue(req.body);
    if (!v.valid) { res.status(400).json({ success: false, error: v.errors.join('; ') }); return; }
    try {
        const result = await createDialogue(req.body);
        res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err.message }); }
});
router.get('/dialogues', async (_req, res) => {
    try { res.json({ success: true, data: await getDialogues() }); }
    catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// === AI GENERATOR ===

// Set AI config (API key, model, baseUrl) at runtime
router.post('/ai/config', (req, res) => {
    const { apiKey, model, baseUrl } = req.body;
    setAIConfig({ apiKey, model, baseUrl });
    res.json({ success: true, configured: isAIConfigured(), config: { model: getAIConfig().model, baseUrl: getAIConfig().baseUrl } });
});

router.get('/ai/config', (_req, res) => {
    const c = getAIConfig();
    res.json({ success: true, configured: isAIConfigured(), model: c.model, baseUrl: c.baseUrl });
});

// Generate content via AI
router.post('/ai/generate', async (req, res) => {
    const { type, context } = req.body;
    if (!type) { res.status(400).json({ success: false, error: 'type required (monster, item, region, dialogue, lore)' }); return; }
    if (!isAIConfigured()) { res.status(400).json({ success: false, error: 'AI not configured. Set API key first via /dev/ai/config' }); return; }
    try {
        const generated = await worldGenerator.generate(type, context);
        if (!generated) { res.status(500).json({ success: false, error: 'AI generation failed' }); return; }
        res.json({ success: true, data: generated });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// Generate and auto-insert content
router.post('/ai/generate-and-save', async (req, res) => {
    const { type, context } = req.body;
    if (!type || !isAIConfigured()) { res.status(400).json({ success: false, error: 'type required and AI must be configured' }); return; }
    try {
        const generated = await worldGenerator.generate(type, context);
        if (!generated) { res.status(500).json({ success: false, error: 'AI generation failed' }); return; }

        let saved: any;
        if (type === 'monster') {
            const v = contentValidator.validateMonster(generated);
            if (!v.valid) { res.json({ success: false, error: v.errors.join('; '), generated }); return; }
            saved = await createMonster(generated);
        } else if (type === 'item') {
            saved = await createItem(generated);
        } else if (type === 'dialogue') {
            saved = await createDialogue(generated);
        } else if (type === 'region') {
            saved = await createMap(generated);
        }

        res.json({ success: true, data: { generated, saved } });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

export default router;

