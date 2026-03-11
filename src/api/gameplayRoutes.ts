// src/api/gameplayRoutes.ts
// Game Loop API: /start, /world, /event, /combat, /spawn, /save, /load

import { Router } from "express";
import {
  createPlayer,
  createCharacter,
  getCharacter,
  getPlayerByUserId,
  getPlayerByEmail,
  deleteCharacter,
  saveCombatLog,
} from "../db/repositories.js";
import { worldSystem, SeededRNG } from "../core/worldSystem.js";
import { eventSystem } from "../core/eventSystem.js";
import { combatSystem } from "../core/combatSystem.js";
import { legendSystem } from "../core/legendSystem.js";
import { GameStateManager, GamePhase } from "../core/gameState.js";
import { supabase } from "../db/supabase.js";
import { v4 as uuidv4 } from "uuid";
import type { CharacterStats } from "../models/combatTypes.js";
import {
  getItems,
  getEquipment,
  getMonsters,
  getFactions,
  getMaps,
} from "../db/contentRepositories.js";

// --- /content endpoint for World Creation UI ---
const BIOME_LIST = [
  {
    id: "forest",
    name: "🌲 Forest",
    description: "Ancient trees teeming with creatures",
  },
  {
    id: "desert",
    name: "🏜️ Desert",
    description: "Scorched sands hiding deadly secrets",
  },
  {
    id: "volcanic",
    name: "🌋 Volcanic",
    description: "Molten rock and fire-born monsters",
  },
  {
    id: "coast",
    name: "🌊 Coast",
    description: "Sea shores with mysterious depths",
  },
  {
    id: "mountain",
    name: "⛰️ Mountain",
    description: "Jagged peaks above the clouds",
  },
  {
    id: "ruins",
    name: "🏚️ Ruins",
    description: "Fallen kingdoms with undead guardians",
  },
  {
    id: "cursed_land",
    name: "💀 Cursed Land",
    description: "Blighted realms of eternal darkness",
  },
  {
    id: "swamp",
    name: "🌿 Swamp",
    description: "Murky bogs hiding ancient horrors",
  },
];

const router = Router();

// In-memory session cache (still useful for local or warm-starts, but not relied upon)
const sessions = new Map<string, GameStateManager>();
const combatSessions = new Map<string, ActiveCombatSession>();

interface ActiveCombatSession {
  battleId: string;
  enemy: CharacterStats;
  turnCount: number;
  regionName: string;
  regionDangerLevel: number;
  logs: string[];
}

function getCombatOutcome(
  player: CharacterStats,
  enemy: CharacterStats,
): { isFinished: boolean; winnerId: string | null } {
  if (player.hp <= 0) return { isFinished: true, winnerId: enemy.id };
  if (enemy.hp <= 0) return { isFinished: true, winnerId: player.id };
  return { isFinished: false, winnerId: null };
}

async function finalizeCombat(
  gsm: GameStateManager,
  playerStats: CharacterStats,
  combat: ActiveCombatSession,
): Promise<{
  winnerId: string | null;
  rewards: { exp: number; gold: number };
}> {
  const outcome = getCombatOutcome(playerStats, combat.enemy);
  let expGain = 0;
  let goldGain = 0;

  if (!outcome.isFinished) {
    return { winnerId: null, rewards: { exp: 0, gold: 0 } };
  }

  if (outcome.winnerId === playerStats.id) {
    expGain = combat.enemy.level * 10;
    goldGain = combat.enemy.level * 5 + Math.floor(Math.random() * 20);
    const totalExp = gsm.getState().exp + expGain;
    const totalGold = gsm.getState().gold + goldGain;

    let newLevel = gsm.getState().level;
    let remainingExp = totalExp;
    while (remainingExp >= newLevel * 100) {
      remainingExp -= newLevel * 100;
      newLevel++;
    }

    if (newLevel > gsm.getState().level) {
      gsm.updateCharacter({
        level: newLevel,
        exp: remainingExp,
        gold: totalGold,
        maxHP: 100 + (newLevel - 1) * 15,
        maxMana: 50 + (newLevel - 1) * 8,
        hp: 100 + (newLevel - 1) * 15,
        mana: 50 + (newLevel - 1) * 8,
      });
    } else {
      gsm.updateCharacter({
        exp: totalExp,
        gold: totalGold,
        hp: Math.max(0, playerStats.hp),
        mana: playerStats.mana,
      });
    }

    gsm.transition(GamePhase.EXPLORING);

    if (combat.regionDangerLevel >= 7) {
      const legendText = legendSystem.formatLegend(
        playerStats.name,
        "defeated",
        combat.enemy.name,
        combat.regionName,
      );
      try {
        await legendSystem.recordLegend({
          world_id: combat.battleId,
          player_name: playerStats.name,
          event_text: legendText,
          turn_number: combat.turnCount,
          region_name: combat.regionName,
        });
      } catch {
        /* non-critical */
      }
    }
  } else {
    gsm.updateCharacter({ hp: 0, mana: playerStats.mana });
    gsm.transition(GamePhase.DEAD);
  }

  return { winnerId: outcome.winnerId, rewards: { exp: expGain, gold: goldGain } };
}

/**
 * Retrieves the GameStateManager. If not in memory, reconstructs it from the database.
 * This makes the backend stateless and compatible with Vercel's serverless functions.
 */
async function getSession(
  characterId: string,
): Promise<GameStateManager | null> {
  if (sessions.has(characterId)) {
    return sessions.get(characterId)!;
  }

  const { data: save, error } = await supabase
    .from("player_states")
    .select("*")
    .eq("character_id", characterId)
    .single();

  if (error || !save) return null;

  const gsm = new GameStateManager(
    save.character_id,
    save.character_id,
    Number(save.world_seed),
  );
  gsm.updateCharacter({
    hp: save.hp,
    maxHP: save.max_hp,
    mana: save.mana,
    maxMana: save.max_mana,
    exp: save.exp,
    level: save.level,
    gold: save.gold,
    characterName: save.character_name || "Hero",
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
  const { error } = await supabase.from("player_states").upsert(
    {
      character_id: s.characterId,
      current_region: s.regionIndex,
      current_map: s.mapId,
      hp: s.hp,
      mana: s.mana,
      max_hp: s.maxHP,
      max_mana: s.maxMana,
      exp: s.exp,
      level: s.level,
      gold: s.gold,
      inventory_json: s.inventory,
      equipment_json: s.equipment,
      world_seed: s.worldSeed,
      phase: s.phase,
      character_name: s.characterName,
      last_action_log: lastLog || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "character_id" },
  );

  if (error) console.error(`[AutoSave Error] ${characterId}:`, error.message);
}

// --- /start ---
router.post("/start", async (req, res) => {
  try {
    const {
      playerName,
      characterName,
      worldSeed,
      userId,
      email,
      signatureSkill,
      characterId,
      customSelection,
    } = req.body;

    // --- AUTH INTEGRATION ---
    let player;
    if (userId && email) {
      player = await getPlayerByUserId(userId);
      if (!player) {
        player = await createPlayer(playerName || "Hero", userId, email);
      }
    } else {
      player = await createPlayer(playerName || "Hero", null, "guest@local");
    }

    let character;
    if (characterId) {
      // Load existing character from vault
      character = await getCharacter(characterId);
    } else {
      // Create new character (legacy flow)
      if (!characterName) {
        res
          .status(400)
          .json({
            success: false,
            error: "characterName required for new character",
          });
        return;
      }
      character = await createCharacter(
        player.id,
        characterName,
        {},
        signatureSkill,
      );
    }

    const seed = worldSeed ?? Math.floor(Math.random() * 999999999);
    const instance = await worldSystem.generateWorld(seed, customSelection);

    // Create game state session
    const gsm = new GameStateManager(player.id, character.id, seed);
    gsm.updateCharacter({
      hp: character.hp,
      maxHP: character.maxHP,
      mana: character.mana,
      maxMana: character.maxMana,
      level: character.level,
      exp: 0,
      gold: 0,
      characterName: character.name,
      signatureSkill: character.skillData || signatureSkill,
    });
    sessions.set(character.id, gsm);

    // Initial save
    await autoSave(character.id, "Started a new adventure.");

    res.json({
      success: true,
      data: {
        playerId: player.id,
        characterId: character.id,
        worldSeed: seed,
        regions: instance.regions,
        state: gsm.getState(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /characters (List characters in vault) ---
router.get("/characters", async (req, res) => {
  try {
    const { userId, email } = req.query;
    let player;

    if (userId && userId !== "undefined") {
      player = await getPlayerByUserId(userId as string);
      if (!player && email && email !== "undefined") {
        player = await getPlayerByEmail(email as string);
      }
    } else if (email && email !== "undefined") {
      player = await getPlayerByEmail(email as string);
    } else {
      // Safer guest fallback: don't throw if players is empty
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (error) console.error("Guest lookup failed:", error);
      player = data;
    }

    if (!player) return res.json({ success: true, data: [] });

    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /character (Forge new legend) ---
router.post("/character", async (req, res) => {
  try {
    const { playerName, characterName, userId, email, signatureSkill } =
      req.body;
    if (!characterName)
      return res
        .status(400)
        .json({ success: false, error: "characterName required" });

    let player;
    if (userId && email) {
      player = await getPlayerByUserId(userId);
      if (!player) {
        player = await getPlayerByEmail(email);
      }
      if (!player)
        player = await createPlayer(playerName || "Hero", userId, email);
    } else if (email) {
      player = await getPlayerByEmail(email);
      if (!player)
        player = await createPlayer(playerName || "Hero", null, email);
    } else {
      // Find any guest player or create one
      const { data } = await supabase
        .from("players")
        .select("*")
        .eq("email", "guest@local")
        .limit(1)
        .single();
      player =
        data || (await createPlayer(playerName || "Hero", null, "guest@local"));
    }

    const character = await createCharacter(
      player.id,
      characterName,
      {},
      signatureSkill,
    );
    res.json({ success: true, data: character });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /world ---
router.post("/world", async (req, res) => {
  try {
    const { seed } = req.body;
    if (!seed) {
      res.status(400).json({ success: false, error: "seed required" });
      return;
    }
    const instance = await worldSystem.generateWorld(seed);
    res.json({
      success: true,
      data: { worldSeed: seed, regions: instance.regions },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /content (for world creation UI) ---
router.get("/content", async (_req, res) => {
  try {
    const [monsters, factions, maps] = await Promise.all([
      getMonsters(),
      getFactions(),
      getMaps(),
    ]);
    res.json({
      success: true,
      data: {
        biomes: BIOME_LIST,
        monsters: monsters.slice(0, 24), // top 24 for display
        factions,
        maps: maps.slice(0, 12),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /event ---
router.post("/event", async (req, res) => {
  try {
    const { characterId, regionIndex } = req.body;
    if (!characterId) {
      res.status(400).json({ success: false, error: "characterId required" });
      return;
    }

    const stats = await getCharacter(characterId);

    // Lazy-load session
    const gsm = await getSession(characterId);
    if (!gsm) {
      res
        .status(404)
        .json({
          success: false,
          error: "No active session found. Please reload.",
        });
      return;
    }

    let instance = worldSystem.getInstance();
    if (!instance) {
      // Hot-reload world instance if serverless function cold-started
      const seed = gsm.getState().worldSeed;
      instance = await worldSystem.generateWorld(seed);
    }

    const region =
      typeof regionIndex === "number"
        ? (instance.regions[regionIndex] ??
          instance.getRandomRegion(new SeededRNG(Date.now())))
        : instance.getRandomRegion(new SeededRNG(Date.now()));

    const event = await eventSystem.generateEvent(stats, region);

    // Update game state session
    gsm.transition(GamePhase.EVENT);
    if (event.type === "enemy_encounter") {
      gsm.transition(GamePhase.COMBAT);
      if (event.enemy) {
        const battleId = uuidv4();
        combatSessions.set(characterId, {
          battleId,
          enemy: { ...event.enemy },
          turnCount: 0,
          regionName: region.name,
          regionDangerLevel: region.dangerLevel,
          logs: [
            `You explore ${region.name}...`,
            `A ${event.enemy.name} (Lv.${event.enemy.level}) appears!`,
            `Choose your action.`,
          ],
        });
      }
    } else if (event.type === "npc_encounter") {
      gsm.transition(GamePhase.DIALOGUE);
    } else if (event.type === "rest_event") {
      const healLog = gsm.rest(event.restPercent || 0.25);
      event.restLog = healLog;
    }

    if (
      event.type === "nothing" ||
      event.type === "treasure_found" ||
      event.type === "ambient_event" ||
      event.type === "rest_event"
    ) {
      gsm.transition(GamePhase.EXPLORING);
    }
    if (event.treasureGold) {
      gsm.updateCharacter({ gold: gsm.getState().gold + event.treasureGold });
    }

    // Auto-save after event
    await autoSave(characterId, event.description);
    const activeCombat = combatSessions.get(characterId);
    res.json({
      success: true,
      data: {
        ...event,
        battleId: activeCombat?.battleId || null,
        combatLogs: activeCombat?.logs || [],
        gameState: gsm.getState(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /combat/turn ---
router.post("/combat/turn", async (req, res) => {
  try {
    const { characterId } = req.body;
    if (!characterId) {
      res.status(400).json({ success: false, error: "characterId required" });
      return;
    }

    const gsm = await getSession(characterId);
    if (!gsm) {
      res.status(404).json({ success: false, error: "No active session" });
      return;
    }

    const combat = combatSessions.get(characterId);
    if (!combat) {
      res.status(404).json({ success: false, error: "No active combat" });
      return;
    }

    const allEquipment = await getEquipment();
    const player = gsm.getCharacterStats(allEquipment);
    player.hp = gsm.getState().hp;
    player.mana = gsm.getState().mana;
    player.maxHP = gsm.getState().maxHP;
    player.maxMana = gsm.getState().maxMana;

    const enemy = combatSystem.calculateEffectiveStats(combat.enemy, []);
    enemy.hp = combat.enemy.hp;
    enemy.mana = combat.enemy.mana;

    const actors =
      player.speed >= enemy.speed
        ? [
            { kind: "player" as const, attacker: player, defender: enemy },
            { kind: "enemy" as const, attacker: enemy, defender: player },
          ]
        : [
            { kind: "enemy" as const, attacker: enemy, defender: player },
            { kind: "player" as const, attacker: player, defender: enemy },
          ];

    combat.turnCount += 1;
    const turnLogs: string[] = [`Turn ${combat.turnCount} begins.`];

    for (const actor of actors) {
      const currentOutcome = getCombatOutcome(player, enemy);
      if (currentOutcome.isFinished) break;

      const result = combatSystem.executeTurn(actor.attacker, actor.defender);
      actor.defender.hp = Math.max(0, actor.defender.hp - result.damage);
      turnLogs.push(
        `[Turn ${combat.turnCount}] ${actor.kind === "player" ? "You" : actor.attacker.name} attacks ${actor.kind === "player" ? actor.defender.name : "you"} for ${result.damage} damage!`,
      );
    }

    combat.enemy.hp = enemy.hp;
    combat.enemy.mana = enemy.mana;
    gsm.updateCharacter({ hp: player.hp, mana: player.mana });

    const outcome = await finalizeCombat(gsm, player, combat);
    combat.logs.push(...turnLogs);

    if (outcome.winnerId) {
      combat.logs.push(
        outcome.winnerId === player.id
          ? `Victory! ${combat.enemy.name} is defeated.`
          : `${combat.enemy.name} defeats you.`,
      );
      try {
        await saveCombatLog(combat.battleId, combat.logs.join("\n"));
      } catch (err) {
        console.error("Failed to save turn-based combat log:", err);
      }
      combatSessions.delete(characterId);
    }

    await autoSave(characterId, turnLogs[turnLogs.length - 1]);

    res.json({
      success: true,
      data: {
        battleId: combat.battleId,
        winner: outcome.winnerId,
        turns: combat.turnCount,
        logs: turnLogs,
        allLogs: combat.logs,
        rewards: outcome.rewards,
        enemy: {
          ...combat.enemy,
          hp: enemy.hp,
          maxHP: enemy.maxHP,
        },
        gameState: gsm.getState(),
        isFinished: !!outcome.winnerId,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /spawn ---
router.post("/spawn", async (req, res) => {
  try {
    const { name, level } = req.body;
    const enemy = worldSystem.spawnEnemy(name ?? "Goblin", level ?? 1);
    res.json({ success: true, data: enemy });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /save ---
router.post("/save", async (req, res) => {
  try {
    const { characterId, log } = req.body;
    if (!characterId) {
      res.status(400).json({ success: false, error: "characterId required" });
      return;
    }

    await autoSave(characterId, log);
    res.json({ success: true, message: "Game saved!" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /load/list ---
router.get("/load/list/:playerName", async (req, res) => {
  try {
    const { playerName } = req.params;
    // In this implementation, character_id is tied to the player_id derived from the char name or we just list all
    // For simplicity, let's list all player states with character metadata
    const { data, error } = await supabase
      .from("player_states")
      .select(
        "character_id, character_name, level, updated_at, last_action_log",
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /load/:characterId ---
router.get("/load/:characterId", async (req, res) => {
  try {
    const { characterId } = req.params;

    const { data, error } = await supabase
      .from("player_states")
      .select("*")
      .eq("character_id", characterId)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: "No save found" });
      return;
    }

    // Restore session
    const gsm = new GameStateManager(
      data.character_id,
      data.character_id,
      Number(data.world_seed),
    );
    gsm.updateCharacter({
      hp: data.hp,
      maxHP: data.max_hp,
      mana: data.mana,
      maxMana: data.max_mana,
      exp: data.exp,
      level: data.level,
      gold: data.gold,
      characterName: data.character_name || "Hero",
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
        regions: world.regions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- DELETE /load/:characterId ---
router.delete("/load/:characterId", async (req, res) => {
  try {
    const { characterId } = req.params;
    if (!characterId) {
      res.status(400).json({ success: false, error: "characterId required" });
      return;
    }

    // Delete from DB (Repo handles characters table, which should cascade to player_states if set up,
    // but let's be explicit and delete from characters which is the parent)
    await deleteCharacter(characterId);

    // Remove from in-memory sessions
    sessions.delete(characterId);

    res.json({ success: true, message: "Character deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /item/use ---
router.post("/item/use", async (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    if (!characterId || !itemId) {
      res
        .status(400)
        .json({ success: false, error: "characterId and itemId required" });
      return;
    }

    const gsm = await getSession(characterId);
    if (!gsm) {
      res.status(404).json({ success: false, error: "No active session" });
      return;
    }

    // Fetch item metadata from DB
    const allItems = await getItems();
    const item = allItems.find((i) => i.id === itemId);
    if (!item) {
      res
        .status(404)
        .json({ success: false, error: "Item not found in database" });
      return;
    }

    const log = gsm.useItem(item);
    if (!log) {
      res
        .status(400)
        .json({
          success: false,
          error: "Could not use item (Not in inventory?)",
        });
      return;
    }

    // Auto-save after item usage
    await autoSave(characterId, log);

    res.json({ success: true, message: log, gameState: gsm.getState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
