import os
import psycopg
from flask import jsonify, current_app
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

DB_SCHEMA = "sqlift"
DB_SSL_MODE = "require"
RATE_LIMIT_DEFAULT = "40 per minute"
RATE_LIMIT_STORAGE = "memory://"


def tbl(name: str) -> str:
    # Returns a fully-qualified quoted table identifier for the configured schema
    return f'{DB_SCHEMA}."{name}"'


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[RATE_LIMIT_DEFAULT],
    storage_uri=RATE_LIMIT_STORAGE,
)

def _clean_env_value(value):
    # Strips whitespace and surrounding quotes from an env var value
    if value is None:
        return None
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value

def _get_database_url():
    # Resolves the database URL from env vars, substituting password placeholder if needed
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
    # Public wrapper to retrieve the resolved database URL
    return _get_database_url()

_CONSTRAINT_MESSAGES = {
    # workout_exercise
    "chk_we_sort_order":    "Exercise order must be greater than zero.",
    "chk_we_target_sets":   "Number of target sets must be greater than zero.",
    "chk_we_target_reps":   "Number of target reps must be greater than zero.",
    "chk_we_target_weight": "Target weight cannot be negative.",
    # set_log
    "chk_sl_number": "Set number must be greater than zero.",
    "chk_sl_weight": "Weight cannot be negative.",
    "chk_sl_reps":   "Number of reps must be greater than zero.",
    "chk_sl_rpe":    "RPE must be between 0 and 10.",
    # record_log
    "chk_rl_number": "Record number must be greater than zero.",
    # workout_session
    "chk_ws_difficulty_rating":   "Difficulty rating must be between 0 and 10.",
    "chk_ws_enjoyment_rating":    "Enjoyment rating must be between 0 and 10.",
    "chk_ws_energy_level_rating": "Energy level rating must be between 0 and 10.",
}


def db_error_message(exc):
    """Return a user-friendly error message from a psycopg exception.
    Looks up named CHECK constraint violations in a human-readable mapping;
    falls back to message_primary for RAISE EXCEPTION and other errors.
    Never exposes message_detail to avoid leaking internal row data."""
    diag = getattr(exc, 'diag', None)
    if diag is None:
        return str(exc).split('\n')[0]
    constraint = getattr(diag, 'constraint_name', None)
    if constraint and constraint in _CONSTRAINT_MESSAGES:
        return _CONSTRAINT_MESSAGES[constraint]
    return getattr(diag, 'message_primary', None) or str(exc).split('\n')[0]


def postgres_error_hint(exc):
    # Maps common Postgres connection exceptions to user-friendly hint messages
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
            f'The {DB_SCHEMA} schema or user table is missing. Re-run the SQL setup '
            "and confirm the table names match the schema."
        )
    return "An error occurred while connecting to the database."

def api_route(limit=None):
    # Decorator that opens a DB connection and applies an optional rate limit to a route
    def decorator(f):
        decorated_f = f
        if limit:
            decorated_f = limiter.limit(limit)(f)

        @wraps(decorated_f)
        def wrapper(*args, **kwargs):
            try:
                database_url = get_database_url()
                with psycopg.connect(database_url, sslmode=DB_SSL_MODE) as conn:
                    conn.execute(f"SET search_path TO {DB_SCHEMA}")
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