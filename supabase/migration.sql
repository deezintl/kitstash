-- ============================================================
-- KitStash — Supabase Migration
-- Run this in Supabase SQL Editor (or as a migration file)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------
-- Items: the master gear catalog
-- --------------------------------------------------------
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT CHECK (category IN ('Recon', 'Direct Action', 'Arrest')),
  status TEXT CHECK (status IN ('production', 'discontinued')) DEFAULT 'production',
  purchase_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Kits: named loadout groupings
-- --------------------------------------------------------
CREATE TABLE kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('Recon', 'Direct Action', 'Arrest')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Media: uploaded images and videos
-- --------------------------------------------------------
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES kits(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('image', 'video')) NOT NULL,
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  ai_processed BOOLEAN DEFAULT false,
  ai_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Annotations: bounding boxes linking media → items
-- --------------------------------------------------------
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  timestamp_sec FLOAT,                -- null for images, seconds for video frames
  timestamp_end FLOAT,                -- end of visibility range for video
  coords JSONB NOT NULL,              -- { x, y, width, height } as % of media dimensions
  confidence FLOAT,                   -- AI confidence score, null for manual
  status TEXT CHECK (status IN ('suggested', 'confirmed', 'rejected')) DEFAULT 'suggested',
  signature_name TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Audit log: every write action
-- --------------------------------------------------------
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT CHECK (action IN ('create', 'update', 'delete')) NOT NULL,
  signature_name TEXT,
  ip_address INET,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- Indexes
-- --------------------------------------------------------
CREATE INDEX idx_annotations_media ON annotations(media_id);
CREATE INDEX idx_annotations_item ON annotations(item_id);
CREATE INDEX idx_annotations_status ON annotations(status);
CREATE INDEX idx_media_kit ON media(kit_id);
CREATE INDEX idx_media_ai_processed ON media(ai_processed);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_status ON items(status);

-- --------------------------------------------------------
-- Row-Level Security (RLS) — permissive for collaborative use
-- --------------------------------------------------------
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write (no auth model — signature-based trust)
CREATE POLICY "Allow all for items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for kits" ON kits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for media" ON media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for annotations" ON annotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- Storage bucket for media uploads
-- --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads and reads on the media bucket
CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- --------------------------------------------------------
-- Auto-update updated_at on annotations
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER annotations_updated_at
  BEFORE UPDATE ON annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------
-- Seed: sample items for testing
-- --------------------------------------------------------
INSERT INTO items (name, brand, category, status, purchase_url) VALUES
  ('JPC 2.0', 'Crye Precision', 'Direct Action', 'production', 'https://cryeprecision.com/jpc-2-0'),
  ('FAST SF High Cut', 'Ops-Core', 'Direct Action', 'production', 'https://gentexcorp.com/ops-core'),
  ('D3CRX Heavy', 'Haley Strategic', 'Direct Action', 'production', 'https://haleystrategic.com/d3crx-heavy'),
  ('Comtac V', '3M/Peltor', 'Recon', 'production', NULL),
  ('PVS-31A', 'L3Harris', 'Recon', 'production', NULL),
  ('Safariland 6354DO', 'Safariland', 'Arrest', 'production', 'https://safariland.com/6354do'),
  ('Spiritus Mk4', 'Spiritus Systems', 'Direct Action', 'production', 'https://spiritussystems.com/micro-fight-mk4'),
  ('LBT-6094A', 'London Bridge Trading', 'Direct Action', 'discontinued', NULL),
  ('MBITR', 'L3Harris', 'Recon', 'discontinued', NULL),
  ('Ferro Slickster', 'Ferro Concepts', 'Arrest', 'production', 'https://ferroconcepts.com/slickster');
