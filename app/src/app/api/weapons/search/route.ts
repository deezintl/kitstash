import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const weaponType = req.nextUrl.searchParams.get("weapon_type");

  let query = supabase.from("weapons").select("*").order("name").limit(20);

  if (q.trim()) {
    query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,weapon_type.ilike.%${q}%`);
  }

  if (weaponType) {
    query = query.eq("weapon_type", weaponType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
