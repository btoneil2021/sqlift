# Supabase Flask Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the existing Flask backend to Supabase so the API can read from the `sqlift` schema through server-side requests.

**Architecture:** Keep the browser talking only to Flask. Flask will create a Supabase Python client from environment variables, query the `sqlift` schema on demand, and return a small JSON response that proves the database connection works. This keeps Supabase credentials out of client code and avoids changing the deployment model.

**Tech Stack:** Flask, `supabase-py`, pytest, Vercel environment variables.

---

### Task 1: Add a Supabase-backed API route

**Files:**
- Modify: `api/app.py`
- Modify: `api/index.py`

**Step 1: Add the failing behavior target**

Define a route that reaches Supabase and returns a JSON payload with a sample record count or sample rows from `sqlift."user"`.

**Step 2: Implement the minimal Supabase client helper**

Read `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY` from the environment, create a client with `create_client`, and query the `sqlift` schema.

**Step 3: Keep the Vercel entrypoint wired to the Flask app**

Make `api/index.py` import and expose the Flask app from `api/app.py` so the deployed function uses the Supabase-enabled routes.

**Step 4: Verify the route manually**

Run the Flask app or hit the Vercel route locally and confirm the new endpoint returns JSON instead of a hardcoded message.

### Task 2: Add regression coverage

**Files:**
- Create: `tests/test_supabase_integration.py`

**Step 1: Write a failing test**

Assert that the Supabase client helper uses environment variables and that the new route returns a Supabase-shaped JSON response.

**Step 2: Run the test and verify it fails before implementation**

Run: `python3 -m pytest -q tests/test_supabase_integration.py`

**Step 3: Make the test pass**

Use monkeypatching to stub the Supabase client and avoid network access.

### Task 3: Document setup

**Files:**
- Modify: `README.md`
- Modify: `requirements.txt`

**Step 1: Document the environment variables**

Explain which Supabase env vars are required locally and in Vercel.

**Step 2: Add any missing runtime dependency**

Ensure the Python dependency list includes the client package needed by the backend code.

**Step 3: Verify the documentation**

Run: `sed -n '1,260p' README.md`

Expected: the README tells a teammate how to configure Supabase and what endpoint proves the wiring works.
