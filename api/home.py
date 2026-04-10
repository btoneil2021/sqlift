from flask import Blueprint, jsonify
from api.utils import api_route, fetch_sample_users

home_bp = Blueprint('home', __name__)

@home_bp.route("/api/supabase/health")
@api_route(limit="20 per minute")
def supabase_health(conn):
    users = fetch_sample_users(conn)
    return jsonify(
        status="ok",
        connected=True,
        schema="sqlift",
        table="user",
        sample_users=users,
        user_count=len(users),
    )
