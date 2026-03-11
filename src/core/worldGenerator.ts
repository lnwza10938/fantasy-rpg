// src/core/worldGenerator.ts
// AI Content Generator — structured JSON output for world content
// API key is configurable at runtime via the Dev Panel (stored in memory, not .env)

export interface AIGeneratorConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
    provider: 'openai' | 'gemini' | 'groq' | 'openrouter';
}

// Runtime config — initialized from environment variables if available
let config: AIGeneratorConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    provider: 'gemini'
};

// Interpretation cache to prevent redundant hits and save quota
const interpretationCache = new Map<string, any>();

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
- "mechanics": A clear, detailed technical breakdown explaining EXACTLY how the Trigger, Role, Target, and Effect interact based on the code.
- "mana_cost": 0-100 (if triggered)
- "cooldown": 0-10 (turns)
- "target_type": single_enemy|all_enemies|self|all_allies
- "effect_type": damage|heal|buff|debuff
- "scaling_stat": attack|defense|speed|maxMana|maxHP|level
- "power_multiplier": 0.5 to 3.0 (damage/heal potency)

Return ONLY the JSON object. No narrative.`
};

export class WorldGenerator {

    /**
     * Generate content of a given type using AI.
     * Returns parsed JSON or null on failure.
     */
    public async generate(type: keyof typeof PROMPTS, context?: string): Promise<any | null> {
        if (!isAIConfigured()) return null;

        // Check cache first for skill interpretations
        if (type === 'skill' && context && interpretationCache.has(context)) {
            return interpretationCache.get(context);
        }

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
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 8000,
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (response.status === 429) {
                    console.warn('Gemini Rate Limit Hit (429). Using fallback.');
                    return this.getFallbackSkillInterpretation(context || '000000000');
                }

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
            text = text.trim();
            if (text.startsWith('```json')) {
                text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/^```\n/, '').replace(/\n```$/, '');
            }

            // Still fallback to regex if there's other fluff
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            let jsonString = jsonMatch ? jsonMatch[0] : text;

            let result = text;
            try {
                result = JSON.parse(jsonString);
            } catch (e: any) {
                throw new Error(`Failed to parse AI response as JSON. Received text: ${text.substring(0, 200)}...\nParse Error: ${e.message}`);
            }

            // Save to cache before returning
            if (type === 'skill' && context) {
                interpretationCache.set(context, result);
            }
            return result;

        } catch (err: any) {
            console.error('AI generation failed:', err);
            // If it's a skill and it failed (other than 429 handled above), use fallback
            if (type === 'skill') {
                return this.getFallbackSkillInterpretation(context || '000000000');
            }
            throw new Error(`AI generation failed: ${err.message}`);
        }
    }

    private getFallbackSkillInterpretation(code: string) {
        const d = code.split('').map(Number);
        // Basic fallback logic based on 9_digit_skill_system.md
        const prefix = ['Chaotic', 'Infernal', 'Sacred', 'Echoing', 'Void', 'Vibrant', 'Abyssal', 'Golden', 'Shattered'][d[0]] || 'Primal';
        const role = ['Striker', 'Healer', 'Buffer', 'Debuffer', 'Protector', 'Assailant', 'Infuser', 'Warden', 'Executioner'][d[1]] || 'Skill';
        const elements = ['Kinetic', 'Spark', 'Flow', 'Spirit', 'Life', 'Mana', 'True', 'Null', 'Armor'][d[3]] || 'Force';

        const name = `${prefix} ${elements} ${role}`;

        return {
            name,
            description: `A unique passive ability forged from the essence of code ${code.match(/.{1,3}/g)?.join('-')}.`,
            mechanics: `This skill triggers based on digit ${d[0]} and performs a ${role.toLowerCase()} effect using ${elements.toLowerCase()} energy. Target: ${d[2]}, Scaling: ${d[4]}.`,
            mana_cost: 0,
            cooldown: 0,
            target_type: 'single_enemy',
            effect_type: 'damage',
            scaling_stat: 'attack',
            power_multiplier: 1.0
        };
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
