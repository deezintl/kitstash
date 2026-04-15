import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  // Use direct Postgres connection from the Vercel serverless function
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    // Fallback: try to construct from Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = supabaseUrl.replace('https://', '').split('.')[0];
    const dbUrl = `postgresql://postgres.${ref}:${process.env.SUPABASE_DB_PASSWORD || 'postgres'}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
    
    return NextResponse.json({
      message: "No DATABASE_URL configured. Add it to .env.local. You can find it in Supabase > Settings > Database > Connection string.",
      hint: "Or run this SQL manually in the Supabase SQL editor: ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_x real; ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_y real;",
    });
  }

  try {
    const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await pool.query("ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_x real");
    await pool.query("ALTER TABLE media_persons ADD COLUMN IF NOT EXISTS dot_y real");
    await pool.end();
    return NextResponse.json({ success: true, message: "Columns dot_x and dot_y added to media_persons" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
