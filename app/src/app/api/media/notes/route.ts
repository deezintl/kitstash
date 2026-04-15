import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { media_id, notes } = body;
  if (!media_id) return NextResponse.json({ error: "media_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("media")
    .update({ notes: notes || null })
    .eq("id", media_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
