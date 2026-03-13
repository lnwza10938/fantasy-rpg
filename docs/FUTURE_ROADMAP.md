# Future Roadmap - Mid-Engine Build Plan

This roadmap defines the next major implementation phases for the **Procedural Fantasy RPG** project from the current **mid-engine stage**.

Current foundation already in place:

- canonical world definitions
- world overrides
- graph-based topology
- traversal-aware runtime state
- hub / dashboard route
- adventure loop
- dev panel and visual map editor foundation
- first geography layer
- first asset ingestion pipeline

This document is now the primary high-level plan for feature sequencing.

## Guardrails

The following architectural rules should remain stable unless a serious bug requires otherwise:

- `WorldDefinition` remains canonical authored/generated world truth
- `world_overrides` remains the authored delta layer
- runtime traversal state remains separate from canonical world data
- topology remains gameplay truth
- geography remains a render / interpretation layer on top of topology

Do not reopen large refactors of:

- `WorldDefinition`
- `WorldMapLayout`

The engine is stable enough now that progress should come primarily from:

- tooling
- gameplay depth
- story binding
- content pipelines

## Phase 1 - Stabilize UI and Core Flow

Goal:

```text
Clear routes
Clear page responsibility
Clear state machine
```

Required outcomes:

### Mythic Atlas Theme Lock

The UI system should now standardize around the official theme tokens in:

- `docs/MYTHIC_ATLAS_COLOR_SYSTEM.md`

This means:

- stop mixing earlier dashboard-green styling with atlas-dark styling
- use the locked gold / dark-stone / restrained-accent palette
- keep route responsibilities clean enough that each page can share one design language
- treat the color system as a stable dependency for future UI work

### Hub

`/hub` should act as a dashboard only.

Keep:

- current adventure snapshot
- quick actions
- recent worlds
- recent legends

Do not render:

- combat UI
- forge UI
- vault UI
- full gameplay surface

### Adventure

Adventure should behave as a real state-driven experience:

- `MAP`
- `STORY`
- `EVENT`
- `COMBAT`
- `RESULT`

Only one primary state should dominate at a time.

### Combat

Combat presentation should remain readable and game-like:

- enemy
- battle text
- hero
- action grid

### Node Feedback

Node states must remain visually distinct:

- current
- reachable
- cleared
- boss
- secret

### Dev Map Editor Foundation

Must support:

- canvas
- node selection
- path selection
- inspector
- override draft

## Phase 2 - Traversal Depth

Goal:

```text
Travel should become a deeper gameplay layer, not just node switching.
```

Key additions:

### Path Rules

Add richer metadata such as:

- difficulty
- visibility
- requirements
- effects

Example:

```json
{
  "kind": "hazard",
  "difficulty": 3,
  "visibility": "hidden",
  "requirements": ["torch"],
  "effects": ["hp_cost"]
}
```

### Hidden Paths

Support path discovery triggered by:

- events
- items
- lore

### Gated Routes

Examples:

- ancient gate
- relic requirement
- faction lock

### Travel Events

Travel should have its own event layer:

- ambush
- merchant
- lore discovery

## Phase 3 - Story Binding

Goal:

```text
Attach narrative systems to worlds, regions, and nodes without changing the core map model.
```

Target direction:

### World Story Pack

Potential table / record direction:

- `world_story_bindings`

Example fields:

- `world_id`
- `intro_story`
- `main_arc`
- `faction_list`

### Region Narrative

Potential binding layer:

- `region_story_bindings`

Example fields:

- `region_id`
- `intro_dialogue`
- `event_pool`
- `quest_hooks`

### Node Dialogue

Use node-specific narrative bindings for visual-novel style presentation.

## Phase 4 - Encounter Engine

Goal:

```text
Move from basic encounter delivery to authored and weighted encounter structure.
```

### Encounter Tables

Support weighted encounter tables per region / danger band.

Example:

```text
cursed_meadows
Widow 40%
Husk 30%
Hound 30%
```

### Elite Encounters

Rare or upgraded enemy appearances should exist outside the normal pool.

### Boss Nodes

Nodes marked as boss nodes should support:

- special spawn logic
- boss-only presentation
- stronger reward hooks

## Phase 5 - Geography Layer

Goal:

```text
Move from graph-only map presentation toward a real world geography layer.
```

Target visual and systemic additions:

- terrain
- biomes
- rivers
- mountains
- geography-aware route placement

Non-negotiable rule:

```text
topology = gameplay truth
```

Geography should remain a render / interpretation layer.

## Phase 6 - AI World Generation

Goal:

```text
Use AI as a specialist layer for turning lore and world prompts into structured world data.
```

### AI Role 1 - Lore Parser

Input:

- novels
- lore text
- world notes

Output:

- regions
- factions
- story hooks
- event seeds

### AI Role 2 - World Builder

Generate:

- world definitions
- topology
- biome groupings
- enemy pools

### AI Role 3 - Dialogue Generator

Generate:

- NPC dialogue
- event text
- battle taunts

Detailed pipeline specification:

- [AI_LORE_WORLD_PIPELINE.md](/Users/mon/game_project/docs/AI_LORE_WORLD_PIPELINE.md)

## Phase 7 - Dev Tools Expansion

Goal:

```text
Grow the dev-side map tooling from topology editing into full world authoring.
```

Target additions:

### Node Creation

- add region
- set core region metadata

### Path Editor

- connect nodes
- edit path rules
- edit visibility / requirements / effects

### Auto Layout

Support stronger layout options:

- force layout
- tree layout
- radial layout

### Terrain Painter

Future layer for painting:

- biomes
- terrain zones
- geography overlays

## Phase 8 - Content Pipeline

Goal:

```text
Make the game expandable through packs and structured imported content.
```

Target pack directions:

### World Packs

- `world_pack.json`

### Monster Packs

- `monster_pack.json`

### Story Packs

- `story_pack.json`

This should align with the current dev-side asset and terrain recipe tooling.

## Phase 9 - Player Systems

Goal:

```text
Layer a deeper RPG progression system on top of the stable world engine.
```

Key systems:

### Equipment

- weapons
- armor
- relics

### Skill System

Use the existing:

- `9 digit skill code`

### Progression

- level
- stats
- perks

## Phase 10 - Endgame Systems

Goal:

```text
Turn the world engine into a reactive long-term RPG system.
```

### World Mutation

World state should change based on:

- player actions
- route choices
- faction decisions

### Dynamic Events

Examples:

- invasions
- storms
- faction conflicts

### Endless Worlds

Continue supporting seed-driven and procedural replay worlds.

## Recommended Near-Term Build Order

The practical next order after current stabilization work is:

1. finish Phase 1 polish where needed
2. deepen traversal through Phase 2
3. build story binding from Phase 3
4. strengthen encounter authoring from Phase 4
5. continue geography layer work from Phase 5
6. expand dev tools and content pipelines in parallel

## Final Direction

The long-term product direction is:

```text
World Engine
+ AI Story Engine
+ Graph Traversal RPG
```

This project should continue evolving as a structured world-and-story engine, not as a loose collection of disconnected web game screens.
