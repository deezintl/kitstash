# KitStash — Setup Checklist (Zero to Deployed)

## 1. Supabase

- [ ] Create a free Supabase project at [supabase.com](https://supabase.com)
- [ ] Open the SQL Editor in the Supabase Dashboard
- [ ] Paste and run `supabase/migration.sql` — creates all tables, indexes, RLS policies, the storage bucket, and seed data
- [ ] Verify: go to Table Editor and confirm `items` has 10 rows
- [ ] Copy your Project URL, `anon` key, and `service_role` key from Project Settings → API

## 2. Modal.com (AI Pipeline)

- [ ] Create a free Modal account at [modal.com](https://modal.com)
- [ ] Install the Modal CLI: `pip install modal`
- [ ] Authenticate: `modal token new`
- [ ] Create the Supabase secret:
  ```bash
  modal secret create kitstash-supabase \
    SUPABASE_URL="https://YOUR_REF.supabase.co" \
    SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  ```
- [ ] Deploy the pipeline:
  ```bash
  cd modal/
  modal deploy ai_pipeline.py
  ```
- [ ] Copy the webhook URL printed in the terminal (looks like `https://YOUR_USER--kitstash-ai-pipeline-geardetector-process-media-endpoint.modal.run`)

## 3. Next.js App (Local Dev)

- [ ] Navigate to the app directory: `cd app/`
- [ ] Copy the example env file: `cp .env.local.example .env.local`
- [ ] Fill in all four values in `.env.local` (Supabase URL, anon key, service role key, Modal webhook URL)
- [ ] Install dependencies: `npm install`
- [ ] Start dev server: `npm run dev`
- [ ] Open [http://localhost:3000](http://localhost:3000) — you should see the dashboard with 0 media and 10 seed gear items

## 4. Test the Flow

- [ ] Go to `/gear` — verify the 10 seed items appear with status dots and category badges
- [ ] Go to `/upload` — drop an image of tactical gear
- [ ] Watch the status go: Uploading → AI Analyzing → Ready
- [ ] Click "Ready" to go to the media detail page
- [ ] Verify AI-suggested bounding boxes appear as yellow dashed outlines
- [ ] Hover a box → popover appears with confidence score and Confirm/Edit/Reject
- [ ] Click Confirm → signature modal appears → enter your name → box turns green
- [ ] Check the right sidebar — activity log shows your name

## 5. Deploy to Vercel

- [ ] Push the `app/` directory to a GitHub repo
- [ ] Import the repo in [vercel.com](https://vercel.com) → New Project
- [ ] Framework preset: Next.js (auto-detected)
- [ ] Root directory: `app/` (if the repo includes the parent kitstash folder)
- [ ] Add all four environment variables in Vercel's Settings → Environment Variables
- [ ] Deploy — Vercel will build and provide a `.vercel.app` URL
- [ ] Test the production URL end-to-end

## 6. Optional Enhancements

- [ ] Set up a Supabase Realtime subscription so annotation changes appear live for all viewers
- [ ] Add video thumbnail generation (ffmpeg in the Modal pipeline)
- [ ] Configure a custom domain on Vercel
- [ ] Set up Supabase database backups (free tier includes daily backups)
