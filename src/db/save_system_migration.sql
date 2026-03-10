-- src/db/save_system_migration.sql
-- Run this in Supabase SQL Editor

-- Add character_name and last_action_log to player_states for better load screen info
ALTER TABLE player_states ADD COLUMN IF NOT EXISTS character_name text;
ALTER TABLE player_states ADD COLUMN IF NOT EXISTS last_action_log text;

-- Add a world_states table if we want to save persistent world changes (future proofing)
CREATE TABLE IF NOT EXISTS world_states (
    world_seed bigint PRIMARY KEY,
    discovered_regions text[] DEFAULT '{}',
    cleared_maps text[] DEFAULT '{}',
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
