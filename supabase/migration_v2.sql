-- ============================================================
-- KitStash v2 Migration — Person Hierarchy, Gear Slots, Weapons
-- ============================================================

-- 1. Persons table — identified individuals across photos
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign TEXT NOT NULL UNIQUE,
  real_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Media-Person junction — which persons appear in which media
CREATE TABLE IF NOT EXISTS media_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  person_index INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, person_index)
);

-- 3. Gear slot types enum
DO $$ BEGIN
  CREATE TYPE gear_slot AS ENUM (
    'helmet', 'headwear', 'eyepro', 'top', 'pants',
    'lbe', 'belt', 'boots', 'gloves', 'comms', 'accessories'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Person gear slots — gear worn by a person in a specific photo
CREATE TABLE IF NOT EXISTS person_gear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_person_id UUID NOT NULL REFERENCES media_persons(id) ON DELETE CASCADE,
  slot gear_slot NOT NULL,
  item_name TEXT NOT NULL,
  brand TEXT,
  annotation_id UUID REFERENCES annotations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Weapon attachment type enum
DO $$ BEGIN
  CREATE TYPE weapon_slot AS ENUM (
    'muzzle_device', 'handguard', 'foregrip', 'flashlight',
    'laser', 'optic_rail', 'optic', 'stock', 'magazine', 'suppressor', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Weapons carried by a person in a photo
CREATE TABLE IF NOT EXISTS person_weapons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_person_id UUID NOT NULL REFERENCES media_persons(id) ON DELETE CASCADE,
  weapon_type TEXT NOT NULL DEFAULT 'primary',
  weapon_name TEXT NOT NULL,
  brand TEXT,
  annotation_id UUID REFERENCES annotations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Weapon attachments
CREATE TABLE IF NOT EXISTS weapon_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_weapon_id UUID NOT NULL REFERENCES person_weapons(id) ON DELETE CASCADE,
  slot weapon_slot NOT NULL,
  attachment_name TEXT NOT NULL,
  brand TEXT,
  annotation_id UUID REFERENCES annotations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Add image-level tags to media (DA, Recon, Arrest)
ALTER TABLE media ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_media_persons_media ON media_persons(media_id);
CREATE INDEX IF NOT EXISTS idx_media_persons_person ON media_persons(person_id);
CREATE INDEX IF NOT EXISTS idx_person_gear_mp ON person_gear(media_person_id);
CREATE INDEX IF NOT EXISTS idx_person_weapons_mp ON person_weapons(media_person_id);
CREATE INDEX IF NOT EXISTS idx_weapon_attachments_pw ON weapon_attachments(person_weapon_id);
CREATE INDEX IF NOT EXISTS idx_media_tags ON media USING gin(tags);

-- 10. RLS Policies
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_weapons ENABLE ROW LEVEL SECURITY;
ALTER TABLE weapon_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read persons" ON persons FOR SELECT USING (true);
CREATE POLICY "Public insert persons" ON persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update persons" ON persons FOR UPDATE USING (true);

CREATE POLICY "Public read media_persons" ON media_persons FOR SELECT USING (true);
CREATE POLICY "Public insert media_persons" ON media_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update media_persons" ON media_persons FOR UPDATE USING (true);
CREATE POLICY "Public delete media_persons" ON media_persons FOR DELETE USING (true);

CREATE POLICY "Public read person_gear" ON person_gear FOR SELECT USING (true);
CREATE POLICY "Public insert person_gear" ON person_gear FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update person_gear" ON person_gear FOR UPDATE USING (true);
CREATE POLICY "Public delete person_gear" ON person_gear FOR DELETE USING (true);

CREATE POLICY "Public read person_weapons" ON person_weapons FOR SELECT USING (true);
CREATE POLICY "Public insert person_weapons" ON person_weapons FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update person_weapons" ON person_weapons FOR UPDATE USING (true);
CREATE POLICY "Public delete person_weapons" ON person_weapons FOR DELETE USING (true);

CREATE POLICY "Public read weapon_attachments" ON weapon_attachments FOR SELECT USING (true);
CREATE POLICY "Public insert weapon_attachments" ON weapon_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update weapon_attachments" ON weapon_attachments FOR UPDATE USING (true);
CREATE POLICY "Public delete weapon_attachments" ON weapon_attachments FOR DELETE USING (true);

-- 11. Expanded gear database — seed items from Zapad primer & DG Bakery
INSERT INTO items (name, brand, category, status, purchase_url) VALUES
  -- Helmets
  ('LSHZ 1+ High Cut', 'Armocom', 'Direct Action', 'production', 'https://www.dgbakery.site/catalog?subcategory=Helmets'),
  ('LSHZ 1+ Low Cut', 'Armocom', 'Direct Action', 'production', 'https://www.dgbakery.site/catalog?subcategory=Helmets'),
  ('Ops Core FAST Clone (NIJ IIIA)', 'Militech/AAShield', 'Direct Action', 'production', NULL),
  ('RBR F6 MkII', 'RBR Tactical Armor', 'Direct Action', 'production', NULL),
  ('Spartan 2', '5.45 Design', 'Direct Action', 'production', NULL),
  ('Spartan 1', '5.45 Design', 'Direct Action', 'discontinued', NULL),
  ('Ars Arma Airframe', 'Ars Arma', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  -- Eye Protection
  ('M-Frame 3.0', 'Oakley', 'Direct Action', 'production', NULL),
  ('Desert Locust', 'Revision', 'Direct Action', 'production', NULL),
  ('Stealth', 'Uvex', 'Direct Action', 'production', NULL),
  ('X600', 'Bolle', 'Direct Action', 'production', NULL),
  ('Turbofan', 'ESS', 'Direct Action', 'production', NULL),
  -- Headwear
  ('Tactical Cap SURPAT', 'SRVV', 'Recon', 'production', NULL),
  ('Tactical Cap ATACS FG', 'SSO/TPC', 'Recon', 'production', NULL),
  ('SS Leto Boonie', 'SSO/SPOSN', 'Recon', 'production', NULL),
  -- Uniforms - Black
  ('KPPO Anti Cut Suit', 'Armacom', 'Direct Action', 'production', 'https://www.dgbakery.site/products/kppo_suit'),
  ('Uniformteks Contract Uniform', 'Uniformteks', 'Direct Action', 'production', 'https://www.dgbakery.site/catalog'),
  ('KPPO Uniform Set', 'KPPO', 'Direct Action', 'production', 'https://www.dgbakery.site/catalog'),
  ('Alpha/Vympel Coveralls', 'SSO/SPOSN', 'Direct Action', 'production', 'https://www.dgbakery.site/products/spons_alpha_coverall'),
  ('Vympel Coverall', 'Uniformteks/Innovation', 'Direct Action', 'production', 'https://www.dgbakery.site/products/Vympel_coverall_uniformteks'),
  -- Uniforms - Camo
  ('Innovation ATACS FG Set', 'Innovation/Slavyanka', 'Direct Action', 'production', 'https://www.dgbakery.site/catalog'),
  ('TCP-R Combat Pants', 'Tactical Performance Corp', 'Direct Action', 'production', 'http://www.tactical-performance.com/'),
  ('TCS Combat Shirt Gen II', 'Tactical Performance Corp', 'Direct Action', 'production', 'http://www.tactical-performance.com/'),
  ('Uron Pants', 'Voin', 'Direct Action', 'production', NULL),
  ('IDA Shirt Gen 3', 'UR Tactical', 'Direct Action', 'production', 'https://www.ur-tactical.com/'),
  ('AFR Pants', 'UR Tactical', 'Direct Action', 'production', 'https://www.ur-tactical.com/'),
  ('Striker XT Gen 2 Top', 'UF PRO', 'Direct Action', 'production', 'https://ufpro.com/'),
  ('Striker HT Pants', 'UF PRO', 'Direct Action', 'production', 'https://ufpro.com/'),
  ('Lynx Field Top', '5.45 Design', 'Direct Action', 'production', NULL),
  -- Armor / LBE
  ('Defender 2 Standard', 'Fort Technologies', 'Direct Action', 'production', 'https://www.dgbakery.site/products/d2_newgen_molle_cover_2022'),
  ('Defender 2 Low Profile', 'Fort Technologies', 'Direct Action', 'production', NULL),
  ('Defender 2 Emerald', 'Fort Technologies', 'Direct Action', 'production', NULL),
  ('DCS Standard', 'Warrior Assault Systems', 'Direct Action', 'production', NULL),
  ('DCS Releasable', 'Warrior Assault Systems', 'Direct Action', 'production', NULL),
  ('CPC', 'Ars Arma/Crye Precision', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  ('AVS', 'Ars Arma/Crye Precision', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  ('MK2 Chest Rig', 'J-Tech/ANA/TT', 'Recon', 'production', NULL),
  ('Centurion Chest Rig', 'Warrior Assault Systems', 'Recon', 'production', NULL),
  ('Falcon Chest Rig', 'Warrior Assault Systems', 'Recon', 'production', NULL),
  ('Intendant Rig', 'Ars Arma', 'Recon', 'production', 'https://www.arsarma.ru/'),
  ('Fortress Mod K', 'Fort Technologies', 'Direct Action', 'production', 'https://www.dgbakery.site/products/fortress_mod_k'),
  -- Belts
  ('MK2 Belt', 'J-Tech/ANA', 'Direct Action', 'production', NULL),
  ('Gunner Belt Pad', 'ANA', 'Direct Action', 'production', NULL),
  ('SureGrip Padded Belt', 'HSGI', 'Direct Action', 'production', NULL),
  ('Intendant AVS Belt', 'Ars Arma', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  ('Intendant Ronin Belt', 'Ars Arma', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  -- Boots
  ('Zephyr GTX', 'Lowa', 'Direct Action', 'production', NULL),
  ('Quest 4D GTX', 'Salomon', 'Direct Action', 'production', NULL),
  ('Caribu', 'Trezeta', 'Direct Action', 'production', NULL),
  ('Moab 2', 'Merrell', 'Direct Action', 'production', NULL),
  -- Comms
  ('UV-5R', 'Baofeng', 'Direct Action', 'production', NULL),
  ('F8-HP', 'Baofeng', 'Direct Action', 'production', NULL),
  ('GSSH-04', 'Dencom', 'Direct Action', 'production', NULL),
  ('Impact Sport', 'Howard Leight', 'Direct Action', 'production', NULL),
  ('Sordin Supreme Pro-X', 'MSA', 'Direct Action', 'production', NULL),
  ('Comtac XPI', '3M/Peltor', 'Direct Action', 'production', NULL),
  -- Accessories
  ('Pakteen', 'Camelbak', 'Direct Action', 'production', NULL),
  ('SurvivalBak', 'SRVV', 'Direct Action', 'production', NULL),
  ('Gruppa 99 IFAK', 'Ars Arma', 'Direct Action', 'production', 'https://www.arsarma.ru/'),
  ('Ripoff IFAK', 'Warrior Assault Systems', 'Direct Action', 'production', NULL),
  ('ATS Tear Away IFAK', 'Ars Arma', 'Direct Action', 'production', NULL),
  ('Reflective Armband IFF', 'Various (SSO/Voin/Fireline)', 'Direct Action', 'production', NULL),
  ('Glint Strips', 'Fort Technologies', 'Direct Action', 'production', NULL),
  ('Leather Gloves (fingerless)', 'Various', 'Direct Action', 'production', 'https://www.dgbakery.site/products/leather_gloves_no_fingers'),
  ('Hatch Knee Protectors', 'Hatch', 'Direct Action', 'production', 'https://www.dgbakery.site/products/hatch_knee_protectors_early_gen'),
  ('HWI Knee Protectors', 'HWI', 'Direct Action', 'production', 'https://www.dgbakery.site/products/hwi_knee_protectors'),
  -- Rucks
  ('Trooper 45L', 'Tasmanian Tiger', 'Recon', 'production', NULL),
  ('Whirlwind (Rush 72 clone)', 'SSO/SPOSN', 'Recon', 'production', NULL),
  ('ACT 60+10L', 'Deuter', 'Recon', 'production', NULL),
  ('RUSH 24', '5.11 Tactical', 'Recon', 'production', NULL),
  -- Recon suits
  ('Fall Leaf Suit', 'Uniformteks/5.45 Design', 'Recon', 'production', NULL),
  ('Spring Leaf Suit', 'Limkom', 'Recon', 'production', NULL),
  ('Spectre Suit', 'SSO', 'Recon', 'production', NULL),
  ('Sumrak ATACS FG', 'BARS', 'Recon', 'production', NULL),
  -- DG Bakery specific items
  ('LSHZ 1+ Cover (Syrian Ed)', 'Various', 'Direct Action', 'production', 'https://www.dgbakery.site/products/lshz_1_plus_cover_syrian_ed'),
  ('Thor Helmet Cover (Black)', 'Various', 'Direct Action', 'production', 'https://www.dgbakery.site/products/thor_cover_black'),
  ('Thor Helmet Cover (Moss)', 'Various', 'Recon', 'production', 'https://www.dgbakery.site/products/thor_cover_moss'),
  ('Blue Moss Cap', 'Various', 'Recon', 'production', 'https://www.dgbakery.site/products/blue_moss_cap')
ON CONFLICT (name) DO NOTHING;

