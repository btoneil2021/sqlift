# SQLift (CS-5200 Project)

- **Live App:** [https://cs-5200-project.vercel.app](https://cs-5200-project.vercel.app)
- **GitHub Repository:** [https://github.com/btoneil2021/cs-5200-project](https://github.com/btoneil2021/cs-5200-project)

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
git clone <repository_url>
cd cs-5200-project
```

### 2. Environment Variables
The application requires a PostgreSQL database (hosted on Supabase) and a secret key for session management. 
Create a `.env` file in the root directory (you can copy `.env.example` if it exists) and add the following configuration:

```
# Use the connection string from Supabase > Connect > Direct > Transaction Pooler
DATABASE_URL="postgresql://postgres.llogioyvqexdoyvqqtti:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
DATABASE_PASSWORD="your-real-password-here"
SECRET_KEY="replace-with-a-long-random-string"
```
*Note: This project talks to the Supabase Postgres database through the Flask backend, not directly from the browser. The `DATABASE_PASSWORD` acts as a replacement for the `[YOUR-PASSWORD]` placeholder in the URL.*

### 3. Install Dependencies

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
