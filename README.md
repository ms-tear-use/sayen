# sayen

a little space to share.

Sayen is a private web app for two people who already share one Space. It is built with React, Vite, and Supabase.

## Setup

1. Copy `.env.example` to `.env` and add your Supabase URL and publishable key.
2. The tables in `supabase/schema.sql` should already exist. Do not recreate them from the app.
3. If the other person's name or local time does not appear, run `supabase/partner_access.sql` in the Supabase SQL editor.
4. For profile and memory photos, run `supabase/storage.sql` in the SQL editor.
5. For status, schedules, goal folders, and extra photos, run `supabase/life.sql` in the SQL editor.
5. Start the app:

```bash
npm install
npm run dev
```

There is no public signup. Sign in with one of the two accounts that already belong to the shared Space.
