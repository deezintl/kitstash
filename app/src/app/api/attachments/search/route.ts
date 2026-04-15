import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const slot = req.nextUrl.searchParams.get("slot");

  let query = supabase.from("attachment_catalog").select("*").order("name").limit(20);

  if (q.trim()) {
    query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  if (slot) {
    query = query.eq("slot", slot);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
