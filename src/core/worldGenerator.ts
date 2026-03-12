// src/core/worldGenerator.ts
// AI Content Generator — structured JSON output for world content
// API key is configurable at runtime via the Dev Panel (stored in memory, not .env)

export interface AIGeneratorConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  provider: "openai" | "gemini" | "groq" | "openrouter";
}

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function normalizeAIConfigValue(
  provider: AIGeneratorConfig["provider"],
  model: string,
): string {
  const trimmed = model.trim();
  if (provider === "gemini") {
    if (!trimmed || /^gemini-1\.5\b/i.test(trimmed)) {
      return DEFAULT_GEMINI_MODEL;
    }
  }
  return trimmed;
}

// Runtime config — initialized from environment variables if available
let config: AIGeneratorConfig = {
  apiKey: process.env.GEMINI_API_KEY || "",
  model: DEFAULT_GEMINI_MODEL,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  provider: "gemini",
};

// Interpretation cache to prevent redundant hits and save quota
const interpretationCache = new Map<string, any>();

export function setAIConfig(newConfig: Partial<AIGeneratorConfig>) {
  const nextProvider = newConfig.provider || config.provider;
  const nextModel =
    typeof newConfig.model === "string"
      ? normalizeAIConfigValue(nextProvider, newConfig.model)
      : config.model;

  Object.assign(config, newConfig, {
    provider: nextProvider,
    model: nextModel,
  });
}

export function getAIConfig(): Readonly<AIGeneratorConfig> {
  return config;
}

export function isAIConfigured(): boolean {
  return config.apiKey.length > 0;
}

// --- Generation Templates ---

const PROMPTS: Record<string, string> = {
  monster: `Generate a fantasy RPG monster as JSON:
{ "name": "string", "level": 1-100, "base_hp": number, "base_attack": number, "base_defense": number, "speed": number, "skill_id": 9-digit-number, "description": "string" }
Make it unique, creative, and fitting for a dark fantasy world. Return ONLY the JSON object, no markdown.`,

  item: `Generate a fantasy RPG item as JSON:
{ "name": "string", "type": "consumable|material|quest|key", "stat_bonus": { "hp": number }, "description": "string" }
Make it unique. Return ONLY the JSON object.`,

  region: `Generate a fantasy RPG region as JSON:
{ "name": "string", "danger_level": 1-10, "description": "string", "biome": "volcanic|tundra|forest|desert|swamp|mountain|coast|void" }
Make it unique and atmospheric. Return ONLY the JSON object.`,

  dialogue: `Generate an NPC dialogue as JSON:
{ "npc_name": "string", "dialogue_text": "string" }
Make it immersive and mysterious. Return ONLY the JSON object.`,

  lore: `Generate a piece of world lore as JSON:
{ "title": "string", "text": "string", "region": "string" }
Make it mysterious and hinting at ancient history. Return ONLY the JSON object.`,

  skill: `You are interpreting a procedurally generated 9-digit skill code for a Turn-Based RPG.
Each digit (1st-9th) has a specific meaning (0-9):

1. Trigger: 0=AlwaysActive, 1=OnHit, 2=OnDamaged, 3=OnKill, 4=LowHP, 5=LowMana, 6=Timed, 7=EnterCombat, 8=BuffEvent, 9=CHAOTIC
2. Role: 0=None, 1=Attack, 2=Defense, 3=Buff, 4=Debuff, 5=Curse, 6=Heal, 7=Summon, 8=Utility, 9=CHAOTIC
3. Target: 0=Self, 1=SingleEnemy, 2=MultiEnemy, 3=AllEnemies, 4=Area, 5=SingleAlly, 6=AllAllies, 7=Random, 8=AllUnitsArea, 9=CHAOTIC
4. Effect: 0=None, 1=Physical, 2=Magical, 3=Soul, 4=LifeSteal, 5=ManaDrain, 6=MaxHPDamage, 7=ManaBreak, 8=ArmorBreak, 9=CHAOTIC
5. Scaling: 0=None, 1=AttackPower, 2=DefensePower, 3=MaxHP, 4=MaxMana, 5=Speed, 6=Level, 7=EnemyCount, 8=BuffCount, 9=CHAOTIC
6. Delivery: 0=Instant, 1=DirectStrike, 2=Explosion, 3=Wave, 4=Chain, 5=Aura, 6=Ring, 7=Beam, 8=SpawnObject, 9=CHAOTIC
7. Duration: 0=Instant, 1=Short, 2=Medium, 3=Long, 4=Continuous, 5=Periodic, 6=Stackable, 7=Delayed, 8=Conditional, 9=CHAOTIC
8. Modifier: 0=None, 1=LifeSteal, 2=ArmorUp, 3=AttackUp, 4=Slow, 5=StatusEffect, 6=Bounce, 7=RangeUp, 8=CDReduce, 9=CHAOTIC
9. Special: 0=None, 1=HPTrade, 2=ManaOverload, 3=Random, 4=Backfire, 5=PermStack, 6=Mutation, 7=LowHPBoost, 8=Hidden, 9=CHAOTIC

Translate the provided 9-digit code into ONE COHESIVE PASSIVE/TRIGGERED SKILL.
MANDATORY SCHEMA:
- "name": Atmospheric name.
- "description": High-quality flavorful description in English.
- "mechanics": A clear technical breakdown (e.g., "Triggers on low HP, granting a physical shield to all allies").
- CRITICAL: DO NOT mention digit numbers (e.g., "digit 1", "index 0") in the description or mechanics. Use game terminology only.
- "mana_cost": 0-100 (if triggered)
- "cooldown": 0-10 (turns)
- "target_type": single_enemy|all_enemies|self|all_allies
- "effect_type": damage|heal|buff|debuff
- "scaling_stat": attack|defense|speed|maxMana|maxHP|level
- "power_multiplier": 0.5 to 3.0 (damage/heal potency)

Return ONLY the JSON object. No narrative.`,
};

export class WorldGenerator {
  public async generateFromPrompt(
    prompt: string,
    options?: {
      systemMsg?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<any | null> {
    if (!isAIConfigured()) return null;

    const systemMsg =
      options?.systemMsg ||
      "You are a fantasy RPG content generator. Return ONLY valid JSON.";

    try {
      let text = "";
      if (config.provider === "gemini") {
        const activeModel = normalizeAIConfigValue(config.provider, config.model);
        const url = `${config.baseUrl}/models/${activeModel}:generateContent?key=${config.apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemMsg + "\n\n" + prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.4,
              maxOutputTokens: options?.maxTokens ?? 8000,
              responseMimeType: "application/json",
            },
          }),
        });

        if (response.status === 429) {
          throw new Error("AI rate limit hit. Please try again in a moment.");
        }

        if (!response.ok) {
          throw new Error(
            `Gemini Error: ${response.status} ${await response.text()}`,
          );
        }
        const data = await response.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: systemMsg },
              { role: "user", content: prompt },
            ],
            temperature: options?.temperature ?? 0.4,
            max_tokens: options?.maxTokens ?? 1400,
          }),
        });
        if (!response.ok) {
          throw new Error(
            `AI API error: ${response.status} ${await response.text()}`,
          );
        }
        const data = await response.json();
        text = data.choices?.[0]?.message?.content ?? "";
      }

      text = text.trim();
      if (text.startsWith("```json")) {
        text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (text.startsWith("```")) {
        text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonString);
    } catch (err: any) {
      console.error("AI prompt generation failed:", err);
      throw new Error(`AI generation failed: ${err.message}`);
    }
  }

  /**
   * Generate content of a given type using AI.
   * Returns parsed JSON or null on failure.
   */
  public async generate(
    type: keyof typeof PROMPTS,
    context?: string,
  ): Promise<any | null> {
    if (!isAIConfigured()) return null;

    // Check cache first for skill interpretations
    if (type === "skill" && context && interpretationCache.has(context)) {
      return interpretationCache.get(context);
    }

    const prompt =
      PROMPTS[type] + (context ? `\n\nAdditional context: ${context}` : "");

    try {
      const result = await this.generateFromPrompt(prompt, {
        systemMsg:
          "You are a fantasy RPG content generator. Return ONLY valid JSON.",
        temperature: 0.8,
        maxTokens: 8000,
      });

      // Save to cache before returning
      if (type === "skill" && context) {
        interpretationCache.set(context, result);
      }
      return result;
    } catch (err: any) {
      console.error("AI generation failed:", err);
      // If it's a skill and it failed (other than 429 handled above), use fallback
      if (type === "skill") {
        return this.getFallbackSkillInterpretation(context || "000000000");
      }
      throw new Error(`AI generation failed: ${err.message}`);
    }
  }

  private getFallbackSkillInterpretation(code: string) {
    const d = code.split("").map(Number);

    const triggers = [
      "Always Active",
      "On Hit",
      "On Damaged",
      "On Kill",
      "Low HP",
      "Low Mana",
      "Timed",
      "On Combat Start",
      "On Buff",
      "Chaotic",
    ];
    const targets = [
      "Self",
      "Single Enemy",
      "Multiple Enemies",
      "All Enemies",
      "Area",
      "Single Ally",
      "All Allies",
      "Random",
      "Area (All)",
      "Unstable",
    ];
    const scalings = [
      "None",
      "Attack",
      "Defense",
      "Max HP",
      "Max Mana",
      "Speed",
      "Level",
      "Enemy Count",
      "Buff Count",
      "Variable",
    ];
    const roles = [
      "Striker",
      "Healer",
      "Buffer",
      "Debuffer",
      "Protector",
      "Assailant",
      "Infuser",
      "Warden",
      "Executioner",
      "Glitch",
    ];
    const elements = [
      "Kinetic",
      "Spark",
      "Flow",
      "Spirit",
      "Life",
      "Mana",
      "True",
      "Null",
      "Armor",
      "Void",
    ];

    const prefix =
      [
        "Chaotic",
        "Infernal",
        "Sacred",
        "Echoing",
        "Void",
        "Vibrant",
        "Abyssal",
        "Golden",
        "Shattered",
        "Lost",
      ][d[0]] || "Primal";
    const role = roles[d[1]] || "Skill";
    const element = elements[d[3]] || "Force";

    const name = `${prefix} ${element} ${role}`;

    return {
      name,
      description: `A unique passive ability forged from the essence of code ${code.match(/.{1,3}/g)?.join("-")}.`,
      mechanics: `Triggers ${triggers[d[0]]}. Affects ${targets[d[2]]} using ${element.toLowerCase()} power. Effectiveness scales with ${scalings[d[4]]}.`,
      mana_cost: 0,
      cooldown: 0,
      target_type: "single_enemy",
      effect_type: "damage",
      scaling_stat: "attack",
      power_multiplier: 1.0,
    };
  }

  /**
   * Generate multiple content items in batch.
   */
  public async generateBatch(
    type: keyof typeof PROMPTS,
    count: number,
    context?: string,
  ): Promise<any[]> {
    const results: any[] = [];
    for (let i = 0; i < count; i++) {
      const item = await this.generate(type, context);
      if (item) results.push(item);
    }
    return results;
  }
}

export const worldGenerator = new WorldGenerator();
