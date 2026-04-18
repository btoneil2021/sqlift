<div align="center">
  <h1>SQLift (CS-5200 Project)</h1>
</div>

This is a workout and achievement tracking application built with a Flask backend, a React/Vite frontend, and a MySQL database.

## Technical Specifications

- **Frontend**: React 19 (managed via Vite) and React Router for fast, client-side routing.
- **Backend / Host Language**: Python 3.9+, primarily using the **Flask** web framework and **Flask-Cors** for handling cross-origin requests.
- **Database**: MySQL utilizing the `mysql-connector-python` database adapter.
- **Authentication**: `bcrypt` for secure password hashing.
- **Scripts**: Built-in Python scripts for data scraping and API population (e.g., from the Wger API).
- **Environment Management**: `python-dotenv` for backend environment variables, and `concurrently` (via npm) for running both server and client together.

## Prerequisites

To build and run this project on your computer, you must install the following software. Please download and install them from their respective official pages:

1. **Node.js (and npm)**: Required to run the React frontend and root concurrent scripts. (LTS version recommended)
   - Download: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)
2. **Python**: Required to run the Flask backend API and data scraping scripts. (Python 3.9+ recommended)
   - Download: [https://www.python.org/downloads/](https://www.python.org/downloads/)

## Installation and Setup

### 1. Set Up Your MySQL Database

You'll need a MySQL instance running locally or on a cloud provider.

1. Ensure MySQL 8.0+ is installed and running.
2. Create a new database (e.g., `sqlift`).
3. Run the SQL files in order using your preferred MySQL client (e.g., MySQL Workbench, `mysql` CLI):
     1. `sql/create-tables.sql` — creates the schema/database and all tables.
     2. `sql/auth_procs.sql`
     3. `sql/profile_procs.sql`
     4. `sql/workout.sql`
     5. `sql/workout_session.sql`
     5. `sql/achievement_procs.sql`
     6. `sql/leaderboard_procs.sql`
     7. `sql/stats_procs.sql`
     8. `sql/View_workout.sql`
     9. `sql/prevent_friendship.sql`
   - Optionally, seed the database with exercise and equipment data from `sql/database_dump.sql`.

4. Construct your connection string: `mysql://username:password@host:port/database_name`.

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```
# Your MySQL connection string (e.g., mysql://root:password@localhost:3306/sqlift)
DATABASE_URL="mysql://root:[YOUR-PASSWORD]@localhost:3306/sqlift"

# The database password for your MySQL user
DATABASE_PASSWORD="your-mysql-password"

# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY="replace-with-a-long-random-string"
```

*The `DATABASE_PASSWORD` value is substituted into the URL at runtime — it replaces the `[YOUR-PASSWORD]` placeholder.*

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

# Install Flask, mysql-connector-python, bcrypt, and other API requirements
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