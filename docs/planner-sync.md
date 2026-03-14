# Planner Sync Report - 2026-03-14

## Integration Overview
- **Branch**: `work`
- **Latest Commit**: `bd9d99b`
- **Active Objective**: Phase 1 - Core Loop Stabilization (State Consistency)

## System Mapping & Issues

### FILE: src/core/sessionPersistence.ts
- **Role**: Reconciles database records into the `GameStateManager` and serializes session data for storage.
- **Issue**: Current mapping between `last_event` JSON and the `TraversalRuntimeState` is complex. If the JSON structure deviates (e.g., during a schema update), session hydration fails silently to defaults.
- **Planned Change**: Harden the `parseStoredWorldSession` logic with stricter schema validation.
- **Status**: Researching.

### FILE: src/api/gameplayRoutes.ts
- **Role**: Main API router for game logic. Handles `/start`, `/event`, `/travel`, and `/save`.
- **Issue**: The `sessions` cache (in-memory) is unreliable in serverless environments. While `getSession` attempts to hydrate from DB, there are race conditions where a page transition happens before the `autoSave` completes.
- **Planned Change**: Ensure `/save` is awaited before allowing navigation on the frontend, and investigate "stale world" issues during `/start` redirects.
- **Status**: Audit in progress.

### FILE: src/client/main.ts
- **Role**: Frontend entry point and route manager.
- **Issue**: The global `G` object is reset on every page load (since it's a multi-page app). It relies on fetching the state from the API on every page's `init`. If the API returns a stale session because the previous page's save was slow, the UI desyncs.
- **Planned Change**: Implement a "Pending Save" guard on the frontend.
- **Status**: Planning.

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
