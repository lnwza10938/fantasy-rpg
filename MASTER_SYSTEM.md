# PROCEDURAL FANTASY RPG – MASTER SYSTEM DOCUMENT

This document describes the complete architecture and design of the Procedural Fantasy RPG Web Engine.

This file must be preserved and referenced whenever the project continues development.

The system must always follow this architecture.

---

## 1. CORE GAME CONCEPT

The game is a Procedural Fantasy RPG running on a web platform.

Key design principles:

* Skills are generated from numeric codes.
* The world is persistent and evolves over time.
* Player actions create legends stored in world history.
* Developers can expand game content through a developer panel without modifying engine code.

The world is not reset after completion.

Players may:

1. Continue the same world
2. Start a new world

If the same world is continued, the history of the previous player remains and affects future events.

---

## 2. SKILL SYSTEM (9 DIGIT SYSTEM)

Every skill in the game is defined by a 9 digit number.

Example: `863016382`

Structure:

| Digit | Property |
|-------|----------|
| 1 | Trigger |
| 2 | Skill Role |
| 3 | Target |
| 4 | Effect Type |
| 5 | Scaling Source |
| 6 | Delivery Shape |
| 7 | Duration |
| 8 | Secondary Modifier |
| 9 | Special Property |

Each digit contains values from 0–9. Total possible skills: **1,000,000,000**

---

## 3. SKILL ENGINE

**SkillSystem** — Accept a 9 digit skill id, extract digits using math, cache decoded skills.

**SkillInterpreter** — Convert decoded skill data into RuntimeSkill objects (damage, healing, manaCost, cooldown, range, duration, modifiers).

---

## 4. COMBAT SYSTEM

Combat is deterministic and turn based.

Flow: startCombat → determine turn order → execute skill → calculate damage → apply effects → log result → repeat until hp <= 0

---

## 5. CHARACTER SYSTEM

Structure: id, name, level, hp, maxHP, mana, maxMana, attack, defense, speed, skillMain

---

## 6. WORLD SYSTEM

World is generated from a numeric seed. Functions: generateWorld(seed), getRandomRegion(), spawnEnemy(level)

---

## 7. EVENT SYSTEM

Event Types: exploration, enemy encounter, treasure, dialogue, rare events

---

## 8. LEGEND SYSTEM

The world records the actions of players. Examples:

* Hero defeated the Dragon of Ash Valley
* Hero destroyed the Kingdom of Ironfall
* Hero discovered the Forgotten Gate

Future players may encounter references to these legends through NPC dialogue or world events.

---

## 9. DATABASE SYSTEM

Core Tables: players, characters, combat_logs, world_states

---

## 10. CONTENT DATABASE

Content Tables: monsters, items, equipment, maps, spawn_points, dialogues, game_text, assets

---

## 11. DEVELOPER CONTENT PANEL

Route: /dev — Add Monster, Item, Equipment, Map, Spawn Point, Dialogue, Upload Image, Game Text

---

## 12. GAME LOOP

Player enters world → Select region → Explore → Event generated → Combat → Result logged → World state saved

---

## 13. API SYSTEM

Backend: /start, /world, /event, /combat, /spawn

Developer: /dev/monster, /dev/item, /dev/equipment, /dev/map, /dev/spawn, /dev/dialogue

---

## 14. FRONTEND

HTML + TypeScript + Fetch API. Screens: Login, Character, Exploration, Combat Logs

---

## 15. PROJECT STRUCTURE

```
game_project/
├── src/
│   ├── core/
│   │   ├── skillSystem.ts
│   │   ├── skillInterpreter.ts
│   │   ├── combatSystem.ts
│   │   ├── worldSystem.ts
│   │   ├── eventSystem.ts
│   │   └── legendSystem.ts
│   ├── models/
│   │   └── combatTypes.ts
│   ├── db/
│   │   ├── supabase.ts
│   │   ├── repositories.ts
│   │   └── contentRepositories.ts
│   ├── api/
│   │   └── gameRoutes.ts
│   └── server.ts
├── web/
│   ├── index.html
│   ├── main.ts
│   └── dev.html
├── scripts/
│   └── runSimulation.ts
└── MASTER_SYSTEM.md
```

---

## 16. SYSTEM ARCHITECTURE

- **Game Engine Layer**: Skill Engine, Combat Engine, World Engine, Event Engine, Legend Engine
- **Content Layer**: Monsters, Items, Equipment, Maps, Dialogue
- **Infrastructure Layer**: Supabase Database, Backend API, Server
- **Tools Layer**: Developer Admin Panel
- **Frontend Layer**: Web UI

---

## 17. ENGINE PIPELINE

World Seed → Generate World → Load Map → Spawn Enemy → Combat Engine → Generate Combat Logs → Save Results

---

## 18. FUTURE EXTENSIONS

Procedural enemy generation, Equipment generator, Economy system, NPC AI, Faction systems, Advanced world simulation

---

## END OF MASTER DOCUMENT
