import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * PATCH /api/annotations/[id]
 * Update an annotation's status or item assignment.
 * Body: { status?, item_id?, signature_name }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { status, item_id, signature_name } = body;
    const id = params.id;

    if (!signature_name) {
      return NextResponse.json(
        { error: "signature_name is required" },
        { status: 400 }
      );
    }

    // Get client IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

    // Build update object
    const update: Record<string, unknown> = {
      signature_name,
      ip_address: ip,
    };
    if (status) update.status = status;
    if (item_id !== undefined) update.item_id = item_id;

    const { data, error } = await supabase
      .from("annotations")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Write audit log
    await supabase.from("audit_log").insert({
      table_name: "annotations",
      record_id: id,
      action: "update",
      signature_name,
      ip_address: ip,
      changes: update,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Annotation update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
