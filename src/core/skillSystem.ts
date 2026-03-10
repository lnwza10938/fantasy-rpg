// src/core/skillSystem.ts
// DATA LAYER: Defines the structure and meanings of skill properties

export enum SkillTrigger { None = 0, OnAttack = 1, OnHit = 2, OnDefend = 3, OnDamaged = 4, OnDeath = 5, StartOfTurn = 6, EndOfTurn = 7, Passive = 8, Active = 9 }
export enum SkillRole { None = 0, Damage = 1, Heal = 2, Buff = 3, Debuff = 4, Summon = 5, Control = 6, Utility = 7, Movement = 8, Transformation = 9 }
export enum TargetType { None = 0, Self = 1, SingleEnemy = 2, SingleAlly = 3, AllEnemies = 4, AllAllies = 5, RandomEnemy = 6, RandomAlly = 7, AreaOfEffect = 8, Everyone = 9 }
export enum EffectType { None = 0, PhysicalDamage = 1, MagicalDamage = 2, TrueDamage = 3, Healing = 4, Shielding = 5, StatusEffect = 6, ResourceRestore = 7, ResourceDrain = 8, Dispel = 9 }
export enum ScalingSource { None = 0, Attack = 1, Defense = 2, MaxHP = 3, MaxMana = 4, Speed = 5, Level = 6, MissingHP = 7, TargetMaxHP = 8, Flat = 9 }
export enum DeliveryShape { None = 0, Melee = 1, Projectile = 2, Beam = 3, Nova = 4, Cone = 5, Line = 6, Wall = 7, Aura = 8, Instant = 9 }
export enum SkillDuration { None = 0, Instant = 1, OneTurn = 2, TwoTurns = 3, ThreeTurns = 4, FourTurns = 5, FiveTurns = 6, UntilEndOfCombat = 7, Channeled = 8, Permanent = 9 }
export enum SecondaryModifier { None = 0, Burn = 1, Freeze = 2, Stun = 3, Poison = 4, Bleed = 5, Silence = 6, Blind = 7, Knockback = 8, Root = 9 }
export enum SpecialProperty { None = 0, Lifesteal = 1, Unavoidable = 2, Piercing = 3, Execute = 4, CritChanceUp = 5, CooldownReduction = 6, Multicast = 7, Invulnerability = 8, Revive = 9 }

/**
 * Skill class representing the decodable logic of a 9-digit skill.
 * Optimized for minimal heap allocations.
 */
export class Skill {
    public readonly id: number;
    public readonly trigger: SkillTrigger;
    public readonly role: SkillRole;
    public readonly target: TargetType;
    public readonly effect: EffectType;
    public readonly scaling: ScalingSource;
    public readonly delivery: DeliveryShape;
    public readonly duration: SkillDuration;
    public readonly modifier: SecondaryModifier;
    public readonly special: SpecialProperty;

    constructor(id: number) {
        this.id = id;

        // Performance optimization: Mathematical extraction (Zero string allocations)
        // Digits are extracted from right (special) to left (trigger)
        let remainder = Math.abs(id);

        this.special = remainder % 10; remainder = Math.floor(remainder / 10);
        this.modifier = remainder % 10; remainder = Math.floor(remainder / 10);
        this.duration = remainder % 10; remainder = Math.floor(remainder / 10);
        this.delivery = remainder % 10; remainder = Math.floor(remainder / 10);
        this.scaling = remainder % 10; remainder = Math.floor(remainder / 10);
        this.effect = remainder % 10; remainder = Math.floor(remainder / 10);
        this.target = remainder % 10; remainder = Math.floor(remainder / 10);
        this.role = remainder % 10; remainder = Math.floor(remainder / 10);
        this.trigger = remainder % 10;
    }
}

// LOGIC LAYER: Manages skill decoding and caching

export class SkillSystem {
    // Caching mechanism to avoid re-parsing the same skill ID
    private cache: Map<number, Skill>;

    constructor() {
        this.cache = new Map<number, Skill>();
    }

    /**
     * Retrieves a decoded Skill object from a 9-digit ID.
     * Uses caching to ensure deterministic and performant execution.
     */
    public getSkill(id: number): Skill {
        if (!this.cache.has(id)) {
            this.cache.set(id, new Skill(id));
        }
        return this.cache.get(id)!;
    }
}

export const skillSystem = new SkillSystem();
