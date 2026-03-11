// src/core/skillInterpreter.ts
// RUNTIME LAYER: Converts static skill data into playable runtime constraints

import {
  Skill,
  SkillRole,
  TargetType,
  EffectType,
  ScalingSource,
  DeliveryShape,
  SkillDuration,
  SkillTrigger,
} from "./skillSystem.js";
import type { CharacterStats } from "../models/combatTypes.js";

/**
 * The final, mathematically resolved state of a skill ready for combat consumption.
 */
export interface RuntimeSkill {
  id: number;
  damage: number;
  healing: number;
  manaCost: number;
  cooldown: number;
  range: number;
  isAura: boolean;
  isAoE: boolean;
  durationTurns: number;
  modifiers: number[];
  specialProperties: number[];
  isActive: boolean;
}

export class SkillInterpreter {
  /**
   * Transforms raw Skill properties into definitive numeric rules by connecting all 9 digits.
   */
  public interpret(skill: Skill, caster: CharacterStats): RuntimeSkill {
    // 1. Establish initial base values
    let damage = 0;
    let healing = 0;
    let manaCost = 0; // Signature skills are passive/automatic
    let cooldown = 0;
    let range = 1;
    let durationTurns = 0;
    let isAoE = false;
    let isAura = false;

    // 2. Resolve Scaling (Digit 5)
    const powerScale = this.calculatePowerScale(skill.scaling, caster);

    // 3. Resolve Role (Digit 2) & Value
    // Note: Attack vs Heal vs Utility
    if (skill.role === SkillRole.Attack) {
      damage = 5 + Math.floor(powerScale * 1.2);
    } else if (skill.role === SkillRole.Heal) {
      healing = 8 + Math.floor(powerScale * 1.0);
    } else if (
      skill.role === SkillRole.Buff ||
      skill.role === SkillRole.Debuff
    ) {
      powerScale > 50 ? (durationTurns += 1) : 0;
    }

    // 4. Resolve Target (Digit 3)
    // MultiEnemy (2), AllEnemies (3), Area (4), AllAllies (6), AllUnitsArea (8)
    const targetGroup = [2, 3, 4, 6, 8];
    if (targetGroup.includes(skill.target)) {
      isAoE = true;
      // Balance: AoE damage/healing is reduced by 30%
      damage = Math.floor(damage * 0.7);
      healing = Math.floor(healing * 0.7);
    }

    // 5. Resolve Effect Type (Digit 4)
    // Physical (1), Magical (2), Soul (3), LifeSteal (4), ManaDrain (5), MaxHPDamage (6), ManaBreak (7), ArmorBreak (8)
    if (
      skill.effect === EffectType.Soul ||
      skill.effect === EffectType.MaxHPDamage
    ) {
      damage = Math.floor(damage * 1.15); // Powerful effects do more raw damage
    } else if (skill.effect === EffectType.LifeSteal) {
      damage = Math.floor(damage * 0.85); // Lifesteal damage is lower to balance recovery
    }

    // 6. Resolve Delivery Shape into structural constraints (Digit 6)
    range = this.calculateRange(skill.delivery);
    if (skill.delivery === DeliveryShape.Aura) isAura = true;

    // 7. Compute Duration (Digit 7)
    durationTurns = this.calculateDurationTurns(skill.duration);

    // 8. Return populated RuntimeSkill object
    return {
      id: skill.id,
      damage,
      healing,
      manaCost,
      cooldown,
      range,
      isAura,
      isAoE,
      durationTurns,
      modifiers: skill.modifier === 0 ? [] : [skill.modifier],
      specialProperties: skill.special === 0 ? [] : [skill.special],
      isActive: false,
    };
  }

  private calculatePowerScale(
    scaling: ScalingSource,
    caster: CharacterStats,
  ): number {
    switch (scaling) {
      case ScalingSource.AttackPower:
        return caster.attack;
      case ScalingSource.DefensePower:
        return caster.defense;
      case ScalingSource.MaxHP:
        return Math.floor(caster.maxHP * 0.1);
      case ScalingSource.MaxMana:
        return Math.floor(caster.maxMana * 0.2);
      case ScalingSource.Speed:
        return caster.speed;
      case ScalingSource.Level:
        return caster.level * 3;
      default:
        return 10;
    }
  }

  private calculateRange(delivery: DeliveryShape): number {
    switch (delivery) {
      case DeliveryShape.DirectStrike:
        return 1;
      case DeliveryShape.Wave:
      case DeliveryShape.Beam:
      case DeliveryShape.Chain:
        return 4;
      case DeliveryShape.Explosion:
      case DeliveryShape.Ring:
        return 2;
      case DeliveryShape.Aura:
        return 0; // Self-centered
      default:
        return 1;
    }
  }

  private calculateDurationTurns(duration: SkillDuration): number {
    switch (duration) {
      case SkillDuration.Instant:
        return 0;
      case SkillDuration.Short:
        return 1;
      case SkillDuration.Medium:
        return 2;
      case SkillDuration.Long:
        return 3;
      case SkillDuration.Periodic:
        return 3;
      case SkillDuration.Continuous:
        return 5;
      case SkillDuration.Conditional:
        return 10;
      default:
        return 0;
    }
  }
}

export const skillInterpreter = new SkillInterpreter();
