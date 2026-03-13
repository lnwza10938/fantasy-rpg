# Mythic Atlas Color System

This document locks the official **Mythic Atlas** color palette and visual color rules for the project.

It should now be treated as the source of truth for:

- player-facing UI theme work
- frontend refactors
- new panels and controls
- map node state styling
- combat, dialogue, and tooltip presentation

This palette was formalized from the latest shared design reference on **March 13, 2026**.

## Purpose

The project has gone through multiple visual eras already:

- dashboard-like green panels
- Terraria-inspired bright menu styling
- early gold / purple fantasy styling

That made the UI inconsistent between pages and caused Codex / AI-generated UI work to drift.

The goal of this document is to stop that drift by locking:

- background values
- surface values
- gold hierarchy
- accent colors
- node-state colors
- bars, glow, and action rules

## Core Theme Direction

Theme name:

```text
Mythic Atlas
```

Visual identity:

- ancient atlas
- dark stone
- gold framing
- restrained glow
- readable spacing
- no flat dashboard green as the dominant tone

The project should now aim for:

```text
dark fantasy atlas
```

rather than:

```text
green dashboard
```

## Official Palette

### Background Layer

Use for:

- page background
- world backdrop foundation
- fog / vignette layer

```css
--atlas-bg-0: #0f0f13;
--atlas-bg-1: #15141a;
--atlas-bg-2: #1c1a1f;
--atlas-bg-3: #232129;
```

### Surface Layer

Use for:

- panels
- cards
- dialogue shells
- combat surfaces

```css
--atlas-surface-1: #1f1d24;
--atlas-surface-2: #27242d;
--atlas-surface-3: #2e2b35;
```

### Primary Gold

Use for:

- titles
- borders
- selected objects
- primary actions

```css
--atlas-gold-1: #d4a65a;
--atlas-gold-2: #e7c67a;
--atlas-gold-3: #9c7a3b;
--atlas-gold-4: #6e5527;
```

Primary gold gradient direction:

```text
#e7c67a -> #9c7a3b
```

### Accent Colors

Use with care for magic, map states, and special content:

```css
--atlas-purple: #a06cff;
--atlas-blue: #8fd6ff;
--atlas-green: #3fbf6a;
--atlas-orange: #ff875f;
```

### Danger / Combat

Use for:

- boss emphasis
- damage
- enemy highlights
- dangerous actions

```css
--atlas-red-1: #d84545;
--atlas-red-2: #a83232;
--atlas-red-3: #731f1f;
```

### Text

```css
--atlas-text-primary: #f2f2f2;
--atlas-text-secondary: #bfbfbf;
--atlas-text-muted: #7a7a7a;
```

## Map Node Colors

These are now the canonical player-facing node colors for map UIs:

```css
--atlas-node-undiscovered: #5b5b63;
--atlas-node-discovered: #d4a65a;
--atlas-node-current: #e7c67a;
--atlas-node-secret: #a06cff;
--atlas-node-boss: #d84545;
--atlas-node-cleared: #3fbf6a;
```

Use them for:

- `/adventure`
- `/map`
- `/dev/map-editor` previews where player-style states are shown

## Bars and Resource Colors

```css
--atlas-hp: #d84545;
--atlas-mana: #5fa8ff;
--atlas-stamina: #3fbf6a;
```

## Glow Rules

Glow should remain subtle and intentional.

Approved glow tokens:

```css
--atlas-glow-gold: rgba(212, 166, 90, 0.4);
--atlas-glow-purple: rgba(160, 108, 255, 0.35);
--atlas-glow-red: rgba(216, 69, 69, 0.35);
```

Use glow only for:

- hover
- selected map nodes
- magical emphasis
- boss / danger feedback

Avoid large soft neon glows across entire panels.

## Component Color Rules

### Primary Buttons

Use:

- gold gradient
- dark text
- strong contrast

Recommended direction:

```css
background: linear-gradient(#e7c67a, #9c7a3b);
color: #1c1a1f;
```

### Secondary Buttons

Use:

- dark surface
- gold border
- light text

### Danger Buttons

Use:

- red fill or red-accented border
- no bright saturated dashboard red blocks unless the action is truly destructive

### Dialogue Box

Use:

- dark surface
- gold border
- bright readable text

### Tooltip

Use:

- panel-dark background
- gold or muted-gold outline
- small readable type

## CSS Integration Rule

The frontend should now expose these tokens directly in CSS as `--atlas-*`.

For compatibility with older code, existing aliases may remain:

- `--color-bg`
- `--color-panel`
- `--color-gold`
- `--color-accent`
- `--color-danger`

But all new UI work should prefer the official `--atlas-*` names first.

## Migration Guidance

When updating or building UI:

1. use `--atlas-*` as the source palette
2. keep older aliases only for compatibility
3. replace flat green dashboard emphasis with atlas surfaces and gold accents
4. avoid introducing unrelated palette systems

## Design Guardrails

Do:

- use dark backgrounds
- use gold for hierarchy and selection
- use accent colors sparingly
- keep readability higher than ornament

Do not:

- let green become the dominant panel color
- use bright flat UI blocks for major surfaces
- mix multiple visual eras on one page
- create route-specific color systems without updating this document

## Current Project Impact

This color system should directly guide:

- `/hub`
- `/adventure`
- `/map`
- `/forge`
- `/vault`
- `/dev/*`

It should also shape:

- future component extraction
- combat presenter cleanup
- dialogue system styling
- dev map editor polish

## Next Step

The next design-system document that should grow out of this is:

```text
Mythic Atlas UI Kit / Component Guide
```

That future document should define:

- panel
- action button
- tooltip
- battle menu
- node
- route
- inventory grid
- dialogue box

For now, this file is the official color and visual token lock.
