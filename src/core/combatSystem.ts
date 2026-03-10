// src/core/combatSystem.ts
// LOGIC LAYER: Deterministic combat simulation without UI dependencies

import type { CharacterStats, CombatState, EffectiveStats } from '../models/combatTypes.js';
import { CombatFaction } from '../models/combatTypes.js';
import { skillSystem } from './skillSystem.js';
import { skillInterpreter } from './skillInterpreter.js';
import type { RuntimeSkill } from './skillInterpreter.js';
import { saveCombatLog } from '../db/repositories.js';

export class CombatSystem {

    /**
     * Calculates effective stats for a character based on base stats + equipment/buffs.
     */
    public calculateEffectiveStats(base: CharacterStats, equipment: any[] = []): EffectiveStats {
        let attackBonus = 0;
        let defenseBonus = 0;
        let speedBonus = 0;
        let hpBonus = 0;

        for (const item of equipment) {
            attackBonus += item.attack_bonus || 0;
            defenseBonus += item.defense_bonus || 0;
            speedBonus += item.speed_bonus || 0;
            hpBonus += item.hp_bonus || 0;
        }

        return {
            ...base,
            maxHP: base.maxHP + hpBonus,
            attack: base.attack + attackBonus,
            defense: base.defense + defenseBonus,
            speed: base.speed + speedBonus,
            baseStats: base,
            modifiers: { attackBonus, defenseBonus, speedBonus, hpBonus }
        };
    }

    /**
     * Executes a single turn in a turn-based battle using EffectiveStats.
     */
    public executeTurn(attacker: EffectiveStats, defender: EffectiveStats): { damage: number, log: string } {
        // Simple damage formula: (Atk * 2) - Def
        const rawDamage = (attacker.attack * 2) - defender.defense;
        const damage = Math.max(1, Math.floor(rawDamage + (Math.random() * 5)));

        const log = `${attacker.name} attacks ${defender.name} for ${damage} damage!`;
        return { damage, log };
    }

    /**
     * Runs a full autonomous combat loop until one side wins.
     */
    public async executeFullCombat(p1: EffectiveStats, p2: EffectiveStats, battleId: string): Promise<CombatState> {
        const state: CombatState = {
            isFinished: false,
            winnerId: null,
            turnCount: 0,
            logs: [`Battle started: ${p1.name} vs ${p2.name}`]
        };

        const currentP1 = { ...p1 };
        const currentP2 = { ...p2 };

        while (currentP1.hp > 0 && currentP2.hp > 0 && state.turnCount < 50) {
            state.turnCount++;

            // Speed check for initiative
            const [first, second] = currentP1.speed >= currentP2.speed
                ? [currentP1, currentP2]
                : [currentP2, currentP1];

            // First attacker
            const turn1 = this.executeTurn(first as EffectiveStats, second as EffectiveStats);
            second.hp -= turn1.damage;
            state.logs.push(`[Turn ${state.turnCount}] ${turn1.log}`);

            if (second.hp <= 0) break;

            // Second attacker
            const turn2 = this.executeTurn(second as EffectiveStats, first as EffectiveStats);
            first.hp -= turn2.damage;
            state.logs.push(`[Turn ${state.turnCount}] ${turn2.log}`);
        }

        state.isFinished = true;
        state.winnerId = currentP1.hp > 0 ? currentP1.id : currentP2.id;
        state.logs.push(`Battle ended. Winner: ${state.winnerId}`);

        // Optionally persist to DB
        if (battleId) {
            const fullLogText = state.logs.join('\n');
            try {
                await saveCombatLog(battleId, fullLogText);
            } catch (err) {
                console.error('Failed to save combat log to Supabase:', err);
            }
        }

        return state;
    }

    /**
     * Executes a single turn where an attacker applies its skill onto a defender
     */
    private runTurn(attacker: CharacterStats, defender: CharacterStats, state: CombatState): void {

        state.logs.push(`--- Turn ${state.turnCount}: ${attacker.name}'s turn ---`);

        // 1. Fetch and Interpret Skill
        const rawSkill = skillSystem.getSkill(attacker.skillMain);
        const runtimeSkill = skillInterpreter.interpret(rawSkill, attacker);

        // 2. Consume Resources
        if (attacker.mana < runtimeSkill.manaCost) {
            state.logs.push(`${attacker.name} tried to use skill [${runtimeSkill.id}] but failed (Not enough Mana).`);
            // Default to basic attack if mana is insufficient (Fallback logic)
            this.executeBasicAttack(attacker, defender, state);
            return;
        }

        attacker.mana -= runtimeSkill.manaCost;
        state.logs.push(`${attacker.name} uses skill ${runtimeSkill.id} (${runtimeSkill.manaCost} MP)`);

        // 3. Apply Skill Effects (Damage, Healing)
        this.applySkill(attacker, defender, runtimeSkill, state);
    }

    /**
     * Applies the concrete effects of a RuntimeSkill to the target
     */
    private applySkill(attacker: CharacterStats, defender: CharacterStats, skill: RuntimeSkill, state: CombatState): void {

        // Apply Damage
        if (skill.damage > 0) {
            const finalDamage = this.calculateDamage(skill.damage, defender.defense);
            defender.hp -= finalDamage;

            // Floor HP to 0 
            if (defender.hp < 0) defender.hp = 0;

            state.logs.push(`${defender.name} takes ${finalDamage} damage. -> HP: ${defender.hp}/${defender.maxHP}`);
        }

        // Apply Healing (Self-targeted for now based on Role interpretation)
        if (skill.healing > 0) {
            attacker.hp += skill.healing;

            // Cap HP to max
            if (attacker.hp > attacker.maxHP) attacker.hp = attacker.maxHP;

            state.logs.push(`${attacker.name} heals for ${skill.healing} HP. -> HP: ${attacker.hp}/${attacker.maxHP}`);
        }

        // TODO: Phase 2 - Apply Duration & Modifiers (Bleed, Poison) using skill.modifiers array
        this.applyEffects(attacker, defender, skill, state);
    }

    /**
     * Fallback bare-knuckle attack if out of mana
     */
    private executeBasicAttack(attacker: CharacterStats, defender: CharacterStats, state: CombatState): void {
        const finalDamage = this.calculateDamage(attacker.attack, defender.defense);
        defender.hp -= finalDamage;
        if (defender.hp < 0) defender.hp = 0;

        state.logs.push(`${attacker.name} uses Basic Attack!`);
        state.logs.push(`${defender.name} takes ${finalDamage} damage. -> HP: ${defender.hp}/${defender.maxHP}`);
    }

    /**
     * Safely calculates deterministic combat math.
     * Simple armor formula: Damage reduced by Defense flatly, minimum 1 damage.
     */
    private calculateDamage(incomingDamage: number, targetDefense: number): number {
        const rawDamage = incomingDamage - targetDefense;
        return rawDamage > 0 ? rawDamage : 1;
    }

    /**
     * Extension point for future complex modifiers (Stun, Burn, Lifesteal)
     */
    private applyEffects(attacker: CharacterStats, defender: CharacterStats, skill: RuntimeSkill, state: CombatState): void {
        // Scaffold for when secondary modifiers are implemented
        if (skill.specialProperties && skill.specialProperties.length > 0) {
            // Handle Lifesteal, Execute, etc.
        }
    }

    /**
     * Checks win condition
     */
    private isCombatFinished(p1: CharacterStats, p2: CharacterStats): boolean {
        return p1.hp <= 0 || p2.hp <= 0;
    }
}

// Singleton Engine pattern
export const combatSystem = new CombatSystem();
