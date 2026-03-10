// src/core/spawnSystem.ts
// Weighted probability spawn system — reads from content DB

import { supabase } from '../db/supabase.js';
import { worldSystem } from './worldSystem.js';
import type { CharacterStats } from '../models/combatTypes.js';

export interface SpawnPool {
    monsterName: string;
    weight: number; // 0.0 - 1.0
}

export class SpawnSystem {

    /**
     * Select a monster from a weighted spawn pool using probability.
     */
    public selectFromPool(pool: SpawnPool[]): string {
        const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const entry of pool) {
            roll -= entry.weight;
            if (roll <= 0) return entry.monsterName;
        }
        return pool[pool.length - 1]!.monsterName;
    }

    /**
     * Try to load a spawn pool from the database for a given map.
     * Falls back to the worldSystem enemy pool if no DB spawn points exist.
     */
    public async getSpawnPool(mapId?: string): Promise<SpawnPool[]> {
        if (mapId) {
            const { data } = await supabase
                .from('spawn_points')
                .select('monster_pool, spawn_rate')
                .eq('map_id', mapId);

            if (data && data.length > 0) {
                const pool: SpawnPool[] = [];
                for (const row of data) {
                    const names: string[] = row.monster_pool ?? [];
                    const rate: number = row.spawn_rate ?? 0.5;
                    for (const name of names) {
                        pool.push({ monsterName: name, weight: rate / names.length });
                    }
                }
                if (pool.length > 0) return pool;
            }
        }

        // Fallback: use worldSystem data
        const world = worldSystem.getInstance();
        if (!world || world.regions.length === 0) {
            return [{ monsterName: 'Goblin', weight: 1.0 }];
        }
        const region = world.regions[0]!;
        return region.enemyPool.map((name: string) => ({ monsterName: name, weight: 1.0 / region.enemyPool.length }));
    }

    /**
     * Try to load monster stats from DB, otherwise use worldSystem.spawnEnemy.
     */
    public async spawnMonster(name: string, level: number): Promise<CharacterStats> {
        // Try DB first
        const { data } = await supabase
            .from('monsters')
            .select('*')
            .eq('name', name)
            .limit(1)
            .maybeSingle();

        if (data) {
            return {
                id: `monster_${data.id}`,
                name: data.name,
                level: level,
                hp: Math.floor(data.base_hp + (level * 5)),
                maxHP: Math.floor(data.base_hp + (level * 5)),
                mana: Math.floor(20 + level * 2),
                maxMana: Math.floor(20 + level * 2),
                attack: Math.floor(data.base_attack + Math.floor(level * 1.2)),
                defense: Math.floor(data.base_defense + Math.floor(level * 0.6)),
                speed: Math.floor(data.speed + Math.floor(level * 0.3)),
                skillMain: Number(data.skill_id)
            };
        }

        // Fallback to procedural generation
        return worldSystem.spawnEnemy(name, level);
    }
}

export const spawnSystem = new SpawnSystem();
