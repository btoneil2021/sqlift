import os
import psycopg
from psycopg.rows import dict_row
from flask import jsonify, current_app
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["40 per minute"],
    storage_uri="memory://",
)

def _clean_env_value(value):
    if value is None:
        return None
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value

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
        password = _clean_env_value(os.getenv("DATABASE_PASSWORD"))
        if not password:
            raise RuntimeError(
                "DATABASE_URL contains [YOUR-PASSWORD] placeholder, but "
                "DATABASE_PASSWORD environment variable is not set."
            )
        url = url.replace("[YOUR-PASSWORD]", password)
    return url

def get_database_url():
    return _get_database_url()

def fetch_sample_users(conn, limit=3):
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
            "Database authentication failed. Check your password in the "
            "environment variables (DATABASE_URL or DATABASE_PASSWORD)."
        )
    if "getaddrinfo failed" in message.lower() or "resolve host" in message.lower():
        return (
            "Could not resolve the database host. This means your .env file is "
            "still using the placeholder database URL instead of your real one. "
            "Please update your .env file with your actual Supabase credentials."
        )
    if "relation" in message.lower() and '"user"' in message:
        return (
            "The sqlift schema or user table is missing. Re-run the SQL setup "
            "and confirm the table names match the schema."
        )
    return "An error occurred while connecting to the database."

def api_route(limit=None):
    def decorator(f):
        decorated_f = f
        if limit:
            decorated_f = limiter.limit(limit)(f)

        @wraps(decorated_f)
        def wrapper(*args, **kwargs):
            try:
                database_url = get_database_url()
                with psycopg.connect(database_url, sslmode="require") as conn:
                    return decorated_f(conn, *args, **kwargs)
            except RateLimitExceeded as exc:
                return jsonify(
                    status="error",
                    message="Rate limit exceeded",
                    error=str(exc.description) if exc.description else "Too Many Requests"
                ), 429
            except Exception as exc:
                current_app.logger.exception("API Route Error")
                return jsonify(
                    status="error",
                    connected=False,
                    message="An error occurred during the request.",
                    error="Internal Server Error",
                    hint=postgres_error_hint(exc),
                ), 500
        return wrapper
    return decorator
