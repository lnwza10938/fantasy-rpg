// src/db/contentRepositories.ts
// CRUD functions for game content tables (monsters, items, equipment, maps, spawn_points, dialogues, npcs, factions)

import { supabase } from './supabase.js';

// --- Monsters ---

export async function createMonster(data: {
    name: string;
    level: number;
    base_hp: number;
    base_attack: number;
    base_defense: number;
    speed: number;
    skill_id: number;
    image_url?: string;
    type?: string;
    biome?: string;
    rarity?: string;
    description?: string;
}) {
    const { data: result, error } = await supabase.from('monsters').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getMonsters() {
    const { data, error } = await supabase.from('monsters').select('*').order('level');
    if (error) throw error;
    return data;
}

export async function getMonster(id: string) {
    const { data, error } = await supabase.from('monsters').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

// --- Items ---

export async function createItem(data: {
    name: string;
    type: string;
    stat_bonus?: object;
    image_url?: string;
    rarity?: string;
    description?: string;
}) {
    const { data: result, error } = await supabase.from('items').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getItems() {
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (error) throw error;
    return data;
}

// --- Equipment ---

export async function createEquipment(data: {
    name: string;
    slot: string;
    attack_bonus?: number;
    defense_bonus?: number;
    speed_bonus?: number;
    hp_bonus?: number;
    image_url?: string;
    rarity?: string;
    description?: string;
}) {
    const { data: result, error } = await supabase.from('equipment').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getEquipment() {
    const { data, error } = await supabase.from('equipment').select('*').order('name');
    if (error) throw error;
    return data;
}

// --- Maps ---

export async function createMap(data: {
    name: string;
    danger_level: number;
    description?: string;
    image_url?: string;
    biome?: string;
}) {
    const { data: result, error } = await supabase.from('maps').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getMaps() {
    const { data, error } = await supabase.from('maps').select('*').order('danger_level');
    if (error) throw error;
    return data;
}

// --- Spawn Points ---

export async function createSpawnPoint(data: {
    map_id: string; monster_pool: string[]; spawn_rate: number;
}) {
    const { data: result, error } = await supabase.from('spawn_points').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getSpawnPoints(mapId?: string) {
    let query = supabase.from('spawn_points').select('*');
    if (mapId) query = query.eq('map_id', mapId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

// --- Dialogues ---

export async function createDialogue(data: {
    npc_name: string; dialogue_text: string;
}) {
    const { data: result, error } = await supabase.from('dialogues').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getDialogues() {
    const { data, error } = await supabase.from('dialogues').select('*').order('npc_name');
    if (error) throw error;
    return data;
}

// --- NPCs ---

export async function createNPC(data: {
    name: string;
    role: string;
    region?: string;
    personality?: string;
    description?: string;
}) {
    const { data: result, error } = await supabase.from('npcs').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getNPCs() {
    const { data, error } = await supabase.from('npcs').select('*').order('name');
    if (error) throw error;
    return data;
}

// --- Factions ---

export async function createFaction(data: {
    name: string;
    type?: string;
    ideology?: string;
    description?: string;
}) {
    const { data: result, error } = await supabase.from('factions').insert([data]).select().single();
    if (error) throw error;
    return result;
}

export async function getFactions() {
    const { data, error } = await supabase.from('factions').select('*').order('name');
    if (error) throw error;
    return data;
}

// --- Lore Snippets ---

export async function getLoreSnippets() {
    const { data, error } = await supabase.from('lore_snippets').select('*');
    if (error) return []; // Fallback if table not yet created
    return data;
}
