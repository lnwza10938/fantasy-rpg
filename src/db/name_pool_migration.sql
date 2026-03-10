-- Phase 3.1: Name Pool Schema Expansion
-- Support for various name categories for procedural generation

CREATE TABLE IF NOT EXISTS name_pools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL, -- e.g., 'city', 'kingdom', 'npc', 'religion', etc.
    name text NOT NULL,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(category, name)
);

CREATE INDEX IF NOT EXISTS idx_name_pools_category ON name_pools(category);
