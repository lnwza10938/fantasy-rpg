-- Phase 2 Migration: player_states table for Save/Load system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS player_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id uuid NOT NULL UNIQUE,
    current_region int NOT NULL DEFAULT 0,
    current_map text,
    hp int NOT NULL DEFAULT 100,
    mana int NOT NULL DEFAULT 50,
    max_hp int NOT NULL DEFAULT 100,
    max_mana int NOT NULL DEFAULT 50,
    exp int NOT NULL DEFAULT 0,
    level int NOT NULL DEFAULT 1,
    gold int NOT NULL DEFAULT 0,
    inventory_json jsonb DEFAULT '[]',
    equipment_json jsonb DEFAULT '{"weapon":null,"armor":null,"accessory":null}',
    world_seed bigint NOT NULL DEFAULT 0,
    last_event text,
    phase text DEFAULT 'IDLE',
    updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
