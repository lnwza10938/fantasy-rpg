// scripts/runSimulation.ts
// Full end-to-end simulation: World → Region → Events → Combat → Legend

import { worldSystem } from "../src/core/worldSystem.js";
import { eventSystem, EventType } from "../src/core/eventSystem.js";
import { legendSystem } from "../src/core/legendSystem.js";
import type { CharacterStats } from "../src/models/combatTypes.js";

async function runSimulation() {
  console.log("═══════════════════════════════════════");
  console.log("  PROCEDURAL FANTASY RPG — SIMULATION");
  console.log("═══════════════════════════════════════\n");

  // 1. Generate World
  const seed = 777;
  const world = worldSystem.generateWorld(seed);
  console.log(`🌍 World Generated (Seed: ${seed})`);
  console.log(`   Regions: ${world.regions.length}\n`);

  for (const r of world.regions) {
    console.log(
      `   [${r.id}] ${r.name} ⚠️${r.dangerLevel} — ${r.enemyTypes.join(", ")}`,
    );
  }

  // 2. Create Hero
  const hero: CharacterStats = {
    id: "hero_001",
    name: "Raen",
    level: 8,
    hp: 120,
    maxHP: 120,
    mana: 60,
    maxMana: 60,
    attack: 18,
    defense: 8,
    speed: 14,
    skillMain: 863016382,
  };
  console.log(`\n🗡️ Hero: ${hero.name} (Lv.${hero.level})\n`);

  // 3. Explore 3 regions with events
  for (let i = 0; i < 3; i++) {
    const region = worldSystem.getRandomRegion();
    console.log(
      `\n━━━ Exploring: ${region.name} (Danger: ${region.dangerLevel}) ━━━`,
    );

    const event = await eventSystem.generateEvent(hero, region);
    console.log(`📜 Event: ${event.type.toUpperCase()}`);
    console.log(`   ${event.description}`);

    if (event.type === EventType.EnemyEncounter && event.combatLogs) {
      console.log(`\n⚔️ Combat Log:`);
      for (const log of event.combatLogs.slice(-5)) {
        console.log(`   ${log}`);
      }

      // Record legend if hero survived
      if (hero.hp > 0 && event.enemy) {
        const legendText = legendSystem.formatLegend(
          hero.name,
          "defeated",
          event.enemy.name,
          region.name,
        );
        console.log(`\n📖 Legend Recorded: ${legendText}`);
      }
    }

    if (event.type === EventType.TreasureFound) {
      console.log(`   💰 Gold: ${event.treasureGold}`);
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  SIMULATION COMPLETE");
  console.log("═══════════════════════════════════════\n");
}

runSimulation();
