// src/core/legendSystem.ts
// Records player achievements into world history for future players to discover

import { supabase } from '../db/supabase.js';

export interface Legend {
    id?: string;
    world_id: string;
    player_name: string;
    event_text: string;
    turn_number: number;
    region_name: string;
    created_at?: string;
}

export class LegendSystem {

    /**
     * Records a legendary act into the world's permanent history.
     */
    public async recordLegend(legend: Omit<Legend, 'id' | 'created_at'>): Promise<Legend> {
        const { data, error } = await supabase
            .from('legends')
            .insert([legend])
            .select()
            .single();

        if (error) throw error;
        return data as Legend;
    }

    /**
     * Retrieves all legends for a specific world, ordered by when they occurred.
     */
    public async getWorldLegends(worldId: string): Promise<Legend[]> {
        const { data, error } = await supabase
            .from('legends')
            .select('*')
            .eq('world_id', worldId)
            .order('turn_number', { ascending: true });

        if (error) throw error;
        return (data ?? []) as Legend[];
    }

    /**
     * Generates a human-readable legend text from a combat victory or discovery.
     */
    public formatLegend(playerName: string, action: string, target: string, regionName: string): string {
        const templates = [
            `${playerName} ${action} ${target} in ${regionName}.`,
            `The tale of ${playerName}, who ${action} ${target} at ${regionName}, echoes through the land.`,
            `In ${regionName}, ${playerName} ${action} ${target}. The world remembers.`,
        ];
        return templates[Math.floor(Math.random() * templates.length)]!;
    }

    /**
     * Generates a random legend reference for NPC dialogue.
     * Returns null if no legends exist yet.
     */
    public async getRandomLegendReference(worldId: string): Promise<string | null> {
        const legends = await this.getWorldLegends(worldId);
        if (legends.length === 0) return null;

        const legend = legends[Math.floor(Math.random() * legends.length)]!;
        const intros = [
            `"I heard a tale... ${legend.event_text}"`,
            `"Long ago... ${legend.event_text}"`,
            `"The elders speak of a hero... ${legend.event_text}"`,
            `"Do you know the legend? ${legend.event_text}"`,
        ];
        return intros[Math.floor(Math.random() * intros.length)]!;
    }
}

export const legendSystem = new LegendSystem();
