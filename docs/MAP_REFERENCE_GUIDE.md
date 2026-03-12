# Map Reference Guide

This document records the user-provided visual references shared on **March 12, 2026** for future map work in this project.

It is a visual-direction guide, not a replacement for the canonical world architecture in `WORLD_GENERATION_SYSTEM_DESIGN.md`.

## Purpose

Use this file when making decisions about:

- world-map composition
- regional-map presentation
- coastlines, rivers, mountains, and biome readability
- settlement placement and label style
- dungeon / structure battle-map layout
- how traversal overlays should sit on top of geographic art

The main rule remains:

- `World Definition` is the source of truth
- maps are a rendered view of that data

This guide exists to keep the rendered result visually coherent and grounded in a stronger fantasy-cartography direction.

## Reference Set Summary

The current visual reference set contains five useful categories.

### 1. Painted World Atlas

The first image shows a large fantasy world with:

- multiple continents and island chains
- strong biome separation
- mountain walls, river systems, coast detail, and climate contrast
- named capitals and region banners
- ocean labeling and large-scale negative space

This is the strongest reference for:

- macro world composition
- continent spacing
- major regional identity
- high-level label hierarchy

### 2. Regional Adventure Map

The second image is a closer regional map with:

- mountain passes and chokepoints
- rivers and roads that explain travel flow
- towns, castles, ports, and ruins embedded in terrain
- local threats and landmarks placed near meaningful routes

This is the strongest reference for:

- region-scale path logic
- settlement placement
- traversal-aware geography
- converting topology into believable terrain

### 3. Parchment Macro Outline Map

The third image uses a simpler parchment look with:

- clean continent silhouettes
- light terrain indication
- large empty seas
- restrained palette and ink-like border treatment

This is the strongest reference for:

- early-pass procedural world previews
- low-detail world generation output
- “atlas draft” style renders before full paint detail exists

### 4. Interior Structure Battle Map

The fourth image is a top-down interior map with:

- readable room purpose
- warm lighting pools
- tables, props, walls, and clear walkable lanes
- a strong central hall with attached support rooms

This is the strongest reference for:

- inns, halls, keeps, guild buildings, and social interiors
- encounter-space readability
- future settlement / structure maps

### 5. Cave / Dungeon Battle Map

The fifth image mixes masonry rooms and natural tunnels with:

- cave branches and cut-stone chambers
- light placement as path guidance
- hazard pockets and debris
- readable combat lanes without becoming too empty

This is the strongest reference for:

- dungeon generation
- ruin / crypt / lab spaces
- hybrid natural-artificial encounter maps

## Visual Principles To Reuse

### World maps should feel geographic first

The world map should not look like a diagram with nodes floating in space.

It should communicate:

- landmass silhouette
- climate bands
- mountain ranges as barriers
- rivers as civilization anchors
- coastline logic
- archipelagos and offshore identity

The traversal graph can sit on top of this, but the geography should still feel believable on its own.

### Regions need strong territorial identity

Each major region should read at a glance through:

- one dominant biome family
- one or two landmark mountain / forest / desert shapes
- a clear capital or anchor settlement
- a short readable label or banner

Good regions should feel visually distinct even before the player reads text.

### Travel routes should come from terrain

Routes should prefer believable geographic logic:

- passes through mountains
- roads between settlements
- river-adjacent travel corridors
- coastal travel where inland barriers are strong
- rare secret paths through forests, ruins, caves, or magical zones

This is important because the current traversal engine uses `nodes` and `paths`, and those paths should eventually feel embedded in the map rather than arbitrarily connected.

### Negative space matters

Large oceans, snowfields, wastelands, and forests should preserve room to breathe.

Do not overcrowd the map with:

- too many labels
- evenly spaced landmarks
- icons on every patch of land
- route lines crossing every region

Empty space is part of scale and mood.

### Interior maps need readable combat lanes

For building and dungeon maps:

- rooms should have clear purpose
- pathways should read immediately
- clutter should support atmosphere without blocking all movement
- light sources should guide the eye
- encounter areas should have a few strong focal points instead of uniform furniture spam

## Mapping This To The Current Architecture

These references fit the current project architecture best when separated into layers.

### Layer 1. Canonical topology

This remains the game-truth layer:

- `WorldDefinition`
- `regions`
- `mapLayout.nodes`
- `mapLayout.paths`
- traversal state

This layer answers:

- where regions exist
- how they connect
- what danger and biome they hold
- which routes are blocked, hidden, hazardous, or open

### Layer 2. Geographic render data

This should become the visual layer that wraps topology in believable terrain:

- continent silhouettes
- coastline shapes
- mountain belts
- river systems
- forests / snowfields / deserts
- settlement markers
- label placement

This layer should be generated from the world model or patched through overrides, but it should not replace the topology truth.

### Layer 3. Local encounter maps

This is for:

- settlements
- interiors
- dungeons
- ruins
- caves

These should be tied to world locations, but they are not the same thing as the world traversal map.

## Practical Rules For This Repo

When continuing world-map work, prefer these rules.

### 1. Keep graph truth and painted geography separate

Do not collapse `mapLayout` into purely decorative art data.
Do not make the renderer invent topology that the world model does not contain.

### 2. Stop treating every region as an isolated card

A region should increasingly feel like territory on land, not just a name in a list.

That means:

- give regions shape and surrounding terrain context
- show nearby barriers and neighbors
- place their entry routes intentionally

### 3. Use natural barriers for gating

If a path is blocked or difficult, the map should eventually support that visually through:

- mountain passes
- ravines
- swamp crossings
- frozen waters
- ruin corridors
- magical storms

### 4. Distinguish world scale from battle-map scale

The world map should remain broad and atmospheric.
The local map should be more tactical, gridded, and room-driven.

Do not force one rendering style to do both jobs.

### 5. Let custom worlds start simple, then deepen

For custom-world generation, a good staged flow is:

1. parchment-style silhouette and continent pass
2. biome and landmark enrichment
3. route / settlement placement
4. local structure and dungeon map attachment

This matches the reference set well and is more realistic than trying to fully paint every scale in one pass.

## Implications For Future Systems

### World generator

The generator should eventually support:

- macro landmass layout
- biome belts and geographic barriers
- settlement placement by rivers, coasts, passes, and resources
- visual anchor landmarks per region
- submap hooks for city / structure / dungeon spaces

### `/map` page

The `/map` page should evolve toward:

- an atlas-like geographic base layer
- traversal overlays aligned to the landmass
- clearer regional identity
- less “floating node board” feeling

### `world_overrides`

Overrides should eventually be able to patch:

- coastline / region art metadata
- settlement marker positions
- route display style
- landmark selection
- local map attachment for structures and dungeons

### Dev authoring

The future dev page should support uploading or linking:

- world-atlas backgrounds
- region overlay art
- settlement icons
- dungeon / interior maps
- local encounter-map assets bound to a region or structure

## Recommended Immediate Next Steps

The next map-related work should follow this order:

1. Add a geographic base layer behind the current traversal graph.
2. Align route rendering to terrain logic such as passes, roads, rivers, or coastlines.
3. Give major regions stronger visual anchors and label treatment.
4. Add support for region-level local maps and structure/dungeon attachments.
5. Expose override hooks so dev tooling can patch the visual layer without breaking topology.

## Reference Usage Notes

These images are references for:

- composition
- layering
- terrain readability
- route logic
- dungeon readability

They are not templates to copy literally.

The target for this project is:

- a readable fantasy atlas at world scale
- a traversal-aware regional map at gameplay scale
- top-down tactical maps for interiors and dungeons

That combination matches the current architecture and gives the cleanest path from procedural generation to curated world authoring.
