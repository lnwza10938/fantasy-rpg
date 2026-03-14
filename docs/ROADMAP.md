# Project Roadmap - Fantasy RPG

This roadmap defines the stabilization and expansion phases for the **Procedural Fantasy RPG** engine.

## Phase 1: Core Loop Stabilization (Current Focus)
Goal: Ensure a 100% reliable "Start-to-Save/Load" journey.

- [ ] **State Consistency**: Fix state synchronization between Hub, Vault, Forge, and Adventure screens.
- [ ] **Traversal Tracking**: Ensure the "Current Region" and Node state are correctly tracked and persisted across transitions.
- [ ] **Reliable Session Recovery**: Validate that cold starts and page refreshes restore the exact player context.
- [ ] **Bug-Free Flow**: Optimize the sequence: `Travel -> Event -> Combat -> Reward -> Continue`.

## Phase 2: Minimum Combat & Progression
Goal: Transition from functional combat to meaningful gameplay depth.

- [ ] **Skill Mechanics**: Fully implement Mana, Cooldowns, and Scaling for Signature Skills.
- [ ] **Item Economy**: Integration of usable items (Potions, Gear) within the combat loop.
- [ ] **Defeat/Recovery Flow**: Implement meaningful consequences for defeat and recovery mechanics.
- [ ] **Initial Balancing**: Establish base EXP and Gold reward curves.

## Phase 3: World Identity & Presets
Goal: Make World Presets structurally distinct.

- [ ] **Preset Topology**: Differentiate how "Inferno", "Balanced", and "Void" presets affect map layout.
- [ ] **Weighted Distribution**: Regional enemy pools and event types should shift based on world theme.

## Phase 4: UX & Visual Clarity (Mythic Atlas)
Goal: Finalize the migration to the official high-fidelity theme.

- [ ] **Theme Uniformity**: Apply "Mythic Atlas" (Dark Stone/Gold) across all remaining legacy panels.
- [ ] **Battle Interface**: Simplify the command deck for faster decision-making.
- [ ] **Map Readability**: Improve visual contrast for discovered vs. undiscovered routes.

## Phase 5: Expansion & Tooling
Goal: Scale content variety through automated systems.

- [ ] **Terrain Recipes**: Implement bio-specific asset binding for automated geography rendering.
- [ ] **AI Lore Pipeline**: Integrate multi-agent lore 분석 for generating custom realms.
