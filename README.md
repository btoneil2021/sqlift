# cs-5200-project

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

The repo can stay private. Teammates only need GitHub write access so their pushes can trigger the workflow.
