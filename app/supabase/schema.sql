-- ============================================================
-- KitStash Database Schema
-- Run this ONCE in your Supabase SQL Editor to set up all tables.
-- Supabase Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================================

-- Custom enum types
CREATE TYPE public.gear_slot AS ENUM (
  'helmet', 'headwear', 'eyepro', 'top', 'pants',
  'lbe', 'belt', 'boots', 'gloves', 'comms', 'accessories'
);

CREATE TYPE public.weapon_slot AS ENUM (
  'muzzle_device', 'handguard', 'foregrip', 'flashlight',
  'laser', 'optic_rail', 'optic', 'stock', 'magazine', 'suppressor', 'other'
);

-- ============================================================
-- Core tables
-- ============================================================

CREATE TABLE public.kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id uuid REFERENCES public.kits(id),
  type text NOT NULL DEFAULT 'image',
  storage_url text NOT NULL,
  thumbnail_url text,
  ai_processed boolean DEFAULT false,
  ai_processed_at timestamptz,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  brand text,
  category text,
  status text DEFAULT 'production',
  purchase_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.persons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign text NOT NULL,
  real_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.weapons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  weapon_type text DEFAULT 'rifle',
  caliber text,
  brand text,
  notes text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.attachment_catalog (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slot public.weapon_slot NOT NULL,
  brand text,
  compatible_weapons text[] DEFAULT '{}',
  purchase_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Relationship / annotation tables
-- ============================================================

CREATE TABLE public.annotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id uuid NOT NULL REFERENCES public.media(id),
  item_id uuid REFERENCES public.items(id),
  timestamp_sec double precision,
  timestamp_end double precision,
  coords jsonb,
  confidence double precision,
  status text DEFAULT 'suggested',
  signature_name text,
  ip_address inet,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.media_persons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id uuid NOT NULL REFERENCES public.media(id),
  person_id uuid REFERENCES public.persons(id),
  person_index integer DEFAULT 1,
  dot_x real,
  dot_y real,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.person_gear (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  media_person_id uuid NOT NULL REFERENCES public.media_persons(id),
  slot public.gear_slot NOT NULL,
  item_name text NOT NULL,
  brand text,
  annotation_id uuid REFERENCES public.annotations(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.person_weapons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  media_person_id uuid NOT NULL REFERENCES public.media_persons(id),
  weapon_type text DEFAULT 'primary',
  weapon_name text NOT NULL,
  brand text,
  annotation_id uuid REFERENCES public.annotations(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.weapon_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  person_weapon_id uuid NOT NULL REFERENCES public.person_weapons(id),
  slot public.weapon_slot NOT NULL,
  attachment_name text NOT NULL,
  brand text,
  annotation_id uuid REFERENCES public.annotations(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text,
  record_id uuid,
  action text,
  signature_name text,
  ip_address inet,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_media_kit_id ON public.media(kit_id);
CREATE INDEX idx_media_created_at ON public.media(created_at DESC);
CREATE INDEX idx_annotations_media_id ON public.annotations(media_id);
CREATE INDEX idx_media_persons_media_id ON public.media_persons(media_id);
CREATE INDEX idx_person_gear_mp_id ON public.person_gear(media_person_id);
CREATE INDEX idx_person_weapons_mp_id ON public.person_weapons(media_person_id);
CREATE INDEX idx_weapon_attachments_pw_id ON public.weapon_attachments(person_weapon_id);

-- ============================================================
-- Storage bucket
-- If this errors, create the bucket manually in the Supabase
-- dashboard: Storage > New Bucket > Name: "media" > Public: ON
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');

-- ============================================================
-- Row Level Security - open access (service role key bypasses)
-- ============================================================

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapon_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON public.kits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.persons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.weapons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.attachment_catalog FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.annotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.media_persons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.person_gear FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.person_weapons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.weapon_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
