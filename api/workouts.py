import json
from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row

from api.utils import api_route, DB_SCHEMA, db_error_message, serialize_row

workouts_bp = Blueprint('workouts', __name__)


def _require_user():
    """Return (user_id, None) if authenticated, else (None, error_response)."""
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify(status="error", message="Not authenticated."), 401)
    return user_id, None


# ── Reference data ────────────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/new/reference-data")
@api_route()
def new_workout_reference_data(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(f"SELECT {DB_SCHEMA}.fn_get_new_workout_reference_data() AS data")
        row = cur.fetchone()
    return jsonify(status="ok", data=row[0])


# ── Exercise search ───────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/search")
@api_route()
def search_exercises(conn):
    user_id, err = _require_user()
    if err:
        return err
    q = request.args.get("q", "").strip() or None
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"SELECT * FROM {DB_SCHEMA}.fn_search_exercise_library(%s)",
            (q,)
        )
        results = cur.fetchall()
    return jsonify(status="ok", results=results)


# ── Exercise library ─────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/library")
@api_route()
def get_exercise_library(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(f"SELECT {DB_SCHEMA}.fn_get_exercise_library() AS exercises")
        row = cur.fetchone()
    return jsonify(status="ok", exercises=row[0] if row else [])


# ── Exercise detail ───────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/<int:exercise_id>")
@api_route()
def get_exercise(conn, exercise_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_get_exercise_by_id(%s::bigint) AS exercise",
            (exercise_id,)
        )
        row = cur.fetchone()
    if not row or row[0] is None:
        return jsonify(status="error", message="Exercise not found."), 404
    return jsonify(status="ok", exercise=row[0])


# ── Workout list ─────────────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/list")
@api_route()
def list_workouts(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_list_user_workouts(%s::bigint) AS workouts",
            (user_id,)
        )
        row = cur.fetchone()
    return jsonify(status="ok", workouts=row[0] if row else [])


# ── Workout CRUD ──────────────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/<int:workout_id>")
@api_route()
def get_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_get_view_workout_payload(%s, %s) AS payload",
            (user_id, workout_id)
        )
        row = cur.fetchone()
    if not row or row[0] is None:
        return jsonify(status="error", message="Workout not found."), 404
    return jsonify(status="ok", workout=row[0])


@workouts_bp.route("/api/workouts", methods=["POST"])
@api_route()
def create_workout(conn):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_create_workout_full(%s, %s, %s, %s::jsonb, %s::jsonb)",
                (
                    user_id,
                    data.get("name"),
                    data.get("preferred_day") or None,
                    json.dumps(data.get("exercises", [])),
                    json.dumps(data.get("tags", [])),
                )
            )
            workout_id = cur.fetchone()[0]
            conn.commit()
    except Exception as exc:
        conn.rollback()
        if "already exists" in str(exc).lower():
            return jsonify(status="error", message="A workout with that name already exists."), 409
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok", workout_id=workout_id), 201


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["PUT"])
@api_route()
def update_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_update_workout_full(%s, %s, %s, %s, %s::jsonb, %s::jsonb)",
                (
                    user_id,
                    workout_id,
                    data.get("name"),
                    data.get("preferred_day") or None,
                    json.dumps(data.get("exercises", [])),
                    json.dumps(data.get("tags", [])),
                )
            )
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok", workout_id=workout_id)


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["DELETE"])
@api_route()
def delete_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_delete_workout(%s, %s)",
                (user_id, workout_id)
            )
            conn.commit()
    except Exception as exc:
        conn.rollback()
        if "in-progress session" in str(exc).lower() or "in progress" in str(exc).lower():
            return jsonify(
                status="error",
                message="Cannot delete a workout with an active in-progress session."
            ), 409
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok")


# ── Session start / resume ────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/<int:workout_id>/sessions", methods=["POST"])
@api_route()
def start_session(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_start_workout_session(%s, %s)",
                (user_id, workout_id)
            )
            workout_session_id = cur.fetchone()[0]
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok", workout_session_id=workout_session_id), 201


@workouts_bp.route("/api/workouts/<int:workout_id>/sessions")
@api_route()
def list_sessions(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"SELECT * FROM {DB_SCHEMA}.fn_list_workout_sessions(%s, %s)",
            (user_id, workout_id)
        )
        rows = cur.fetchall()
    return jsonify(status="ok", sessions=[serialize_row(r) for r in rows])


@workouts_bp.route("/api/workouts/<int:workout_id>/sessions/in-progress")
@api_route()
def get_in_progress_session(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"SELECT * FROM {DB_SCHEMA}.fn_get_in_progress_session_for_workout(%s, %s)",
            (user_id, workout_id)
        )
        row = cur.fetchone()
    if not row:
        return jsonify(status="none")
    s = dict(row)
    for key in ("start_date_time", "end_date_time"):
        if s.get(key) is not None:
            s[key] = s[key].isoformat()
    if s.get("completion_status") is not None:
        s["completion_status"] = str(s["completion_status"])
    return jsonify(status="ok", session=s)
