# 🚀 Future Development Roadmap (Phases 15-20)

This document outlines the planned future enhancements for the **Procedural Fantasy RPG Engine**, based on the gaps identified between the core architecture and a fully shipped game experience.

---

## 💎 Phase 15: Economy & Merchant System
**Goal:** Give player gold actual utility and add non-combat engagement.
- [ ] **Merchant Event**: Implement a new event type in `eventSystem.ts` for random merchant encounters.
- [ ] **Shop UI**: Create a dedicated shop interface in `main.ts` where players can buy recovery items and equipment.
- [ ] **Item Valuation**: Add logic to calculate item prices based on rarity and stat magnitude.

## 🎨 Phase 16: Visual Identity & Combat Polish
**Goal:** Enhance immersion through high-quality visuals and feedback.
- [ ] **AI Portrait Generation**: Integrate or placeholder a system to display character portraits based on the "Forge Legend" appearance data.
- [ ] **Skill Icon System**: Map the 9-digit skill codes to dynamic icons (e.g., Code 2xx = Sword icon, Code x4x = Fire effect).
- [ ] **Dynamic Combat UI**: Transition from text-only logs to a visual battle screen with HP bars and floating damage numbers.

## ⚔️ Phase 17: Procedural Equipment Generator
**Goal:** Move beyond static database items to infinite loot variety.
- [ ] **Affix System**: Implement "Prefixes" and "Suffixes" (e.g., *Slayer's* Iron Sword *of Flame*) to modify base equipment stats.
- [ ] **Loot Scaling**: Ensure drop quality scales naturally with the region's Danger Level and player level.

## 🌍 Phase 18: Living World & Factions
**Goal:** Make the world react to player legends and faction choices.
- [ ] **Reputation System**: Track player standing with different factions (Factions from DB). High/low standings unlock/lock specific regions or dialogues.
- [ ] **World Persistence (Scars)**: Use the `LegendSystem` to modify descriptions for future runs (e.g., if a city was destroyed, it appears as "Ruins" in the next playthrough on the same seed).

## 🧠 Phase 19: Advanced NPC Quests
**Goal:** Add structured objectives and branching narratives.
- [ ] **Quest Framework**: Implement a tracking system for "Kill X", "Collect Y", or "Reach Z" objectives.
- [ ] **Branching Dialogue**: Expand NPC encounters to allow player choices that impact world state or rewards.

## 📱 Phase 20: Final Polish & UX
**Goal:** Professionalize the interface and sensory feedback.
- [ ] **Sound & SFX**: Add audio cues for combat hits, menu navigation, and the "Skill Roll" animation.
- [ ] **Tutorial System**: Implement a "First Time User" guided tour to explain the 9-digit system and exploration loop.

---

## 🛠️ Implementation Priority
1. **Phase 15 (Economy)**: Critical for gameplay loop (Spending Gold).
2. **Phase 16 (Combat Polish)**: Critical for user retention and "Wow" factor.
3. **Phase 17 (Procedural Loot)**: Essential for long-term replayability.
