// src/core/worldPipelines.ts
// Formal world-generation pipeline interfaces for procedural and custom flows.

import type {
  WorldDefinition,
  WorldGenerationSelection,
  WorldMetadata,
} from "../models/worldTypes.js";
import {
  inferWorldPresetFromSeed,
  normalizeWorldMetadata,
} from "../models/worldTypes.js";
import type { WorldInstance } from "./worldSystem.js";
import {
  DefaultLoreParser,
  DefaultTerrainPlanner,
  DefaultWorldSpecificationBuilder,
  DefaultWorldStructureGenerator,
  ExistingCustomWorldBuilder,
  ExistingWorldRegionGenerator,
  type CustomWorldBuilder,
  type CustomWorldSpecification,
  type LoreParseResult,
  type LoreParser,
  type ProceduralGenerationInput,
  type RegionGenerator,
  type TerrainPlan,
  type TerrainPlanner,
  type WorldInterpretationInput,
  type WorldSpecificationBuilder,
  type WorldStructureGenerator,
  type WorldStructurePlan,
} from "./worldGenerationStages.js";

export type WorldGenerationMode = "procedural" | "custom";

export interface BaseWorldPipelineRequest {
  seed: number;
  worldName?: string;
  worldPreset?: string;
  customSelection?: Partial<WorldGenerationSelection> | null;
}

export interface ProceduralWorldPipelineRequest extends BaseWorldPipelineRequest {
  mode: "procedural";
}

export interface CustomWorldPipelineRequest extends BaseWorldPipelineRequest {
  mode: "custom";
  loreText?: string;
}

export type WorldPipelineRequest =
  | ProceduralWorldPipelineRequest
  | CustomWorldPipelineRequest;

export interface WorldPipelineContext {
  mode: WorldGenerationMode;
  seed: number;
  metadata: WorldMetadata;
  selection: WorldGenerationSelection;
  terrainPlan?: TerrainPlan;
  structurePlan?: WorldStructurePlan;
  loreParse?: LoreParseResult;
  worldSpecification?: CustomWorldSpecification;
}

export interface WorldPipelineResult {
  mode: WorldGenerationMode;
  definition: WorldDefinition;
  instance: WorldInstance;
  context: WorldPipelineContext;
}

export interface WorldGenerationPipeline<
  TRequest extends WorldPipelineRequest = WorldPipelineRequest,
> {
  readonly mode: TRequest["mode"];
  generate(request: TRequest): Promise<WorldPipelineResult>;
}

export interface StoredWorldGenerationInput {
  seed: number;
  worldName?: string;
  worldPreset?: string;
  customBiomes?: string[];
  customMonsters?: string[];
}

function normalizeSelection(
  selection?: Partial<WorldGenerationSelection> | null,
): WorldGenerationSelection {
  return {
    biomes: Array.isArray(selection?.biomes)
      ? selection.biomes.filter((item): item is string => typeof item === "string")
      : [],
    monsters: Array.isArray(selection?.monsters)
      ? selection.monsters.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function hasSelection(selection: WorldGenerationSelection): boolean {
  return selection.biomes.length > 0 || selection.monsters.length > 0;
}

function buildMetadata(
  mode: WorldGenerationMode,
  seed: number,
  request: BaseWorldPipelineRequest,
  selection: WorldGenerationSelection,
): WorldMetadata {
  const inferredPreset = inferWorldPresetFromSeed(seed);
  const worldPreset =
    mode === "custom"
      ? request.worldPreset || "custom"
      : request.worldPreset || inferredPreset;

  return normalizeWorldMetadata(
    {
      worldName: request.worldName,
      worldPreset,
      customBiomes: selection.biomes,
      customMonsters: selection.monsters,
    },
    seed,
  );
}

class ProceduralWorldPipeline
  implements WorldGenerationPipeline<ProceduralWorldPipelineRequest>
{
  public readonly mode = "procedural" as const;

  constructor(
    private readonly terrainPlanner: TerrainPlanner = new DefaultTerrainPlanner(),
    private readonly structureGenerator: WorldStructureGenerator = new DefaultWorldStructureGenerator(),
    private readonly regionGenerator: RegionGenerator = new ExistingWorldRegionGenerator(),
  ) {}

  public async generate(
    request: ProceduralWorldPipelineRequest,
  ): Promise<WorldPipelineResult> {
    const selection = normalizeSelection(request.customSelection);
    const metadata = buildMetadata(this.mode, request.seed, request, selection);
    const input: ProceduralGenerationInput = {
      seed: request.seed,
      metadata,
      selection,
    };
    const terrainPlan = await this.terrainPlanner.plan(input);
    const structurePlan = await this.structureGenerator.generate(
      input,
      terrainPlan,
    );
    const instance = await this.regionGenerator.generate(
      input,
      terrainPlan,
      structurePlan,
    );
    const definition = instance.definition;

    return {
      mode: this.mode,
      definition,
      instance,
      context: {
        mode: this.mode,
        seed: request.seed,
        metadata,
        selection,
        terrainPlan,
        structurePlan,
      },
    };
  }
}

class CustomWorldPipeline
  implements WorldGenerationPipeline<CustomWorldPipelineRequest>
{
  public readonly mode = "custom" as const;

  constructor(
    private readonly loreParser: LoreParser = new DefaultLoreParser(),
    private readonly specificationBuilder: WorldSpecificationBuilder = new DefaultWorldSpecificationBuilder(),
    private readonly worldBuilder: CustomWorldBuilder = new ExistingCustomWorldBuilder(),
  ) {}

  public async generate(
    request: CustomWorldPipelineRequest,
  ): Promise<WorldPipelineResult> {
    const selection = normalizeSelection(request.customSelection);
    const metadata = buildMetadata(this.mode, request.seed, request, selection);
    const input: WorldInterpretationInput = {
      seed: request.seed,
      metadata,
      selection,
      loreText: request.loreText,
    };
    const loreParse = await this.loreParser.parse(input);
    const worldSpecification = await this.specificationBuilder.build(
      input,
      loreParse,
    );
    const instance = await this.worldBuilder.build(input, worldSpecification);
    const definition = instance.definition;

    return {
      mode: this.mode,
      definition,
      instance,
      context: {
        mode: this.mode,
        seed: request.seed,
        metadata,
        selection,
        loreParse,
        worldSpecification,
      },
    };
  }
}

export interface WorldPipelineCoordinatorInput extends BaseWorldPipelineRequest {
  mode?: WorldGenerationMode;
  loreText?: string;
}

export class WorldPipelineCoordinator {
  private readonly procedural = new ProceduralWorldPipeline();
  private readonly custom = new CustomWorldPipeline();

  public resolveMode(input: WorldPipelineCoordinatorInput): WorldGenerationMode {
    if (input.mode) return input.mode;
    if (input.worldPreset === "custom") return "custom";

    const selection = normalizeSelection(input.customSelection);
    return hasSelection(selection) ? "custom" : "procedural";
  }

  public async generate(
    input: WorldPipelineCoordinatorInput,
  ): Promise<WorldPipelineResult> {
    const mode = this.resolveMode(input);

    if (mode === "custom") {
      return this.custom.generate({
        ...input,
        mode,
      });
    }

    return this.procedural.generate({
      ...input,
      mode,
    });
  }

  public async generateFromStoredWorld(
    input: StoredWorldGenerationInput,
  ): Promise<WorldPipelineResult> {
    return this.generate({
      seed: input.seed,
      worldName: input.worldName,
      worldPreset: input.worldPreset,
      customSelection: {
        biomes: input.customBiomes || [],
        monsters: input.customMonsters || [],
      },
    });
  }
}

export const worldPipelineCoordinator = new WorldPipelineCoordinator();
