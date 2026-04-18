from flask import Blueprint, jsonify, request, session

from api.utils import api_route, serialize_row

sessions_bp = Blueprint('sessions', __name__)


def _require_user():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify(status="error", message="Not authenticated."), 401)
    return user_id, None


def _session_not_found():
    return jsonify(status="error", message="Session not found."), 404


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


# ── Fetch session tracking payload ────────────────────────────────────────────

@sessions_bp.route("/api/sessions/<int:session_id>")
@api_route()
def get_session(conn, session_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor(dictionary=True) as cur:
        # Get session header
        cur.execute("CALL get_workout_session(%s, %s)", (user_id, session_id))
        session_row = cur.fetchone()
        while cur.nextset():
            pass

        if not session_row:
            return _session_not_found()

        # Get record logs for this session
        cur.execute("CALL get_workout_records(%s, %s)", (user_id, session_id))
        records = cur.fetchall()
        while cur.nextset():
            pass

        # For each record, fetch its sets
        for record in records:
            cur.execute(
                "CALL get_sets_for_record_log(%s, %s)",
                (user_id, record["record_log_id"]),
            )
            sets = cur.fetchall()
            while cur.nextset():
                pass
            # Convert rest_time (seconds INT) to interval string for frontend
            for s in sets:
                s["rest_time"] = _seconds_to_interval(s.get("rest_time"))
            record["sets"] = sets

    # Fetch planned exercises for the exercise picker
    with conn.cursor(dictionary=True) as cur:
        cur.execute(
            "CALL get_workout_exercises(%s, %s)",
            (user_id, session_row["workout_id"]),
        )
        planned = cur.fetchall()

    sess = serialize_row(session_row)
    return jsonify(
        status="ok",
        session=sess,
        planned_exercises=[serialize_row(p) for p in planned],
        records=[
            {**serialize_row(r), "sets": r["sets"]} for r in records
        ],
    )


# ── Record log operations ─────────────────────────────────────────────────────

@sessions_bp.route("/api/sessions/<int:session_id>/records", methods=["POST"])
@api_route()
def add_record(conn, session_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    exercise_id = data.get("exercise_id")
    if not exercise_id:
        return jsonify(status="error", message="exercise_id is required."), 400
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL create_record_log(%s, %s, %s)",
                (user_id, session_id, exercise_id),
            )
            row = cur.fetchone()
            while cur.nextset():
                pass
            record_log_id = row["record_log_id"] if row else None
            assigned_number = row["assigned_number"] if row else None
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok", record_log_id=record_log_id, assigned_number=assigned_number), 201


@sessions_bp.route("/api/records/<int:record_log_id>", methods=["DELETE"])
@api_route()
def delete_record(conn, record_log_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("CALL delete_record_log(%s, %s)", (user_id, record_log_id))
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok")


# ── Set log operations ────────────────────────────────────────────────────────

@sessions_bp.route("/api/records/<int:record_log_id>/sets", methods=["POST"])
@api_route()
def add_set(conn, record_log_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    set_type  = data.get("type") or None
    weight    = data.get("weight")
    reps      = data.get("reps")
    rpe       = data.get("rpe")
    rest_time = _interval_to_seconds(data.get("rest_time"))

    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL create_set_log(%s, %s, %s, %s, %s, %s, %s)",
                (user_id, record_log_id, set_type, weight, reps, rpe, rest_time),
            )
            row = cur.fetchone()
            while cur.nextset():
                pass
            set_log_id = row["set_log_id"] if row else None
            assigned_number = row["assigned_number"] if row else None
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok", set_log_id=set_log_id, assigned_number=assigned_number), 201


@sessions_bp.route("/api/sets/<int:set_log_id>", methods=["PATCH"])
@api_route()
def update_set(conn, set_log_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    set_type  = data.get("type") or None
    weight    = data.get("weight")
    reps      = data.get("reps")
    rpe       = data.get("rpe")
    rest_time = _interval_to_seconds(data.get("rest_time"))

    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL update_set_log(%s, %s, %s, %s, %s, %s, %s)",
                (user_id, set_log_id, set_type, weight, reps, rpe, rest_time),
            )
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    # Fetch the updated set to return
    with conn.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM set_log WHERE set_log_id = %s", (set_log_id,))
        row = cur.fetchone()
    if not row:
        return jsonify(status="error", message="Set not found."), 404
    row["rest_time"] = _seconds_to_interval(row.get("rest_time"))
    return jsonify(status="ok", set=dict(row))


@sessions_bp.route("/api/sets/<int:set_log_id>", methods=["DELETE"])
@api_route()
def delete_set(conn, set_log_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("CALL delete_set_log(%s, %s)", (user_id, set_log_id))
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    return jsonify(status="ok")


# ── Finish / abandon session ──────────────────────────────────────────────────

@sessions_bp.route("/api/sessions/<int:session_id>/finish", methods=["POST"])
@api_route()
def finish_session(conn, session_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    notes      = data.get("notes") or None
    difficulty = data.get("difficulty_rating")
    enjoyment  = data.get("enjoyment_rating")
    energy     = data.get("energy_level_rating")

    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL finish_workout_session(%s, %s, %s, %s, %s, %s)",
                (user_id, session_id, notes, difficulty, enjoyment, energy),
            )
            row = cur.fetchone()
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    if not row:
        return jsonify(status="error", message="Session not found or not in progress."), 404
    return jsonify(status="ok", workout_id=row["workout_id"])


@sessions_bp.route("/api/sessions/<int:session_id>/abandon", methods=["POST"])
@api_route()
def abandon_session(conn, session_id):
    """Finish the session without ratings — marks notes as 'Abandoned'."""
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(dictionary=True) as cur:
            cur.execute(
                "CALL finish_workout_session(%s, %s, %s, %s, %s, %s)",
                (user_id, session_id, "Abandoned", None, None, None),
            )
            row = cur.fetchone()
            while cur.nextset():
                pass
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=str(exc)), 400
    if not row:
        return jsonify(status="error", message="Session not found or not in progress."), 404
    return jsonify(status="ok", workout_id=row["workout_id"])
