from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row
import bcrypt

from api.utils import api_route

profile_bp = Blueprint('profile', __name__)


@profile_bp.route("/api/profile/<int:user_id>", methods=["GET"])
@api_route(limit="30 per minute")
def get_profile(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.get_user_profile(%s)",
            (user_id,),
        )
        user = cur.fetchone()

    if user is None:
        return jsonify(status="error", message="User not found."), 404

    return jsonify(status="ok", user=user)


@profile_bp.route("/api/profile/<int:user_id>", methods=["PUT"])
@api_route(limit="10 per minute")
def update_profile(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    allowed = {"username", "first_name", "last_name", "height", "sex", "email", "phone_num", "profile_pic_url"}
    updates = {k: v for k, v in data.items() if k in allowed}

    required = {"username", "first_name", "last_name", "email", "phone_num"}
    missing = [f for f in required if f in updates and not updates[f]]
    if missing:
        return jsonify(status="error", message=f"Required fields cannot be empty: {', '.join(missing)}"), 400

    if not updates:
        return jsonify(status="error", message="No valid fields provided."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT * FROM sqlift.update_user_profile(
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                user_id,
                updates.get("username"),
                updates.get("first_name"),
                updates.get("last_name"),
                updates.get("height"),
                updates.get("sex"),
                updates.get("email"),
                updates.get("phone_num"),
                updates.get("profile_pic_url")
            ),
        )
        updated = cur.fetchone()
        conn.commit()

    if updated is None:
        return jsonify(status="error", message="User not found."), 404

    return jsonify(status="ok", user=updated)


@profile_bp.route("/api/profile/<int:user_id>/password", methods=["PUT"])
@api_route(limit="5 per minute")
def change_password(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    current_pw = data.get("current_password", "")
    new_pw = data.get("new_password", "")

    if not current_pw or not new_pw:
        return jsonify(status="error", message="current_password and new_password are required."), 400

    if len(new_pw) < 6:
        return jsonify(status="error", message="New password must be at least 6 characters."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sqlift.get_user_password_hash(%s)", (user_id,))
        row = cur.fetchone()

        if row is None:
            return jsonify(status="error", message="User not found."), 404

        stored_hash = row["password"].encode("utf-8") if isinstance(row["password"], str) else row["password"]
        if not bcrypt.checkpw(current_pw.encode("utf-8"), stored_hash):
            return jsonify(status="error", message="Current password is incorrect."), 401

        new_hash = bcrypt.hashpw(new_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cur.execute("SELECT sqlift.change_user_password(%s, %s)", (user_id, new_hash))
        conn.commit()

    return jsonify(status="ok", message="Password updated successfully.")



@profile_bp.route("/api/profile/<int:user_id>/measurements", methods=["GET"])
@api_route(limit="30 per minute")
def get_measurements(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sqlift.get_latest_measurements(%s)", (user_id,))
        rows = cur.fetchall()

    return jsonify(status="ok", measurements=rows)


@profile_bp.route("/api/profile/<int:user_id>/friends", methods=["GET"])
@api_route(limit="30 per minute")
def get_friends(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM sqlift.get_user_friends(%s)", (user_id,))
        friends = cur.fetchall()

    return jsonify(status="ok", friends=friends)


@profile_bp.route("/api/profile/<int:user_id>/friends", methods=["POST"])
@api_route(limit="20 per minute")
def add_friend(conn, user_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    target_username = (data.get("username") or "").strip()
    if not target_username:
        return jsonify(status="error", message="username is required."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute(
                "SELECT * FROM sqlift.add_friend(%s, %s)",
                (user_id, target_username),
            )
            friend = cur.fetchone()
            conn.commit()
        except Exception as exc:
            conn.rollback()
            msg = str(exc).lower()
            if "cannot add yourself" in msg:
                return jsonify(status="error", message="You cannot add yourself as a friend."), 400
            if "unique" in msg or "already friends" in msg:
                return jsonify(status="error", message="Already friends with that user."), 409
            if "not found" in msg:
                return jsonify(status="error", message="User not found."), 404
            raise

    if friend is None:
        return jsonify(status="error", message="User not found."), 404

    return jsonify(status="ok", friend=friend), 201


@profile_bp.route("/api/profile/<int:user_id>/friends/<int:friend_id>", methods=["DELETE"])
@api_route(limit="20 per minute")
def remove_friend(conn, user_id, friend_id):
    if session.get("user_id") != user_id:
        return jsonify(status="error", message="Not authorized."), 403

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT sqlift.remove_friend(%s, %s)", (user_id, friend_id))
        row = cur.fetchone()
        conn.commit()

    removed = row and list(row.values())[0]
    if not removed:
        return jsonify(status="error", message="Friend relationship not found."), 404

    return jsonify(status="ok", message="Friend removed.")
