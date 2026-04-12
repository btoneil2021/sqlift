from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row

from api.utils import api_route, DB_SCHEMA, db_error_message

sessions_bp = Blueprint('sessions', __name__)


def _require_user():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify(status="error", message="Not authenticated."), 401)
    return user_id, None


def _session_not_found():
    return jsonify(status="error", message="Session not found."), 404


# ── Fetch session tracking payload ────────────────────────────────────────────

@sessions_bp.route("/api/sessions/<int:session_id>")
@api_route()
def get_session(conn, session_id):
    user_id, err = _require_user()
    if err:
        return err
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT {DB_SCHEMA}.fn_get_tracking_payload(%s, %s) AS payload",
            (user_id, session_id)
        )
        row = cur.fetchone()
    if not row or row[0] is None:
        return _session_not_found()
    return jsonify(status="ok", **row[0])


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
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"SELECT * FROM {DB_SCHEMA}.fn_add_record_log(%s, %s, %s)",
                (user_id, session_id, exercise_id)
            )
            row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok", record_log_id=row["record_log_id"], assigned_number=row["assigned_number"]), 201


@sessions_bp.route("/api/records/<int:record_log_id>", methods=["DELETE"])
@api_route()
def delete_record(conn, record_log_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_delete_record_log(%s, %s)",
                (user_id, record_log_id)
            )
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
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
    rest_time = data.get("rest_time") or None   # expected as "HH:MM:SS" string or null

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""SELECT * FROM {DB_SCHEMA}.fn_add_set_log(
                    %s::bigint, %s::bigint,
                    %s::{DB_SCHEMA}.set_type,
                    %s::numeric, %s::integer, %s::numeric,
                    %s::interval
                )""",
                (user_id, record_log_id, set_type, weight, reps, rpe, rest_time)
            )
            row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok", set_log_id=row["set_log_id"], assigned_number=row["assigned_number"]), 201


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
    rest_time = data.get("rest_time") or None

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""SELECT * FROM {DB_SCHEMA}.fn_update_set_log(
                    %s::bigint, %s::bigint,
                    %s::{DB_SCHEMA}.set_type,
                    %s::numeric, %s::integer, %s::numeric,
                    %s::interval
                )""",
                (user_id, set_log_id, set_type, weight, reps, rpe, rest_time)
            )
            row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    if not row:
        return jsonify(status="error", message="Set not found."), 404
    return jsonify(status="ok", set=dict(row))


@sessions_bp.route("/api/sets/<int:set_log_id>", methods=["DELETE"])
@api_route()
def delete_set(conn, set_log_id):
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {DB_SCHEMA}.fn_delete_set_log(%s, %s)",
                (user_id, set_log_id)
            )
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    return jsonify(status="ok")


# ── Finish / abandon session ──────────────────────────────────────────────────

@sessions_bp.route("/api/sessions/<int:session_id>/finish", methods=["POST"])
@api_route()
def finish_session(conn, session_id):
    user_id, err = _require_user()
    if err:
        return err
    data = request.get_json(silent=True) or {}

    notes            = data.get("notes") or None
    difficulty       = data.get("difficulty_rating")
    enjoyment        = data.get("enjoyment_rating")
    energy           = data.get("energy_level_rating")

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"SELECT * FROM {DB_SCHEMA}.fn_finish_workout_session(%s, %s, %s, %s, %s, %s)",
                (user_id, session_id, notes, difficulty, enjoyment, energy)
            )
            row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    if not row:
        return jsonify(status="error", message="Session not found or not in progress."), 404
    return jsonify(status="ok", workout_id=row["workout_id"])


@sessions_bp.route("/api/sessions/<int:session_id>/abandon", methods=["POST"])
@api_route()
def abandon_session(conn, session_id):
    """Finish the session without ratings — the schema has no Abandoned status."""
    user_id, err = _require_user()
    if err:
        return err
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"SELECT * FROM {DB_SCHEMA}.fn_finish_workout_session(%s, %s, %s, %s, %s, %s)",
                (user_id, session_id, "Abandoned", None, None, None)
            )
            row = cur.fetchone()
            conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify(status="error", message=db_error_message(exc)), 400
    if not row:
        return jsonify(status="error", message="Session not found or not in progress."), 404
    return jsonify(status="ok", workout_id=row["workout_id"])
