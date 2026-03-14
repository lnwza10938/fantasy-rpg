# Figma & UI Structure Guide

This document outlines the visual structure and component organization for the **Fantasy RPG** project, following the **Mythic Atlas** design system.

## Visual Identity: Mythic Atlas
The core aesthetic is "Dark Fantasy Atlas" characterized by:
- **Primary Surfaces**: Dark Stone (#15141a - #1c1a1f).
- **Accents**: Gold hierarchy (#d4a65a, #e7c67a).
- **Secondary Tones**: Restrained Purple/Blue for magical elements.

## Core Screen Hierarchy

### 1. The Hub (Dashboard)
- **Purpose**: High-level overview of the current session and previous records.
- **Layout**: Character summary card, Recent Journeys list, and Navigation links to Forge/Vault/Map.

### 2. The Legend Vault (Hero Archive)
- **Purpose**: Management of all created characters.
- **Layout**: Grid of Hero cards displaying Level, Origins, and Signature Skill.

### 3. The Forge (Hero Creation)
- **Purpose**: Character generation and Signature Skill rolling.
- **Key Component**: **The Nonagram (9-Pointed Star)**.
  - Interactive SVG animation for rolling the 9-digit skill code.
  - Pulsing glow effects during the "Interpreting..." state.

### 4. The World Map (Topology Viewer)
- **Purpose**: Visualizing world progress and node navigation.
- **Layout**: SVG/Canvas graph showing Nodes and Paths.
- **Node States**: Current (Gold Glow), Cleared (Green Accent), Discovered (Muted Gold), Undiscovered (Grey).

### 5. The Adventure (Main Gameplay)
- **Purpose**: Travel, Events, and Combat.
- **Components**:
  - **Narrative Panel**: Local event descriptions and choice buttons.
  - **Combat Stage**: Dedicated sprite slots for Hero and Enemies, Action Deck, and Turn Log.

## Component Standards
- **Buttons**: Gold gradient fill for primary actions; Bordered dark surfaces for secondary actions.
- **Typography**: Serif titles for lore-heavy headers; Sans-serif for data-heavy stats.
- **Panels**: Slightly rounded corners (4px-8px) with subtle 1px gold/stone borders.

## UI Organization (Folder Mapping)
- `src/client/pages/`: Individual entry points for each screen.
- `src/client/components/`: Reusable UI elements (Nonagram, Stat Bars, Modal Shells).
- `docs/MYTHIC_ATLAS_COLOR_SYSTEM.md`: Source of truth for all color tokens.
