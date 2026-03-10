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
    const { apiKey, model, baseUrl, provider } = req.body;
    setAIConfig({ apiKey, model, baseUrl, provider });
    res.json({ success: true, configured: isAIConfigured(), config: { provider: getAIConfig().provider, model: getAIConfig().model, baseUrl: getAIConfig().baseUrl } });
});

router.get('/ai/config', (_req, res) => {
    const c = getAIConfig();
    res.json({ success: true, configured: isAIConfigured(), provider: c.provider, model: c.model, baseUrl: c.baseUrl });
});

// Generate content via AI
router.post('/ai/generate', async (req, res) => {
    const { type, context } = req.body;
    if (!type) { res.status(400).json({ success: false, error: 'type required (monster, item, region, dialogue, lore, skill)' }); return; }
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

// --- DEV PANEL UI ---
router.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>RPG Dev Panel</title>
    <style>
        :root { --bg: #0a0e14; --surface: #12171f; --surface2: #1a2030; --text: #c8d3e0; --accent: #4fc3f7; --border: #1e2940; --green: #66bb6a; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); padding: 20px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h1 { font-size: 20px; margin-top: 0; color: var(--accent); display: flex; align-items: center; gap: 10px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 6px; }
        select, input { width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: inherit; box-sizing: border-box; }
        button { background: var(--accent); color: var(--bg); border: none; padding: 12px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; width: 100%; }
        button:hover { opacity: 0.9; }
        .preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .preset-btn { background: var(--surface2); color: var(--text); padding: 10px; border-radius: 6px; font-size: 11px; cursor: pointer; border: 1px solid var(--border); text-align: center; }
        .preset-btn:hover { border-color: var(--accent); }
        .status { margin-top: 15px; font-size: 13px; padding: 10px; border-radius: 6px; display: none; }
        .status.success { display: block; background: rgba(102, 187, 106, 0.1); color: var(--green); border: 1px solid rgba(102, 187, 106, 0.3); }
    </style>
</head>
<body>
    <div class="card">
        <h1>🛠 AI Content Generator Config</h1>
        <p style="font-size:13px; color:#888; margin-bottom:20px;">Choose a provider and set your API key to enable procedural content generation.</p>

        <label>1. Pick a Provider</label>
        <div class="preset-grid">
            <div class="preset-btn" onclick="applyPreset('gemini')">✨ Google Gemini (Free Tier)</div>
            <div class="preset-btn" onclick="applyPreset('groq')">⚡ Groq (Llama/Mixtral)</div>
            <div class="preset-btn" onclick="applyPreset('openrouter')">🌐 OpenRouter (Free Selection)</div>
            <div class="preset-btn" onclick="applyPreset('openai')">🤖 OpenAI (Standard)</div>
        </div>

        <form id="configForm">
            <div class="form-group">
                <label>Provider Type</label>
                <select id="provider" name="provider">
                    <option value="openai">OpenAI (Compatible)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                </select>
            </div>
            <div class="form-group">
                <label>API Key</label>
                <input type="password" id="apiKey" name="apiKey" placeholder="sk-..." required>
            </div>
            <div class="form-group">
                <label>Model Name</label>
                <input type="text" id="model" name="model" value="gpt-4o-mini" required>
            </div>
            <div class="form-group">
                <label>Base URL</label>
                <input type="text" id="baseUrl" name="baseUrl" value="https://api.openai.com/v1" required>
            </div>
            <button type="submit">💾 Save Configuration</button>
        </form>

        <div id="status" class="status"></div>
    </div>

    <script>
        const presets = {
            gemini: { provider: 'gemini', model: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
            groq: { provider: 'groq', model: 'llama3-8b-8192', baseUrl: 'https://api.groq.com/openai/v1' },
            openrouter: { provider: 'openrouter', model: 'google/gemini-pro-1.5-exp:free', baseUrl: 'https://openrouter.ai/api/v1' },
            openai: { provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' }
        };

        function applyPreset(id) {
            const p = presets[id];
            document.getElementById('provider').value = p.provider;
            document.getElementById('model').value = p.model;
            document.getElementById('baseUrl').value = p.baseUrl;
            document.getElementById('apiKey').focus();
        }

        // Load existing config
        fetch('/dev/ai/config')
            .then(r => r.json())
            .then(j => {
                if (j.configured) {
                    document.getElementById('model').value = j.model;
                    document.getElementById('baseUrl').value = j.baseUrl;
                    document.getElementById('apiKey').placeholder = "KEY ALREADY SET (Hidden)";
                }
            });

        document.getElementById('configForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            const res = await fetch('/dev/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            const status = document.getElementById('status');
            status.textContent = "✅ AI Configuration Saved Successfully! " + (result.configured ? "(Configured)" : "");
            status.className = "status success";
            setTimeout(() => status.style.display = 'none', 3000);
        };
    </script>
</body>
</html>
    `;
    res.send(html);
});

export default router;

