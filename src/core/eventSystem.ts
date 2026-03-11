// src/core/eventSystem.ts
// Procedural event generator with combat encounter hooks

import type { CharacterStats } from "../models/combatTypes.js";
import { worldSystem } from "./worldSystem.js";
import type { Region } from "./worldSystem.js";

// --- Event Types ---

export enum EventType {
  Nothing = "nothing",
  EnemyEncounter = "enemy_encounter",
  TreasureFound = "treasure_found",
  RareEvent = "rare_event",
  NPCEncounter = "npc_encounter",
  LoreEvent = "lore_event",
  AmbientEvent = "ambient_event",
  RestEvent = "rest_event",
}

export interface GameEvent {
  type: EventType;
  description: string;
  enemy?: CharacterStats;
  treasureGold?: number;
  npcName?: string;
  dialogue?: string;
  loreTitle?: string;
  loreContent?: string;
  restPercent?: number;
  restLog?: string;
}

// --- Event System ---

export class EventSystem {
  /**
   * Generates a procedural event based on current player level and region.
   * Uses weighted random rolls (out of 100):
   *   30% Enemy Encounter (Weighted)
   *   20% Nothing Happens
   *   15% Treasure Found
   *   15% NPC Encounter
   *   10% Lore Event
   *   5% Ambient Event
   *   5% Rare Event
   */
  public async generateEvent(
    player: CharacterStats,
    region: Region,
  ): Promise<GameEvent> {
    const instance = worldSystem.getInstance();
    if (!instance) throw new Error("World instance not ready.");

    const roll = Math.random() * 100;

    if (roll < 30) {
      return this.triggerEnemyEncounter(player, region, instance);
    } else if (roll < 50) {
      return this.triggerNothing(region);
    } else if (roll < 65) {
      return this.triggerTreasure(player, region);
    } else if (roll < 80) {
      return this.triggerNPCEncounter(region, instance);
    } else if (roll < 85) {
      return this.triggerRest(region);
    } else if (roll < 90) {
      return this.triggerLoreEvent(region, instance);
    } else if (roll < 95) {
      return this.triggerAmbientEvent(region);
    } else {
      return this.triggerRareEvent(player, region);
    }
  }

  // --- Private Event Handlers ---

  private triggerLoreEvent(region: Region, instance: any): GameEvent {
    const lorePool =
      instance.lore.length > 0
        ? instance.lore
        : [
            {
              title: "The Silent Era",
              content: "Centuries ago, the world fell silent for a day.",
            },
          ];
    const snippet = lorePool[Math.floor(Math.random() * lorePool.length)];
    return {
      type: EventType.LoreEvent,
      description: `You discover an ancient inscription regarding: ${snippet.title}`,
      loreTitle: snippet.title,
      loreContent: snippet.content,
    };
  }

  private triggerAmbientEvent(region: Region): GameEvent {
    const ambients = [
      `A murder of crows takes flight from the skeletal trees of ${region.name}.`,
      `The air grows freezing, and your breath mists in the gloom.`,
      `You feel a strange vibration in the ground beneath your feet.`,
      `A distant, mournful howl echoes through the biome.`,
    ];
    return {
      type: EventType.AmbientEvent,
      description: ambients[Math.floor(Math.random() * ambients.length)],
    };
  }

  private triggerNPCEncounter(region: Region, instance: any): GameEvent {
    const allNPCs = instance.factions?.flatMap((f: any) => f.npcs || []) || [];
    // Fallback or use separate NPC list if instance has one
    const fallbackNPCs = [{ name: "A Nameless Wanderer", role: "Survivor" }];
    const npc =
      allNPCs.length > 0
        ? allNPCs[Math.floor(Math.random() * allNPCs.length)]
        : fallbackNPCs[0];

    return {
      type: EventType.NPCEncounter,
      description: `You encounter ${npc.name} (${npc.role}) in ${region.name}.`,
      npcName: npc.name,
      dialogue: "Stay away from the shadows, traveler...",
    };
  }

  private async triggerEnemyEncounter(
    player: CharacterStats,
    region: Region,
    instance: any,
  ): Promise<GameEvent> {
    const poolNames = region.enemyPool;
    const monsters = instance.monsterPool.filter((m: any) =>
      poolNames.includes(m.name),
    );

    if (monsters.length === 0) return this.triggerNothing(region);

    // Weighted selection
    const totalWeight = monsters.reduce(
      (sum: number, m: any) => sum + (m.spawn_weight || 1.0),
      0,
    );
    let roll = Math.random() * totalWeight;
    let selectedMonster = monsters[0];

    for (const m of monsters) {
      roll -= m.spawn_weight || 1.0;
      if (roll <= 0) {
        selectedMonster = m;
        break;
      }
    }

    const enemy = worldSystem.spawnEnemy(
      selectedMonster.name,
      Math.max(1, player.level + (Math.random() > 0.8 ? 1 : 0)),
    );

    return {
      type: EventType.EnemyEncounter,
      description: `Enemy Encounter: ${enemy.name} in ${region.name}`,
      enemy,
    };
  }

  private triggerNothing(region: Region): GameEvent {
    const flavors = [
      `Nothing happens. The air is still.`,
      `The path ahead is empty, but you feel eyes upon you.`,
      `You find only dust and shadows.`,
      `The silence of ${region.name} is deafening.`,
    ];
    return {
      type: EventType.Nothing,
      description: `You explore ${region.name}... ${flavors[Math.floor(Math.random() * flavors.length)]}`,
    };
  }

  private triggerRest(region: Region): GameEvent {
    return {
      type: EventType.RestEvent,
      description: `You find a relatively safe nook in ${region.name} to catch your breath.`,
      restPercent: 0.25,
    };
  }

  private triggerTreasure(player: CharacterStats, region: Region): GameEvent {
    const gold = 10 + player.level * 5 + Math.floor(Math.random() * 50);
    return {
      type: EventType.TreasureFound,
      description: `You explore ${region.name}... You found a treasure chest containing ${gold} gold!`,
      treasureGold: gold,
    };
  }

  private triggerRareEvent(player: CharacterStats, region: Region): GameEvent {
    return {
      type: EventType.RareEvent,
      description: `A strange shimmer in the air of ${region.name} fills you with dread. (Rare event placeholder)`,
    };
  }
}

export const eventSystem = new EventSystem();
