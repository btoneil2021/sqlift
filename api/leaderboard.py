from flask import Blueprint, jsonify, session
from api.utils import api_route, DB_SCHEMA

leaderboard_bp = Blueprint('leaderboard', __name__)


def _require_user():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify(status="error", message="Not authenticated."), 401)
    return user_id, None


@leaderboard_bp.route("/api/leaderboard")
@api_route()
def get_leaderboard(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_get_leaderboard(%s::bigint) AS leaderboard",
            (user_id,)
        )
        row = cur.fetchone()
    return jsonify(status="ok", leaderboard=row[0] if row else [])


@leaderboard_bp.route("/api/leaderboard/global")
@api_route()
def get_global_leaderboard(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_get_global_leaderboard(%s::bigint) AS leaderboard",
            (user_id,)
        )
        row = cur.fetchone()
    return jsonify(status="ok", leaderboard=row[0] if row else [])
