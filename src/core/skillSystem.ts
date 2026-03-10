// src/core/skillSystem.ts
// DATA LAYER: Defines the structure and meanings of skill properties

export enum SkillTrigger { AlwaysActive = 0, OnHit = 1, OnDamaged = 2, OnKill = 3, LowHP = 4, LowMana = 5, Timed = 6, EnterCombat = 7, BuffEvent = 8, RandomTrigger = 9 }
export enum SkillRole { None = 0, Attack = 1, Defense = 2, Buff = 3, Debuff = 4, Curse = 5, Heal = 6, Summon = 7, Utility = 8, RandomRole = 9 }
export enum TargetType { Self = 0, SingleEnemy = 1, MultiEnemy = 2, AllEnemies = 3, Area = 4, SingleAlly = 5, AllAllies = 6, RandomTarget = 7, AllUnitsArea = 8, RandomTargetType = 9 }
export enum EffectType { None = 0, Physical = 1, Magical = 2, Soul = 3, LifeSteal = 4, ManaDrain = 5, MaxHPDamage = 6, ManaBreak = 7, ArmorBreak = 8, RandomEffect = 9 }
export enum ScalingSource { None = 0, AttackPower = 1, DefensePower = 2, MaxHP = 3, MaxMana = 4, Speed = 5, Level = 6, EnemyCount = 7, BuffCount = 8, RandomScaling = 9 }
export enum DeliveryShape { Instant = 0, DirectStrike = 1, Explosion = 2, Wave = 3, Chain = 4, Aura = 5, Ring = 6, Beam = 7, SpawnObject = 8, RandomDelivery = 9 }
export enum SkillDuration { Instant = 0, Short = 1, Medium = 2, Long = 3, Continuous = 4, Periodic = 5, Stackable = 6, Delayed = 7, Conditional = 8, RandomDuration = 9 }
export enum SecondaryModifier { None = 0, LifeSteal = 1, ArmorUp = 2, AttackUp = 3, Slow = 4, StatusEffect = 5, Bounce = 6, RangeUp = 7, CooldownReduce = 8, RandomModifier = 9 }
export enum SpecialProperty { None = 0, HPTradePower = 1, ManaOverload = 2, RandomOutcome = 3, Backfire = 4, PermanentStack = 5, Mutation = 6, LowHPBoost = 7, HiddenUnlock = 8, Anomaly = 9 }

/**
 * Skill class representing the decodable logic of a 9-digit skill.
 * If a digit is 9, it randomizes 0-8 every time it's accessed (Live combat behavior).
 */
export class Skill {
    private readonly rawDigits: number[];

    constructor(public readonly id: number) {
        // Performance optimization: Mathematical extraction (Zero string allocations)
        // Digits are extracted from right (special) to left (trigger)
        let remainder = Math.abs(id);
        this.rawDigits = new Array(9);

        for (let i = 8; i >= 0; i--) {
            this.rawDigits[i] = remainder % 10;
            remainder = Math.floor(remainder / 10);
        }
    }

    private getDigit(index: number): number {
        const val = this.rawDigits[index];
        // Rules: If 9, randomize 0-8 for that use.
        if (val === 9) return Math.floor(Math.random() * 9);
        return val;
    }

    // Dynamic getters that handle the "9 = Random" requirement
    public get trigger(): SkillTrigger { return this.getDigit(0) as SkillTrigger; }
    public get role(): SkillRole { return this.getDigit(1) as SkillRole; }
    public get target(): TargetType { return this.getDigit(2) as TargetType; }
    public get effect(): EffectType { return this.getDigit(3) as EffectType; }
    public get scaling(): ScalingSource { return this.getDigit(4) as ScalingSource; }
    public get delivery(): DeliveryShape { return this.getDigit(5) as DeliveryShape; }
    public get duration(): SkillDuration { return this.getDigit(6) as SkillDuration; }
    public get modifier(): SecondaryModifier { return this.getDigit(7) as SecondaryModifier; }
    public get special(): SpecialProperty { return this.getDigit(8) as SpecialProperty; }
}

// LOGIC LAYER: Manages skill decoding and caching

export class SkillSystem {
    // Caching mechanism to avoid re-parsing the same skill ID
    // Note: Skill instances are cached, but their properties are dynamic if they contain '9'
    private cache: Map<number, Skill>;

    constructor() {
        this.cache = new Map<number, Skill>();
    }

    /**
     * Retrieves a Skill instance from a 9-digit ID.
     */
    public getSkill(id: number): Skill {
        let skill = this.cache.get(id);
        if (!skill) {
            skill = new Skill(id);
            this.cache.set(id, skill);
        }
        return skill;
    }
}

export const skillSystem = new SkillSystem();
