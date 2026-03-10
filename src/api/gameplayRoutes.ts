// src/api/gameplayRoutes.ts
// Game Loop API: /start, /world, /event, /combat, /spawn, /save, /load

import { Router } from 'express';
import { createPlayer, createCharacter, getCharacter, getPlayerByUserId, deleteCharacter } from '../db/repositories.js';
import { worldSystem, SeededRNG } from '../core/worldSystem.js';
import { eventSystem } from '../core/eventSystem.js';
import { combatSystem } from '../core/combatSystem.js';
import { legendSystem } from '../core/legendSystem.js';
import { contentSpawner } from '../core/contentSpawner.js';
import { GameStateManager, GamePhase } from '../core/gameState.js';
import { supabase } from '../db/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import type { CharacterStats } from '../models/combatTypes.js';
import { getItems, getEquipment, getMonsters, getFactions, getMaps } from '../db/contentRepositories.js';

// --- /content endpoint for World Creation UI ---
const BIOME_LIST = [
    { id: 'forest', name: '🌲 Forest', description: 'Ancient trees teeming with creatures' },
    { id: 'desert', name: '🏜️ Desert', description: 'Scorched sands hiding deadly secrets' },
    { id: 'volcanic', name: '🌋 Volcanic', description: 'Molten rock and fire-born monsters' },
    { id: 'coast', name: '🌊 Coast', description: 'Sea shores with mysterious depths' },
    { id: 'mountain', name: '⛰️ Mountain', description: 'Jagged peaks above the clouds' },
    { id: 'ruins', name: '🏚️ Ruins', description: 'Fallen kingdoms with undead guardians' },
    { id: 'cursed_land', name: '💀 Cursed Land', description: 'Blighted realms of eternal darkness' },
    { id: 'swamp', name: '🌿 Swamp', description: 'Murky bogs hiding ancient horrors' },
];

const router = Router();

// In-memory session cache (still useful for local or warm-starts, but not relied upon)
const sessions = new Map<string, GameStateManager>();

/**
 * Retrieves the GameStateManager. If not in memory, reconstructs it from the database.
 * This makes the backend stateless and compatible with Vercel's serverless functions.
 */
async function getSession(characterId: string): Promise<GameStateManager | null> {
    if (sessions.has(characterId)) {
        return sessions.get(characterId)!;
    }

    const { data: save, error } = await supabase
        .from('player_states')
        .select('*')
        .eq('character_id', characterId)
        .single();

    if (error || !save) return null;

    const gsm = new GameStateManager(save.character_id, save.character_id, Number(save.world_seed));
    gsm.updateCharacter({
        hp: save.hp, maxHP: save.max_hp, mana: save.mana, maxMana: save.max_mana,
        exp: save.exp, level: save.level, gold: save.gold,
        characterName: save.character_name || 'Hero'
    });
    gsm.setLocation(save.current_region, save.current_map ?? undefined);

    // Refresh with actual DB equipment data
    const allEquipment = await getEquipment();
    gsm.refreshEffectiveStats(allEquipment);

    sessions.set(characterId, gsm);
    return gsm;
}

/**
 * Internal helper to persist state to Supabase.
 */
async function autoSave(characterId: string, lastLog?: string): Promise<void> {
    const gsm = await getSession(characterId);
    if (!gsm) return;

    const s = gsm.getState();
    const { error } = await supabase.from('player_states').upsert({
        character_id: s.characterId,
        current_region: s.regionIndex,
        current_map: s.mapId,
        hp: s.hp, mana: s.mana, max_hp: s.maxHP, max_mana: s.maxMana,
        exp: s.exp, level: s.level, gold: s.gold,
        inventory_json: s.inventory,
        equipment_json: s.equipment,
        world_seed: s.worldSeed,
        phase: s.phase,
        character_name: s.characterName,
        last_action_log: lastLog || null,
        updated_at: new Date().toISOString()
    }, { onConflict: 'character_id' });

    if (error) console.error(`[AutoSave Error] ${characterId}:`, error.message);
}

// --- /start ---
router.post('/start', async (req, res) => {
    try {
        const { playerName, characterName, worldSeed, userId, email, signatureSkill, characterId } = req.body;

        // --- AUTH INTEGRATION ---
        let player;
        if (userId && email) {
            player = await getPlayerByUserId(userId);
            if (!player) {
                player = await createPlayer(playerName || 'Hero', userId, email);
            }
        } else {
            player = await createPlayer(playerName || 'Hero', null, 'guest@local');
        }

        let character;
        if (characterId) {
            // Load existing character from vault
            character = await getCharacter(characterId);
        } else {
            // Create new character (legacy flow)
            if (!characterName) {
                res.status(400).json({ success: false, error: 'characterName required for new character' }); return;
            }
            character = await createCharacter(player.id, characterName, {}, signatureSkill);
        }

        const seed = worldSeed ?? Math.floor(Math.random() * 999999999);
        const instance = await worldSystem.generateWorld(seed);

        // Create game state session
        const gsm = new GameStateManager(player.id, character.id, seed);
        gsm.updateCharacter({
            hp: character.hp, maxHP: character.maxHP, mana: character.mana, maxMana: character.maxMana,
            level: character.level, exp: 0, gold: 0,
            characterName: character.name,
            signatureSkill: character.skillData || signatureSkill
        });
        sessions.set(character.id, gsm);

        // Initial save
        await autoSave(character.id, 'Started a new adventure.');

        res.json({
            success: true,
            data: {
                playerId: player.id,
                characterId: character.id,
                worldSeed: seed,
                regions: instance.regions,
                state: gsm.getState()
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /characters (List characters in vault) ---
router.get('/characters', async (req, res) => {
    try {
        const { userId } = req.query;
        let player;
        if (userId) {
            player = await getPlayerByUserId(userId as string);
        } else {
            // Placeholder: for the prototype, just get the first player or use a guest ID
            // In a real app, this would be derived from the auth session
            const { data } = await supabase.from('players').select('id').limit(1).single();
            player = data;
        }

        if (!player) return res.json({ success: true, data: [] });

        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('player_id', player.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /character (Forge new legend) ---
router.post('/character', async (req, res) => {
    try {
        const { playerName, characterName, userId, email, signatureSkill } = req.body;
        if (!characterName) return res.status(400).json({ success: false, error: 'characterName required' });

        let player;
        if (userId && email) {
            player = await getPlayerByUserId(userId);
            if (!player) player = await createPlayer(playerName || 'Hero', userId, email);
        } else {
            // Find any guest player or create one
            const { data } = await supabase.from('players').select('*').eq('email', 'guest@local').limit(1).single();
            player = data || await createPlayer(playerName || 'Hero', null, 'guest@local');
        }

        const character = await createCharacter(player.id, characterName, {}, signatureSkill);
        res.json({ success: true, data: character });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /world ---
router.post('/world', async (req, res) => {
    try {
        const { seed } = req.body;
        if (!seed) { res.status(400).json({ success: false, error: 'seed required' }); return; }
        const instance = await worldSystem.generateWorld(seed);
        res.json({ success: true, data: { worldSeed: seed, regions: instance.regions } });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /content (for world creation UI) ---
router.get('/content', async (_req, res) => {
    try {
        const [monsters, factions, maps] = await Promise.all([
            getMonsters(),
            getFactions(),
            getMaps()
        ]);
        res.json({
            success: true,
            data: {
                biomes: BIOME_LIST,
                monsters: monsters.slice(0, 24), // top 24 for display
                factions,
                maps: maps.slice(0, 12),
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});


// --- /event ---
router.post('/event', async (req, res) => {
    try {
        const { characterId, regionIndex } = req.body;
        if (!characterId) { res.status(400).json({ success: false, error: 'characterId required' }); return; }

        const stats = await getCharacter(characterId);

        // Lazy-load session
        const gsm = await getSession(characterId);
        if (!gsm) { res.status(404).json({ success: false, error: 'No active session found. Please reload.' }); return; }

        let instance = worldSystem.getInstance();
        if (!instance) {
            // Hot-reload world instance if serverless function cold-started
            const seed = gsm.getState().worldSeed;
            instance = await worldSystem.generateWorld(seed);
        }

        const region = typeof regionIndex === 'number'
            ? instance.regions[regionIndex] ?? instance.getRandomRegion(new SeededRNG(Date.now()))
            : instance.getRandomRegion(new SeededRNG(Date.now()));

        const event = await eventSystem.generateEvent(stats, region);

        // Update game state session
        gsm.transition(GamePhase.EVENT);
        if (event.type === 'enemy_encounter') {
            gsm.transition(GamePhase.COMBAT);
        } else if (event.type === 'npc_encounter') {
            gsm.transition(GamePhase.DIALOGUE);
        } else if (event.type === 'rest_event') {
            const healLog = gsm.rest(event.restPercent || 0.25);
            event.restLog = healLog;
        }

        if (event.type === 'nothing' || event.type === 'treasure_found' || event.type === 'ambient_event' || event.type === 'rest_event') {
            gsm.transition(GamePhase.EXPLORING);
        }
        if (event.treasureGold) {
            gsm.updateCharacter({ gold: gsm.getState().gold + event.treasureGold });
        }

        // Auto-save after event
        await autoSave(characterId, event.description);

        res.json({ success: true, data: { ...event, gameState: gsm.getState() } });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /combat ---
router.post('/combat', async (req, res) => {
    try {
        const { characterId, enemyName, enemyLevel, regionIndex } = req.body;
        if (!characterId) { res.status(400).json({ success: false, error: 'characterId required' }); return; }

        const gsm = await getSession(characterId);
        if (!gsm) { res.status(404).json({ success: false, error: 'No active session' }); return; }

        let instance = worldSystem.getInstance();
        if (!instance) {
            instance = await worldSystem.generateWorld(gsm.getState().worldSeed);
        }
        const region = instance?.regions[regionIndex ?? 0];

        // Fetch equipment metadata to calculate bonuses
        const allEquipment = await getEquipment();
        const effectiveStats = gsm.getCharacterStats(allEquipment);

        // Use Content Spawner for DB-aware enemy creation
        let enemy: CharacterStats;
        if (region) {
            const encounter = await contentSpawner.generateEncounter(region, effectiveStats.level);
            enemy = encounter.enemy;
        } else {
            enemy = worldSystem.spawnEnemy(enemyName ?? 'Goblin', enemyLevel ?? effectiveStats.level);
        }

        // Map effectiveStats name if missing (CharacterStats has name, EffectiveStats adds baseStats)
        // gsm.getCharacterStats already handles this in the latest refactor

        const battleId = uuidv4();
        // Pack enemy into EffectiveStats for the new system
        const effEnemy = combatSystem.calculateEffectiveStats(enemy, []);

        const result = await combatSystem.executeFullCombat(effectiveStats, effEnemy, battleId);

        // EXP + Gold rewards on victory
        let expGain = 0;
        let goldGain = 0;
        if (result.winnerId === effectiveStats.id && gsm) {
            expGain = enemy.level * 10;
            goldGain = enemy.level * 5 + Math.floor(Math.random() * 20);
            const newExp = gsm.getState().exp + expGain;
            const newGold = gsm.getState().gold + goldGain;

            // Level up check
            let newLevel = gsm.getState().level;
            let remainingExp = newExp;
            while (remainingExp >= newLevel * 100) {
                remainingExp -= newLevel * 100;
                newLevel++;
            }

            if (newLevel > gsm.getState().level) {
                gsm.updateCharacter({
                    level: newLevel,
                    exp: remainingExp,
                    gold: newGold,
                    maxHP: 100 + (newLevel - 1) * 15,
                    maxMana: 50 + (newLevel - 1) * 8,
                    hp: 100 + (newLevel - 1) * 15, // Full heal on level up
                    mana: 50 + (newLevel - 1) * 8,
                });
            } else {
                gsm.updateCharacter({ exp: newExp, gold: newGold });
            }

            // Record legend for boss kills (high danger)
            if (region && region.dangerLevel >= 7) {
                const legendText = legendSystem.formatLegend(effectiveStats.name, 'defeated', enemy.name, region.name);
                try {
                    await legendSystem.recordLegend({
                        world_id: battleId, player_name: effectiveStats.name,
                        event_text: legendText, turn_number: result.turnCount,
                        region_name: region.name
                    });
                } catch { /* non-critical */ }
            }
            // Player died
            gsm.transition(GamePhase.DEAD);
        }

        // Auto-save after combat
        await autoSave(characterId, result.logs[result.logs.length - 1]);

        res.json({
            success: true,
            data: {
                battleId,
                winner: result.winnerId,
                turns: result.turnCount,
                logs: result.logs,
                rewards: { exp: expGain, gold: goldGain },
                gameState: gsm?.getState()
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /spawn ---
router.post('/spawn', async (req, res) => {
    try {
        const { name, level } = req.body;
        const enemy = worldSystem.spawnEnemy(name ?? 'Goblin', level ?? 1);
        res.json({ success: true, data: enemy });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /save ---
router.post('/save', async (req, res) => {
    try {
        const { characterId, log } = req.body;
        if (!characterId) { res.status(400).json({ success: false, error: 'characterId required' }); return; }

        await autoSave(characterId, log);
        res.json({ success: true, message: 'Game saved!' });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /load/list ---
router.get('/load/list/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        // In this implementation, character_id is tied to the player_id derived from the char name or we just list all
        // For simplicity, let's list all player states with character metadata
        const { data, error } = await supabase
            .from('player_states')
            .select('character_id, character_name, level, updated_at, last_action_log')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- /load/:characterId ---
router.get('/load/:characterId', async (req, res) => {
    try {
        const { characterId } = req.params;

        const { data, error } = await supabase
            .from('player_states')
            .select('*')
            .eq('character_id', characterId)
            .single();

        if (error || !data) { res.status(404).json({ success: false, error: 'No save found' }); return; }

        // Restore session
        const gsm = new GameStateManager(data.character_id, data.character_id, Number(data.world_seed));
        gsm.updateCharacter({
            hp: data.hp, maxHP: data.max_hp, mana: data.mana, maxMana: data.max_mana,
            exp: data.exp, level: data.level, gold: data.gold,
            characterName: data.character_name || 'Hero'
        });
        gsm.setLocation(data.current_region, data.current_map ?? undefined);

        // Refresh with actual DB equipment data if possible
        const allEquipment = await getEquipment();
        gsm.refreshEffectiveStats(allEquipment);

        sessions.set(characterId, gsm);

        // Regenerate world from saved seed
        const world = await worldSystem.generateWorld(Number(data.world_seed));

        res.json({
            success: true,
            data: {
                gameState: gsm.getState(),
                regions: world.regions
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// --- DELETE /load/:characterId ---
router.delete('/load/:characterId', async (req, res) => {
    try {
        const { characterId } = req.params;
        if (!characterId) {
            res.status(400).json({ success: false, error: 'characterId required' });
            return;
        }

        // Delete from DB (Repo handles characters table, which should cascade to player_states if set up, 
        // but let's be explicit and delete from characters which is the parent)
        await deleteCharacter(characterId);

        // Remove from in-memory sessions
        sessions.delete(characterId);

        res.json({ success: true, message: 'Character deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- /item/use ---
router.post('/item/use', async (req, res) => {
    try {
        const { characterId, itemId } = req.body;
        if (!characterId || !itemId) {
            res.status(400).json({ success: false, error: 'characterId and itemId required' }); return;
        }

        const gsm = await getSession(characterId);
        if (!gsm) { res.status(404).json({ success: false, error: 'No active session' }); return; }

        // Fetch item metadata from DB
        const allItems = await getItems();
        const item = allItems.find(i => i.id === itemId);
        if (!item) { res.status(404).json({ success: false, error: 'Item not found in database' }); return; }

        const log = gsm.useItem(item);
        if (!log) {
            res.status(400).json({ success: false, error: 'Could not use item (Not in inventory?)' }); return;
        }

        // Auto-save after item usage
        await autoSave(characterId, log);

        res.json({ success: true, message: log, gameState: gsm.getState() });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

export default router;
