from functools import lru_cache
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client


app = Flask(__name__)
CORS(app)


def _get_supabase_credentials():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase configuration. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)."
        )

    return url, key


@lru_cache(maxsize=1)
def get_supabase_client():
    url, key = _get_supabase_credentials()
    return create_client(url, key)


def fetch_sample_users(limit=3):
    response = (
        get_supabase_client()
        .schema("sqlift")
        .from_("user")
        .select("user_id, username, email")
        .limit(limit)
        .execute()
    )
    return response.data


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
        app.logger.exception("Supabase health check failed")
        return jsonify(
            status="error",
            connected=False,
            message="Could not reach Supabase.",
            error=str(exc),
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
