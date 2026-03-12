# Multi-Agent Asset AI Plan - March 13, 2026

This document describes the planned AI agent split for asset ingestion.

The main reason for this split is to avoid putting too much burden on one model:

- lower cost
- lower rate-limit pressure
- better specialization
- safer fallbacks

## Agent Roles

### 1. Vision Caption Agent

Input:

- image file or preview

Output:

- short caption
- likely scene content

Current direction:

- free Hugging Face image captioning

### 2. Filename Match Agent

Input:

- filename
- title
- tags
- AI caption

Output:

- `match`
- `partial`
- `mismatch`
- expected terms
- matched terms
- missing terms

### 3. Asset Kind Agent

Input:

- filename
- mime type
- dimensions
- caption
- metadata hints

Output:

- `single`
- `sheet`
- `atlas`
- `gif`
- `audio`
- `unknown`

### 4. Slice Planner Agent

Input:

- image
- dimensions
- asset kind guess
- filename and tags

Output:

- slice mode
- frame width
- frame height
- row / column estimate
- grouping hints

### 5. Terrain Role Agent

Input:

- caption
- filename
- source bucket
- tags

Output:

- biome fit
- terrain type
- structure type
- intended use
- render layer

### 6. Metadata Mapper Agent

Input:

- AI outputs from the agents above
- current source schema

Output:

- DB-safe record JSON

### 7. Validator / Repair Agent

Input:

- draft JSON
- source schema

Output:

- repaired JSON
- unsupported field removal
- type coercion where safe

## Audio Agent Expansion

Later audio-specific agents can include:

### Audio Cue Classifier

Output:

- `ambient`
- `bgm`
- `sfx`
- `ui`
- `voice`

### Biome / Mood Fit Agent

Output:

- suitable biome
- mood
- intensity
- loopability hint

## Orchestration Rule

The system should prefer:

1. cheap/free specialized pass
2. schema-safe normalization
3. heuristic fallback if AI fails

The system should never block the dev workflow entirely if AI is unavailable.

## Current Phase

Implemented now:

- image caption + filename review
- heuristic fallback
- asset kind guessing

Next target:

1. slice planner
2. terrain role classifier
3. audio cue classifier
