# cs-5200-project

## Supabase

This project talks to the Supabase Postgres database through the Flask backend, not directly from the browser.

Set these environment variables locally and in Vercel:

- `DATABASE_URL`

Use the direct Postgres connection string from Supabase, for example:

`postgresql://postgres:[YOUR-PASSWORD]@db.llogioyvqexdoyvqqtti.supabase.co:5432/postgres`

Replace `[YOUR-PASSWORD]` with the actual database password.

## Wger Import

The scraper and import scripts live in the `web-scrapers/` folder.

Run a preview first (no database connection opened):

```bash
python3 web-scrapers/import_wger.py --dry-run --limit 50
```

Run the real import after `DATABASE_URL` is set:

```bash
python3 web-scrapers/import_wger.py --limit 50
```

Available flags:

| Flag | Description |
|------|-------------|
| `--dry-run` | Fetch data and print a summary without writing to the database |
| `--limit N` | Limit the number of exercises fetched from the wger API |
| `--max-pages N` | Limit the number of pages fetched from each wger endpoint |
| `--database-url URL` | Override `DATABASE_URL` for a one-off import run |

## Deployment

This project is deployed to Vercel through GitHub Actions instead of Vercel's Git integration.

When anyone with write access pushes to `main`, the workflow in `.github/workflows/deploy.yml` will:

1. Pull the Vercel project settings and production environment.
2. Deploy the repository root with `vercel deploy --prod`.
3. Run a smoke test against the live backend at `https://cs-5200-project.vercel.app`.

Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set `DATABASE_URL` in the Vercel project environment settings instead. The deploy workflow pulls it from Vercel during deployment.

The repo can stay private. Teammates only need GitHub write access so their pushes can trigger the workflow
