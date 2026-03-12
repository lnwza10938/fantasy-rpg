# Terrain Asset Workflow - March 13, 2026

This document describes how terrain-facing assets move from upload to actual map usage.

## Workflow Overview

1. Upload asset source file
2. Choose source bucket
   - terrain
   - structure
   - background
   - effect
   - character part
   - monster image
   - audio
3. Run AI filename review if the file is visual
4. Set map-facing metadata
5. If the file is a sheet, open the slicer page
6. Save slices and usage hints
7. Let terrain recipes and geography generators read the metadata

## Buckets And Intended Use

### Terrain Assets

Use for:

- landmass paint
- cliffs
- grass
- sand
- snow
- river edges
- biome detail

### Structure Assets

Use for:

- ruins
- cities
- villages
- bridges
- towers
- castles
- shrines

### Background Assets

Use for:

- sky layers
- scenic horizon art
- mist backdrops
- region splash art

### Effect Assets

Use for:

- fog
- magical overlays
- water shimmer
- portals
- sigils

### Audio Assets

Use for:

- biome ambience
- region loops
- combat intensity layers
- menu and UI cues

## Required Terrain Metadata

Every terrain-facing image should ideally define:

- `assetKind`
- `biome`
- `terrainType`
- `renderLayer`
- `intendedUse`
- `paletteHints`
- `tileable`
- `seamless`

If a file is a sheet:

- `sliceMode`
- `frameWidth`
- `frameHeight`
- `columns`
- `rows`
- `padding`
- `spacing`
- `slices[]`

## Generator Usage Rules

### World Map

Reads:

- broad biome and landform assets
- mountain / river / coast / valley shapes
- large landmark structures

### Regional Map

Reads:

- terrain sheets
- path / bridge / settlement accents
- region landmark art

### Local / Dungeon Map

Reads:

- tileset slices
- room props
- floor / wall / doorway pieces
- local effect overlays

## AI Review Rules

For image assets, AI review should answer:

- does the image match the filename?
- what does the image likely depict?
- is it a single image or a sheet/atlas?
- what tags and title are recommended?

For audio assets, later AI review should answer:

- what mood does the cue suggest?
- which biome or scene type fits it?
- is it ambience, BGM, SFX, UI, or voice?

## Current Tooling Status

Implemented now:

- `/dev-assets`
- `/dev-assets/slices`
- `/dev-assets/audio`
- free-model visual filename review
- metadata capture for terrain generation
- slice metadata persistence

Still planned:

- manual slice editing
- sub-asset promotion from slices
- terrain recipe editor
- stronger audio classification
