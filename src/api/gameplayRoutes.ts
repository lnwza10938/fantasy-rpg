// src/api/gameplayRoutes.ts
// Game Loop API: /start, /world, /event, /combat, /spawn, /save, /load

import { Router } from "express";
import crypto from "node:crypto";
import {
  createPlayer,
  createCharacter,
  getCharacter,
  getPlayerByUserId,
  getPlayerByEmail,
  deleteCharacter,
  saveCombatLog,
} from "../db/repositories.js";
import {
  deleteWorldDefinitionByCharacterId,
  getWorldDefinitionByCharacterId,
  listWorldDefinitionSummaries,
  upsertWorldDefinition,
} from "../db/worldDefinitionRepositories.js";
import { worldSystem } from "../core/worldSystem.js";
import { eventSystem } from "../core/eventSystem.js";
import { combatSystem } from "../core/combatSystem.js";
import { legendSystem } from "../core/legendSystem.js";
import { GameStateManager, GamePhase } from "../core/gameState.js";
import { worldPipelineCoordinator } from "../core/worldPipelines.js";
import {
  hydrateGameStateFromSave,
  mapSaveToWorldArchive,
  serializeSessionForSave,
} from "../core/sessionPersistence.js";
import {
  evaluatePathTraversal,
  formatTraversalBlockedReason,
  getPathBetweenRegions,
  getRegionById,
  getRegionIndexById,
  hydrateTraversalRuntimeState,
  syncTraversalKnowledge,
} from "../models/worldTraversal.js";
import type { WorldDefinition, WorldMapPath, WorldRegion } from "../models/worldTypes.js";
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
const INVITE_PREFIX = "invite:";
const INVITE_MIN_LENGTH = 8;
const INVITE_MAX_LENGTH = 64;

interface ActiveCombatSession {
  battleId: string;
  enemy: CharacterStats;
  turnCount: number;
  regionName: string;
  regionDangerLevel: number;
  logs: string[];
}

interface TravelResolution {
  pathId: string;
  kind: WorldMapPath["kind"];
  difficulty: number;
  description: string;
  hpLoss: number;
  manaLoss: number;
  newlyRevealedPathIds: string[];
  newlyDiscoveredRegionIds: string[];
}

function normalizeInviteCode(code: string): string {
  return code.trim();
}

function validateInviteCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(code);
}

function hashInviteCode(code: string): string {
  const pepper = process.env.INVITE_CODE_PEPPER || "fantasy-rpg-invite-pepper";
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${normalizeInviteCode(code)}`)
    .digest("hex");
}

function inviteEmailKey(code: string): string {
  return `${INVITE_PREFIX}${hashInviteCode(code)}`;
}

function invitePlayerName(code: string): string {
  return `Invite-${hashInviteCode(code).slice(0, 10)}`;
}

async function resolvePlayerFromRequest(params: {
  userId?: string | null;
  email?: string | null;
  inviteCode?: string | null;
  playerName?: string | null;
  createIfMissing?: boolean;
  allowGuestFallback?: boolean;
}) {
  const {
    userId,
    email,
    inviteCode,
    playerName,
    createIfMissing = false,
    allowGuestFallback = false,
  } = params;

  if (inviteCode) {
    if (!validateInviteCode(inviteCode)) {
      throw new Error(
        `Invite code must be ${INVITE_MIN_LENGTH}-${INVITE_MAX_LENGTH} characters and contain only letters, numbers, "_" or "-".`,
      );
    }

    const inviteEmail = inviteEmailKey(inviteCode);
    let player = await getPlayerByEmail(inviteEmail);
    if (!player && createIfMissing) {
      player = await createPlayer(
        playerName || invitePlayerName(inviteCode),
        null,
        inviteEmail,
      );
    }
    return player;
  }

  if (userId) {
    let player = await getPlayerByUserId(userId);
    if (!player && email) {
      player = await getPlayerByEmail(email);
    }
    if (!player && createIfMissing && email) {
      player = await createPlayer(playerName || "Hero", userId, email);
    }
    return player;
  }

  if (email) {
    let player = await getPlayerByEmail(email);
    if (!player && createIfMissing) {
      player = await createPlayer(playerName || "Hero", null, email);
    }
    return player;
  }

  if (allowGuestFallback) {
    let player = await getPlayerByEmail("guest@local");
    if (!player && createIfMissing) {
      player = await createPlayer(playerName || "Hero", null, "guest@local");
    }
    return player;
  }

  return null;
}

function getCombatOutcome(
  player: CharacterStats,
  enemy: CharacterStats,
): { isFinished: boolean; winnerId: string | null } {
  if (player.hp <= 0) return { isFinished: true, winnerId: enemy.id };
  if (enemy.hp <= 0) return { isFinished: true, winnerId: player.id };
  return { isFinished: false, winnerId: null };
}

function clampTravelLoss(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveTravelTransition(params: {
  gsm: GameStateManager;
  definition: WorldDefinition;
  path: WorldMapPath;
  fromRegion: WorldRegion;
  toRegion: WorldRegion;
}): TravelResolution {
  const { gsm, definition, path, fromRegion, toRegion } = params;
  const currentState = gsm.getState();
  const hpBefore = currentState.hp;
  const manaBefore = currentState.mana;
  let hpLoss = 0;
  let manaLoss = 0;
  let description = `The party travels from ${fromRegion.name} to ${toRegion.name}.`;

  if (path.kind === "hazard") {
    hpLoss = clampTravelLoss(
      Math.round(path.difficulty * 2.4) - currentState.level,
      2,
      18,
    );
    manaLoss = clampTravelLoss(
      Math.round(path.difficulty * 0.9) - Math.floor(currentState.level / 2),
      0,
      10,
    );
    description = `The hazardous route to ${toRegion.name} batters the party before the next encounter begins.`;
  } else if (path.kind === "secret") {
    manaLoss = clampTravelLoss(Math.round(path.difficulty * 0.5), 0, 4);
    description = `A concealed route unfolds between ${fromRegion.name} and ${toRegion.name}. The party slips through hidden ground.`;
  } else if (path.visibility === "fogged") {
    manaLoss = clampTravelLoss(Math.round(path.difficulty * 0.35), 0, 3);
    description = `The fog-laced road to ${toRegion.name} forces a cautious advance before the next event resolves.`;
  }

  if (hpLoss > 0 || manaLoss > 0) {
    gsm.updateCharacter({
      hp: Math.max(1, hpBefore - hpLoss),
      mana: Math.max(0, manaBefore - manaLoss),
    });
  }

  const beforeTraversal = gsm.getWorldState().traversal;
  const nextTraversal = syncTraversalKnowledge(definition, {
    ...beforeTraversal,
    currentRegionId: toRegion.id,
    traversedPathIds: [...beforeTraversal.traversedPathIds, path.id],
  });
  gsm.setTraversalState(nextTraversal);

  return {
    pathId: path.id,
    kind: path.kind,
    difficulty: path.difficulty,
    description,
    hpLoss,
    manaLoss,
    newlyRevealedPathIds: nextTraversal.revealedPathIds.filter(
      (pathId) => !beforeTraversal.revealedPathIds.includes(pathId),
    ),
    newlyDiscoveredRegionIds: nextTraversal.discoveredRegionIds.filter(
      (regionId) => !beforeTraversal.discoveredRegionIds.includes(regionId),
    ),
  };
}

async function finalizeCombat(
  gsm: GameStateManager,
  playerStats: CharacterStats,
  combat: ActiveCombatSession,
  definition?: WorldDefinition,
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
    if (gsm.getWorldState().traversal.currentRegionId) {
      gsm.markRegionCleared(gsm.getWorldState().traversal.currentRegionId!);
      if (definition) {
        gsm.setTraversalState(
          syncTraversalKnowledge(definition, gsm.getWorldState().traversal),
        );
      }
    }

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

  const storedWorld = await getWorldDefinitionByCharacterId(characterId);
  const gsm = hydrateGameStateFromSave(save, storedWorld?.metadata);

  // Refresh with actual DB equipment data
  const allEquipment = await getEquipment();
  gsm.refreshEffectiveStats(allEquipment);

  sessions.set(characterId, gsm);
  return gsm;
}

/**
 * Internal helper to persist state to Supabase.
 */
async function autoSave(characterId: string, lastLog?: string): Promise<{ success: boolean; revision: string | null }> {
  const gsm = await getSession(characterId);
  if (!gsm) return { success: false, revision: null };

  const session = gsm.getStructuredState();
  const payload = serializeSessionForSave(session, lastLog);
  const { error } = await supabase
    .from("player_states")
    .upsert(payload, { onConflict: "character_id" });

  if (error) {
    console.error(`[AutoSave Error] ${characterId}:`, error.message);
    return { success: false, revision: null };
  }
  return { success: true, revision: payload.updated_at };
}

async function persistCanonicalWorldForCharacter(params: {
  characterId: string;
  mode: "procedural" | "custom";
  definition: any;
  sourceLore?: string | null;
}) {
  return upsertWorldDefinition({
    characterId: params.characterId,
    mode: params.mode,
    definition: params.definition,
    sourceLore: params.sourceLore || null,
  });
}

async function restoreCanonicalWorldForCharacter(
  characterId: string,
  worldState: ReturnType<GameStateManager["getWorldState"]>,
) {
  const stored = await getWorldDefinitionByCharacterId(characterId);
  if (stored) {
    const instance = (await worldSystem.loadWorldDefinition(
      stored.definition,
    )).bindToCharacter(characterId);
    return {
      mode: stored.mode,
      definition: stored.definition,
      instance,
      stored: true,
    };
  }

  const pipeline = await worldPipelineCoordinator.generateFromStoredWorld({
    seed: worldState.seed,
    worldName: worldState.metadata.worldName,
    worldPreset: worldState.metadata.worldPreset,
    customBiomes: worldState.metadata.customBiomes,
    customMonsters: worldState.metadata.customMonsters,
  });

  await persistCanonicalWorldForCharacter({
    characterId,
    mode: pipeline.mode,
    definition: pipeline.definition,
  });
  pipeline.instance.bindToCharacter(characterId);

  return {
    mode: pipeline.mode,
    definition: pipeline.definition,
    instance: pipeline.instance,
    stored: false,
  };
}

function syncSessionTraversalToDefinition(
  gsm: GameStateManager,
  definition: any,
) {
  const worldState = gsm.getWorldState();
  const fallbackRegionId =
    worldState.location.regionId ||
    definition.regions[worldState.location.regionIndex]?.id ||
    definition.mapLayout.startRegionId ||
    definition.regions[0]?.id ||
    null;
  const traversal = hydrateTraversalRuntimeState(
    definition,
    worldState.traversal,
    fallbackRegionId,
  );
  const currentRegionIndex = Math.max(
    0,
    getRegionIndexById(definition, traversal.currentRegionId),
  );
  gsm.setTraversalState(traversal);
  gsm.setLocation(
    currentRegionIndex,
    worldState.location.mapId || undefined,
    traversal.currentRegionId,
  );
  return traversal;
}

router.post("/invite/login", async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== "string") {
      res.status(400).json({ success: false, error: "inviteCode required" });
      return;
    }

    const player = await resolvePlayerFromRequest({
      inviteCode,
      createIfMissing: true,
    });

    res.json({
      success: true,
      data: {
        playerId: player.id,
        profile: {
          id: null,
          email: null,
          isInvite: true,
          playerId: player.id,
          label: player.name,
        },
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- /start ---
router.post("/start", async (req, res) => {
  try {
    const {
      playerName,
      characterName,
      worldSeed,
      userId,
      email,
      inviteCode,
      signatureSkill,
      characterId,
      customSelection,
      worldName,
      worldPreset,
    } = req.body;

    // --- AUTH INTEGRATION ---
    const player = await resolvePlayerFromRequest({
      userId,
      email,
      inviteCode,
      playerName,
      createIfMissing: true,
      allowGuestFallback: true,
    });

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
    const pipeline = await worldPipelineCoordinator.generate({
      seed,
      worldName,
      worldPreset,
      customSelection,
    });
    const instance = pipeline.instance;
    instance.bindToCharacter(character.id);

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
    gsm.setWorldMeta(pipeline.context.metadata);
    instance.setMetadata(gsm.getWorldState().metadata);
    const startRegionId =
      instance.definition.mapLayout.startRegionId || instance.regions[0]?.id || null;
    const startRegionIndex = Math.max(
      0,
      getRegionIndexById(instance.definition, startRegionId),
    );
    if (startRegionId) {
      gsm.visitRegion(startRegionId, startRegionIndex);
    }
    sessions.set(character.id, gsm);

    const canonicalWorld = await persistCanonicalWorldForCharacter({
      characterId: character.id,
      mode: pipeline.mode,
      definition: instance.definition,
    });

    // Initial save
    await autoSave(character.id, "Started a new adventure.");

    res.json({
      success: true,
      data: {
        playerId: player.id,
        characterId: character.id,
        worldSeed: seed,
        regions: instance.regions,
        worldDefinition: canonicalWorld.definition,
        generationMode: pipeline.mode,
        state: gsm.getState(),
        structuredState: gsm.getStructuredState(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /characters (List characters in vault) ---
router.get("/characters", async (req, res) => {
  try {
    const { userId, email, inviteCode } = req.query;
    const player = await resolvePlayerFromRequest({
      userId: userId as string,
      email: email as string,
      inviteCode: inviteCode as string,
      allowGuestFallback: true,
    });

    if (!player) return res.json({ success: true, data: [] });

    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("player_id", player.id)
      .order("name", { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /character (Forge new legend) ---
router.post("/character", async (req, res) => {
  try {
    const {
      playerName,
      characterName,
      userId,
      email,
      inviteCode,
      signatureSkill,
    } =
      req.body;
    if (!characterName)
      return res
        .status(400)
        .json({ success: false, error: "characterName required" });

    const player = await resolvePlayerFromRequest({
      userId,
      email,
      inviteCode,
      playerName,
      createIfMissing: true,
      allowGuestFallback: true,
    });

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
    const { seed, worldName, worldPreset, customSelection, mode } = req.body;
    if (!seed) {
      res.status(400).json({ success: false, error: "seed required" });
      return;
    }
    const pipeline = await worldPipelineCoordinator.generate({
      seed: Number(seed),
      worldName,
      worldPreset,
      customSelection,
      mode,
    });
    res.json({
      success: true,
      data: {
        worldSeed: Number(seed),
        generationMode: pipeline.mode,
        worldDefinition: pipeline.definition,
        regions: pipeline.instance.regions,
      },
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
    const { characterId, regionIndex, regionId } = req.body;
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
    const worldState = gsm.getWorldState();
    const shouldRegenerateWorld =
      !instance ||
      instance.ownerCharacterId !== characterId ||
      instance.seed !== worldState.seed ||
      JSON.stringify(instance.metadata) !== JSON.stringify(worldState.metadata);

    if (shouldRegenerateWorld) {
      const restoredWorld = await restoreCanonicalWorldForCharacter(
        characterId,
        worldState,
      );
      instance = restoredWorld.instance;
    }
    if (!instance) {
      throw new Error("World instance could not be restored for this session.");
    }

    const traversal = syncSessionTraversalToDefinition(gsm, instance.definition);
    const currentRegionId =
      traversal.currentRegionId || instance.definition.mapLayout.startRegionId;
    const currentRegion =
      getRegionById(instance.definition, currentRegionId) ||
      instance.regions[Math.max(0, gsm.getWorldState().location.regionIndex)] ||
      instance.regions[0];

    const region =
      getRegionById(instance.definition, regionId) ||
      (typeof regionIndex === "number" ? instance.regions[regionIndex] : null) ||
      currentRegion;

    if (!region) {
      res.status(400).json({ success: false, error: "No region available" });
      return;
    }

    const targetRegionIndex = Math.max(
      0,
      getRegionIndexById(instance.definition, region.id),
    );
    let travel: TravelResolution | null = null;
    let selectedPath: WorldMapPath | null = null;

    if (currentRegion && region.id !== currentRegion.id) {
      selectedPath = getPathBetweenRegions(
        instance.definition,
        currentRegion.id,
        region.id,
      );

      if (!selectedPath) {
        res.status(400).json({
          success: false,
          error: formatTraversalBlockedReason("Path is not adjacent"),
        });
        return;
      }

      const pathEvaluation = evaluatePathTraversal(
        instance.definition,
        traversal,
        selectedPath,
        gsm.getState().level,
      );
      if (!pathEvaluation.traversable) {
        res.status(400).json({
          success: false,
          error: formatTraversalBlockedReason(pathEvaluation.blockedReason),
        });
        return;
      }

      gsm.visitRegion(region.id, targetRegionIndex);
      travel = resolveTravelTransition({
        gsm,
        definition: instance.definition,
        path: selectedPath,
        fromRegion: currentRegion,
        toRegion: region,
      });
    } else {
      gsm.visitRegion(region.id, targetRegionIndex);
      gsm.setTraversalState(
        syncTraversalKnowledge(instance.definition, gsm.getWorldState().traversal),
      );
    }

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
            ...(travel
              ? [
                  travel.description,
                  ...(travel.hpLoss > 0 || travel.manaLoss > 0
                    ? [
                        `Travel toll: -${travel.hpLoss} HP, -${travel.manaLoss} MP.`,
                      ]
                    : []),
                ]
              : []),
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
    await autoSave(characterId, travel?.description || event.description);
    const activeCombat = combatSessions.get(characterId);
    res.json({
      success: true,
      data: {
        ...event,
        travel,
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

    const traversalBeforeCombat = gsm.getWorldState().traversal;
    const outcome = await finalizeCombat(
      gsm,
      player,
      combat,
      worldSystem.getInstance()?.definition,
    );
    const traversalAfterCombat = gsm.getWorldState().traversal;
    const newlyRevealedPaths = traversalAfterCombat.revealedPathIds.filter(
      (pathId) => !traversalBeforeCombat.revealedPathIds.includes(pathId),
    );
    const newlyDiscoveredRegions = traversalAfterCombat.discoveredRegionIds.filter(
      (regionId) => !traversalBeforeCombat.discoveredRegionIds.includes(regionId),
    );
    if (newlyRevealedPaths.length > 0) {
      turnLogs.push(`New routes revealed: ${newlyRevealedPaths.length}.`);
    }
    if (newlyDiscoveredRegions.length > 0) {
      turnLogs.push(`New regions sighted: ${newlyDiscoveredRegions.length}.`);
    }
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

    const result = await autoSave(characterId, log);
    res.json({ 
      success: result.success, 
      message: result.success ? "Game saved!" : "Save operation failed",
      revision: result.revision 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /session/validate ---
router.get("/session/validate", async (req, res) => {
  try {
    const { characterId, revision } = req.query;
    if (!characterId) {
      return res.status(400).json({ success: false, error: "characterId required" });
    }

    const { data, error } = await supabase
      .from("player_states")
      .select("updated_at")
      .eq("character_id", characterId)
      .single();

    if (error || !data) {
      return res.json({ success: true, outOfSync: false });
    }

    const serverRevision = data.updated_at;
    const isOutOfSync = revision && revision !== serverRevision;

    res.json({
      success: true,
      outOfSync: !!isOutOfSync,
      revision: serverRevision
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- /load/list ---
router.get("/load/list/:playerName", async (req, res) => {
  try {
    const { userId, email, inviteCode } = req.query;
    const player = await resolvePlayerFromRequest({
      userId: userId as string,
      email: email as string,
      inviteCode: inviteCode as string,
      allowGuestFallback: true,
    });

    if (!player) {
      res.json({ success: true, data: [] });
      return;
    }

    const { data: characters, error: characterError } = await supabase
      .from("characters")
      .select("id")
      .eq("player_id", player.id);

    if (characterError) throw characterError;
    const characterIds = (characters || []).map((c: any) => c.id);
    if (characterIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const { data, error } = await supabase
      .from("player_states")
      .select(
        "character_id, character_name, level, updated_at, last_action_log",
      )
      .in("character_id", characterIds)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/worlds", async (req, res) => {
  try {
    const { userId, email, inviteCode } = req.query;
    const player = await resolvePlayerFromRequest({
      userId: userId as string,
      email: email as string,
      inviteCode: inviteCode as string,
      allowGuestFallback: true,
    });

    if (!player) {
      res.json({ success: true, data: [] });
      return;
    }

    const { data: characters, error: characterError } = await supabase
      .from("characters")
      .select("id, name")
      .eq("player_id", player.id);

    if (characterError) throw characterError;

    const characterMap = new Map(
      (characters || []).map((character: any) => [character.id, character.name]),
    );
    const characterIds = Array.from(characterMap.keys());
    if (characterIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const { data: saves, error: saveError } = await supabase
      .from("player_states")
      .select(
        "character_id, character_name, world_seed, current_region, updated_at, phase, last_action_log, last_event",
      )
      .in("character_id", characterIds)
      .order("updated_at", { ascending: false });

    if (saveError) throw saveError;

    const definitionSummaryMap = await listWorldDefinitionSummaries(characterIds);
    const worlds = (saves || []).map((save: any) =>
      mapSaveToWorldArchive(
        save,
        characterMap.get(save.character_id) || undefined,
        definitionSummaryMap.get(save.character_id)?.metadata,
      ),
    );

    res.json({ success: true, data: worlds });
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

    const storedWorld = await getWorldDefinitionByCharacterId(characterId);

    // Restore session
    const gsm = hydrateGameStateFromSave(data, storedWorld?.metadata);

    // Refresh with actual DB equipment data if possible
    const allEquipment = await getEquipment();
    gsm.refreshEffectiveStats(allEquipment);

    sessions.set(characterId, gsm);

    const restoredWorld = await restoreCanonicalWorldForCharacter(
      characterId,
      gsm.getWorldState(),
    );
    const world = restoredWorld.instance;
    syncSessionTraversalToDefinition(gsm, restoredWorld.definition);

    res.json({
      success: true,
      data: {
        gameState: gsm.getState(),
        structuredState: gsm.getStructuredState(),
        worldDefinition: restoredWorld.definition,
        generationMode: restoredWorld.mode,
        regions: world.regions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/worlds/:characterId", async (req, res) => {
  try {
    const { characterId } = req.params;
    const { userId, email, inviteCode } = req.body || {};
    if (!characterId) {
      res.status(400).json({ success: false, error: "characterId required" });
      return;
    }

    const player = await resolvePlayerFromRequest({
      userId,
      email,
      inviteCode,
      allowGuestFallback: true,
    });
    if (!player) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { data: ownedCharacter, error: characterError } = await supabase
      .from("characters")
      .select("id")
      .eq("id", characterId)
      .eq("player_id", player.id)
      .maybeSingle();

    if (characterError) throw characterError;
    if (!ownedCharacter) {
      res.status(403).json({ success: false, error: "World access denied" });
      return;
    }

    const { error } = await supabase
      .from("player_states")
      .delete()
      .eq("character_id", characterId);

    if (error) throw error;
    await deleteWorldDefinitionByCharacterId(characterId);

    sessions.delete(characterId);
    combatSessions.delete(characterId);

    res.json({ success: true, message: "World deleted successfully" });
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
