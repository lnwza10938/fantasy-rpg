-- Run this script in the Supabase SQL Editor
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common';
