-- Phase 3: Schema Expansion for Seeding Data
-- Run this in Supabase SQL Editor

-- Add rarity and biome to monsters
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS biome text;
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common';
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS description text;

-- Add rarity and description to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common';
ALTER TABLE items ADD COLUMN IF NOT EXISTS description text;

-- Add biome to maps
ALTER TABLE maps ADD COLUMN IF NOT EXISTS biome text;

-- Create NPCs table
CREATE TABLE IF NOT EXISTS npcs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    role text NOT NULL,
    region text,
    personality text,
    description text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Factions table
CREATE TABLE IF NOT EXISTS factions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text,
    ideology text,
    description text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
