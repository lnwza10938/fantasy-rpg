# Codex Prompt Strategy Report

Source summary created from the shared ChatGPT conversation titled `การออกแบบระบบแผนที่`, published on March 11, 2026:
`https://chatgpt.com/s/t_69b1e731c1588191b962ae4ef1bd2008`

This document is a pre-implementation understanding report. Its purpose is to confirm how the shared prompt strategy should be interpreted for this repository before any major code changes begin.

## 1. What the Shared Conversation Is Actually Asking For

The linked conversation does not define new gameplay features directly.

Instead, it defines a strategy for using Codex to build a large system safely:

- do not generate the whole project at once
- build the system layer by layer
- lock architecture and data model before building generators or UI
- keep AI roles modular
- avoid starting from map rendering first

The core instruction is:

```text
architecture
-> data model
-> pipelines
-> AI system
-> renderer
-> gameplay
```

That ordering is the main message of the shared prompt.

## 2. My Understanding of the 12-Step Strategy

The conversation proposes a staged implementation flow for Codex.

### Step 0: Context Load

Load the design document and force the implementation to respect it.

My interpretation:

- Codex should read architecture docs first
- Codex should avoid improvising a simpler system
- future prompts should include only the relevant docs and modules, not the entire repo

### Step 1: Project Skeleton

Create folder structure and placeholder modules first.

My interpretation for this repo:

- this is more useful as a refactor target than a literal first step
- this repository already has working folders under `src/`
- we should not destroy the current structure just to match the example names

### Step 2: Shared Types

Create reusable type definitions for world-related data.

My interpretation:

- shared world, region, biome, faction, settlement, and NPC types should be normalized
- current models should gradually move toward a cleaner shared type layer

### Step 3: Unified World Data Model

Build the core world model that everything else depends on.

My interpretation:

- this is the real foundation
- procedural generation, custom worlds, maps, lore, and gameplay should all use the same data shape
- this step matters more than any rendering or UI step

### Step 4: Manual Override System

Overrides should be modeled as transformations, not direct mutation.

My interpretation:

- future edits like locked landmarks, forced monster pools, or custom story links should be represented as override data
- the base world and the override layer should stay conceptually separate

### Step 5: Procedural Generation Pipeline

Build deterministic generator interfaces.

My interpretation:

- procedural systems should be decomposed into smaller generation stages
- parent context must flow downward rather than each generator inventing everything locally

### Step 6: Custom World Pipeline

Build the text-to-world pipeline.

My interpretation:

- uploaded lore should not skip straight into gameplay
- text should first become a structured world specification
- only then should the playable world be assembled

### Step 7: AI Agent System

Create specialist agents with clear responsibilities.

My interpretation:

- each AI role should have narrow responsibilities
- prompts and outputs should stay structured
- agent boundaries matter more than model personality

### Step 8: Orchestrator AI

Create a coordinator that routes tasks and merges outputs.

My interpretation:

- the orchestrator decides workflow
- it should not become another giant content-generation prompt

### Step 9: Validator System

Create consistency checks between outputs.

My interpretation:

- validators are required if multiple generators or agents can disagree
- validators should report conflicts without silently rewriting data

### Step 10: Map Rendering System

Render maps from the world data model.

My interpretation:

- rendering is downstream of world data
- maps should read from the world model, never become the source of truth

### Step 11: Web Interface

Build a viewer for generated data.

My interpretation:

- UI comes after model and generation layers are stable enough
- otherwise the UI will be tightly coupled to unstable data structures

### Step 12: Gameplay Integration

Connect world data to dialogue, quests, travel, and gameplay.

My interpretation:

- gameplay is the consumer of the world model
- world architecture should be stable before gameplay rules bind to it deeply

## 3. What This Means for This Repository

This repository is not a blank project skeleton anymore.

It already has:

- frontend pages and adventure flow
- API routes
- persistent saves and world archive behavior
- procedural/custom world inputs
- monster spawning and combat
- lore, events, and character systems

Because of that, I understand the shared strategy as an adaptation guide, not a literal rewrite order.

The repo currently looks like this at a high level:

- `src/api` for backend routes
- `src/client` for frontend pages and UI logic
- `src/core` for game logic and world logic
- `src/db` for persistence and content repositories
- `src/models` for shared data shapes

So in this codebase, the staged strategy should be interpreted like this:

### Existing app first, then architecture hardening

We should not stop working features to rebuild the whole tree.

Instead we should:

- identify the world model that already exists
- stabilize and document it
- extract cleaner shared interfaces around it
- gradually move generators and renderers behind those interfaces

### Preserve working gameplay while refactoring

Because the game is already playable, changes should avoid:

- breaking save/load compatibility
- rewriting the whole adventure UI unnecessarily
- replacing working combat/event flow just to satisfy an abstract architecture

### Use the prompt strategy to control scope

The conversation is most valuable as a guardrail:

- one layer per task
- small prompts with only relevant modules
- no giant “build the whole game engine now” prompt

## 4. Repo-Specific Interpretation of Each Layer

Below is my current understanding of how the shared strategy maps into this repo.

### Architecture Layer

Relevant current areas:

- `src/core`
- `src/models`
- `docs/WORLD_GENERATION_SYSTEM_DESIGN.md`

What should happen here:

- define the stable world data contract
- separate generated world data from runtime player state
- clarify which data is canonical and which is derived

### Data Model Layer

Relevant current areas:

- `src/models`
- `src/core/worldSystem.ts`
- `src/core/gameState.ts`

What should happen here:

- normalize `World`, `Region`, enemy pool, lore references, world metadata, and overrides
- make procedural and custom worlds resolve to the same shape

### Pipeline Layer

Relevant current areas:

- procedural world creation in `src/core`
- custom world flows in API and state assembly

What should happen here:

- separate world-building stages more clearly
- formalize inputs and outputs for procedural mode and custom mode

### AI Layer

Relevant current areas:

- AI config routes
- content interpretation hooks
- future dev tooling for story/world uploads

What should happen here:

- define specialist roles as interfaces first
- keep provider-specific logic behind adapters
- prefer structured input/output contracts

### Renderer Layer

Relevant current areas:

- current map/adventure UI
- future world/region/city/dungeon map views

What should happen here:

- render from world model data
- keep visual components isolated from generation logic

### Gameplay Layer

Relevant current areas:

- event system
- combat system
- exploration
- lore events
- world archive

What should happen here:

- make gameplay consume the unified world model rather than local ad hoc fields
- use stable world metadata to drive monster pools, events, and future story hooks

## 5. What I Believe Should Not Be Done

To show understanding clearly, these are the mistakes I believe the shared conversation is warning against:

### Do not start from the map renderer

If rendering comes first, the data model becomes UI-shaped instead of system-shaped.

### Do not ask Codex to build everything in one pass

That creates tight coupling and inconsistent abstractions.

### Do not let AI agents communicate in loose prose

If the multi-agent system grows, it should exchange structured data, ideally JSON-compatible payloads.

### Do not mutate generated world data everywhere

Override logic should be explicit and layered.

### Do not break the existing playable product for a clean-architecture fantasy

This repo already has value. Architecture work should strengthen it, not reset it.

## 6. My Readiness Assessment Before Implementation

Based on the shared strategy, I believe the safest next implementation sequence for this repo is:

### Phase A: Documentation and model alignment

- finalize world architecture docs
- define current unified world shape in code terms
- identify missing fields and duplicated concepts

### Phase B: Type and contract cleanup

- move toward cleaner shared world types
- define stable input/output contracts for world creation
- separate runtime state from world definition state

### Phase C: Pipeline hardening

- formalize procedural world generation stages
- formalize custom world interpretation stages
- add override-friendly world metadata

### Phase D: Rendering and tooling expansion

- add better map-scale rendering only after the world model is stable
- add dev tools for authored world packs and story uploads against the stable model

### Phase E: Advanced AI orchestration

- add specialist agents
- add validator/refiner layers
- add structured communication protocol

## 7. Final Understanding Statement

My understanding of the linked conversation is:

- it is a strategy for controlling Codex, not a request to code everything immediately
- it assumes the world model is the foundation of the entire system
- it requires layered construction and narrow prompts
- it warns against starting from rendering or giant all-in-one prompts
- in this repository, it should be used as an incremental refactor and expansion guide, not as a destructive rewrite plan

If this understanding is accepted, the next step should be to choose one concrete layer and implement only that layer.

The most sensible starting point for this repo is not map rendering yet.

It is the stabilization of the unified world data model and the boundary between:

- world definition
- runtime gameplay state
- overrides / authored content
