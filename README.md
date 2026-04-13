<div align="center">
  <h1>SQLift (CS-5200 Project)</h1>

  <p align="center">
    <a href="https://cs-5200-project.vercel.app"><img src="https://img.shields.io/badge/status-Live_Demo-success?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
    <a href="https://github.com/btoneil2021/cs-5200-project"><img src="https://img.shields.io/github/repo-size/btoneil2021/cs-5200-project?style=for-the-badge" alt="GitHub repo size"></a>
    <a href="https://github.com/btoneil2021/cs-5200-project/commits/main"><img src="https://img.shields.io/github/last-commit/btoneil2021/cs-5200-project?style=for-the-badge&color=2ea043" alt="Last Commit"></a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </p>

  <h4>
    <a href="https://cs-5200-project.vercel.app">View Live App</a>
    <span> · </span>
    <a href="https://github.com/btoneil2021/cs-5200-project">View Repository</a>
  </h4>
</div>

This is a workout and achievement tracking application built with a Flask backend, a React/Vite frontend, and a PostgreSQL (Supabase) database.

## Technical Specifications

- **Frontend**: React 19 (managed via Vite) and React Router for fast, client-side routing.
- **Backend / Host Language**: Python 3.9+, primarily using the **Flask** web framework and **Flask-Cors** for handling cross-origin requests.
- **Database**: PostgreSQL (hosted on Supabase) utilizing the `psycopg` database adapter.
- **Authentication**: `bcrypt` for secure password hashing.
- **Scripts**: Built-in Python scripts for data scraping and API population (e.g., from the Wger API).
- **Environment Management**: `python-dotenv` for backend environment variables, and `concurrently` (via npm) for running both server and client together.

## Prerequisites

To build and run this project on your computer, you must install the following software. Please download and install them from their respective official pages:

1. **Git**: Required to clone the repository.
   - Download: [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. **Node.js (and npm)**: Required to run the React frontend and root concurrent scripts. (LTS version recommended)
   - Download: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
3. **Python**: Required to run the Flask backend API and data scraping scripts. (Python 3.9+ recommended)
   - Download: [https://www.python.org/downloads/](https://www.python.org/downloads/)

## Installation and Setup

### 1. Expected Installation Directory
You can place this project anywhere on your computer (e.g., your `Documents` or `Projects` folder).

Open your terminal or command prompt (such as PowerShell or Git Bash) and clone the repository:
```bash
git clone https://github.com/btoneil2021/cs-5200-project
cd cs-5200-project
```

### 2. Set Up Your Supabase Database

You'll need your own free Supabase project. The app does not share a database, so each person running this locally needs their own.

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, give it a name, set a strong database password, and choose a region.
3. Once the project is ready, run the SQL files in order using the **SQL Editor** in the Supabase dashboard:
     1. `sql/create-tables.sql` — creates the schema, ENUMs, and all tables
     2. `sql/auth_procs.sql`
     3. `sql/profile_procs.sql`
     4. `sql/workout.sql`
     5. `sql/achievement_procs.sql`
     6. `sql/leaderboard_procs.sql`
     7. `sql/stats_procs.sql`
     8. `sql/View_workout.sql`
   - Optionally, run `sql/database_dump.sql` **after** the above steps to seed the database with exercise and equipment data. The dump is inserts only — it requires the schema to already exist.

4. Get your connection string: **Project Settings > Database > Connection string > Transaction pooler (port 6543)**.

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```
# Your Supabase transaction pooler connection string (port 6543)
DATABASE_URL="postgresql://postgres.<your-project-ref>:[YOUR-PASSWORD]@<region>.pooler.supabase.com:6543/postgres"

# The database password you set when creating the Supabase project
DATABASE_PASSWORD="your-supabase-db-password"

# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY="replace-with-a-long-random-string"
```

*The `DATABASE_PASSWORD` value is substituted into the URL at runtime — it replaces the `[YOUR-PASSWORD]` placeholder.*

### 4. Install Dependencies

You will need to install dependencies for the root workspace, the frontend, and the backend.

**Root and Frontend Dependencies (Node.js):**
```bash
# Install root dependencies (concurrently)
npm install

# Install frontend dependencies (React, Vite, React Router, etc.)
cd frontend
npm install
cd ..
```

**Backend Dependencies (Python):**
```bash
# It is highly recommended to use a virtual environment
python -m venv venv

# Activate the virtual environment:
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install Flask, psycopg, bcrypt, and other API requirements
pip install -r requirements.txt
```

## Running the Application

You can start both the backend and the frontend simultaneously from the root directory using the `concurrently` package provided in the `package.json`.

Make sure your Python virtual environment is activated, then run:

```bash
npm run dev
```

This will automatically run:
- The React Vite frontend (typically at `http://localhost:5173`)
- The Python Flask backend (`python api/app.py`)


## Wger Data Import

The scraper and import scripts live in the `web-scrapers/` folder, which populates the database with default exercise data.

Run a preview first (no database connection opened):

```bash
python web-scrapers/import_wger.py --dry-run --limit 50
```

Run the real import after `DATABASE_URL` is set:

```bash
python web-scrapers/import_wger.py --limit 50
```

### Available flags:

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

### Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set `DATABASE_URL` in the Vercel project environment settings instead. The deploy workflow pulls it from Vercel during deployment.

The repo can stay private. Teammates only need GitHub write access so their pushes can trigger the workflow
