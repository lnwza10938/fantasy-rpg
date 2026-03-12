# AI Lore -> World Generator Pipeline

This document defines the planned **AI-driven lore-to-world pipeline** for the **Procedural Fantasy RPG** project.

The goal is to accept large narrative inputs such as:

- lore documents
- novels
- campaign notes
- worldbuilding text
- wiki pages
- structured prompts

and transform them into a **playable Realm** that fits the current project architecture.

This pipeline is designed to work with the existing system, not replace it.

It must remain compatible with:

- `WorldDefinition`
- `regions`
- `mapLayout`
- `world_overrides`
- traversal-aware runtime state

## 1. Purpose

The project is moving from a web RPG into a **world creation platform**.

That means AI should not only generate flavor text. It should help create:

- realm structure
- locations
- routes
- encounters
- story hooks
- battle text

The end result should be a realm that can be inserted into the current world system and played immediately.

## 2. Core Design Rules

The pipeline must respect the current engine boundaries:

- canonical world definitions remain the base truth
- overrides remain authored deltas
- runtime state remains separate
- topology remains gameplay truth
- geography remains a render / spatial interpretation layer

AI must not bypass these rules.

## 3. Pipeline Overview

High-level flow:

```text
Lore Input
-> Lore Analyzer AI
-> World Structure AI
-> Region Generator AI
-> Topology Generator AI
-> Encounter Generator AI
-> Dialogue Generator AI
-> WorldDefinition
-> Playable Realm
```

The orchestrator should validate and merge all intermediate outputs before producing the final world package.

## 4. Supported Inputs

The system should accept long-form narrative material such as:

- novels
- lore pages
- setting documents
- campaign notes
- worldbuilding prompts
- uploaded story text

Example:

```text
The Ash Empire once ruled the volcanic lands.
After the eruption of the Black Spire,
the empire collapsed and monsters spread across the realm.
```

## 5. AI Worker 1 - Lore Analyzer

Purpose:

```text
Read source lore and extract structured world ingredients.
```

Expected output shape:

```json
{
  "factions": ["Ash Empire"],
  "regions": ["Volcanic Wastes"],
  "events": ["Black Spire Eruption"],
  "monsters": ["Lava Spawn", "Ash Wraith"],
  "landmarks": ["Black Spire"]
}
```

This worker should extract:

- factions
- regions
- landmarks
- monsters
- history events
- environmental identity
- political powers
- cultural anchors

## 6. AI Worker 2 - World Structure Generator

Purpose:

```text
Turn extracted lore ingredients into a coherent Realm structure.
```

Expected output:

```json
{
  "realmName": "Ashfall Realm",
  "theme": "volcanic apocalypse",
  "biomes": [
    "volcanic",
    "ash desert",
    "ruined cities"
  ]
}
```

This worker should define:

- realm name
- world theme
- biome mix
- world tone
- intended difficulty arc
- high-level story arc

## 7. AI Worker 3 - Region Generator

Purpose:

```text
Create playable Locations for the Realm.
```

Expected region output:

```json
[
  {
    "name": "Ash Spire",
    "biome": "volcanic",
    "dangerLevel": 6,
    "landmark": "Black Spire",
    "enemies": ["Lava Spawn"]
  },
  {
    "name": "Cinder Fields",
    "biome": "ash desert",
    "dangerLevel": 4,
    "enemies": ["Ash Wraith"]
  }
]
```

Recommended scale:

- 6-12 locations for one generated realm

Each location should map cleanly into the current `WorldRegion` concept.

## 8. AI Worker 4 - Topology Generator

Purpose:

```text
Create a route graph between generated locations.
```

Expected output:

```json
{
  "nodes": [
    "cinder_fields",
    "ash_spire",
    "obsidian_gate"
  ],
  "paths": [
    ["cinder_fields", "ash_spire"],
    ["ash_spire", "obsidian_gate"]
  ]
}
```

This worker should determine:

- start node
- boss / goal node
- major routes
- secret routes
- route risk structure

This output must be converted into the current `WorldMapLayout`.

## 9. AI Worker 5 - Encounter Generator

Purpose:

```text
Populate locations with encounter and enemy pools.
```

Expected output:

```json
{
  "cinder_fields": {
    "enemies": [
      "Ash Wraith",
      "Cinder Beast"
    ],
    "events": [
      "Lost Caravan",
      "Burning Shrine"
    ]
  }
}
```

This worker should generate:

- enemy pools
- weighted encounters
- encounter flavor hooks
- travel events
- special node encounters

## 10. AI Worker 6 - Dialogue Generator

Purpose:

```text
Generate player-facing narrative text for story, encounters, and battle presentation.
```

Example outputs:

```text
The air burns your lungs.

Ash Wraith appears!
```

or

```text
A ruined shrine stands before you.
Its stone is warm to the touch.
```

This worker can support:

- event text
- story text
- battle taunts
- location intro text
- NPC dialogue

## 11. Final Output Shape

The full AI pipeline should produce data that can be assembled into a playable `WorldDefinition`.

Example:

```json
{
  "metadata": {
    "realmName": "Ashfall Realm"
  },
  "regions": [],
  "mapLayout": {}
}
```

This final structure must remain compatible with the current game systems.

## 12. Orchestrator Layer

The pipeline should be coordinated by a **Master AI / Orchestrator**.

Purpose:

- call worker AIs in sequence
- pass structured outputs forward
- normalize partial outputs
- validate the final package
- decide when to use fallback rules

Full flow:

```text
Lore
-> Analyzer
-> Structure
-> Regions
-> Topology
-> Encounters
-> Dialogue
-> Validation
-> WorldDefinition
```

## 13. Validation Layer

Before a generated realm is persisted, the pipeline must validate:

- graph connectedness
- presence of start node
- presence of goal node
- valid regions
- valid path endpoints
- valid enemy pools
- coherent danger progression
- schema compatibility with `WorldDefinition`

AI must not be trusted to generate gameplay structure without validation.

## 14. World Pack Output

The generator should also be able to emit a portable realm package.

Suggested shape:

```json
{
  "realm": "Ashfall Realm",
  "regions": [],
  "topology": {},
  "encounters": {}
}
```

This supports future:

- world packs
- imports
- sharing
- dev preview flows

## 15. Integration With Current Game

Once the final structure is validated, it should:

```text
insert into world_definitions
```

and become:

```text
playable immediately
```

Optional follow-up:

- generate a preview draft first
- allow manual override authoring before publish

## 16. Custom Realm Mode

The player or dev should be able to:

```text
paste lore
```

and receive:

```text
a generated realm
```

This is the basis for a future **Custom Realm Mode**.

## 17. Multi-Agent Scaling Strategy

Because the project may rely on free or rate-limited AI providers, the work should be split across specialist workers.

Recommended worker split:

- Lore Analyzer
- World Structure Generator
- Region Generator
- Topology Generator
- Encounter Generator
- Dialogue Generator

This reduces:

- token overload
- context bloat
- rate-limit pressure on a single request

## 18. Advanced Future Workers

Optional future expansions:

- Quest Generator
- Faction AI
- Dynamic Event Generator
- Settlement Generator
- Dungeon Layout Generator

## 19. Expected Runtime Experience

Target user flow:

1. paste lore / upload world text
2. AI parses the source
3. pipeline generates:
   - Realm
   - Locations
   - Routes
   - Encounters
   - Dialogue
4. world is validated
5. realm becomes playable in the game

Longer-term target:

```text
10-20 seconds
```

for a reasonable single-realm generation pass, depending on provider limits.

## 20. Safety Rule - AI Must Not Invent Structure Blindly

The pipeline must always apply explicit rules for:

- topology
- difficulty curve
- encounter balance
- region count
- graph validity

The generator should never rely on raw AI text alone for gameplay-critical world structure.

## 21. Benefits

This system would allow the project to create:

```text
infinite realms
```

from:

```text
text lore
```

while still preserving the current engine architecture.

## 22. Final Product Direction

The long-term direction of this system is:

```text
AI Lore Engine
+ Procedural RPG World
+ Graph Exploration Game
```

This should be treated as the AI-generation counterpart to the current map, override, and terrain-authoring systems.

## 23. Recommended Next Technical Step

The next most important follow-up document after this one is:

```text
AI Prompt Architecture for each worker
```

That should define:

- Lore Analyzer prompt
- World Structure prompt
- Region Generator prompt
- Topology Generator prompt
- Encounter Generator prompt
- Dialogue Generator prompt

This is the layer that will make AI generation stable and aligned with the game rules instead of drifting into generic fantasy output.
