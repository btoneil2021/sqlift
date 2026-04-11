from flask import Blueprint, jsonify, request, session
from psycopg.rows import dict_row
import bcrypt

from api.utils import api_route, tbl

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/api/auth/login", methods=["POST"])
@api_route(limit="10 per minute")
def login(conn):
    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify(status="error", message="Email and password are required."), 400

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM sqlift.get_user_by_email(%s)",
            (email,),
        )
        user = cur.fetchone()

    if user is None:
        return jsonify(status="error", message="Invalid email or password."), 401

    stored_hash = user["password"].encode("utf-8") if isinstance(user["password"], str) else user["password"]
    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return jsonify(status="error", message="Invalid email or password."), 401

    session["user_id"] = user["user_id"]

    user_data = {k: v for k, v in user.items() if k != "password"}
    return jsonify(status="ok", user=user_data)


@auth_bp.route("/api/auth/signup", methods=["POST"])
@api_route(limit="5 per minute")
def signup(conn):
    data = request.get_json(silent=True)
    if not data:
        return jsonify(status="error", message="Request body must be JSON."), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    phone_num = data.get("phone_num", "").strip()

    if not all([username, email, password, first_name, last_name, phone_num]):
        return jsonify(status="error", message="username, email, password, first_name, last_name, and phone_num are required."), 400

    if len(password) < 6:
        return jsonify(status="error", message="Password must be at least 6 characters."), 400

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute(
                "SELECT * FROM sqlift.signup_user(%s, %s, %s, %s, %s, %s)",
                (username, email, password_hash, first_name, last_name, phone_num),
            )
            user = cur.fetchone()
            conn.commit()
        except Exception as exc:
            conn.rollback()
            msg = str(exc)
            if "unique" in msg.lower() and "username" in msg.lower():
                return jsonify(status="error", message="Username already taken."), 409
            if "unique" in msg.lower() and "email" in msg.lower():
                return jsonify(status="error", message="An account with that email already exists."), 409
            if "unique" in msg.lower() and "phone_num" in msg.lower():
                return jsonify(status="error", message="That phone number is already in use."), 409
            raise

    session["user_id"] = user["user_id"]
    return jsonify(status="ok", user=user), 201


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(status="ok", message="Logged out.")


@auth_bp.route("/api/auth/me", methods=["GET"])
@api_route(limit="60 per minute")
def me(conn):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(status="error", message="Not authenticated."), 401

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT user_id, username, first_name, last_name,
                   height, sex, email, phone_num, profile_pic_url
            FROM {tbl('user')}
            WHERE user_id = %s
            """,
            (user_id,),
        )
        user = cur.fetchone()

    if user is None:
        session.clear()
        return jsonify(status="error", message="User not found."), 404

    return jsonify(status="ok", user=user)


@auth_bp.route("/api/auth/username-available/<username>", methods=["GET"])
@api_route(limit="60 per minute")
def username_available(conn, username):
    with conn.cursor() as cur:
        cur.execute("SELECT sqlift.is_username_available(%s)", (username,))
        available = cur.fetchone()[0]
    return jsonify(status="ok", available=available)
