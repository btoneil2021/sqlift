# cs-5200-project

## Supabase

This project talks to Supabase through the Flask backend, not directly from the browser.

Set these environment variables locally and in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY`

The backend exposes a database-backed health route at `/api/supabase/health`. It queries the `sqlift` schema and returns a few sample rows from the `user` table so you can confirm the connection is working.

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

Set the Supabase variables in the Vercel project environment settings instead. The deploy workflow pulls them from Vercel during deployment.

The repo can stay private. Teammates only need GitHub write access so their pushes can trigger the workflow.
