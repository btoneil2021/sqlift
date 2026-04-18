import datetime
from flask import Blueprint, jsonify, request, session

from api.utils import api_route, serialize_row

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

    params = [
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
        data.get("calve_measurement")
    ]

    with conn.cursor(dictionary=True) as cur:
        query = "CALL log_measurement(" + ",".join(["%s"] * len(params)) + ")"
        cur.execute(query, params)
        row = cur.fetchone()
        while cur.nextset():
            pass
        conn.commit()

    return jsonify(status="ok", measurement=serialize_row(row)), 201


@stats_bp.route("/api/stats/<int:user_id>/goals", methods=["GET"])
@api_route(limit="30 per minute")
def get_goals(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_user_goals(%s)", (user_id,))
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

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL add_user_goal(%s, %s, %s)", (user_id, description, target_date))
        goal = cur.fetchone()
        while cur.nextset():
            pass
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

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL update_goal_status(%s, %s, %s)", (user_id, goal_id, new_status))
        goal = cur.fetchone()
        while cur.nextset():
            pass
        conn.commit()

    if goal is None:
        return jsonify(status="error", message="Goal not found."), 404

    return jsonify(status="ok", goal=serialize_goal(goal))


@stats_bp.route("/api/stats/<int:user_id>/goals/<int:goal_id>", methods=["DELETE"])
@api_route(limit="20 per minute")
def delete_goal(conn, user_id, goal_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL delete_user_goal(%s, %s)", (user_id, goal_id))
        row = cur.fetchone()
        while cur.nextset():
            pass
        conn.commit()

    deleted = row and row["deleted"]
    if not deleted or deleted == 0:
        return jsonify(status="error", message="Goal not found."), 404

    return jsonify(status="ok", message="Goal deleted.")


@stats_bp.route("/api/stats/<int:user_id>/exercise-progression", methods=["GET"])
@api_route(limit="30 per minute")
def get_exercise_progression(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_user_exercise_progression(%s)", (user_id,))
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

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_user_hero_stats(%s)", (user_id,))
        hero = cur.fetchone()
        while cur.nextset():
            pass

        cur.execute("CALL get_user_exercise_prs(%s)", (user_id,))
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


@stats_bp.route("/api/stats/<int:user_id>/muscle-volume", methods=["GET"])
@api_route(limit="30 per minute")
def get_muscle_volume(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_muscle_volume_by_session(%s)", (user_id,))
        rows = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_favourite_muscle(%s)", (user_id,))
        fav = cur.fetchone()

    by_date = {}
    for r in rows:
        date_key = r["session_date"].isoformat() if r["session_date"] else None
        if not date_key:
            continue
        if date_key not in by_date:
            by_date[date_key] = {}
        by_date[date_key][r["muscle_name"]] = float(r["volume_kg"] or 0)

    return jsonify(
        status="ok",
        by_date=by_date,
        favourite_muscle=fav["muscle_name"] if fav else None,
        favourite_muscle_volume=float(fav["total_volume"]) if fav and fav["total_volume"] else None,
    )


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

    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_user_workout_history(%s)", (user_id,))
        sessions = [_serialize_session(s) for s in cur.fetchall()]
        while cur.nextset():
            pass

        cur.execute("CALL get_user_daily_streaks(%s)", (user_id,))
        streaks = cur.fetchone()
        while cur.nextset():
            pass

        cur.execute("CALL get_user_weekly_streaks(%s)", (user_id,))
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
