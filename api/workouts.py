from flask import Blueprint, jsonify, request, session

from api.utils import api_route, tbl, serialize_row

workouts_bp = Blueprint('workouts', __name__)


def _require_user():
    """Return (user_id, None) if authenticated, else (None, error_response)."""
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify(status="error", message="Not authenticated."), 401)
    return user_id, None


def _seconds_to_interval(seconds):
    """Convert an integer number of seconds to an HH:MM:SS string."""
    if seconds is None:
        return None
    seconds = int(seconds)
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _interval_to_seconds(interval_str):
    """Convert an HH:MM:SS or MM:SS interval string to integer seconds."""
    if interval_str is None:
        return None
    if isinstance(interval_str, (int, float)):
        return int(interval_str)
    parts = str(interval_str).strip().split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(parts[0])


# ── Exercise search ───────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/search")
@api_route()
def search_exercises(conn):
    user_id, err = _require_user()
    if err:
        return err
    q = request.args.get("q", "").strip() or None
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL search_exercises(%s)", (q,))
        results = cur.fetchall()
    return jsonify(status="ok", results=results)


# ── Exercise library ─────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/library")
@api_route()
def get_exercise_library(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_exercise_library()")
        exercises = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_exercise_library_muscle_groups()")
        mg_rows = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_exercise_library_equipment()")
        eq_rows = cur.fetchall()

    # Index muscle groups and equipment by exercise_id
    mg_map = {}
    for r in mg_rows:
        mg_map.setdefault(r['exercise_id'], []).append({'name': r['name'], 'role': r['role']})

    eq_map = {}
    for r in eq_rows:
        eq_map.setdefault(r['exercise_id'], []).append(r['name'])

    for ex in exercises:
        ex['muscle_groups'] = mg_map.get(ex['exercise_id'], [])
        ex['equipment'] = eq_map.get(ex['exercise_id'], [])

    return jsonify(status="ok", exercises=exercises)


# ── Exercise detail ───────────────────────────────────────────────────────────

@workouts_bp.route("/api/exercises/<int:exercise_id>")
@api_route()
def get_exercise(conn, exercise_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_exercise_by_id(%s)", (exercise_id,))
        exercise = cur.fetchone()
        while cur.nextset():
            pass

        if not exercise:
            return jsonify(status="error", message="Exercise not found."), 404

        cur.execute("CALL get_exercise_muscle_groups(%s)", (exercise_id,))
        mg_rows = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_exercise_equipment(%s)", (exercise_id,))
        eq_rows = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_exercise_media(%s)", (exercise_id,))
        media_rows = cur.fetchall()

    exercise['muscle_groups'] = [{'name': r['name'], 'role': r['role']} for r in mg_rows]
    exercise['equipment'] = [r['name'] for r in eq_rows]
    exercise['media'] = [{'url': r['url'], 'type': r['type']} for r in media_rows]
    return jsonify(status="ok", exercise=exercise)


# ── Workout list ─────────────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/list")
@api_route()
def list_workouts(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL list_user_workouts(%s)", (user_id,))
        workouts = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL list_user_workout_tags(%s)", (user_id,))
        tag_rows = cur.fetchall()

    # Index tags by workout_id
    tag_map = {}
    for r in tag_rows:
        tag_map.setdefault(r['workout_id'], []).append({
            'tag_name': r['tag_name'],
            'color_code': r['color_code'],
        })

    for w in workouts:
        w['tags'] = tag_map.get(w['workout_id'], [])
        if w.get('last_started_at'):
            w['last_started_at'] = w['last_started_at'].isoformat()

    return jsonify(status="ok", workouts=workouts)


# ── Reference data for workout builder ────────────────────────────────────────

@workouts_bp.route("/api/workouts/new/reference-data")
@api_route()
def get_reference_data(conn):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute(f"SELECT name, color_code FROM {tbl('workout_tag')} ORDER BY name")
        tags = cur.fetchall()

        cur.execute(f"SELECT muscle_id, name FROM {tbl('muscle_group')} ORDER BY name")
        muscle_groups = cur.fetchall()

        cur.execute(f"SELECT equipment_id, name FROM {tbl('equipment')} ORDER BY name")
        equipment = cur.fetchall()

    return jsonify(status="ok", data={
        "tags": tags,
        "muscle_groups": muscle_groups,
        "equipment": equipment,
    })


# ── Workout CRUD ──────────────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/<int:workout_id>")
@api_route()
def get_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL get_workout(%s, %s)", (user_id, workout_id))
        workout = cur.fetchone()
        while cur.nextset():
            pass

        if not workout:
            return jsonify(status="error", message="Workout not found."), 404

        cur.execute("CALL get_workout_tags(%s, %s)", (user_id, workout_id))
        tags = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_workout_exercises(%s, %s)", (user_id, workout_id))
        exercises = cur.fetchall()
        while cur.nextset():
            pass

        cur.execute("CALL get_workout_history(%s, %s)", (user_id, workout_id))
        history = cur.fetchone()
        while cur.nextset():
            pass

    # Convert expected_rest_time (seconds INT) to interval string for frontend
    for ex in exercises:
        ex["expected_rest_time"] = _seconds_to_interval(ex.get("expected_rest_time"))

    header = serialize_row(workout)
    # Proc returns 'workout_name' but frontend expects 'name'
    if "workout_name" in header:
        header["name"] = header.pop("workout_name")

    result = {
        "header": header,
        "tags": tags,
        "exercises": [serialize_row(e) for e in exercises],
        "history": serialize_row(history) if history else None,
    }
    return jsonify(status="ok", workout=result)


@workouts_bp.route("/api/workouts", methods=["POST"])
@api_route()
def create_workout(conn):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL create_full_workout(%s, %s, %s)",
                (user_id, data.get("name"), data.get("preferred_day") or None),
            )
            row = cur.fetchone()
            workout_id = row["workout_id"] if row else None
            while cur.nextset():
                pass

            exercises = data.get("exercises", [])
            for idx, ex in enumerate(exercises, start=1):
                cur.execute(
                    "CALL create_workout_exercise(%s, %s, %s, %s, %s, %s, %s, %s)",
                    (
                        user_id,
                        workout_id,
                        ex.get("sort_order", idx),
                        ex.get("exercise_id"),
                        ex.get("target_sets"),
                        ex.get("target_reps"),
                        ex.get("target_weight"),
                        _interval_to_seconds(ex.get("expected_rest_time")),
                    ),
                )
                while cur.nextset():
                    pass

            tags = data.get("tags", [])
            for tag in tags:
                tag_name = tag if isinstance(tag, str) else tag.get("name")
                if tag_name:
                    cur.execute(
                        "CALL add_workout_tag(%s, %s, %s)",
                        (user_id, workout_id, tag_name),
                    )
                    while cur.nextset():
                        pass

            conn.commit()
    except Exception as exc:
        conn.rollback()
        msg = str(exc).lower()
        if "already exists" in msg:
            return jsonify(status="error", message="A workout with that name already exists."), 409
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok", workout_id=workout_id), 201


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["PUT"])
@api_route()
def update_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        with conn.cursor(dictionary=True) as cur:
            # Clear existing exercises and tags first
            cur.execute("CALL delete_workout_exercise(%s, %s)", (user_id, workout_id))
            while cur.nextset():
                pass
            cur.execute("CALL delete_workout_tags_assignment(%s, %s)", (user_id, workout_id))
            while cur.nextset():
                pass

            # Update workout header
            cur.execute(
                "CALL update_workout(%s, %s, %s, %s)",
                (user_id, workout_id, data.get("name"), data.get("preferred_day") or None),
            )
            while cur.nextset():
                pass

            # Re-add exercises
            exercises = data.get("exercises", [])
            for idx, ex in enumerate(exercises, start=1):
                cur.execute(
                    "CALL create_workout_exercise(%s, %s, %s, %s, %s, %s, %s, %s)",
                    (
                        user_id,
                        workout_id,
                        ex.get("sort_order", idx),
                        ex.get("exercise_id"),
                        ex.get("target_sets"),
                        ex.get("target_reps"),
                        ex.get("target_weight"),
                        _interval_to_seconds(ex.get("expected_rest_time")),
                    ),
                )
                while cur.nextset():
                    pass

            # Re-add tags
            tags = data.get("tags", [])
            for tag in tags:
                tag_name = tag if isinstance(tag, str) else tag.get("name")
                if tag_name:
                    cur.execute(
                        "CALL add_workout_tag(%s, %s, %s)",
                        (user_id, workout_id, tag_name),
                    )
                    while cur.nextset():
                        pass

            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok", workout_id=workout_id)


@workouts_bp.route("/api/workouts/<int:workout_id>", methods=["DELETE"])
@api_route()
def delete_workout(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("CALL delete_workout(%s, %s)", (user_id, workout_id))
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        msg = str(exc).lower()
        if "in-progress session" in msg or "in progress" in msg:
            return jsonify(
                status="error",
                message="Cannot delete a workout with an active in-progress session.",
            ), 409
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok")


# ── Session start / resume ────────────────────────────────────────────────────

@workouts_bp.route("/api/workouts/<int:workout_id>/sessions", methods=["POST"])
@api_route()
def start_session(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("CALL start_workout_session(%s, %s)", (user_id, workout_id))
            row = cur.fetchone()
            while cur.nextset():
                pass
            workout_session_id = row["workout_session_id"] if row else None
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok", workout_session_id=workout_session_id), 201


@workouts_bp.route("/api/workouts/<int:workout_id>/sessions")
@api_route()
def list_sessions(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute("CALL list_workout_sessions(%s, %s)", (user_id, workout_id))
        rows = cur.fetchall()
    return jsonify(status="ok", sessions=[serialize_row(r) for r in rows])


@workouts_bp.route("/api/workouts/<int:workout_id>/sessions/in-progress")
@api_route()
def get_in_progress_session(conn, workout_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        cur.execute(
            "CALL get_in_progress_workout_session(%s, %s)", (user_id, workout_id)
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
