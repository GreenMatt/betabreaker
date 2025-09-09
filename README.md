# BetaBreaker — Ultimate Climbing PWA (Scaffold)

This repo scaffolds a Progressive Web App for gym climbing: boulder, top rope, and lead. It includes Supabase integration, auth (Google/Facebook/Email), offline-first quick logging, and placeholders for social, gamification, and admin features.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS (neon purple theme)
- Supabase (DB, Auth, Realtime, Storage)
- PWA: manifest + service worker with basic cache

## Quick Start
1. Create a Supabase project.
2. In the SQL editor, run:
   - `supabase/schema.sql`
   - `supabase/storage_policies.sql` (after creating buckets below)
3. Auth providers:
   - Enable Google and Facebook in Authentication → Providers.
   - Add authorized redirect URIs: `https://YOUR_DOMAIN` and `http://localhost:3000`.
4. Storage buckets:
   - Create public buckets: `profile-photos`, `climb-photos`.
   - Apply `supabase/storage_policies.sql`.
5. Environment variables (create `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
6. Install and run locally:
   - `npm install`
   - `npm run dev`

## Deploy to Cloudflare Pages
- Build command: `npm run build:cf`
- Output directory: `.vercel/output/static`
- Environment variables (Build):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- wrangler config: see `wrangler.toml` (includes `compatibility_date` and `nodejs_compat` flags). Ensure your Pages project picks these up; if the UI shows a `node` flag, keep it enabled.

Notes:
- Use the `build:cf` script so `@cloudflare/next-on-pages` generates `.vercel/output` and Pages Functions for SSR. Using plain `next build` on Pages will not ship SSR and can cause 500s.
- If you still see 500s, check Pages logs for function errors (often missing runtime env vars or unsupported Node APIs when `nodejs_compat` is disabled).

## App Structure
- `src/app` — routes: dashboard, gyms, climb detail, quick log, sessions, feed, profile, leaderboards, challenges, settings, admin.
- `src/components` — UI: auth buttons, upload button, PWA register.
- `src/lib` — Supabase client, offline queue.
- `supabase/` — schema and policies; edge function stub for leaderboards.

## PWA
- `public/manifest.webmanifest` and `public/sw.js` provide installability and basic offline caching.
- Quick Log queues entries locally and attempts sync when the app goes online (replace with actual inserts to `climb_logs`).

## Database Overview
Schema covers:
- `users`, `gyms`, `climbs`, `climb_logs`, `training_sessions`
- `community_ratings`, `follows`, `badges`, `user_badges`
- `challenges`, `challenge_progress`
- Extra: `gym_admins`, `climb_photos` for normalization
RLS policies restrict writes to owners/admins and allow broad reads where appropriate.

## Next Steps (Recommended)
- Wire Quick Log to Supabase: insert into `climb_logs`; create sessions on-the-fly.
- Realtime: subscribe to per-climb comments/ratings to update `climb/[id]` in real time.
- Points system: compute points client-side on log; periodically recalc via Edge Function (`supabase/functions/recalculate_leaderboards`).
- Leaderboards: add pages that query server-side using RLS-safe views or RPCs.
- Admin tools: implement gym CRUD and climb CRUD with photo uploads to `climb-photos`.
- Images: generate thumbnails, add lazy loading.
- Push notifications: add Web Push (VAPID) and store subscriptions; trigger via server.
- Icons: replace `public/icons/*` PNG placeholders with real icons.

## Notes
- This scaffold avoids extra dependencies to keep setup simple. You can add `@supabase/auth-helpers-nextjs` for deeper SSR integration later.
- Policies are conservative; adjust per your moderation needs.
