from flask import Blueprint, jsonify, session
from api.utils import api_route

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
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_leaderboard(%s)", (user_id,))
        rows = cur.fetchall()
    leaderboard = [
        {
            "user_id":      int(r["user_id"]),
            "username":     r["username"],
            "total_volume": float(r["total_volume"]),
            "max_weight":   float(r["max_weight"]),
            "sessions_done": int(r["sessions_done"]),
            "rank":         int(r["rank"]),
            "is_me":        bool(r["is_me"]),
        }
        for r in rows
    ]
    return jsonify(status="ok", leaderboard=leaderboard)


@leaderboard_bp.route("/api/leaderboard/global")
@api_route()
def get_global_leaderboard(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_global_leaderboard(%s)", (user_id,))
        rows = cur.fetchall()
    leaderboard = [
        {
            "user_id":      int(r["user_id"]),
            "username":     r["username"],
            "total_volume": float(r["total_volume"]),
            "max_weight":   float(r["max_weight"]),
            "sessions_done": int(r["sessions_done"]),
            "rank":         int(r["rank"]),
            "is_me":        bool(r["is_me"]),
        }
        for r in rows
    ]
    return jsonify(status="ok", leaderboard=leaderboard)
