import os
import datetime
import mysql.connector
from flask import jsonify, current_app
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter.errors import RateLimitExceeded

DB_SCHEMA = "sqlift"
DB_SSL_MODE = "PREFERRED" # MySQL connector uses PREFERRED, REQUIRED, etc.
RATE_LIMIT_DEFAULT = "40 per minute"
RATE_LIMIT_STORAGE = "memory://"


def serialize_row(row):
    if row is None:
        return None
    return {
        k: v.isoformat() if isinstance(v, (datetime.datetime, datetime.date)) else v
        for k, v in row.items()
    }


def tbl(name: str) -> str:
    # Returns a fully-qualified quoted table identifier for the configured schema
    return f'{DB_SCHEMA}.`{name}`'


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
    # Resolves the database URL from env vars
    url = _clean_env_value(
        os.getenv("DATABASE_URL")
        or os.getenv("MYSQL_URL")
    )
    if not url:
        raise RuntimeError(
            "Missing database configuration. Set DATABASE_URL to your MySQL "
            "connection string/URL."
        )
    # MySQL URLs often look like mysql://user:pass@host:port/db
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
    # record_log
    "chk_rl_number": "Record number must be greater than zero.",
}


def mysql_error_hint(exc):
    message = str(exc)
    if "Access denied" in message:
        return (
            "Database authentication failed. Check your username and password in the "
            "environment variables (DATABASE_URL)."
        )
    if "Can't connect to MySQL server" in message:
        return (
            "Could not connect to the MySQL server. Check your host and port in "
            "the DATABASE_URL environment variable."
        )
    if "Unknown database" in message:
        return (
            f"The database '{DB_SCHEMA}' is missing. Ensure the database is created "
            "and matches the name in your connection settings."
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
            conn = None
            try:
                database_url = get_database_url()
                if "://" in database_url:
                    parts = database_url.split("://")[1].split("@")
                    creds = parts[0].split(":")
                    host_port_db = parts[1].split("/")
                    host_port = host_port_db[0].split(":")
                    
                    conn = mysql.connector.connect(
                        user=creds[0],
                        password=creds[1] if len(creds) > 1 else "",
                        host=host_port[0],
                        port=host_port[1] if len(host_port) > 1 else 3306,
                        database=host_port_db[1] if len(host_port_db) > 1 else DB_SCHEMA,
                        ssl_disabled=(DB_SSL_MODE == "DISABLED")
                    )
                else:
                    conn = mysql.connector.connect(user='root', database=DB_SCHEMA)
                try:
                    return decorated_f(conn, *args, **kwargs)
                finally:
                    if conn and conn.is_connected():
                        conn.close()

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
                    hint=mysql_error_hint(exc),
                ), 500
        return wrapper
    return decorator