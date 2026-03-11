import {
  createPlayer,
  createCharacter,
  getCharacter,
  saveCombatLog,
} from "./src/db/repositories.js";
import { combatSystem } from "./src/core/combatSystem.js";
import type { CharacterStats } from "./src/models/combatTypes.js";
import { v4 as uuidv4 } from "uuid";

async function runFullIntegrationTest() {
  console.log("🚀 Starting Full Integration Test...");

  try {
    // 1. Create a Player
    console.log("Creating Player...");
    const player = await createPlayer("Alptraum");
    console.log("✅ Player Created:", player.id);

    // 2. Create a Character
    console.log("Creating Character...");
    const characterData = await createCharacter(player.id, "Shadow Knight", {
      level: 10,
      hp: 150,
      maxHP: 150,
      mana: 80,
      maxMana: 80,
      attack: 25,
      defense: 10,
      speed: 15,
      skillMain: 863016382,
    });
    console.log("✅ Character Created:", characterData.id);

    // 3. Fetch Character (verifying transform logic)
    console.log("Fetching Character stats...");
    const heroStats = await getCharacter(characterData.id);
    console.log("✅ Stats Loaded:", heroStats.name, "HP:", heroStats.hp);

    // 4. Create a dummy Enemy for combat
    const goblin: CharacterStats = {
      id: uuidv4(),
      name: "Forest Goblin",
      level: 5,
      hp: 50,
      maxHP: 50,
      mana: 20,
      maxMana: 20,
      attack: 12,
      defense: 4,
      speed: 12,
      skillMain: 112111111,
    };

    // 5. Run Combat and Save Log
    console.log("Running Combat Simulation...");
    const battleId = uuidv4();

    // Prepare EffectiveStats for the new system
    const effHero = combatSystem.calculateEffectiveStats(heroStats, []);
    const effGoblin = combatSystem.calculateEffectiveStats(goblin, []);

    const result = await combatSystem.executeFullCombat(
      effHero,
      effGoblin,
      battleId,
    );
    console.log(
      "✅ Combat Finished. Winner:",
      result.winnerId === heroStats.id ? "Hero" : "Goblin",
    );

    console.log("✅ Log should be saved in DB for Battle ID:", battleId);
    console.log("\n--- Full Integration Test Successful! ---");
  } catch (error) {
    console.error("❌ Test Failed:", error);
  }
}

runFullIntegrationTest();
