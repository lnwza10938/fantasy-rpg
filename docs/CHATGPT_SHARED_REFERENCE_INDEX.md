# ChatGPT Shared Reference Index

This document tracks the public ChatGPT shared links provided for this project so they can be reused as architectural reference without re-discovering the thread history.

All links below are public shared conversations titled `การออกแบบระบบแผนที่`.

## Purpose

Use this file as the reference index when deciding:

- world-generation architecture
- world/runtime data boundaries
- map topology design
- staged implementation order
- what to prioritize next

It is not a replacement for the project docs derived from these links. It is the source index that points back to them.

## Current Decision Summary

After reviewing the shared links together, the current repo direction should remain:

- keep `World Definition` as the canonical source of truth
- keep `World Session State` and traversal state separate from world definition
- treat map topology as a graph, with canonical nodes and paths
- derive adjacency from path data instead of storing competing truth
- prioritize traversal-engine work over more renderer polish or more speculative generator layers

In practice, that means the next architecture-heavy work should focus on:

1. canonical topology cleanup
2. runtime node-state and traversal rules
3. adventure/map flow that respects reachable paths
4. authoring and override tooling on top of that stable graph

## Reference Links

### 1. Core World Generation Design

- Link: `https://chatgpt.com/s/t_69b1e382f4888191adadeed9871860a5`
- Published: March 11, 2026
- Role: foundational design reference
- Main value:
  - defines world-first architecture
  - defines procedural and custom world pipelines
  - defines unified world model as the canonical source of truth
  - defines override support and multi-scale map thinking
- Local derived doc:
  - `docs/WORLD_GENERATION_SYSTEM_DESIGN.md`

### 2. Staged Codex Build Strategy

- Link: `https://chatgpt.com/s/t_69b1e731c1588191b962ae4ef1bd2008`
- Published: March 11, 2026
- Role: implementation-order reference
- Main value:
  - argues for building in layers
  - emphasizes architecture before renderer/gameplay coupling
  - supports using small, scoped implementation steps instead of large rewrites
- Local derived doc:
  - `docs/CODEX_PROMPT_STRATEGY_REPORT.md`

### 3. Architecture Review and Corrections

- Link: `https://chatgpt.com/s/t_69b1e8c8dc508191be743373e5141b40`
- Published: March 11, 2026
- Role: review of the first two references
- Main value:
  - reinforces that the world model must be canonical
  - reinforces separation of `World Definition` vs `Runtime Game State`
  - recommends stateless specialist agents and an orchestrator layer
  - helps trim premature work such as jumping too early into renderer-heavy features
- Local impact:
  - used to refine `docs/WORLD_GENERATION_SYSTEM_DESIGN.md`
  - used to refine `docs/CODEX_PROMPT_STRATEGY_REPORT.md`

### 4. Topology and Traversal Review

- Link: `https://chatgpt.com/s/t_69b2726abe4081919d5e788d54747969`
- Published: March 12, 2026
- Role: practical review of the current topology direction
- Main value:
  - validates graph-based topology for the project
  - recommends avoiding duplicated map-position truth between `regions` and `mapLayout`
  - recommends treating `paths` as canonical and deriving `connections`
  - recommends storing node progress such as `discovered`, `visited`, `cleared`, and `locked` in runtime state
  - points toward a traversal engine as the next major system
- Local impact:
  - informs current map/traversal decisions
  - should guide the next refactor of topology and adventure progression

## How To Use These References

When a future task touches the systems below, start from these links and then move to the local docs:

- for world architecture:
  - start with reference 1
  - then read `docs/WORLD_GENERATION_SYSTEM_DESIGN.md`

- for implementation order:
  - start with reference 2
  - then read `docs/CODEX_PROMPT_STRATEGY_REPORT.md`

- for design corrections:
  - use reference 3 to validate assumptions before large refactors

- for map/traversal decisions:
  - use reference 4 before changing topology, region movement, or route rules

## Notes

- These links are external planning references, not runtime dependencies.
- If a link becomes unavailable later, the derived local docs should remain the working source inside this repository.
- If more shared planning links are added later, append them here with their purpose and local impact.
