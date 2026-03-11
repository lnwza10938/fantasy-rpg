# Save Deletion Feature Implementation Plan

Implement a way for users to delete their saved characters and associated game states.

## User Review Required
> [!IMPORTANT]
> Deleting a save is permanent and cannot be undone. We will implement a simple confirmation dialog on the frontend.

## Proposed Changes

### Backend

#### [MODIFY] [repositories.ts](file:///Users/mon/game_project/src/db/repositories.ts)
- Add `deleteCharacter(id: string)` method.

#### [MODIFY] [gameplayRoutes.ts](file:///Users/mon/game_project/src/api/gameplayRoutes.ts)
- Add `DELETE /api/load/:characterId` endpoint to handle character and state deletion.

---

### Frontend

#### [MODIFY] [index.html](file:///Users/mon/game_project/index.html)
- Add CSS for a delete button within the save cards.

#### [MODIFY] [main.ts](file:///Users/mon/game_project/src/client/main.ts)
- Update `fetchSaveList` to include a delete button for each card.
- Implement `deleteSave(characterId: string)` function with confirmation.

## Phase 12: Character Creation & 9-Digit Skill System

### Backend
#### [NEW] `POST /api/generate-skill`
- Endpoint that takes a 9-digit code and calls the existing AI provider (Gemini/OpenAI) using a strict system prompt to map the 9 digits into a structured JSON skill (Name, Description, Power, Mana Cost).

#### [MODIFY] `gameplayRoutes.ts` & `repositories.ts`
- Ensure Character Creation logic stores the final selected `9-digit code` and the `interpreted skill JSON` directly on the `character` or `player_state` row.

### Frontend
#### [MODIFY] `index.html`
- Create a dedicated "Character Creation" screen separate from the "World Creation" screen.
- Implement a 9-Pointed Star layout using CSS (absolute positioning or SVG) to visually represent the 9 digits of the skill code.

#### [MODIFY] `main.ts`
- Implement roll logic: Generates a random 9-digit string.
- Fetch interpretation from `/api/generate-skill`.
- Allow infinite re-rolls until the player confirms.

## Verification Plan

### Automated Tests
- Verify `createCharacter` correctly persists the `skill_data` JSON.
- Test `/api/start` with an existing `character_id` to ensure game state is correctly linked.

### Manual Verification
1. Create a character in "Forge Legend".
2. Go to "Legend Vault" and verify the character and their 9-digit skill/description exist.
3. Start a "New Adventure", select a world theme, then pick the newly created legend.
4. Verify the game starts with the correct character and skill.

## Phase 14: Legend Vault & Independent Creation

Separating character creation into a new "Forge Legend" page. Characters are stored in a "Legend Vault" and selected when starting a new world.

### Database
#### [NEW] [character_skill_migration.sql](file:///Users/mon/game_project/src/db/character_skill_migration.sql)
- Add `skill_data` JSONB column to `characters` table to persist AI-generated skill descriptions.

### Backend
#### [MODIFY] [repositories.ts](file:///Users/mon/game_project/src/db/repositories.ts)
- Update `createCharacter` to accept `skillData`.
- Update `getCharacter` to return `skillData`.

#### [MODIFY] [gameplayRoutes.ts](file:///Users/mon/game_project/src/api/gameplayRoutes.ts)
- Refactor `POST /api/start` to accept an existing `characterId`.
- Add `GET /api/characters` to list available legends in the vault.
- Add `POST /api/character` to forge a new legend independently.

### Frontend
#### [MODIFY] [index.html](file:///Users/mon/game_project/index.html)
- Add "Legend Vault" and "Forge Legend" screens.
- Update start wizard to character selection instead of creation.

#### [MODIFY] [main.ts](file:///Users/mon/game_project/src/client/main.ts)
- Implement `refreshVault()` and `createLegend()` functions.
- Decouple world setup from character setup.
