import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ai/trigger
 * Proxies the AI pipeline request to Modal.com.
 * Body: { media_id, storage_url, type }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { media_id, storage_url, type } = body;

    if (!media_id || !storage_url) {
      return NextResponse.json(
        { error: "media_id and storage_url are required" },
        { status: 400 }
      );
    }

    const modalUrl = process.env.MODAL_WEBHOOK_URL;
    if (!modalUrl) {
      console.warn("MODAL_WEBHOOK_URL not configured, skipping AI processing");
      return NextResponse.json({
        status: "skipped",
        message: "AI pipeline not configured",
      });
    }

    // Fire-and-forget to Modal (don't block the upload response)
    fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id, storage_url, type }),
    }).catch((err) => {
      console.error("Modal webhook error:", err);
    });

    return NextResponse.json({ status: "triggered", media_id });
  } catch (err) {
    console.error("AI trigger error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
