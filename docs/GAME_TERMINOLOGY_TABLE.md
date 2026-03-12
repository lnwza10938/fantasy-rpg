# Game Terminology Table

This document locks the core player-facing vocabulary for the **Procedural Fantasy RPG** project.

Its purpose is to keep:

- UI labels consistent across all pages
- player-facing language readable and RPG-like
- AI-assisted UI/content generation aligned to one vocabulary set
- dev terms separate from player terms

This should be treated as the default language system for all future UI cleanup and content authoring.

## Core Naming Rules

Use these rules across the game:

- prefer 1-2 word labels
- prefer familiar RPG language
- keep player-facing labels simple and readable
- do not expose dev-only model terms in normal UI

## Main Navigation

Use these labels in the main navigation:

| Internal / Old Label | Player-Facing Label |
| --- | --- |
| `Hub` | `Home` |
| `Adventure` | `Journey` |
| `Map` | `World Map` |
| `Forge` | `Create Hero` |
| `Vault` | `Hero Archive` |

Approved final navigation set:

```text
Home
Journey
World Map
Create Hero
Hero Archive
```

## World Terminology

Use the following player-facing terms for world data:

| Dev Term | Player-Facing Term |
| --- | --- |
| `World` | `Realm` |
| `Region` | `Location` |
| `Node` | `Area` |
| `Path` | `Route` |
| `Seed World` | `Generated Realm` |
| `Custom World` | `Custom Realm` |

Example:

```text
Realm: The Balanced Realm

Locations
Cursed Meadows
Ash Spire
Obsidian Throne
```

## Traversal Terms

Use the following terms for travel and route-based interaction:

| Dev Term | Player-Facing Term |
| --- | --- |
| `travel` | `Journey` |
| `connections` | `Routes` |
| `unlocked` | `Discovered` |
| `hidden` | `Secret Route` |
| `locked` | `Sealed Route` |

Example:

```text
Routes

Ash Spire
Secret Route
Sealed Route
```

## Gameplay Loop Terms

The main gameplay loop should read like this:

| Dev Term | Player-Facing Term |
| --- | --- |
| `explore` | `Explore` |
| `event` | `Encounter` |
| `combat` | `Battle` |
| `result` | `Outcome` |

Approved loop wording:

```text
Explore
Encounter
Battle
Outcome
```

## Character Terminology

Use one core character term across the game:

```text
Hero
```

Example:

```text
Hero
Aria Stormblade
Level 5
```

## Character Creation

Player-facing creation terminology should use:

```text
Create Hero
```

Use this structure:

```text
Create Hero

Hero Name
Origin
Signature Skill
```

Avoid using `Forge Legend` as the main player-facing label unless it is deliberately retained for lore flavor in a specific place.

## Character Storage

Use:

```text
Hero Archive
```

Example:

```text
Hero Archive

Aria Stormblade
Level 5
Realm: Balanced Realm
```

## World Map Vocabulary

On map-facing screens, prefer:

```text
Locations
Routes
```

Do not expose:

```text
nodes
connections
```

## Enemy Terminology

| Dev Term | Player-Facing Term |
| --- | --- |
| `enemyPool` | `Enemies` |

Example:

```text
Enemies

Sorrow Widow
Warped Husk
Gore Hound
```

## Danger Terminology

Use:

```text
Threat Level
```

Instead of:

```text
dangerLevel
Danger Level
```

Example:

```text
Threat Level: 4
```

## Items and Equipment

Preferred RPG terminology:

```text
Items
Gear
Weapon
Armor
Relic
```

## Skill Terminology

For the player-facing skill system, use:

```text
Signature Skill
```

This should remain the default wording for the 9-digit-derived hero skill.

## Procedural World Terminology

Use:

```text
Generated Realm
```

Avoid exposing raw technical wording like:

```text
Seed
Seed World
```

## Story Terminology

| Dev Term | Player-Facing Term |
| --- | --- |
| `story` | `Story` |
| `dialogue` | `Dialogue` |
| `quest` | `Quest` |
| `event` | `Encounter` |

## Dev Tool Terminology

Dev tools should remain clearly separated from player UI.

Recommended label:

```text
World Editor
```

This is appropriate for the private dev-facing surface and does not need to match player-facing language exactly.

## Example UI Language

### Home

```text
Continue Journey
Create Hero
Hero Archive
World Map
```

### Journey

```text
Current Location
Cursed Meadows

Routes
Ash Spire
Secret Route
```

### World Map

```text
Realm
The Balanced Realm

Locations
Ash Spire
Widow Crossing
Obsidian Throne
```

### Create Hero

```text
Hero Name
Origin
Signature Skill
```

### Hero Archive

```text
Aria Stormblade
Level 5
Realm: Balanced Realm
```

## Terms Players Should Not See

The following are dev/internal words and should be hidden from normal player UI wherever possible:

```text
topology
node
override
metadata
definition
seed
```

## Lore Vocabulary

These terms are approved for world flavor and narrative writing:

```text
Realms
Orders
Relics
Bloodlines
Sigils
Shrines
Ancient Gates
```

## Locked Vocabulary Summary

This is the core approved language set:

```text
Home
Journey
World Map
Create Hero
Hero Archive

Realm
Location
Route

Explore
Encounter
Battle
Outcome

Hero
Gear
Items
Signature Skill

Threat Level
Secret Route
Sealed Route
```

## Usage Guidance

When updating UI or writing new content:

1. use this document as the default vocabulary source
2. prefer player-facing terms in all public UI
3. keep dev-facing technical words in private tooling only
4. if a lore-specific screen intentionally uses a more poetic label, keep the base meaning aligned with this table

This terminology layer should be expanded later into a broader **UI Language System** covering:

- battle text
- encounter text
- confirmation messages
- error states
- action labels
- quest language
