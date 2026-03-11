// src/core/gameState.ts
// Game State Manager — tracks the current state of a play session

import { combatSystem } from "./combatSystem.js";
import type { EffectiveStats } from "../models/combatTypes.js";
import type {
  WorldLocationState,
  WorldMetadata,
} from "../models/worldTypes.js";
import { normalizeWorldMetadata } from "../models/worldTypes.js";

export enum GamePhase {
  IDLE = "IDLE",
  EXPLORING = "EXPLORING",
  EVENT = "EVENT",
  COMBAT = "COMBAT",
  DIALOGUE = "DIALOGUE",
  LOOT = "LOOT",
  INVENTORY = "INVENTORY",
  DEAD = "DEAD",
}

export interface GameStateData {
  phase: GamePhase;
  playerId: string;
  characterId: string;
  worldSeed: number;
  worldName: string;
  worldPreset: string;
  customBiomes: string[];
  customMonsters: string[];
  regionIndex: number;
  mapId: string | null;
  eventId: string | null;
  combatId: string | null;

  // Live character state
  hp: number;
  maxHP: number;
  mana: number;
  maxMana: number;
  exp: number;
  level: number;
  gold: number;

  // Inventory & equipment
  inventory: InventorySlot[];
  equipment: EquipmentSlots;

  // Metadata
  characterName: string;
  effectiveStats: EffectiveStats;

  // AI Signature Skill
  signatureSkill?: any;
}

export interface InventorySlot {
  itemId: string;
  qty: number;
}

export interface EquipmentSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

export interface WorldSessionState {
  seed: number;
  metadata: WorldMetadata;
  location: WorldLocationState;
}

export interface RuntimeCharacterState {
  hp: number;
  maxHP: number;
  mana: number;
  maxMana: number;
  exp: number;
  level: number;
  gold: number;
  characterName: string;
  effectiveStats: EffectiveStats;
  signatureSkill?: any;
}

export interface RuntimeInventoryState {
  inventory: InventorySlot[];
  equipment: EquipmentSlots;
}

export interface RuntimeGameState
  extends RuntimeCharacterState,
    RuntimeInventoryState {}

export interface StructuredGameStateData {
  phase: GamePhase;
  playerId: string;
  characterId: string;
  world: WorldSessionState;
  runtime: RuntimeGameState;
}

// Valid state transitions
const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  [GamePhase.IDLE]: [GamePhase.EXPLORING],
  [GamePhase.EXPLORING]: [GamePhase.EVENT, GamePhase.INVENTORY, GamePhase.IDLE],
  [GamePhase.EVENT]: [
    GamePhase.COMBAT,
    GamePhase.DIALOGUE,
    GamePhase.LOOT,
    GamePhase.EXPLORING,
  ],
  [GamePhase.COMBAT]: [GamePhase.LOOT, GamePhase.DEAD, GamePhase.EXPLORING],
  [GamePhase.DIALOGUE]: [GamePhase.EXPLORING, GamePhase.EVENT],
  [GamePhase.LOOT]: [GamePhase.EXPLORING, GamePhase.INVENTORY],
  [GamePhase.INVENTORY]: [GamePhase.EXPLORING, GamePhase.IDLE],
  [GamePhase.DEAD]: [GamePhase.IDLE],
};

export class GameStateManager {
  private phase: GamePhase;
  private readonly identity: { playerId: string; characterId: string };
  private worldState: WorldSessionState;
  private runtimeState: RuntimeGameState;

  constructor(playerId: string, characterId: string, worldSeed: number) {
    this.phase = GamePhase.IDLE;
    this.identity = { playerId, characterId };
    this.worldState = {
      seed: worldSeed,
      metadata: normalizeWorldMetadata(undefined, worldSeed),
      location: {
        regionIndex: 0,
        mapId: null,
        eventId: null,
        combatId: null,
      },
    };
    this.runtimeState = {
      hp: 100,
      maxHP: 100,
      mana: 50,
      maxMana: 50,
      exp: 0,
      level: 1,
      gold: 0,
      inventory: [],
      equipment: { weapon: null, armor: null, accessory: null },
      characterName: "Unknown Hero",
      effectiveStats: {
        id: characterId,
        name: "Hero",
        level: 1,
        hp: 100,
        maxHP: 100,
        mana: 50,
        maxMana: 50,
        attack: 12,
        defense: 6,
        speed: 10,
        skillMain: 111111111,
        baseStats: {
          id: characterId,
          name: "Hero",
          level: 1,
          hp: 100,
          maxHP: 100,
          mana: 50,
          maxMana: 50,
          attack: 12,
          defense: 6,
          speed: 10,
          skillMain: 111111111,
        },
        modifiers: {
          attackBonus: 0,
          defenseBonus: 0,
          speedBonus: 0,
          hpBonus: 0,
        },
      },
    };
  }

  public getState(): Readonly<GameStateData> {
    return {
      phase: this.phase,
      playerId: this.identity.playerId,
      characterId: this.identity.characterId,
      worldSeed: this.worldState.seed,
      worldName: this.worldState.metadata.worldName,
      worldPreset: this.worldState.metadata.worldPreset,
      customBiomes: [...this.worldState.metadata.customBiomes],
      customMonsters: [...this.worldState.metadata.customMonsters],
      regionIndex: this.worldState.location.regionIndex,
      mapId: this.worldState.location.mapId,
      eventId: this.worldState.location.eventId,
      combatId: this.worldState.location.combatId,
      hp: this.runtimeState.hp,
      maxHP: this.runtimeState.maxHP,
      mana: this.runtimeState.mana,
      maxMana: this.runtimeState.maxMana,
      exp: this.runtimeState.exp,
      level: this.runtimeState.level,
      gold: this.runtimeState.gold,
      inventory: this.runtimeState.inventory.map((slot) => ({ ...slot })),
      equipment: { ...this.runtimeState.equipment },
      characterName: this.runtimeState.characterName,
      effectiveStats: this.runtimeState.effectiveStats,
      signatureSkill: this.runtimeState.signatureSkill,
    };
  }

  public getWorldState(): Readonly<WorldSessionState> {
    return {
      seed: this.worldState.seed,
      metadata: {
        worldName: this.worldState.metadata.worldName,
        worldPreset: this.worldState.metadata.worldPreset,
        customBiomes: [...this.worldState.metadata.customBiomes],
        customMonsters: [...this.worldState.metadata.customMonsters],
      },
      location: { ...this.worldState.location },
    };
  }

  public getRuntimeState(): Readonly<RuntimeGameState> {
    return {
      hp: this.runtimeState.hp,
      maxHP: this.runtimeState.maxHP,
      mana: this.runtimeState.mana,
      maxMana: this.runtimeState.maxMana,
      exp: this.runtimeState.exp,
      level: this.runtimeState.level,
      gold: this.runtimeState.gold,
      inventory: this.runtimeState.inventory.map((slot) => ({ ...slot })),
      equipment: { ...this.runtimeState.equipment },
      characterName: this.runtimeState.characterName,
      effectiveStats: this.runtimeState.effectiveStats,
      signatureSkill: this.runtimeState.signatureSkill,
    };
  }

  public getStructuredState(): Readonly<StructuredGameStateData> {
    return {
      phase: this.phase,
      playerId: this.identity.playerId,
      characterId: this.identity.characterId,
      world: this.getWorldState(),
      runtime: this.getRuntimeState(),
    };
  }
  public getPhase(): GamePhase {
    return this.phase;
  }

  /** Transition to a new phase with validation */
  public transition(to: GamePhase): boolean {
    const allowed = TRANSITIONS[this.phase];
    if (!allowed.includes(to)) return false;
    this.phase = to;
    return true;
  }

  /** Update live character values */
  public updateCharacter(
    updates: Partial<
      Pick<
        GameStateData,
        | "hp"
        | "mana"
        | "exp"
        | "level"
        | "gold"
        | "maxHP"
        | "maxMana"
        | "characterName"
        | "signatureSkill"
      >
    >,
  ) {
    Object.assign(this.runtimeState, updates);
    this.refreshEffectiveStats();
  }

  /** Set region and map */
  public setLocation(regionIndex: number, mapId?: string) {
    this.worldState.location.regionIndex = regionIndex;
    this.worldState.location.mapId = mapId ?? null;
  }

  public setWorldMeta(
    updates: Partial<
      Pick<
        GameStateData,
        "worldName" | "worldPreset" | "customBiomes" | "customMonsters"
      >
    >,
  ) {
    const nextMeta: Partial<WorldMetadata> = { ...this.worldState.metadata };
    if (typeof updates.worldName !== "undefined") {
      nextMeta.worldName = updates.worldName;
    }
    if (typeof updates.worldPreset !== "undefined") {
      nextMeta.worldPreset = updates.worldPreset;
    }
    if (typeof updates.customBiomes !== "undefined") {
      nextMeta.customBiomes = updates.customBiomes;
    }
    if (typeof updates.customMonsters !== "undefined") {
      nextMeta.customMonsters = updates.customMonsters;
    }

    this.worldState.metadata = normalizeWorldMetadata(
      nextMeta,
      this.worldState.seed,
    );
  }

  /** Add item to inventory */
  public addItem(itemId: string, qty: number = 1) {
    const existing = this.runtimeState.inventory.find((s) => s.itemId === itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      this.runtimeState.inventory.push({ itemId, qty });
    }
  }

  /** Remove item from inventory */
  public removeItem(itemId: string, qty: number = 1): boolean {
    const slot = this.runtimeState.inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) {
      this.runtimeState.inventory = this.runtimeState.inventory.filter(
        (s) => s.itemId !== itemId,
      );
    }
    return true;
  }

  /** Equip item to slot */
  public equip(slot: keyof EquipmentSlots, itemId: string) {
    this.runtimeState.equipment[slot] = itemId;
    this.refreshEffectiveStats();
  }

  public getCharacterStats(equipmentMetadata: any[]): EffectiveStats {
    const equippedIds = Object.values(this.runtimeState.equipment).filter(
      (id) => !!id,
    );
    const equippedData = equipmentMetadata.filter(
      (e) => equippedIds.includes(e.id) || equippedIds.includes(e.name),
    ); // handles both id and name

    const baseStats = {
      id: this.identity.characterId,
      name: this.runtimeState.characterName,
      level: this.runtimeState.level,
      hp: this.runtimeState.hp,
      maxHP: this.runtimeState.maxHP,
      mana: this.runtimeState.mana,
      maxMana: this.runtimeState.maxMana,
      attack: 10 + this.runtimeState.level * 2,
      defense: 5 + this.runtimeState.level,
      speed: 10,
      skillMain: 111111111,
    };

    return combatSystem.calculateEffectiveStats(baseStats, equippedData);
  }

  /** Re-calculates effective stats and stores them in state */
  public refreshEffectiveStats(equipmentMetadata: any[] = []) {
    // In a real app, we'd fetch or pass the full metadata.
    // For now, we update base values so UI isn't empty.
    this.runtimeState.effectiveStats = this.getCharacterStats(equipmentMetadata);
  }

  /**
   * Logic for resting to recover resources.
   * @param percent Percentage of max HP/Mana to recover (0.0 to 1.0)
   */
  public rest(percent: number = 0.3): string {
    const hpHeal = Math.floor(this.runtimeState.maxHP * percent);
    const manaHeal = Math.floor(this.runtimeState.maxMana * percent);

    const oldHP = this.runtimeState.hp;
    const oldMana = this.runtimeState.mana;

    this.runtimeState.hp = Math.min(
      this.runtimeState.maxHP,
      this.runtimeState.hp + hpHeal,
    );
    this.runtimeState.mana = Math.min(
      this.runtimeState.maxMana,
      this.runtimeState.mana + manaHeal,
    );

    return `Restored ${this.runtimeState.hp - oldHP} HP and ${this.runtimeState.mana - oldMana} Mana.`;
  }

  /**
   * Logic for using a consumable item.
   * Returns the effect description if successful.
   */
  public useItem(item: any): string | null {
    if (!this.removeItem(item.id, 1)) return null;

    const statBonus = item.stat_bonus || {};
    let log = `Used ${item.name}.`;

    if (statBonus.hp) {
      const heal = statBonus.hp;
      this.runtimeState.hp = Math.min(
        this.runtimeState.maxHP,
        this.runtimeState.hp + heal,
      );
      log += ` Restored ${heal} HP.`;
    }
    if (statBonus.mana) {
      const restored = statBonus.mana;
      this.runtimeState.mana = Math.min(
        this.runtimeState.maxMana,
        this.runtimeState.mana + restored,
      );
      log += ` Restored ${restored} Mana.`;
    }

    return log;
  }

  /** Serialize for save */
  public serialize(): string {
    return JSON.stringify(this.getState());
  }

  /** Restore from saved data */
  public static deserialize(json: string): GameStateManager {
    const data: GameStateData = JSON.parse(json);
    const mgr = new GameStateManager(
      data.playerId,
      data.characterId,
      data.worldSeed,
    );
    mgr.phase = data.phase;
    mgr.setWorldMeta({
      worldName: data.worldName,
      worldPreset: data.worldPreset,
      customBiomes: data.customBiomes,
      customMonsters: data.customMonsters,
    });
    mgr.worldState.location = {
      regionIndex: data.regionIndex,
      mapId: data.mapId,
      eventId: data.eventId,
      combatId: data.combatId,
    };
    mgr.runtimeState = {
      hp: data.hp,
      maxHP: data.maxHP,
      mana: data.mana,
      maxMana: data.maxMana,
      exp: data.exp,
      level: data.level,
      gold: data.gold,
      inventory: Array.isArray(data.inventory) ? data.inventory : [],
      equipment: data.equipment || {
        weapon: null,
        armor: null,
        accessory: null,
      },
      characterName: data.characterName,
      effectiveStats: data.effectiveStats,
      signatureSkill: data.signatureSkill,
    };
    return mgr;
  }
}
