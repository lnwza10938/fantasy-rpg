# Dev Data Entry Guide

This guide explains how to add records through the dev pages so the data fits the
current map, asset, and terrain pipeline.

## 1. Asset Library

Use `/dev-assets` when you want to register the original source file.

Good examples:

- Terrain tile sheet
  - `Title`: `Emerald Plains Tileset`
  - `Tags`: `terrain, plains, grass, world-map`
  - `Biome`: `forest`
  - `Terrain Type`: `plains`
  - `Asset Kind`: `sheet`
  - `Slice Mode`: `grid`
  - `Intended Use`: `world-geography, regional-map`

- Landmark background
  - `Title`: `Sunken Temple Backdrop`
  - `Tags`: `background, ruins, temple, mist`
  - `Biome`: `ruins`
  - `Asset Kind`: `single`
  - `Render Layer`: `background`
  - `Intended Use`: `regional-map, landmark`

## 2. Sheet Slicer

Use `/dev-assets/slices` when one uploaded image contains many usable pieces.

Recommended flow:

1. Select the uploaded sheet.
2. Click `AI Slice Plan` for a first guess.
3. Use `Generate Grid` if the suggestion is clean.
4. Switch to `Manual` and drag on the image when the sheet is irregular.
5. Click `Promote To Sub-Assets` when the slices should become reusable records.

Examples:

- Pixel terrain sheet
  - frame size: `32x32`
  - mode: `grid`
  - result: many ground / cliff / foliage slices

- Mixed atlas with props and ruins
  - mode: `manual`
  - drag select the bridge, shrine, tree, and wall segments
  - promote only the good pieces

## 3. Audio Intake

Use `/dev-assets/audio` for ambience, BGM, SFX, UI sounds, and voice clips.

Good examples:

- `Whispering Marsh Night Loop`
  - `Biome`: `swamp`
  - `Audio Type`: `ambient`
  - `Mood`: `haunting`
  - `Intensity`: `low`
  - `Intended Use`: `world-map, exploration`
  - `Loopable`: enabled

- `Temple Battle Rise`
  - `Biome`: `ruins`
  - `Audio Type`: `bgm`
  - `Mood`: `tense`
  - `Intensity`: `high`
  - `Intended Use`: `combat, boss`

## 4. Terrain Recipes

Use `/dev-terrain` to tell the generator which assets, slices, and audio fit a
map context.

A recipe should usually define:

- biome or terrain type
- applies to `zone` or `flow`
- selection weight
- optional danger band
- visual assets and slices
- optional palette override

Good examples:

- Forest plains zone
  - `Biome`: `forest`
  - `Terrain Type`: `plains`
  - `Applies To`: `zone`
  - `Selection Weight`: `120`
  - `Intended Use`: `world-geography, regional-map`
  - attach grass / tree / meadow slices
  - optional `Zone Color`: `rgba(108, 168, 102, 0.78)`

- Hazard ridge flow
  - `Terrain Type`: `ridge`
  - `Applies To`: `flow`
  - `Min Danger`: `5`
  - `Selection Weight`: `140`
  - attach cliff / ridge / dust effect assets
  - optional `Flow Color`: `rgba(92, 88, 84, 0.72)`

## 5. AI To DB

Use `AI To DB` when you have rough notes and want the tool to shape one record.

Best practice:

- describe one record at a time
- include biome / type / intended use in plain text
- say whether it is a single image, sheet, ambient audio, region, monster, or recipe

Good prompts:

- `Create one terrain recipe for a forest plains zone using bright grass tiles, oak tree slices, and light wind ambience. Weight 120. Intended for world geography.`
- `Create one monster record for a level 4 swamp beast called Mirefang Stalker with fast speed and poison flavor.`
- `Create one map record for a volcanic pass with danger 7 and a broken bridge landmark.`

## 6. Practical Rule

From this point on:

- upload the original file in `Asset Library`
- cut or promote it in `Sheet Slicer` if needed
- bind it in `Terrain Recipes`
- let the map generator read those bindings instead of hard-coded assumptions
