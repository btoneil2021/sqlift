# Supabase availability and keepalive

The primary keepalive is a daily Vercel Cron at `17 3 * * *` UTC, calling
`/api/supabase/keepalive` on the production deployment. It is configured in
`vercel.json` and only becomes active after an approved production deployment.
The route opens the application's configured PostgreSQL connection, executes
`SELECT 1`, and returns an uncached health response. It writes no application data.

GitHub Actions is a secondary hourly check at minute 23, with a manual Run workflow
option. It requires HTTP 200 (redirects are rejected) and JSON containing `status: "ok"`,
`connected: true`, and integer `result: 1`. It retries three times, limits each
request to 30 seconds, and caps the job at five minutes. It prints neither response
bodies nor credentials. The PR test workflow uses mocks and needs no database secrets.

## Why a second scheduler is necessary

[GitHub disables scheduled workflows in public repositories after 60 days without
repository activity](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
Scheduled jobs may also be delayed or dropped during high load. Adding retries,
more schedules, or a second workflow in the same repository cannot repair a
scheduler that has been disabled. Do not create artificial commits to keep it enabled.

[Supabase assesses low database activity over seven days](https://supabase.com/docs/guides/platform/free-project-pausing).
Keepalive traffic is best effort: daily Vercel Cron removes the GitHub inactivity
dependency, but it does not guarantee sufficient activity under Supabase's policy.
The current documentation gives paused projects a **one-year restore window**;
that recovery limit is distinct from the inactivity period. Follow the deadline
shown for the actual project in the dashboard if it differs.

[Vercel Cron is available on all plans](https://vercel.com/docs/cron-jobs), uses the
existing hosting account, and does not depend on repository commits. The daily
schedule fits [Hobby's once-per-day restriction](https://vercel.com/docs/cron-jobs/usage-and-pricing).
Hobby execution can occur within the scheduled hour; function usage limits still
apply. Vercel's scheduler calls the route directly, so GitHub's retry logic does
not apply to Vercel calls. [Vercel does not retry failed cron invocations and may
miss a delivery without producing a runtime log](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-error-handling).
A single daily database probe is not a guaranteed activity threshold. Neither
scheduler can resume an already-paused database.

For guaranteed exemption from inactivity pausing, Supabase recommends a paid plan.
That requires a separate billing decision; this change does not upgrade anything.
An independent uptime monitor with failure/missed-run alerts is another option,
but requires approval before configuring a new service or account. Failed Actions
notifications alone cannot detect a disabled schedule.

## Security and cost boundaries

The route was already public and remains a read-only `SELECT 1` check. This change
adds no authentication grants or database credentials. Its existing in-memory,
per-IP limiter is not a global abuse or spending cap, and the shared route wrapper
opens a database connection before checking that limiter. The server-side database
connection has no explicit timeout; the client timeout bounds the Actions check,
not the running Vercel function. Function duration and usage limits still apply.
These are existing limitations, not guarantees supplied by this keepalive change.

The daily cron adds roughly 30 function invocations per month (delivery can be
duplicated); the hourly backup keeps its existing cadence. Charges or quota usage
depend on the existing hosting plan. No plan upgrade is configured. Protecting
the route with a new cron secret or adding an external missed-run monitor would
require separately approved setup, and must preserve both schedulers' access.

## Verify the database before restoring or deploying

First inspect any **existing** Vercel Storage/Integration resource association:
its Open in Supabase link may identify the Supabase project without revealing
credentials. Do not install a new integration just to discover this. Association
alone is insufficient if a manually configured database URL overrides the
integration. Environment-variable names and provenance can be checked without
revealing values: the application prefers `DATABASE_URL`, then
`SUPABASE_DATABASE_URL`, then `POSTGRES_URL`. If the effective variable's project
cannot be resolved from non-secret metadata, leave the runtime mapping unverified.

The repository uses environment-based database configuration and intentionally
contains no real database URL. A successful health response does **not** identify
the Supabase project. In the existing Vercel project's production settings, verify
only the project reference in the effective `DATABASE_URL` (or fallback
`SUPABASE_DATABASE_URL` / `POSTGRES_URL`) against the intended Supabase dashboard
project. Do not copy connection strings, passwords, or tokens into logs, issues,
or pull requests. Check both the direct hostname and, for a pooler URL, the
`postgres.<project-ref>` username. A custom DB role or hostname may require checking
the Supabase connection settings privately.

## Recovery and rollout

1. Sign in to Supabase securely, verify the account, organization, and project,
   then choose **Resume project** for the paused project. This is separate from
   restoring an older database backup, which could lose newer data.
2. Confirm the production database mapping above. Check the live route with:
   `KEEPALIVE_URL=https://cs-5200-project.vercel.app/api/supabase/keepalive python3 scripts/check_supabase.py`.
3. In GitHub Actions, open **Supabase Keepalive**. If disabled, select **Enable
   workflow**, then **Run workflow** on `main`. Verify the run actually finishes
   successfully. Re-enabling alone does not make the new draft code active.
4. Review and approve the PR before merging. **Merging to main triggers the
   existing Vercel production deployment workflow.** No production deployment is
   needed to run the mock tests.
5. After the approved deployment succeeds, open the existing Vercel project's
   **Settings → Cron Jobs**, confirm this path and schedule are enabled, and use
   its manual run control. Check the function logs for a fresh HTTP 200 and the
   successful database query response. Confirm an actual scheduled invocation
   within the next daily window; a manual request does not prove scheduling works.
6. Check GitHub's next scheduled run too. Keep failure notifications enabled for
   the responsible operator, and review Supabase inactivity-warning emails. If
   pausing still occurs, decide on Supabase Pro or an approved independent monitor
   rather than assuming more retries fix missing executions.

To roll back the Vercel schedule, remove `crons` from `vercel.json` and deploy only
after approval, or disable the cron in Vercel. This leaves the database unchanged.

## Local validation

Install `requirements.txt` in a virtual environment, then run:

```sh
python -m unittest discover -s tests -v
```

The tests cover the real Flask route with a mocked database, failure HTTP statuses,
cache prevention, strict response validation, retry recovery, timeout exhaustion,
and the daily cron's route configuration. They do not verify production access,
Supabase project identity, or either scheduler's current enabled state.
