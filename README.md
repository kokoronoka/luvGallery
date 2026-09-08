# LuvGallery 💗

A cozy, timestamped photo timeline for couples, family, and friends — instead of dumping everything into one shared album, every photo lands on a real moment in time, with a note beside it.

## Running it

This is a plain HTML/CSS/JS PWA — no build step, no npm install. But it **must** be served over `http://`, not opened as a `file://` path, or the service worker (offline support / installability) won't register.

From this folder, run any static server, e.g.:

```
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser. On mobile (same Wi-Fi), use your machine's LAN IP instead of `localhost`, or deploy it to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages) to install it as a real app on a phone home screen.

## What's here

- **Timelines hub** — once signed in, your home screen is a list of separate timelines, one per connection (e.g. "Sarah · Partner", "Ben · Friend") — not one flat shared album for everyone.
- **A timeline** — every moment you add to it appears on a vertical thread, grouped by month, each with its date/time stamp, photos, and your note.
- **Add a moment** — upload one or more photos, pick the date & time, write a note, mark who it's about (you, them, or both).
- **People** — add a partner, friend, or family member **by their email**. They see the request in their own People tab and can Accept or Decline; accepting instantly creates a new shared timeline visible to both of you.
- **Templates** — three looks (Love/romantic, Family Warm, Friends Fun) with their own palette and fonts — chosen **per timeline**, so your "Sarah" timeline can look completely different from your "Ben" one.
- **Export** — pick a month within a timeline and export it as a printable PNG or a paginated PDF scrapbook page, photos + notes included.

## How it stores data

Everything (photos included) lives in this browser's **IndexedDB** first — every action feels instant and works fully offline. If you set up cloud sync (below), the same data is mirrored to your own Supabase project in the background, so both people in a timeline see each other's moments, and it survives a browser wipe.

**Without an account** ("Continue without an account"), LuvGallery is a private solo journal on that one device — no Hub, no People tab, just a single timeline, since there's no one to share it with. Signing in switches you into the shared, multi-timeline experience; these are two separate pockets of data and don't merge into each other.

Every timeline is strictly **between two people** — there's no "whole family in one shared space" timeline (yet); each relationship gets its own thread.

## Cloud sync setup (required for the People / shared-timelines features)

This lets you sign in, invite someone by email, and share a real timeline with them. Takes about 10 minutes, free tier is plenty. Without it, People and the Hub just explain that cloud sync isn't set up — the app still works as a local solo journal.

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) and sign up / sign in.
2. Click **New project**. Pick any name (e.g. `luvgallery`), a database password (save it somewhere), and the region closest to you.
3. Wait ~1–2 minutes for it to finish provisioning.

### 2. Run the schema
1. In your project's dashboard, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`sql/schema.sql`](sql/schema.sql) from this project, copy its entire contents, paste into the SQL editor, and click **Run**.
3. This creates `profiles` (auto-filled from your account's email, so people can be found), `timelines` (each one shared by exactly two accounts), `invitations` (the add-by-email / accept-or-decline flow), and `entries` (moments, now scoped to a timeline instead of a single owner) — all with row-level security so only a timeline's two members can ever see its content. It also turns on Realtime and updates the photo Storage policy to be timeline-scoped rather than per-owner.
4. **Heads up:** this script drops and recreates `entries`, `people`, `settings`, and `timelines` if they already exist from an earlier run — any data in them is lost. If you've only been testing, that's expected and fine.

### 3. Turn on email/password sign-in
1. Go to **Authentication → Providers → Email** and make sure it's enabled.
2. For easy testing, turn **off** "Confirm email" (Authentication → Providers → Email → uncheck "Confirm email"). Turn it back on before sharing this with anyone else.

### 4. Get your API keys
1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **Publishable key** (starts with `sb_publishable_...`; on older projects it may be called the `anon` `public` key instead — that works too).

### 5. Plug them into the app
Open [`js/supabase-config.js`](js/supabase-config.js) and replace the two placeholder values:

```js
window.LUV_SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
window.LUV_SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxxxxxxxxxx';
```

Reload the app. You should now see a sign-in screen — create an account, and you're syncing. (You can still tap **Continue without an account** any time to keep using it purely locally.)

### How the invite flow works
1. In **People**, enter the other person's email and pick a relationship label, then **Send invite**.
2. It shows up under **Requests for you** in *their* People tab (they need a LuvGallery account with that exact email — it doesn't send an email itself).
3. They tap **Accept** or **Decline**. Accepting creates a new timeline, visible to both of you immediately (and live, via Realtime, if you both have the app open).
4. Either person can delete a shared timeline later from the Hub (removes it for both).

### How sync works under the hood
- Every save (a moment, a template choice, an invite response) updates IndexedDB immediately, then syncs to Supabase in the background — the UI never waits on the network.
- Photos upload to your project's private Storage bucket under `{timeline_id}/...`, so either member of a timeline can read them — not just whoever uploaded.
- A small pulsing dot next to the export icon shows while a sync is in progress.
- Tap the account icon (top right) any time to see who's signed in, force a manual **Sync now**, or sign out.
- If you're offline, changes queue up (tracked in `localStorage`) and flush automatically once you're back online or the tab regains focus.
- Realtime updates rely on each table's row-level security policy to narrow what a given signed-in client actually receives — not on client-side filtering.

## Project layout

```
index.html            — app shell, all views, auth screen, timeline sub-header
css/styles.css         — design tokens for all 3 templates + components
js/db.js               — IndexedDB data layer (timelines, entries, invitations cache)
js/cloud.js            — Supabase auth + offline-first sync engine + invitations
js/supabase-config.js  — your Supabase project URL/key (fill in to enable sync)
js/app.js              — routing, hub/timeline/people rendering, forms, lightbox
js/export.js           — PNG/PDF export (html2canvas + jsPDF)
sql/schema.sql          — profiles, timelines, invitations, entries, RLS, storage
manifest.webmanifest   — PWA manifest
sw.js                  — offline cache service worker (bypasses Supabase requests)
icons/                 — app icons (generated via scripts/make_icons.py)
vendor/                — bundled html2canvas + jsPDF + supabase-js (offline-friendly)
```

## Known scope boundaries

- **1:1 only.** A timeline is always exactly two people — no group/family-wide timelines yet. Each relationship gets its own thread and its own theme.
- **Local journal and shared timelines don't merge.** If you used the app without an account first and then sign in, your solo entries stay put on that device rather than becoming a shared timeline (there's no one to share a solo journal with).
- **Profiles are a lightweight directory.** Any signed-in user can look up another user's email/display name by their account id (needed to show partner names and invite senders) — there's no per-relationship restriction on that lookup. Fine for a personal/family app, worth tightening if this ever became a public product.
- **Invites require an existing account.** There's no outbound email — if the person hasn't signed up yet, ask them to create an account first, then send the invite (or send it anytime; it'll simply wait until they do, since it's matched by email at read-time).

## Next steps worth considering

- Data export/import (JSON backup) so memories survive completely starting over.
- Dark mode variants per template.
- Group timelines (e.g. one shared space for a whole family) if the 1:1 model ever feels limiting.
- Google/Apple sign-in (the guide this was built from covers Google OAuth) if email/password feels like too much friction.
