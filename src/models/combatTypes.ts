// src/models/combatTypes.ts
// DATA LAYER: Represents the state and structure of combat entities

export interface CharacterStats {
  id: string;
  name: string;
  level: number;
  imageUrl?: string;
  hp: number;
  maxHP: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  skillMain: number; // 9-digit skill ID
  skillData?: any;
}

export interface EffectiveStats extends CharacterStats {
  baseStats: CharacterStats;
  modifiers: {
    attackBonus: number;
    defenseBonus: number;
    speedBonus: number;
    hpBonus: number;
  };
}

export interface CombatState {
  isFinished: boolean;
  winnerId: string | null;
  turnCount: number;
  logs: CombatLogEntry[];
}

// Log entries use minimal footprint, optimized for fast array pushes
export type CombatLogEntry = string;

// Enum to manage combat actor turns transparently
export enum CombatFaction {
  Player = 0,
  Enemy = 1,
}
