import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/weapons/observed-attachments?weapon_name=AK-105
 * Returns the set of attachments that have been observed on this weapon
 * across all media posts (via person_weapons + weapon_attachments).
 * De-duped by (slot, attachment_name, brand). Includes observation count.
 */
export async function GET(req: NextRequest) {
  const weaponName = req.nextUrl.searchParams.get("weapon_name");
  if (!weaponName) {
    return NextResponse.json({ error: "weapon_name required" }, { status: 400 });
  }

  // Find all person_weapons with this weapon_name
  const { data: pw, error: pwErr } = await supabase
    .from("person_weapons")
    .select("id")
    .ilike("weapon_name", weaponName);
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });

  const pwIds = (pw || []).map((r: { id: string }) => r.id);
  if (pwIds.length === 0) return NextResponse.json([]);

  const { data: atts, error: attErr } = await supabase
    .from("weapon_attachments")
    .select("slot, attachment_name, brand")
    .in("person_weapon_id", pwIds);
  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  // Dedupe with observation counts
  const seen = new Map<string, { slot: string; attachment_name: string; brand: string | null; count: number }>();
  for (const a of atts || []) {
    const key = `${a.slot}|${(a.attachment_name || "").toLowerCase()}|${(a.brand || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) existing.count++;
    else seen.set(key, { slot: a.slot, attachment_name: a.attachment_name, brand: a.brand, count: 1 });
  }

  return NextResponse.json(Array.from(seen.values()));
}
