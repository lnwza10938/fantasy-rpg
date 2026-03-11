// src/core/gameState.ts
// Game State Manager — tracks the current state of a play session

import { combatSystem } from "./combatSystem.js";
import type { EffectiveStats } from "../models/combatTypes.js";

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
  private state: GameStateData;

  constructor(playerId: string, characterId: string, worldSeed: number) {
    this.state = {
      phase: GamePhase.IDLE,
      playerId,
      characterId,
      worldSeed,
      regionIndex: 0,
      mapId: null,
      eventId: null,
      combatId: null,
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
    return this.state;
  }
  public getPhase(): GamePhase {
    return this.state.phase;
  }

  /** Transition to a new phase with validation */
  public transition(to: GamePhase): boolean {
    const allowed = TRANSITIONS[this.state.phase];
    if (!allowed.includes(to)) return false;
    this.state.phase = to;
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
    Object.assign(this.state, updates);
    this.refreshEffectiveStats();
  }

  /** Set region and map */
  public setLocation(regionIndex: number, mapId?: string) {
    this.state.regionIndex = regionIndex;
    this.state.mapId = mapId ?? null;
  }

  /** Add item to inventory */
  public addItem(itemId: string, qty: number = 1) {
    const existing = this.state.inventory.find((s) => s.itemId === itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      this.state.inventory.push({ itemId, qty });
    }
  }

  /** Remove item from inventory */
  public removeItem(itemId: string, qty: number = 1): boolean {
    const slot = this.state.inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) {
      this.state.inventory = this.state.inventory.filter(
        (s) => s.itemId !== itemId,
      );
    }
    return true;
  }

  /** Equip item to slot */
  public equip(slot: keyof EquipmentSlots, itemId: string) {
    this.state.equipment[slot] = itemId;
    this.refreshEffectiveStats();
  }

  public getCharacterStats(equipmentMetadata: any[]): EffectiveStats {
    const equippedIds = Object.values(this.state.equipment).filter(
      (id) => !!id,
    );
    const equippedData = equipmentMetadata.filter(
      (e) => equippedIds.includes(e.id) || equippedIds.includes(e.name),
    ); // handles both id and name

    const baseStats = {
      id: this.state.characterId,
      name: this.state.characterName,
      level: this.state.level,
      hp: this.state.hp,
      maxHP: this.state.maxHP,
      mana: this.state.mana,
      maxMana: this.state.maxMana,
      attack: 10 + this.state.level * 2,
      defense: 5 + this.state.level,
      speed: 10,
      skillMain: 111111111,
    };

    return combatSystem.calculateEffectiveStats(baseStats, equippedData);
  }

  /** Re-calculates effective stats and stores them in state */
  public refreshEffectiveStats(equipmentMetadata: any[] = []) {
    // In a real app, we'd fetch or pass the full metadata.
    // For now, we update base values so UI isn't empty.
    this.state.effectiveStats = this.getCharacterStats(equipmentMetadata);
  }

  /**
   * Logic for resting to recover resources.
   * @param percent Percentage of max HP/Mana to recover (0.0 to 1.0)
   */
  public rest(percent: number = 0.3): string {
    const hpHeal = Math.floor(this.state.maxHP * percent);
    const manaHeal = Math.floor(this.state.maxMana * percent);

    const oldHP = this.state.hp;
    const oldMana = this.state.mana;

    this.state.hp = Math.min(this.state.maxHP, this.state.hp + hpHeal);
    this.state.mana = Math.min(this.state.maxMana, this.state.mana + manaHeal);

    return `Restored ${this.state.hp - oldHP} HP and ${this.state.mana - oldMana} Mana.`;
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
      this.state.hp = Math.min(this.state.maxHP, this.state.hp + heal);
      log += ` Restored ${heal} HP.`;
    }
    if (statBonus.mana) {
      const restored = statBonus.mana;
      this.state.mana = Math.min(
        this.state.maxMana,
        this.state.mana + restored,
      );
      log += ` Restored ${restored} Mana.`;
    }

    return log;
  }

  /** Serialize for save */
  public serialize(): string {
    return JSON.stringify(this.state);
  }

  /** Restore from saved data */
  public static deserialize(json: string): GameStateManager {
    const data: GameStateData = JSON.parse(json);
    const mgr = new GameStateManager(
      data.playerId,
      data.characterId,
      data.worldSeed,
    );
    Object.assign(mgr.state, data);
    return mgr;
  }
}
