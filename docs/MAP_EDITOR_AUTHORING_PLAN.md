# Map Editor Authoring Plan

This document defines the target direction for the dedicated dev-side map editor.

## Core Rule

The editor does **not** write canonical world data directly.

Workflow:

1. Load `WorldDefinition`
2. Edit visually
3. Generate override draft
4. Validate
5. Save to `world_overrides`

## Editor Layout

The dedicated route is:

- `/dev-map-editor`

The page is split into:

- a top bar for world selection and save / validate actions
- a left column for world list, tool mode, layers, and quick actions
- a center canvas for topology editing
- a right column for inspector, validation, and override draft output

## Current Build Direction

The first dedicated implementation focuses on:

- visual node / path editing
- draft-first override generation
- validation feedback
- save to `world_overrides`

This matches the canonical architecture already in the codebase:

- `world_definitions` remain the base world truth
- `world_overrides` remain the authored delta layer

## Tool Modes

The editor is expected to operate through explicit tool modes:

- `Select`
- `Move Node`
- `Add Node`
- `Add Path`
- `Delete`
- `Pan`

The first dedicated build already exposes these modes in the UI, even if pan and
more advanced interaction rules still need a richer implementation pass.

## Inspector Design

The right-side inspector is split conceptually into:

- layout-level controls
- node inspector
- path inspector
- override draft output

This allows visual edits to remain understandable while still exposing the exact
override payload that will be saved.

## Validation Rules

The editor should validate at least:

- start node exists
- goal node exists
- path endpoints exist
- region ids are unique
- overlapping nodes are flagged
- disconnected graphs are flagged
- secret paths that are immediately visible are warned

The first dedicated route now includes this validation layer directly in the UI.

## Phase Plan

### Phase 1

- dedicated page route
- world list
- canvas render
- selection
- node / path inspector
- override draft preview
- save override

### Phase 2

- stronger add-node flow
- richer path creation flow
- better context actions
- undo / redo
- stronger validation and conflict resolution

### Phase 3

- story binding tabs
- encounter binding
- geography overlay controls
- richer authored path metadata

## Relationship To Other Dev Pages

The editor is designed to connect with:

- `/dev-assets`
- `/dev-assets/slices`
- `/dev-assets/audio`
- `/dev-terrain`

This matters because topology authoring should eventually bind into:

- terrain recipes
- geography palettes
- local map generation
- story packs

## Summary

The dedicated map editor is meant to become the main authoring surface for:

- topology editing
- override drafting
- validation-driven world patching

It should feel like a real game authoring tool, while still preserving the
project rule that canonical worlds are patched through override drafts instead of
being edited in place.
