import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get("media_id");
  if (!mediaId) return NextResponse.json({ error: "media_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("media_persons")
    .select("*, person:persons(*), gear:person_gear(*), weapons:person_weapons(*, attachments:weapon_attachments(*))")
    .eq("media_id", mediaId)
    .order("person_index");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase
    .from("media_persons")
    .insert({
      media_id: body.media_id,
      person_id: body.person_id || null,
      person_index: body.person_index,
    })
    .select("*, person:persons(*)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("media_persons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
