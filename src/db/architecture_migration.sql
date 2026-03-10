-- src/db/architecture_migration.sql
-- Run this in Supabase SQL Editor

-- Add spawn_weight to monsters
ALTER TABLE monsters ADD COLUMN IF NOT EXISTS spawn_weight float DEFAULT 1.0;

-- Create lore_snippets table
CREATE TABLE IF NOT EXISTS lore_snippets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    rarity text DEFAULT 'common',
    biome text, -- Optional, for region-specific lore
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed some lore for testing
INSERT INTO lore_snippets (title, content, rarity) VALUES 
('The Second Eclipse', 'Legends speak of a day when the sun turned black and for seven years the dead walked among the living.', 'rare'),
('The Shattered Crown', 'The last king of Omenfell broke his own crown rather than let it fall to the Abyss.', 'common'),
('Whispers of the Tundra', 'Travelers in the frozen north report hearing voices in the wind, calling names of the long forgotten.', 'uncommon');
