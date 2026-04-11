import datetime
from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row

from api.utils import api_route

stats_bp = Blueprint('stats', __name__)


def serialize_goal(goal):
    # Converts target_date to ISO string for JSON serialization
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

    fields = {
        "p_weight":              data.get("weight"),
        "p_height":              data.get("height"),
        "p_visual_body_fat_pct": data.get("visual_body_fat_percent"),
        "p_neck":                data.get("neck_measurement"),
        "p_shoulder":            data.get("shoulder_measurement"),
        "p_chest":               data.get("chest_measurement"),
        "p_bicep":               data.get("bicep_measurement"),
        "p_forearm":             data.get("forearm_measurement"),
        "p_waist":               data.get("waist_measurement"),
        "p_hips":                data.get("hips_measurement"),
        "p_thigh":               data.get("thigh_measurement"),
        "p_calve":               data.get("calve_measurement"),
    }
    provided = {k: v for k, v in fields.items() if v is not None}
    named_sql = ", ".join(f"{k} => %({k})s" for k in provided)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"SELECT * FROM sqlift.log_measurement(p_user_id => %(p_user_id)s, {named_sql})",
            {"p_user_id": user_id, **provided},
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
        cur.execute(
            "SELECT * FROM sqlift.get_user_goals(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
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
            """SELECT * FROM sqlift.add_user_goal(
                p_user_id     => %(p_user_id)s,
                p_description => %(p_description)s,
                p_target_date => %(p_target_date)s
            )""",
            {"p_user_id": user_id, "p_description": description, "p_target_date": target_date},
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
            """SELECT * FROM sqlift.update_goal_status(
                p_user_id           => %(p_user_id)s,
                p_goal_id           => %(p_goal_id)s,
                p_completion_status => %(p_completion_status)s
            )""",
            {"p_user_id": user_id, "p_goal_id": goal_id, "p_completion_status": new_status},
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
        cur.execute(
            "SELECT sqlift.delete_user_goal(p_user_id => %(p_user_id)s, p_goal_id => %(p_goal_id)s)",
            {"p_user_id": user_id, "p_goal_id": goal_id},
        )
        row = cur.fetchone()
        conn.commit()

    deleted = row and list(row.values())[0]
    if not deleted:
        return jsonify(status="error", message="Goal not found."), 404

    return jsonify(status="ok", message="Goal deleted.")


@stats_bp.route("/api/stats/<int:user_id>/exercise-progression", methods=["GET"])
@api_route(limit="30 per minute")
def get_exercise_progression(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.get_user_exercise_progression(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        rows = cur.fetchall()

    exercises = {}
    for r in rows:
        eid = int(r["exercise_id"])
        if eid not in exercises:
            exercises[eid] = {
                "exercise_id": eid,
                "exercise_name": r["exercise_name"],
                "history": [],
            }
        exercises[eid]["history"].append({
            "date": r["session_date"].isoformat() if r["session_date"] else None,
            "max_weight_kg": float(r["max_weight_kg"]) if r["max_weight_kg"] is not None else None,
        })

    return jsonify(status="ok", exercises=list(exercises.values()))


@stats_bp.route("/api/stats/<int:user_id>/hero-stats", methods=["GET"])
@api_route(limit="30 per minute")
def get_hero_stats(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.get_user_hero_stats(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        hero = cur.fetchone()

        cur.execute(
            "SELECT * FROM sqlift.get_user_exercise_prs(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        prs = cur.fetchall()

    if not hero:
        return jsonify(status="ok", stats=None)

    top_pr = None
    if hero.get("pr_exercise_id"):
        top_pr = {
            "exercise_name": hero["pr_exercise_name"],
            "weight_kg": float(hero["pr_weight_kg"]) if hero["pr_weight_kg"] is not None else None,
            "reps": int(hero["pr_reps"]) if hero["pr_reps"] is not None else None,
        }

    stats = {
        "total_sessions": int(hero["total_sessions"] or 0),
        "total_volume_kg": float(hero["total_volume_kg"] or 0),
        "max_session_volume_kg": float(hero["max_session_volume_kg"] or 0),
        "heaviest_set_kg": float(hero["heaviest_set_kg"] or 0),
        "max_reps_in_set": int(hero["max_reps_in_set"] or 0),
        "avg_session_minutes": int(hero["avg_session_minutes"] or 0),
        "top_exercise_by_volume": hero.get("top_exercise_by_volume"),
        "top_pr": top_pr,
        "exercise_prs": [
            {
                "exercise_id": int(r["exercise_id"]),
                "exercise_name": r["exercise_name"],
                "max_weight_kg": float(r["max_weight_kg"]) if r["max_weight_kg"] is not None else None,
                "reps_at_max": int(r["reps_at_max"]) if r["reps_at_max"] is not None else None,
                "pr_date": r["pr_date"].isoformat() if r["pr_date"] else None,
            }
            for r in prs
        ],
    }

    return jsonify(status="ok", stats=stats)


def _serialize_session(s):
    # Converts session datetime fields to ISO strings for JSON serialization
    s = dict(s)
    if s.get("start_date_time"):
        s["start_date_time"] = s["start_date_time"].isoformat()
    if s.get("end_date_time"):
        s["end_date_time"] = s["end_date_time"].isoformat()
    return s


@stats_bp.route("/api/stats/<int:user_id>/workout-history", methods=["GET"])
@api_route(limit="30 per minute")
def get_workout_history(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.get_user_workout_history(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        sessions = [_serialize_session(s) for s in cur.fetchall()]

        cur.execute(
            "SELECT * FROM sqlift.get_user_daily_streaks(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        streaks = cur.fetchone()

        cur.execute(
            "SELECT * FROM sqlift.get_user_weekly_streaks(p_user_id => %(p_user_id)s)",
            {"p_user_id": user_id},
        )
        per_workout_streaks = cur.fetchall()

    return jsonify(
        status="ok",
        sessions=sessions,
        current_streak=int(streaks["current_streak"] or 0) if streaks else 0,
        longest_streak=int(streaks["longest_streak"] or 0) if streaks else 0,
        per_workout_streaks=[
            {
                "workout_id": r["out_workout_id"],
                "workout_name": r["out_workout_name"],
                "weekly_streak": r["out_weekly_streak"],
            }
            for r in per_workout_streaks
        ],
    )
