# Asset Pipeline Architecture - March 13, 2026

This document defines the **asset ingestion system** used to feed the map, terrain,
regional render, local map, and future atmosphere layers.

The project should no longer treat an uploaded file as a final game-ready asset.

Instead:

- a file is the **source container**
- metadata and AI review describe what the file contains
- a sprite sheet or atlas can produce many **usable sub-assets**
- terrain and map generators read those tagged assets later

## Design Goal

The asset system must support:

- single image assets
- sprite sheets
- atlas packs
- animated GIFs
- audio files
- story / note text files

The system must work with real-world pixel art pipelines where:

- one file may contain many tiles or props
- naming can be noisy or inconsistent
- metadata matters more than filename alone

## Core Model

Current implementation uses `content_entries` as the storage base plus structured
`metadata_json`.

Conceptual layers:

### 1. Source File

Stored in `content_entries`:

- `file_url`
- `preview_url`
- `mime_type`
- `content_kind`
- `category`
- `subcategory`
- `title`
- `slug`
- `tags`
- `metadata_json`

### 2. Asset Classification

Stored in `metadata_json`:

- `assetKind`
  - `single`
  - `sheet`
  - `atlas`
  - `gif`
  - `audio`
- `intendedUse`
- `biome`
- `terrainType`
- `structureType`
- `renderLayer`
- `paletteHints`
- `tileable`
- `seamless`

### 3. Sheet / Atlas Metadata

Also stored in `metadata_json`:

- `sliceMode`
  - `none`
  - `grid`
  - `manual`
  - `auto`
- `frameWidth`
- `frameHeight`
- `columns`
- `rows`
- `padding`
- `spacing`
- `width`
- `height`
- `slices[]`

### 4. Audio Metadata

Stored in `metadata_json` for audio assets:

- `audioType`
  - `ambient`
  - `bgm`
  - `sfx`
  - `ui`
  - `voice`
- `mood`
- `intensity`
- `loopable`
- `biome`
- `intendedUse`

## AI Review Layer

AI review should not be a single monolithic task.

The system should evolve toward specialized agents:

1. `vision-caption`
   - describe image content
2. `filename-match`
   - compare image against filename / title / tags
3. `asset-kind`
   - infer `single`, `sheet`, `atlas`, `gif`, `audio`
4. `slice-planner`
   - suggest frame size, rows, columns, or grouping
5. `terrain-role`
   - classify for `ground`, `cliff`, `water`, `foliage`, `structure`, `overlay`
6. `metadata-mapper`
   - map AI output into DB-safe JSON
7. `validator / repair`
   - fix malformed JSON or unsupported fields

Current implementation has:

- filename / image review
- captioning via a free Hugging Face image model
- heuristic fallback
- asset kind guessing

## Page Structure

The dev-side asset workflow is intentionally split into separate pages:

- `/dev-assets`
  - main asset library and intake
- `/dev-assets/slices`
  - sprite sheet / atlas slicing workbench
- `/dev-assets/audio`
  - audio-specific intake and metadata
- `/dev-terrain`
  - recipe-driven terrain and geography binding

This keeps the workflow focused and avoids one overloaded page.

## Integration With Map Generation

The map generator should read **asset metadata**, not raw filenames.

Examples:

- `forest` + `terrainType=plains` + `renderLayer=background`
  - eligible for broad geography paint
- `structureType=bridge` + `intendedUse=regional-map`
  - eligible for landmark or path accent usage
- `assetKind=sheet` + slice metadata present
  - eligible for tile-based regional or local map rendering
- `audioType=ambient` + `biome=swamp`
  - eligible for swamp exploration ambience

## Immediate Build Direction

The next useful layers after the current implementation are:

1. richer sheet slicing and sub-asset editing with drag-to-slice
2. AI-assisted slice planning
3. deeper terrain recipe authoring, weighting, and validation
4. local map / dungeon tileset usage
5. stronger audio classification

## Practical Rule

From this point on:

- uploaded files are not assumed to be immediately usable
- every asset should pass through classification and metadata tagging
- terrain generation should prefer tagged assets over ad hoc name matching
