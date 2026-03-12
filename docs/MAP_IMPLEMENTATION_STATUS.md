# Map Implementation Status - March 13, 2026

This document focuses specifically on the current implementation status of the **map / world authoring** side of the project as of **March 13, 2026**.

## Current Stage

The map system is now past the prototype stage.

It currently has:

- canonical world definitions stored in the database
- deterministic node-and-path topology generation
- a first geography render layer generated from world data
- traversal-aware runtime state
- a dedicated `/map` route
- an integrated `/adventure` map gameplay surface
- guided `world_overrides` authoring inside the dev panel

In short:

- the game can already **generate**, **load**, **display**, and **play through** topology-based worlds
- the dev side can now **start patching canonical worlds intentionally**
- the project is now entering the phase where **direct topology editing** and **story binding** make more sense than more structural refactors

## What Is Fully In Place

### 1. Canonical World Model

The project already has a shared world model with:

- `WorldDefinition`
- `WorldRegion`
- `WorldMapLayout`
- `WorldMapNode`
- `WorldMapPath`

This means the map is not a loose UI layer anymore. It is backed by world data that can be saved, restored, and patched.

### 2. Canonical Persistence

The database layer now stores and restores canonical world data through:

- `world_definitions`
- `world_overrides`

Current behavior:

- generated worlds are persisted
- load / cold-start restore prefers canonical world rows
- overrides are applied on top of the stored world definition when the world is hydrated

### 3. Map-First Generation

The world generator already produces:

- regions
- node positions
- path connections
- path types
- start / goal structure
- landmark / icon / accent metadata

This means topology is already real gameplay data, not just presentation.

### 4. Traversal Layer

Traversal is implemented in active gameplay.

Currently supported:

- current node tracking
- reachable node logic
- discovered / visited / cleared state
- backend validation before travel
- path visibility states
- hazard / secret / gated route metadata
- save/load support for traversal state

This is enough to call the project a **graph-based map RPG** already, even if the progression layer is not final.

## What Was Added Most Recently

### 1. Guided World Override Authoring In Dev Panel

The dev panel now has a usable authoring flow for `world_overrides`.

It no longer depends only on hand-written JSON.

Current authoring support includes:

- selecting a target world from existing `world_definitions`
- choosing override type directly in the editor
- choosing scope and target region
- seeding safe payload templates
- mirroring current canonical world data into the override payload
- syncing the helper UI from JSON and back again

Supported override directions now include:

- `patch_region`
- `set_map_layout`
- `patch_metadata`
- `replace_definition`

### 2. Safer Override Validation

The dev repository layer now validates map-authoring records more strictly.

Examples:

- `world_definition_id` is required for overrides
- `override_type` must be valid
- `payload_json` must be an object
- `patch_region` must use region scope and a region reference

This matters because map authoring is now modifying canonical world data, so bad records are more dangerous than ordinary content mistakes.

### 3. Direct Authoring Shortcut From World Definitions

Inside the dev panel, `World Definitions` can now open directly into a new override flow.

### 4. Geography Render Layer - Phase 1

The map now has a first geography-aware background layer generated from the canonical world itself.

Current behavior:

- each region can project a terrain zone behind the topology graph
- paths can seed background rivers, ridges, or mist bands
- biome and accent metadata now influence the visual look of the map surface
- older worlds still fall back safely to generated geography if no explicit layer exists yet

This does **not** replace topology as gameplay truth.

It is a render layer behind the graph, which is the correct direction for eventually reaching more atlas-like world maps.

This is important because it turns the workflow into:

1. inspect a canonical world
2. click `Override`
3. seed a patch
4. save the patch into `world_overrides`

That is the first practical authoring loop for map editing in the project.

## What Is Partially Complete

### 1. Map Authoring

Map authoring now exists, but it is still **payload-first**, not yet **visual editor-first**.

That means:

- we can patch regions and layouts intentionally
- but we do not yet have a direct drag/edit UI for nodes and paths on the map surface

This is a major improvement over raw JSON-only editing, but not the final target.

### 2. Traversal Progression

Traversal works, but the progression design is still not fully mature.

Still incomplete:

- stronger route-based gating
- more meaningful hidden-route reveal loops
- better travel-event variety
- clearer start-to-goal campaign structure

### 3. Geography Layer

The current system is now beginning to render geography, but it is not yet geography-rich enough.

Still incomplete:

- landmass-aware continent shaping
- more believable route placement against geography
- separation between world map, regional map, and local tactical map

## What Is Still Missing

These are the most important map-side missing pieces:

### 1. Direct Node / Path Editor

The next map-specific milestone should be a direct authoring surface for:

- adding/removing nodes
- editing node positions
- editing path connections
- editing path properties such as kind, difficulty, visibility, and requirements

This should sit on top of the current canonical world and override system, not replace it.

### 2. Story Binding To World / Region

The current map system is structurally ready for story binding, but the authoring flow is still incomplete.

Needed next:

- bind story files to `world_definition_id`
- bind lore/dialogue to regions or map nodes
- allow world-specific narrative packs to ride on top of canonical worlds

### 3. Geographic Render Layer

The game still needs a better render layer that visually reflects terrain and travel space rather than showing the graph alone.

This should follow the direction already documented in:

- `MAP_REFERENCE_GUIDE.md`
- `WORLD_GENERATION_SYSTEM_DESIGN.md`

## Practical Status Summary

If we describe the current map stack in simple terms:

- **Generation**: strong
- **Persistence**: strong
- **Traversal**: usable
- **Canonical world patching**: now usable
- **Visual authoring**: early
- **Story-map integration**: early
- **Geographic renderer**: pending

## Recommended Next Build Order

The most efficient next order is now:

1. build direct `node/path editor` tools on top of the new override authoring flow
2. bind story/lore files to `world_definition_id` and target regions
3. deepen travel/path gameplay rules
4. add a richer geographic render layer behind the topology graph

## Overall Assessment

The map side of the project is now in a strong middle stage.

The most important architectural pieces are already done:

- unified world model
- canonical persistence
- traversal state
- override application
- first guided authoring flow

The project no longer needs another major reset in this area.

From here, the highest-value work is **tooling and content-layer expansion**, not another foundational rewrite.
