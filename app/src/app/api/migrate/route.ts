import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Run this SQL in the Supabase SQL editor:",
    sql: "ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_x real; ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_y real;",
  });
}
