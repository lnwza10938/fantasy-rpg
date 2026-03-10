-- src/db/character_skill_migration.sql
-- Run this in Supabase SQL Editor

-- Add skill_data JSONB column to characters table to persist AI-generated skill details
ALTER TABLE characters ADD COLUMN IF NOT EXISTS skill_data jsonb;

-- Comment to describe the column
COMMENT ON COLUMN characters.skill_data IS 'Stores the AI-interpreted skill details (name, description, mana_cost, etc.)';
