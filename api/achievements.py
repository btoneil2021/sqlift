import datetime
from flask import Blueprint, jsonify, request, session

from api.utils import api_route

achievements_bp = Blueprint('achievements', __name__)


@achievements_bp.route("/api/profile/<int:user_id>/achievements", methods=["GET"])
@api_route(limit="30 per minute")
def get_achievements(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL evaluate_and_get_achievements(%s)", (user_id,))
        rows = cur.fetchall()
    conn.commit()  # required — the procedure performs INSERTs to award achievements

    achievements = [
        {
            "achievement_id":     int(r["achievement_id"]),
            "name":               r["name"],
            "description":        r["description"],
            "achievement_img_url": r.get("achievement_img_url"),
            "date_earned": r["date_earned"].isoformat() if isinstance(r["date_earned"], datetime.date) else r["date_earned"],
        }
        for r in rows
    ]
    return jsonify(status="ok", achievements=achievements)
