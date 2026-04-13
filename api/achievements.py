import datetime
from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row

from api.utils import api_route

achievements_bp = Blueprint('achievements', __name__)


@achievements_bp.route("/api/profile/<int:user_id>/achievements", methods=["GET"])
@api_route(limit="30 per minute")
def get_achievements(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    tz = request.args.get("tz", "UTC")

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.evaluate_and_get_achievements(%s, %s)",
            (user_id, tz)
        )
        rows = cur.fetchall()
    conn.commit()   # required — the SQL function performs INSERTs to award achievements

    achievements = [
        {
            "achievement_id": int(r["achievement_id"]),
            "name": r["name"],
            "description": r["description"],
            "achievement_img_url": r.get("achievement_img_url"),
            "date_earned": r["date_earned"].isoformat() if isinstance(r["date_earned"], datetime.date) else r["date_earned"],
        }
        for r in rows
    ]
    return jsonify(status="ok", achievements=achievements)
