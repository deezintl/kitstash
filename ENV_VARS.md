# KitStash — Environment Variables

## Next.js App (`.env.local`)

| Variable | Side | Where to Find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase Dashboard → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase Dashboard → Project Settings → API → `service_role` key (keep secret!) |
| `MODAL_WEBHOOK_URL` | Server only | Printed after running `modal deploy ai_pipeline.py` — the full endpoint URL |

## Modal.com Secrets (`kitstash-supabase`)

Create a Modal secret named `kitstash-supabase` with these values:

| Variable | Where to Find |
|---|---|
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` above |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as the server-side key above |

Create the secret via: `modal secret create kitstash-supabase SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=eyJ...`

## Vercel Environment Variables

When deploying to Vercel, add all four Next.js variables in: Vercel Dashboard → Project → Settings → Environment Variables. Mark `SUPABASE_SERVICE_ROLE_KEY` and `MODAL_WEBHOOK_URL` as server-only (uncheck "Expose to Browser").
