# World Generation System Design

Source summary created from the shared ChatGPT conversation titled `การออกแบบระบบแผนที่`, published on March 11, 2026:
`https://chatgpt.com/s/t_69b1e382f4888191adadeed9871860a5`

Reviewed and sharpened after a follow-up evaluation shared on March 11, 2026:
`https://chatgpt.com/s/t_69b1e8c8dc508191be743373e5141b40`

This document adapts that design into the context of this project: a web-based fantasy RPG with turn-based combat, choice-driven exploration, persistent character progression, and AI-assisted content systems.

For the more detailed multi-agent plan that turns lore inputs into a playable realm through specialized AI workers, see [AI_LORE_WORLD_PIPELINE.md](/Users/mon/game_project/docs/AI_LORE_WORLD_PIPELINE.md).

## 1. Purpose

The project should treat the world as a structured game system, not just a visual map.

World generation must support two parallel creation paths:

- procedural world generation from seed, presets, and parameters
- custom world generation from lore, text, or narrative descriptions

Both paths must converge into the same world structure so the rest of the game can use the result consistently.

That shared structure should power:

- map and region presentation
- combat encounters and monster spawns
- lore events and narrative hooks
- NPC dialogue and faction context
- future quests, world packs, and manual editing tools

## 2. Core Design Principles

### World-first architecture

The map is a representation of world data, not the source of truth.

The system should generate or load structured world data first, then render:

- world-level views
- region-level views
- settlement and dungeon views

### Canonical world model

The unified world model must be the canonical source of truth for world definition.

That means:

- renderers read from the world model
- gameplay systems read from the world model
- dialogue and quest systems read from the world model
- authoring and override systems modify or transform world definition through controlled layers

No downstream system should create a competing definition of the world.

### Dual generation modes

The system must support two world creation pipelines:

`Procedural Mode`

```text
seed + preset + generation parameters
-> deterministic world builder
-> unified world model
```

`Custom Mode`

```text
text + lore + world notes
-> AI interpretation
-> structured world specification
-> unified world model
```

### Shared hierarchy

All worlds should follow the same spatial hierarchy:

```text
World
  -> Region
      -> Settlement / Point of Interest
          -> Structure / Dungeon / Encounter Space
```

Each layer inherits context from the layer above.

### Deterministic where possible

Seeded generation should be reproducible.

AI-assisted generation should remain stable through:

- structured specs
- versioned generation rules
- explicit override data

### Manual override support

Generation should never block later editing.

The data model should allow future tools to:

- lock terrain or biomes
- pin or move settlements
- force landmarks
- regenerate only one region
- lock dungeon entrances or special locations

## 3. World Generation Modes

### 3.1 Procedural World

Procedural worlds are created from system-defined inputs such as:

- world preset
- seed
- biome mix
- danger scaling
- monster pool weighting

This mode is best for:

- replayable runs
- fast world creation
- sandbox discovery
- controlled balancing for gameplay

Typical flow:

```text
seed / preset / tags
-> terrain and biome planning
-> region generation
-> settlement and landmark placement
-> monster pool assignment
-> event and lore distribution
```

### 3.2 Custom World

Custom worlds start from authored input such as:

- lore documents
- campaign notes
- story summaries
- setting descriptions
- region concepts

This mode should interpret narrative input into a structured world spec, then build the same world model used by procedural mode.

Typical flow:

```text
text / lore / uploaded story
-> AI lore parser
-> structured world specification
-> world builder
-> region builder
-> gameplay-ready world model
```

This is the foundation for future dev tooling such as custom world packs, story uploads, and narrative-linked monster/ecosystem design.

## 4. Structured Custom World Schema

The shared conversation defined nine major categories for custom world interpretation. They fit this project well and should remain the baseline schema.

### 1. World Tone

Defines the thematic identity of the world, for example:

- dark fantasy
- heroic fantasy
- high magic
- post-collapse
- ancient empire

### 2. Geography

Defines major environmental features:

- continents
- seas
- mountains
- forests
- deserts
- rivers
- climate zones

### 3. Kingdoms and Factions

Defines political and territorial power:

- kingdoms
- city-states
- guilds
- rival groups
- influence zones
- borders and alliances

### 4. History

Defines world-shaping events:

- ancient wars
- fallen civilizations
- migrations
- magical disasters
- religious upheaval

### 5. Settlements

Defines inhabited places:

- capitals
- cities
- villages
- forts
- ports
- ruined settlements

### 6. Special Locations

Defines unique or memorable destinations:

- dungeons
- ruins
- temples
- towers
- cursed zones
- magical anomalies

### 7. Gameplay Zones

Defines gameplay-facing areas:

- danger zones
- exploration regions
- quest hubs
- boss territories
- resource regions

### 8. NPC Social Structure

Defines social and cultural context:

- professions
- hierarchy
- religion
- trade culture
- local values

### 9. Narrative Hooks

Defines story-driving tensions:

- conflicts
- mysteries
- secrets
- major quest lines
- power struggles

## 5. Unified World Data Model

Every world should resolve into the same shared structure.

Suggested top-level entities:

- `World`
- `Regions`
- `Kingdoms`
- `Factions`
- `Settlements`
- `Structures`
- `Dungeons`
- `GameplayZones`
- `LoreEntries`
- `NPCProfiles`
- `Overrides`
- `Metadata`

Core hierarchy:

```text
World
  -> Regions
      -> Settlements / Landmarks
          -> Structures / Dungeons / Encounter Nodes
```

For this project, that model should also support:

- region danger values
- enemy pools and spawn weights
- custom biome definitions
- world preset and seed metadata
- persistent world identity for save/load and resume

### World definition versus runtime game state

The project should explicitly separate:

- `World Definition`
- `Runtime Game State`

`World Definition` includes static or authored world truth such as:

- geography
- regions
- settlements
- dungeons
- factions
- lore structure

`Runtime Game State` includes session-dependent or player-dependent state such as:

- player position
- quest progress
- inventory
- combat state
- NPC relationship changes
- temporary event outcomes

Runtime systems may reference the world model, but they should not become the place where world definition lives.

## 6. Multi-Agent AI Architecture

The shared design recommends using an orchestrated multi-agent workflow instead of one overloaded prompt.

That architecture is appropriate for future expansion in this project.

### Master Orchestrator

Responsibilities:

- decide which generation mode is active
- route tasks to the correct specialist
- merge results into one world model
- resolve conflicts and missing data

The orchestrator coordinates work rather than inventing every detail alone.
It should also assemble and pass context to specialist agents instead of requiring each agent to hold long-lived internal state.

### Suggested specialist agents

- `Lore Parser AI`
  - extract places, factions, events, constraints, themes from raw text
- `World Specification AI`
  - convert parsed lore into the 9-category world schema
- `Terrain Planner AI`
  - place biome and environment patterns for procedural worlds
- `World Structure AI`
  - place major powers, landmarks, and high-level geography
- `Region Designer AI`
  - split worlds into region-scale playable spaces
- `City Designer AI`
  - define settlements from culture, terrain, and economy
- `Dungeon Designer AI`
  - define internal structure for dungeons and special sites
- `Gameplay Zone AI`
  - map geography into playable encounter areas
- `NPC Social AI`
  - derive culture, roles, attitudes, and local society
- `Dialogue AI`
  - produce NPC dialogue on demand from live state
- `Quest/Event AI`
  - generate hooks, conflicts, and world events

### Stateless agent rule

Specialist agents should be treated as stateless workers.

This means:

- the orchestrator owns workflow and context assembly
- agent calls should receive explicit structured input
- agent calls should return explicit structured output
- agent behavior should not depend on hidden conversation memory

## 7. Validation Layer

If multiple AI agents produce separate outputs, the system needs validators before final world assembly.

### Consistency Validator

Should detect conflicts such as:

- geography that contradicts lore
- settlements in impossible terrain
- faction relationships that do not match history
- incompatible gameplay zone placement

### Data Refiner

Should normalize and compress AI output into schema-safe game data.

This is especially important if the project supports multiple providers or fallback models.

## 8. Map and Rendering Model

The shared chat framed maps as visualizations of the world model. That fits the current architecture and should remain the rule.

For visual direction and composition rules derived from the latest user-provided map references, also use:

- `docs/MAP_REFERENCE_GUIDE.md`

The system should eventually support four scales:

### World Map

Shows:

- continents
- oceans
- major kingdoms
- major landmarks

### Region Map

Shows:

- cities
- roads
- rivers
- forests
- region-level danger and biome information

### City Map

Shows:

- districts
- roads
- markets
- walls
- major buildings

### Dungeon Map

Shows:

- rooms
- corridors
- entrances
- special chambers

Recommended rendering split:

- `SVG` or `Canvas` for world and region maps
- tile or grid systems for city and dungeon spaces
- CSS for interface layout and presentation only

## 9. Gameplay Integration

Because this is not only a world viewer but an RPG, the world model should directly drive gameplay systems.

The generated world should inform:

- encounter selection
- region danger balance
- lore event pools
- NPC and dialogue context
- future quest generation
- special monsters tied to world packs or story arcs

In this project specifically, the unified world model should feed:

- map exploration
- event-based discovery
- turn-based monster encounters
- world archive and resume systems
- custom world creation tools

## 10. Manual Override and Authoring

The shared design strongly emphasizes override support. That matters even more once this project adds developer authoring tools.

The world system should eventually support:

- per-region regeneration
- locked custom monster pools
- hand-authored landmarks
- manually linked lore to a chosen world
- explicit story-to-region associations
- custom world packs uploaded from a dev workflow

This is the bridge between procedural generation and curated content.

## 11. AI Communication Rules

The original design recommends structured data exchange between agents. That should be retained.

Rules:

- agents exchange JSON or schema-checked payloads
- prompts should be short and role-specific
- deterministic calculations stay in code, not in AI
- expensive content generation should be lazy when possible

Good candidates for lazy generation:

- NPC dialogue
- local event text
- optional lore expansion

## 12. Performance Strategy

To keep the system practical across multiple AI providers, generation should optimize for cost and consistency.

Recommended strategies:

- split tasks into narrow jobs
- cache intermediate structured outputs
- minimize context passed between agents
- use code for deterministic calculations
- generate dialogue and optional flavor text only when needed

## 13. Implementation Direction for This Repo

This repo already contains several pieces that can evolve toward this design:

- procedural world seeds and presets
- custom world metadata
- region-based exploration
- weighted monster spawning
- lore and event systems
- save/load and world archive behavior
- AI-assisted interpretation for player-facing systems

Recommended next implementation layers:

### Phase 1

Stabilize the current unified world object used by gameplay and save/load.

### Phase 2

Expand world metadata so custom worlds preserve richer structured information:

- tone
- geography
- factions
- history
- hooks

### Phase 3

Introduce authored world-pack tooling:

- upload world pack definitions
- attach monsters to world packs
- attach lore and story entries to a specific world

### Phase 4

Support richer map scales and region presentation from the world model.

### Phase 5

Add AI orchestration and validator/refiner layers for larger custom-world workflows.

## 14. Summary

The shared conversation describes a strong long-term architecture for this project:

- two world generation modes
- one unified world model
- multi-scale rendering
- modular AI specialists
- validation and manual overrides
- direct connection from world data to gameplay

For this codebase, the key takeaway is simple:

The project should keep moving toward a world-first RPG architecture where maps, monsters, lore, events, and future dev tools all read from the same structured world data.
