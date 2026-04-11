import datetime
from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row

from api.utils import api_route

stats_bp = Blueprint('stats', __name__)


def serialize_goal(goal):
    """Convert datetime.date fields to ISO strings so jsonify doesn't use RFC 7231."""
    if goal and goal.get('target_date') and isinstance(goal['target_date'], datetime.date):
        goal = dict(goal)
        goal['target_date'] = goal['target_date'].isoformat()
    return goal


@stats_bp.route("/api/profile/<int:user_id>/measurements", methods=["POST"])
@api_route(limit="20 per minute")
def log_measurement(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    if not data.get("weight"):
        return jsonify(status="error", message="weight is required."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.log_measurement(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                user_id,
                data.get("weight"),
                data.get("height"),
                data.get("visual_body_fat_percent"),
                data.get("neck_measurement"),
                data.get("shoulder_measurement"),
                data.get("chest_measurement"),
                data.get("bicep_measurement"),
                data.get("forearm_measurement"),
                data.get("waist_measurement"),
                data.get("hips_measurement"),
                data.get("thigh_measurement"),
                data.get("calve_measurement"),
            ),
        )
        row = cur.fetchone()
        conn.commit()

    return jsonify(status="ok", measurement=row), 201


@stats_bp.route("/api/stats/<int:user_id>/goals", methods=["GET"])
@api_route(limit="30 per minute")
def get_goals(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sqlift.get_user_goals(%s)", (user_id,))
        goals = cur.fetchall()

    return jsonify(status="ok", goals=[serialize_goal(g) for g in goals])


@stats_bp.route("/api/stats/<int:user_id>/goals", methods=["POST"])
@api_route(limit="20 per minute")
def add_goal(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    description = (data.get("description") or "").strip()
    if not description:
        return jsonify(status="error", message="description is required."), 400

    target_date = data.get("target_date") or None

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.add_user_goal(%s, %s, %s)",
            (user_id, description, target_date),
        )
        goal = cur.fetchone()
        conn.commit()

    return jsonify(status="ok", goal=serialize_goal(goal)), 201


@stats_bp.route("/api/stats/<int:user_id>/goals/<int:goal_id>", methods=["PUT"])
@api_route(limit="20 per minute")
def update_goal(conn, user_id, goal_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    allowed_statuses = {"in_progress", "completed"}
    new_status = data.get("completion_status")
    if new_status not in allowed_statuses:
        return jsonify(status="error", message="Invalid completion_status."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.update_goal_status(%s, %s, %s)",
            (user_id, goal_id, new_status),
        )
        goal = cur.fetchone()
        conn.commit()

    if goal is None:
        return jsonify(status="error", message="Goal not found."), 404

    return jsonify(status="ok", goal=serialize_goal(goal))


@stats_bp.route("/api/stats/<int:user_id>/goals/<int:goal_id>", methods=["DELETE"])
@api_route(limit="20 per minute")
def delete_goal(conn, user_id, goal_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT sqlift.delete_user_goal(%s, %s)", (user_id, goal_id))
        row = cur.fetchone()
        conn.commit()

    deleted = row and list(row.values())[0]
    if not deleted:
        return jsonify(status="error", message="Goal not found."), 404

    return jsonify(status="ok", message="Goal deleted.")
