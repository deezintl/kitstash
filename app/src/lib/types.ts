export interface Item {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  status: "production" | "discontinued";
  purchase_url: string | null;
  created_at: string;
}

export interface Kit {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  kit_id: string | null;
  type: "image" | "video";
  storage_url: string;
  thumbnail_url: string | null;
  ai_processed: boolean;
  ai_processed_at: string | null;
  tags: string[];
  created_at: string;
  kit?: Kit | null;
}

export interface Coords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  media_id: string;
  item_id: string | null;
  timestamp_sec: number | null;
  timestamp_end?: number | null;
  coords: Coords;
  confidence: number | null;
  status: "suggested" | "confirmed" | "rejected";
  signature_name: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
}

export interface Person {
  id: string;
  callsign: string;
  real_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface MediaPerson {
  id: string;
  media_id: string;
  person_id: string | null;
  person_index: number;
  created_at: string;
  person?: Person | null;
  gear?: PersonGear[];
  weapons?: PersonWeapon[];
}

export type GearSlot =
  | "helmet"
  | "headwear"
  | "eyepro"
  | "top"
  | "pants"
  | "lbe"
  | "belt"
  | "boots"
  | "gloves"
  | "comms"
  | "accessories";

export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  helmet: "Helmet",
  headwear: "Headwear",
  eyepro: "Eye Protection",
  top: "Top",
  pants: "Pants",
  lbe: "LBE (Armor/Chest Rig)",
  belt: "Belt",
  boots: "Boots",
  gloves: "Gloves",
  comms: "Comms/Ear Pro",
  accessories: "Accessories",
};

export const GEAR_SLOT_CATEGORIES: Record<GearSlot, string[]> = {
  helmet: ["Helmets"],
  headwear: ["Headwear"],
  eyepro: ["Eye Protection"],
  top: ["Uniforms"],
  pants: ["Uniforms"],
  lbe: ["Armor / LBE"],
  belt: ["Belts"],
  boots: ["Boots"],
  gloves: ["Accessories"],
  comms: ["Comms / Ear Pro"],
  accessories: ["Accessories"],
};

export interface PersonGear {
  id: string;
  media_person_id: string;
  slot: GearSlot;
  item_name: string;
  brand: string | null;
  annotation_id: string | null;
  notes: string | null;
  created_at: string;
}

export type WeaponSlot =
  | "muzzle_device"
  | "handguard"
  | "foregrip"
  | "flashlight"
  | "laser"
  | "optic_rail"
  | "optic"
  | "stock"
  | "magazine"
  | "suppressor"
  | "other";

export const WEAPON_SLOT_LABELS: Record<WeaponSlot, string> = {
  muzzle_device: "Muzzle Device",
  handguard: "Handguard",
  foregrip: "Foregrip",
  flashlight: "Flashlight",
  laser: "Laser/IR",
  optic_rail: "Optic Rail",
  optic: "Optic",
  stock: "Stock",
  magazine: "Magazine",
  suppressor: "Suppressor",
  other: "Other",
};

export interface PersonWeapon {
  id: string;
  media_person_id: string;
  weapon_type: string;
  weapon_name: string;
  brand: string | null;
  annotation_id: string | null;
  notes: string | null;
  created_at: string;
  attachments?: WeaponAttachment[];
}

export interface WeaponAttachment {
  id: string;
  person_weapon_id: string;
  slot: WeaponSlot;
  attachment_name: string;
  brand: string | null;
  annotation_id: string | null;
  created_at: string;
}

export interface Weapon {
  id: string;
  name: string;
  weapon_type: string;
  caliber: string | null;
  brand: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
}

export interface AttachmentCatalog {
  id: string;
  name: string;
  slot: WeaponSlot;
  brand: string | null;
  compatible_weapons: string[];
  purchase_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  signature_name: string | null;
  ip_address: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export type Category = string;
export type ProductionStatus = "production" | "discontinued";
export type AnnotationStatus = "suggested" | "confirmed" | "rejected";
export type MediaTag = "Direct Action" | "Recon" | "Arrest";

export const GEAR_CATEGORIES = [
  "Helmets",
  "Headwear",
  "Eye Protection",
  "Uniforms",
  "Armor / LBE",
  "Belts",
  "Boots",
  "Comms / Ear Pro",
  "Accessories",
] as const;
