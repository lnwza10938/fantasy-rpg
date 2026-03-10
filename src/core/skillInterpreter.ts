// src/core/skillInterpreter.ts
// RUNTIME LAYER: Converts static skill data into playable runtime constraints

import {
    Skill,
    SkillRole,
    ScalingSource,
    DeliveryShape,
    SkillDuration,
    SkillTrigger
} from './skillSystem.js';

/**
 * Common stats format for any entity casting a skill.
 * Used to calculate scaling vectors deterministically.
 */
export interface CharacterStats {
    attack: number;
    defense: number;
    maxHP: number;
    maxMana: number;
    speed: number;
    level: number;
}

/**
 * The final, mathematically resolved state of a skill ready for combat consumption.
 * Contains purely actionable numeric logic.
 */
export interface RuntimeSkill {
    id: number;
    damage: number;
    healing: number;
    manaCost: number;
    cooldown: number;
    range: number;
    durationTurns: number;
    modifiers: number[]; // e.g. [SecondaryModifier.Burn]
    specialProperties: number[]; // e.g. [SpecialProperty.Lifesteal]
    isActive: boolean;
}

export class SkillInterpreter {

    /**
     * Transforms raw Skill properties into definitive numeric rules (RuntimeSkill)
     * using the caster's stats for scaling. Deterministic and fast (no side effects).
     */
    public interpret(skill: Skill, caster: CharacterStats): RuntimeSkill {

        // 1. Establish initial base values
        let damage = 0;
        let healing = 0;
        let manaCost = 5; // Base minimal mana cost
        let cooldown = 0;
        let range = 1;
        let durationTurns = 0;

        // 2. Resolve Scaling (What power source drives this skill?)
        const powerScale = this.calculatePowerScale(skill.scaling, caster);

        // 3. Resolve Role & Value (Is it a damaging skill or a healing/utility skill?)
        if (skill.role === SkillRole.Damage) {
            // Base damage + scaled power. Math.floor ensures deterministic integers.
            damage = 10 + Math.floor(powerScale * 1.5);
            manaCost += 5;
        } else if (skill.role === SkillRole.Heal) {
            healing = 15 + Math.floor(powerScale * 1.2);
            manaCost += 10; // Healing is slightly more expensive
        }

        // 4. Resolve Delivery Shape into structural constraints (like Range)
        range = this.calculateRange(skill.delivery);

        // 5. Compute Time mechanics (Duration and Cooldown)
        durationTurns = this.calculateDurationTurns(skill.duration);
        cooldown = this.calculateCooldown(skill, powerScale);

        // 6. Return populated RuntimeSkill object (Immutable output)
        return {
            id: skill.id,
            damage,
            healing,
            manaCost,
            cooldown,
            range,
            durationTurns,
            modifiers: skill.modifier === 0 ? [] : [skill.modifier],
            specialProperties: skill.special === 0 ? [] : [skill.special],
            isActive: (skill.trigger === SkillTrigger.Active)
        };
    }

    /**
     * Isolates scaling logic purely to Character stats mappings.
     */
    private calculatePowerScale(scaling: ScalingSource, caster: CharacterStats): number {
        switch (scaling) {
            case ScalingSource.Attack: return caster.attack;
            case ScalingSource.Defense: return caster.defense;
            case ScalingSource.MaxHP: return caster.maxHP;
            case ScalingSource.MaxMana: return caster.maxMana;
            case ScalingSource.Speed: return caster.speed;
            case ScalingSource.Level: return caster.level * 5; // Levels provide flat high scaling
            case ScalingSource.Flat: return 20; // Fixed flat power
            default: return caster.attack; // Fallback
        }
    }

    /**
     * Deterministically converts structural geometry choices into integer ranges.
     */
    private calculateRange(delivery: DeliveryShape): number {
        switch (delivery) {
            case DeliveryShape.Melee:
            case DeliveryShape.Instant:
                return 1;
            case DeliveryShape.Projectile:
            case DeliveryShape.Beam:
            case DeliveryShape.Line:
                return 4; // Ranged
            case DeliveryShape.Nova:
            case DeliveryShape.Aura:
            case DeliveryShape.Cone:
                return 2; // Mid-range AoE
            default:
                return 1;
        }
    }

    /**
     * Normalizes durations into strict integer turns.
     */
    private calculateDurationTurns(duration: SkillDuration): number {
        switch (duration) {
            case SkillDuration.Instant: return 0;
            case SkillDuration.OneTurn: return 1;
            case SkillDuration.TwoTurns: return 2;
            case SkillDuration.ThreeTurns: return 3;
            case SkillDuration.FourTurns: return 4;
            case SkillDuration.FiveTurns: return 5;
            case SkillDuration.Channeled: return -1; // -1 represents interruptable channel
            case SkillDuration.UntilEndOfCombat: return 99; // Arbitrarily high
            case SkillDuration.Permanent: return 999;
            default: return 0;
        }
    }

    private calculateCooldown(skill: Skill, powerScale: number): number {
        let cd = 1; // Base cooldown

        // Powerful skills and long durations demand longer cooldowns
        if (powerScale > 100) cd += 1;
        if (skill.duration > 1 && skill.duration <= 6) cd += 1;

        // Buff roles might have independent rules
        if (skill.role === SkillRole.Buff || skill.role === SkillRole.Debuff) cd += 2;

        return cd;
    }
}

// Singleton interpreter for use by CombatSystem. State-free and inherently thread-safe.
export const skillInterpreter = new SkillInterpreter();
