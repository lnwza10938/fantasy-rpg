# Planner Sync Report - 2026-03-14

## Integration Overview
- **Branch**: `work`
- **Latest Commit**: `bd9d99b`
- **Active Objective**: Phase 1 - Core Loop Stabilization (State Consistency)

## System Mapping & Issues

### FILE: src/core/sessionPersistence.ts
- **Role**: Reconciles database records into the `GameStateManager` and serializes session data for storage.
- **Issue**: Current mapping between `last_event` JSON and the `TraversalRuntimeState` is complex.
- **Planned Change**: Harden the `parseStoredWorldSession` logic with stricter schema validation.
- **Status**: Researching.

### FILE: src/api/gameplayRoutes.ts
- **Role**: Main API router for game logic. Handles `/start`, `/event`, `/travel`, and `/save`.
- **Issue**: Race conditions where page transitions happen before `autoSave` completes.
- **Implemented Change**: Updated `/save` to return a `revision` (timestamp) and wait for the DB operation to complete. Added `/session/validate` endpoint for revision checking.
- **Status**: PATCHED (Round 1).

### FILE: src/client/main.ts
- **Role**: Frontend entry point and route manager.
- **Issue**: Global state reset on page load leading to stale data if the previous save was slow.
- **Implemented Change**: Added `pendingSave` guard and `waitForPendingSave()` synchronization. Integrated `validateSession()` on app initialization to check revisions.
- **Status**: PATCHED (Round 1).

### FILE: src/core/worldSystem.ts
- **Role**: Manages the singleton `WorldInstance` on the server.
- **Issue**: The `worldSystem` instance is shared across characters in memory but should be character-specific or cleared between calls. In serverless, it's ephemeral, but in local dev, it might leak state.
- **Planned Change**: Move from a singleton `worldSystem` to a per-session context for instances.
- **Status**: Identified.

## Transition Tracking (Adventure/Combat)
- **Path**: `src/api/gameplayRoutes.ts` -> `/battle/action`
- **Issue**: If the client refreshes during a combat turn, the `combatSessions` map (in-memory) is lost.
- **Planned Change**: Persist `ActiveCombatSession` to a dedicated `combat_states` table so combat can survive page refreshes.

## Summary Checklist
- [x] Map session restore paths.
- [x] Map Save/Load paths.
- [x] Map Travel/Map paths.
- [x] Identify transition issues.
- [ ] Push sync report to Git.
