import os

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row


app = Flask(__name__)
CORS(app)


def _get_database_url():
    url = _clean_env_value(
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
        or os.getenv("POSTGRES_URL")
    )

    if not url:
        raise RuntimeError(
            "Missing database configuration. Set DATABASE_URL to the Supabase "
            "direct connection string."
        )

    if "[YOUR-PASSWORD]" in url:
        raise RuntimeError(
            "DATABASE_URL still contains [YOUR-PASSWORD]. Replace it with the "
            "real Supabase postgres password."
        )

    return url


def _clean_env_value(value):
    if value is None:
        return None

    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def get_database_url():
    return _get_database_url()


def fetch_sample_users(limit=3):
    database_url = get_database_url()

    with psycopg.connect(database_url, sslmode="require") as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                'SELECT user_id, username, email FROM sqlift."user" '
                "ORDER BY user_id LIMIT %s",
                (limit,),
            )
            return cur.fetchall()


def postgres_error_hint(exc):
    message = str(exc)
    if "password authentication failed" in message.lower():
        return (
            "Double-check the Supabase postgres password in DATABASE_URL and "
            "make sure it is the direct database connection string."
        )
    if "relation" in message.lower() and '"user"' in message:
        return (
            "The sqlift schema or user table is missing. Re-run the SQL setup "
            "and confirm the table names match the schema."
        )
    return None


@app.route("/")
def home():
    return "Backend is running!"


@app.route("/hello")
@app.route("/api/hello")
def hello():
    return jsonify(message="Hello from Flask on Vercel!")


@app.route("/api/supabase/health")
def supabase_health():
    try:
        users = fetch_sample_users()
    except Exception as exc:
        app.logger.exception("Database health check failed")
        return jsonify(
            status="error",
            connected=False,
            message="Could not reach the database.",
            error=str(exc),
            hint=postgres_error_hint(exc),
        ), 500

    return jsonify(
        status="ok",
        connected=True,
        schema="sqlift",
        table="user",
        sample_users=users,
        user_count=len(users),
    )


@app.errorhandler(404)
def page_not_found(e):
    return jsonify(
        error="Not Found",
        path=request.path,
        full_url=request.url,
        message="The requested URL was not found on the server. If this is a backend request, check the route prefix.",
    ), 404
