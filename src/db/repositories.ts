// src/db/repositories.ts
import { supabase } from "./supabase.js";
import type { CharacterStats } from "../models/combatTypes.js";

// --- Players ---

export async function createPlayer(
  name: string,
  userId: string | null,
  email: string,
) {
  const { data, error } = await supabase
    .from("players")
    .insert([{ name, user_id: userId, email }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPlayerByUserId(userId: string) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found"
  return data;
}

export async function getPlayerByEmail(email: string) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// --- Characters ---

export async function createCharacter(
  playerId: string,
  name: string,
  baseStats?: Partial<CharacterStats>,
  skillData?: any,
) {
  const { data, error } = await supabase
    .from("characters")
    .insert([
      {
        player_id: playerId,
        name: name,
        level: baseStats?.level || 1,
        hp: baseStats?.hp || 100,
        max_hp: baseStats?.maxHP || 100,
        mana: baseStats?.mana || 50,
        max_mana: baseStats?.maxMana || 50,
        attack: baseStats?.attack || 10,
        defense: baseStats?.defense || 5,
        speed: baseStats?.speed || 10,
        skill_main: baseStats?.skillMain || 111111111,
        skill_data: skillData || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCharactersByPlayerId(playerId: string) {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCharacter(id: string): Promise<CharacterStats> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  // Transform snake_case from DB back into the CombatTypes format
  return {
    id: data.id,
    name: data.name,
    level: data.level,
    hp: data.hp,
    maxHP: data.max_hp,
    mana: data.mana,
    maxMana: data.max_mana,
    attack: data.attack,
    defense: data.defense,
    speed: data.speed,
    skillMain: data.skill_main,
    skillData: data.skill_data,
  };
}

export async function deleteCharacter(id: string) {
  // Delete player_states first (in case there's no DB-level cascade)
  await supabase.from("player_states").delete().eq("character_id", id);
  // Then delete the character itself
  const { error } = await supabase.from("characters").delete().eq("id", id);
  if (error) throw error;
}

// --- Combat Logs ---

export async function saveCombatLog(battleId: string, log: string) {
  const { data, error } = await supabase
    .from("combat_logs")
    .insert([
      {
        battle_id: battleId,
        log_text: log,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- World States ---

export async function createWorld(seed: number) {
  const { data, error } = await supabase
    .from("world_states")
    .insert([{ world_seed: seed }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getWorld(id: string) {
  const { data, error } = await supabase
    .from("world_states")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}
