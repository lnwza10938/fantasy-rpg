// src/core/worldGenerator.ts
// AI Content Generator — structured JSON output for world content
// API key is configurable at runtime via the Dev Panel (stored in memory, not .env)

export interface AIGeneratorConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
    provider: 'openai' | 'gemini' | 'groq' | 'openrouter';
}

// Runtime config — set via Dev Panel, never hardcoded
let config: AIGeneratorConfig = {
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    provider: 'openai'
};

export function setAIConfig(newConfig: Partial<AIGeneratorConfig>) {
    Object.assign(config, newConfig);
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
Each digit (1-9) represents: Trigger, Role, Target, Effect, Scaling, Delivery, Duration, Modifier, Special.
Translate the 9-digit code provided in the context into a balanced, thematic skill.
Return ONLY this JSON format:
{
  "name": "Creative Spell Name",
  "description": "Full flavor text explaining the mechanical effects",
  "mana_cost": 10-50,
  "cooldown": 0-5,
  "target_type": "enemy|self|all_enemies|ally",
  "effect_type": "damage|heal|buff|debuff",
  "scaling_stat": "attack|defense|speed|maxMana|maxHP",
  "power_multiplier": 0.5-2.0
}`
};

export class WorldGenerator {

    /**
     * Generate content of a given type using AI.
     * Returns parsed JSON or null on failure.
     */
    public async generate(type: keyof typeof PROMPTS, context?: string): Promise<any | null> {
        if (!isAIConfigured()) return null;

        const systemMsg = 'You are a fantasy RPG content generator. Return ONLY valid JSON.';
        const prompt = PROMPTS[type] + (context ? `\n\nAdditional context: ${context}` : '');

        try {
            let text = '';

            if (config.provider === 'gemini') {
                const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemMsg + "\n\n" + prompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
                    })
                });
                if (!response.ok) throw new Error(`Gemini Error: ${response.status} ${await response.text()}`);
                const data = await response.json();
                text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            } else {
                // OpenAI / Groq / OpenRouter format
                const response = await fetch(`${config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.model,
                        messages: [
                            { role: 'system', content: systemMsg },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.8,
                        max_tokens: 1000
                    })
                });
                if (!response.ok) throw new Error(`AI API error: ${response.status} ${await response.text()}`);
                const data = await response.json();
                text = data.choices?.[0]?.message?.content ?? '';
            }

            // Extract JSON (handle potential markdown wrapping)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            return JSON.parse(jsonMatch[0]);
        } catch (err) {
            console.error('AI generation failed:', err);
            return null;
        }
    }

    /**
     * Generate multiple content items in batch.
     */
    public async generateBatch(type: keyof typeof PROMPTS, count: number, context?: string): Promise<any[]> {
        const results: any[] = [];
        for (let i = 0; i < count; i++) {
            const item = await this.generate(type, context);
            if (item) results.push(item);
        }
        return results;
    }
}

export const worldGenerator = new WorldGenerator();
