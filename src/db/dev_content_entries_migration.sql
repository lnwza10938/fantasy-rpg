-- Dev Content Entries Migration
-- Run this in Supabase SQL Editor before using the new dev panel asset/story library.

CREATE TABLE IF NOT EXISTS content_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL,
    subcategory text,
    content_kind text NOT NULL DEFAULT 'text',
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    summary text,
    body_text text,
    file_url text,
    preview_url text,
    mime_type text,
    tags text[] NOT NULL DEFAULT '{}',
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    world_definition_id uuid REFERENCES world_definitions(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_entries_category
ON content_entries(category);

CREATE INDEX IF NOT EXISTS idx_content_entries_subcategory
ON content_entries(subcategory);

CREATE INDEX IF NOT EXISTS idx_content_entries_content_kind
ON content_entries(content_kind);

CREATE INDEX IF NOT EXISTS idx_content_entries_world_definition_id
ON content_entries(world_definition_id);

CREATE INDEX IF NOT EXISTS idx_content_entries_updated_at
ON content_entries(updated_at DESC);
