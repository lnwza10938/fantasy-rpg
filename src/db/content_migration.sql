-- Content Database Migration Script
-- Run this in Supabase SQL Editor

-- Monsters table
CREATE TABLE IF NOT EXISTS monsters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    level int NOT NULL DEFAULT 1,
    base_hp int NOT NULL DEFAULT 50,
    base_attack int NOT NULL DEFAULT 10,
    base_defense int NOT NULL DEFAULT 5,
    speed int NOT NULL DEFAULT 5,
    skill_id bigint NOT NULL DEFAULT 111111111,
    image_url text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL DEFAULT 'consumable',
    stat_bonus jsonb DEFAULT '{}',
    image_url text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slot text NOT NULL DEFAULT 'weapon',
    attack_bonus int DEFAULT 0,
    defense_bonus int DEFAULT 0,
    speed_bonus int DEFAULT 0,
    hp_bonus int DEFAULT 0,
    image_url text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Maps table
CREATE TABLE IF NOT EXISTS maps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    danger_level int NOT NULL DEFAULT 1,
    description text,
    image_url text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Spawn points table
CREATE TABLE IF NOT EXISTS spawn_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id uuid REFERENCES maps(id),
    monster_pool text[] NOT NULL DEFAULT '{}',
    spawn_rate float NOT NULL DEFAULT 0.5,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Dialogues table
CREATE TABLE IF NOT EXISTS dialogues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_name text NOT NULL,
    dialogue_text text NOT NULL,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Legends table (world history)
CREATE TABLE IF NOT EXISTS legends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id uuid NOT NULL,
    player_name text NOT NULL,
    event_text text NOT NULL,
    turn_number int NOT NULL DEFAULT 0,
    region_name text NOT NULL,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
