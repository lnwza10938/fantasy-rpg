// src/core/contentValidator.ts
// Validates developer and AI-generated content before DB insertion

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class ContentValidator {

    public validateMonster(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.name || typeof data.name !== 'string') errors.push('name is required (string)');
        if (data.level != null && (data.level < 1 || data.level > 100)) errors.push('level must be 1-100');
        if (data.base_hp != null && data.base_hp <= 0) errors.push('base_hp must be > 0');
        if (data.base_attack != null && data.base_attack < 0) errors.push('base_attack must be >= 0');
        if (data.base_defense != null && data.base_defense < 0) errors.push('base_defense must be >= 0');
        if (data.skill_id != null) {
            const s = String(data.skill_id);
            if (s.length !== 9 || isNaN(Number(s))) errors.push('skill_id must be exactly 9 digits');
        }
        return { valid: errors.length === 0, errors };
    }

    public validateItem(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.name) errors.push('name is required');
        if (!data.type) errors.push('type is required');
        const validTypes = ['consumable', 'material', 'quest', 'key'];
        if (data.type && !validTypes.includes(data.type)) errors.push('type must be one of: ' + validTypes.join(', '));
        return { valid: errors.length === 0, errors };
    }

    public validateEquipment(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.name) errors.push('name is required');
        const validSlots = ['weapon', 'armor', 'helmet', 'boots', 'accessory'];
        if (!data.slot || !validSlots.includes(data.slot)) errors.push('slot must be one of: ' + validSlots.join(', '));
        return { valid: errors.length === 0, errors };
    }

    public validateMap(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.name) errors.push('name is required');
        if (data.danger_level != null && (data.danger_level < 1 || data.danger_level > 10)) errors.push('danger_level must be 1-10');
        return { valid: errors.length === 0, errors };
    }

    public validateSpawnPoint(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.map_id) errors.push('map_id is required');
        if (!Array.isArray(data.monster_pool) || data.monster_pool.length === 0) errors.push('monster_pool must be a non-empty array');
        if (data.spawn_rate != null && (data.spawn_rate < 0 || data.spawn_rate > 1)) errors.push('spawn_rate must be 0.0-1.0');
        return { valid: errors.length === 0, errors };
    }

    public validateDialogue(data: any): ValidationResult {
        const errors: string[] = [];
        if (!data.npc_name) errors.push('npc_name is required');
        if (!data.dialogue_text) errors.push('dialogue_text is required');
        return { valid: errors.length === 0, errors };
    }
}

export const contentValidator = new ContentValidator();
