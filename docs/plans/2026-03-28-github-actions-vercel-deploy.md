# GitHub Actions Vercel Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let any teammate push to `main` and have GitHub Actions deploy the private Vercel project to production automatically.

**Architecture:** Keep Vercel Git integration out of the critical path. GitHub Actions will own the deploy trigger, use a Vercel token stored as a GitHub secret, and deploy from the repository root so the Python API route and static frontend are both included. After deployment, the workflow will curl the live production URL to confirm the backend route still responds.

**Tech Stack:** GitHub Actions, Vercel CLI, Python, shell scripting, pytest.

---

### Task 1: Harden the deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Step 1: Add the minimal GitHub Actions deploy path**

Ensure the workflow:
- triggers on `push` to `main`
- installs the Vercel CLI
- pulls project settings and production env vars
- deploys with `vercel deploy --prod`
- uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`

**Step 2: Add a live production smoke test**

Add a post-deploy step that curls `https://cs-5200-project.vercel.app/api/hello` and fails if the JSON payload does not include the expected message.

**Step 3: Run a syntax check**

Run: `python3 - <<'PY'\nfrom pathlib import Path\nprint(Path('.github/workflows/deploy.yml').read_text())\nPY`

Expected: the workflow file prints cleanly and includes the deploy + smoke test steps.

### Task 2: Document the required secrets

**Files:**
- Modify: `README.md`

**Step 1: Add a short deployment note**

Document the required GitHub secrets and explain that teammates only need repo write access; Vercel deploys happen from Actions.

**Step 2: Verify the doc is accurate**

Run: `sed -n '1,260p' README.md`

Expected: the deployment section clearly lists the required secrets and the push-to-main behavior.

### Task 3: Add workflow regression coverage

**Files:**
- Create: `tests/test_github_actions_deploy.py`

**Step 1: Write a failing workflow regression test**

Assert that the workflow uses push-to-main triggers, deploys with `vercel deploy --prod`, and includes a live route smoke test.

**Step 2: Run the new test**

Run: `python3 -m pytest -q tests/test_github_actions_deploy.py --capture=no`

Expected: pass once the workflow is updated.

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml README.md tests/test_github_actions_deploy.py docs/plans/2026-03-28-github-actions-vercel-deploy.md
git commit -m "ci: deploy Vercel from GitHub Actions"
```
