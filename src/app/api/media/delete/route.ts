import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get("id");
  if (!mediaId) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Get media record to find storage path
  const { data: media } = await supabase
    .from("media")
    .select("storage_url")
    .eq("id", mediaId)
    .single();

  // Delete related records first (cascade manually)
  // Get media_persons for this media
  const { data: mps } = await supabase
    .from("media_persons")
    .select("id")
    .eq("media_id", mediaId);

  if (mps && mps.length > 0) {
    const mpIds = mps.map((mp) => mp.id);
    // Delete weapon attachments via person_weapons
    const { data: pws } = await supabase
      .from("person_weapons")
      .select("id")
      .in("media_person_id", mpIds);
    if (pws && pws.length > 0) {
      await supabase
        .from("weapon_attachments")
        .delete()
        .in("person_weapon_id", pws.map((pw) => pw.id));
    }
    await supabase.from("person_weapons").delete().in("media_person_id", mpIds);
    await supabase.from("person_gear").delete().in("media_person_id", mpIds);
    await supabase.from("media_persons").delete().eq("media_id", mediaId);
  }

  // Delete annotations
  await supabase.from("annotations").delete().eq("media_id", mediaId);

  // Delete media record
  const { error } = await supabase.from("media").delete().eq("id", mediaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Try to delete from storage (best effort)
  if (media?.storage_url) {
    try {
      const url = new URL(media.storage_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/media/");
      if (pathParts[1]) {
        await supabase.storage.from("media").remove([pathParts[1]]);
      }
    } catch {
      // Storage cleanup is best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
