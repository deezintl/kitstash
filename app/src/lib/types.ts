export interface Item {
  id: string;
  name: string;
  brand: string | null;
  category: "Recon" | "Direct Action" | "Arrest" | null;
  status: "production" | "discontinued";
  purchase_url: string | null;
  created_at: string;
}

export interface Kit {
  id: string;
  name: string;
  category: "Recon" | "Direct Action" | "Arrest" | null;
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
  created_at: string;
  kit?: Kit;
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

export type Category = "Recon" | "Direct Action" | "Arrest";
export type ProductionStatus = "production" | "discontinued";
export type AnnotationStatus = "suggested" | "confirmed" | "rejected";
