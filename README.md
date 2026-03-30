# cs-5200-project

## Supabase

This project talks to the Supabase Postgres database through the Flask backend, not directly from the browser.

Set these environment variables locally and in Vercel:

- `DATABASE_URL`

Use the direct Postgres connection string from Supabase, for example:

`postgresql://postgres:[YOUR-PASSWORD]@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres`

Replace `[YOUR-PASSWORD]` with the actual database password. The backend exposes a database-backed health route at `/api/supabase/health`. It queries the `sqlift` schema and returns a few sample rows from the `user` table so you can confirm the connection is working.

## Wger Import

The scraper and import scripts live in the `web scrapers/` folder.

Run a preview first:

```bash
python3 "web scrapers/import_wger.py" --dry-run --limit 50
```

Run the real import after `DATABASE_URL` is set:

```bash
python3 "web scrapers/import_wger.py" --limit 50
```

The `--dry-run` flag fetches the wger data and prints a summary without opening a database connection or writing rows.

## Deployment

This project is deployed to Vercel through GitHub Actions instead of Vercel's Git integration.

When anyone with write access pushes to `main`, the workflow in `.github/workflows/deploy.yml` will:

1. Pull the Vercel project settings and production environment.
2. Deploy the repository root with `vercel deploy --prod`.
3. Verify that `https://cs-5200-project.vercel.app/api/hello` returns the expected JSON.

Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set `DATABASE_URL` in the Vercel project environment settings instead. The deploy workflow pulls it from Vercel during deployment.

The repo can stay private. Teammates only need GitHub write access so their pushes can trigger the workflow.
