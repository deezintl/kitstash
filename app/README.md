# KitStash

Tactical gear intelligence platform for cataloging operator equipment from reference photos. Upload images, tag gear and weapons, identify personnel, and build a searchable database of loadout configurations.

## What it does

- **Upload photos** (bulk drag-and-drop, auto-matches `.caption.txt` files)
- **Tag gear** on each person (helmet, plate carrier, boots, comms, etc.)
- **Tag weapons + attachments** (optics, lights, muzzle devices, etc.)
- **Draw bounding boxes** around identified items
- **Filter & search** by tags, weapons, ID status
- **Gun DB** and **Attachment Catalog** for building reference libraries
- **Person tracking** across multiple images

## Setup (3 steps, ~10 minutes)

### Step 1: Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project**, pick a name and password, choose a region
3. Wait for it to finish setting up (~2 minutes)
4. Go to **SQL Editor** (left sidebar)
5. Click **New Query**
6. Open the file `supabase/schema.sql` from this repo, copy the ENTIRE contents, paste it into the query box
7. Click **Run** (green button). You should see "Success. No rows returned"
8. Go to **Storage** (left sidebar) and verify a bucket called `media` was created. If not, click **New Bucket**, name it `media`, toggle **Public** on

Now grab your keys:
- Go to **Settings** > **API** (left sidebar)
- Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
- Copy your **anon public** key
- Copy your **service_role secret** key

### Step 2: Deploy to Vercel (free)

Click this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/deezintl/kitstash&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&envDescription=Get%20these%20from%20your%20Supabase%20project%20Settings%20%3E%20API&project-name=kitstash&root-directory=app)

When prompted, paste in your 3 keys from Step 1:
- `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
- `SUPABASE_SERVICE_ROLE_KEY` = your service role key

Click **Deploy** and wait ~2 minutes.

### Step 3: Use it

Your site is live at the URL Vercel gives you. Start uploading photos.

## Folder Structure

```
app/
  src/
    app/           # Next.js pages (dashboard, upload, media detail, etc.)
    components/    # Reusable UI components
    lib/           # Types, Supabase client, utilities
  supabase/
    schema.sql     # Database setup script
  public/          # Static assets
```

## Tags

Default tags for categorizing images: Direct Action, Recon, Arrest, Comp/Exercise, Winter/Snow, Patches, Calendar, Misc. Tags are stored as arrays on each media record and can be customized in the code.

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Storage**: Supabase Storage (images/videos)

All free tier. No credit card required for small-to-medium usage.
