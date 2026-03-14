# Planner Sync Report - 2026-03-14

## Integration Overview
- **Branch**: `work`
- **Latest Commit**: `bd9d99b`
- **Active Objective**: Phase 1 - Core Loop Stabilization (State Consistency)

## System Mapping & Issues

### FILE: src/core/sessionPersistence.ts
- **Role**: Reconciles database records into the `GameStateManager` and serializes session data for storage.
- **Issue**: Mapping between `last_event` JSON and `TraversalRuntimeState`.
- **Planned Change**: Harden `parseStoredWorldSession` logic.
- **Status**: Researching.

### FILE: src/api/gameplayRoutes.ts
- **Role**: Main API router for game logic. Handles `/start`, `/event`, `/travel`, and `/save`.
- **Issue**: Race conditions and stale state overwrites.
- **Implemented Change**: 
  - Updated `/save` to return `revision` and `savedAt`.
  - Added **Optimistic Locking**: `/save` now requires a `revision` and returns `409 Conflict` (stale_save) if the server has a newer version.
  - Added `/session/validate` for deep consistency checks on init.
- **Status**: PATCHED (Round 2 - Consistency & Locking).

### FILE: src/client/main.ts
- **Role**: Frontend entry point and route manager.
- **Issue**: UI desync during multi-page transitions.
- **Implemented Change**: 
  - Added `pendingSave` guard.
  - `navigateToPage` now awaits `pendingSave` to ensure data persistence before exit.
  - Updated `saveGame` to send `revision` and handle `409 Conflict` with a user notification.
  - Integrated `validateSession` in `onLoginSuccess`.
- **Status**: PATCHED (Round 2).

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
