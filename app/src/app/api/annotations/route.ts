import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * POST /api/annotations
 * Create a new manual annotation.
 * Body: { media_id, item_id, coords, timestamp_sec?, signature_name }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { media_id, item_id, coords, timestamp_sec, signature_name } = body;

    if (!media_id || !item_id || !coords || !signature_name) {
      return NextResponse.json(
        { error: "media_id, item_id, coords, and signature_name are required" },
        { status: 400 }
      );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

    const { data, error } = await supabase
      .from("annotations")
      .insert({
        media_id,
        item_id,
        coords,
        timestamp_sec: timestamp_sec || null,
        confidence: null,
        status: "confirmed",
        signature_name,
        ip_address: ip,
      })
      .select("*, item:items(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Audit log
    await supabase.from("audit_log").insert({
      table_name: "annotations",
      record_id: data.id,
      action: "create",
      signature_name,
      ip_address: ip,
      changes: { media_id, item_id, coords },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Annotation create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
