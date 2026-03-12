// src/core/worldGenerationStages.ts
// Stage contracts for procedural generation and custom-world interpretation.

import type {
  WorldMapGenerationHints,
  WorldGenerationSelection,
  WorldMetadata,
} from "../models/worldTypes.js";
import { worldSystem, type WorldInstance } from "./worldSystem.js";

export interface ProceduralGenerationInput {
  seed: number;
  metadata: WorldMetadata;
  selection: WorldGenerationSelection;
}

export interface TerrainPlan {
  seed: number;
  preset: string;
  primaryBiomes: string[];
  requestedMonsters: string[];
  notes: string[];
}

export interface WorldStructurePlan {
  seed: number;
  metadata: WorldMetadata;
  regionBudget: number;
  laneCount: number;
  routeDensity: number;
  preferredBiomes: string[];
  constrainedMonsterPool: string[];
}

export interface WorldInterpretationInput {
  seed: number;
  metadata: WorldMetadata;
  selection: WorldGenerationSelection;
  loreText?: string;
}

export interface LoreParseResult {
  rawText: string;
  extractedKeywords: string[];
  namedLocations: string[];
  toneHints: string[];
}

export interface CustomWorldSpecification {
  metadata: WorldMetadata;
  selection: WorldGenerationSelection;
  tone: string[];
  geography: string[];
  factions: string[];
  history: string[];
  narrativeHooks: string[];
}

export interface TerrainPlanner {
  plan(input: ProceduralGenerationInput): Promise<TerrainPlan>;
}

export interface WorldStructureGenerator {
  generate(
    input: ProceduralGenerationInput,
    terrainPlan: TerrainPlan,
  ): Promise<WorldStructurePlan>;
}

export interface RegionGenerator {
  generate(
    input: ProceduralGenerationInput,
    terrainPlan: TerrainPlan,
    structurePlan: WorldStructurePlan,
  ): Promise<WorldInstance>;
}

export interface LoreParser {
  parse(input: WorldInterpretationInput): Promise<LoreParseResult>;
}

export interface WorldSpecificationBuilder {
  build(
    input: WorldInterpretationInput,
    parsedLore: LoreParseResult,
  ): Promise<CustomWorldSpecification>;
}

export interface CustomWorldBuilder {
  build(
    input: WorldInterpretationInput,
    specification: CustomWorldSpecification,
  ): Promise<WorldInstance>;
}

function hasSelection(selection: WorldGenerationSelection): boolean {
  return selection.biomes.length > 0 || selection.monsters.length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export class DefaultTerrainPlanner implements TerrainPlanner {
  public async plan(input: ProceduralGenerationInput): Promise<TerrainPlan> {
    const primaryBiomes =
      input.selection.biomes.length > 0
        ? input.selection.biomes
        : input.metadata.customBiomes.length > 0
          ? input.metadata.customBiomes
          : [input.metadata.worldPreset];

    return {
      seed: input.seed,
      preset: input.metadata.worldPreset,
      primaryBiomes,
      requestedMonsters: [...input.selection.monsters],
      notes: [
        `Seed ${input.seed} drives deterministic world generation.`,
        `Preset ${input.metadata.worldPreset} is the current biome bias.`,
      ],
    };
  }
}

export class DefaultWorldStructureGenerator
  implements WorldStructureGenerator
{
  public async generate(
    input: ProceduralGenerationInput,
    terrainPlan: TerrainPlan,
  ): Promise<WorldStructurePlan> {
    const regionBudget = Math.max(
      4,
      terrainPlan.primaryBiomes.length > 0
        ? terrainPlan.primaryBiomes.length * 2
        : 8,
    );

    return {
      seed: input.seed,
      metadata: input.metadata,
      regionBudget,
      laneCount: Math.min(5, Math.max(3, Math.ceil(regionBudget / 3))),
      routeDensity:
        input.metadata.worldPreset === "custom"
          ? 0.72
          : input.metadata.worldPreset === "balanced"
            ? 0.62
            : 0.56,
      preferredBiomes: [...terrainPlan.primaryBiomes],
      constrainedMonsterPool: [...terrainPlan.requestedMonsters],
    };
  }
}

export class ExistingWorldRegionGenerator implements RegionGenerator {
  public async generate(
    input: ProceduralGenerationInput,
    _terrainPlan: TerrainPlan,
    structurePlan: WorldStructurePlan,
  ): Promise<WorldInstance> {
    const hints: WorldMapGenerationHints = {
      regionBudget: structurePlan.regionBudget,
      laneCount: structurePlan.laneCount,
      routeDensity: structurePlan.routeDensity,
      preferredBiomes: structurePlan.preferredBiomes,
    };
    const instance = await worldSystem.generateWorld(
      input.seed,
      hasSelection(input.selection) ? input.selection : undefined,
      hints,
    );
    instance.setMetadata(input.metadata);
    return instance;
  }
}

export class DefaultLoreParser implements LoreParser {
  public async parse(
    input: WorldInterpretationInput,
  ): Promise<LoreParseResult> {
    const rawText = input.loreText || "";
    const extractedKeywords = uniqueStrings(
      rawText
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .filter((token) => token.length >= 4)
        .slice(0, 24),
    );
    const namedLocations = uniqueStrings(
      (rawText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).slice(0, 12),
    );
    const toneHints = uniqueStrings(
      extractedKeywords.filter((token) =>
        [
          "dark",
          "ancient",
          "holy",
          "cursed",
          "ruined",
          "infernal",
          "void",
          "kingdom",
          "empire",
          "forest",
          "desert",
          "swamp",
        ].includes(token),
      ),
    );

    return {
      rawText,
      extractedKeywords,
      namedLocations,
      toneHints,
    };
  }
}

export class DefaultWorldSpecificationBuilder
  implements WorldSpecificationBuilder
{
  public async build(
    input: WorldInterpretationInput,
    parsedLore: LoreParseResult,
  ): Promise<CustomWorldSpecification> {
    const geography = uniqueStrings([
      ...input.selection.biomes,
      ...parsedLore.extractedKeywords.filter((token) =>
        [
          "forest",
          "desert",
          "swamp",
          "mountain",
          "coast",
          "volcanic",
          "ruins",
        ].includes(token),
      ),
    ]);

    return {
      metadata: input.metadata,
      selection: input.selection,
      tone: uniqueStrings([
        input.metadata.worldPreset,
        ...parsedLore.toneHints,
      ]),
      geography,
      factions: parsedLore.namedLocations.filter((name) =>
        /\b(Order|Clan|Empire|Kingdom|Guild|House)\b/.test(name),
      ),
      history: parsedLore.extractedKeywords.filter((token) =>
        ["ancient", "fallen", "war", "empire", "ruined"].includes(token),
      ),
      narrativeHooks: uniqueStrings([
        ...parsedLore.namedLocations,
        ...parsedLore.extractedKeywords.slice(0, 8),
      ]),
    };
  }
}

export class ExistingCustomWorldBuilder implements CustomWorldBuilder {
  public async build(
    input: WorldInterpretationInput,
    specification: CustomWorldSpecification,
  ): Promise<WorldInstance> {
    const selection =
      specification.selection.biomes.length > 0 ||
      specification.selection.monsters.length > 0
        ? specification.selection
        : input.selection;

    const instance = await worldSystem.generateWorld(
      input.seed,
      hasSelection(selection) ? selection : undefined,
      {
        regionBudget: Math.max(5, specification.geography.length * 2 || 6),
        laneCount: Math.min(5, Math.max(3, Math.ceil(specification.geography.length / 2) + 1)),
        routeDensity: specification.narrativeHooks.length > 4 ? 0.74 : 0.66,
        preferredBiomes: specification.geography,
        narrativeTone: specification.tone,
      },
    );
    instance.setMetadata(specification.metadata);
    return instance;
  }
}
