-- Phase 7: Email Authentication Migration
-- Run this in Supabase SQL Editor

-- Add user_id and email to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id);
ALTER TABLE players ADD COLUMN IF NOT EXISTS email text;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);

-- Optional: If players table doesn't exist yet (safeguard)
CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    user_id uuid UNIQUE REFERENCES auth.users(id),
    email text,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure characters table exists and links correctly
CREATE TABLE IF NOT EXISTS characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    name text NOT NULL,
    level int DEFAULT 1,
    hp int DEFAULT 100,
    max_hp int DEFAULT 100,
    mana int DEFAULT 50,
    max_mana int DEFAULT 50,
    attack int DEFAULT 10,
    defense int DEFAULT 5,
    speed int DEFAULT 10,
    skill_main bigint DEFAULT 111111111,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
