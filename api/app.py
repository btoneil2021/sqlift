import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
CORS(app, supports_credentials=True)

from api.utils import limiter, api_route
limiter.init_app(app)


@app.route("/")
def home():
    return "Backend is running!"


@app.route("/api/hello")
def hello():
    return jsonify(message="Hello from Flask on Vercel!")


@app.route("/api/supabase/keepalive")
@api_route(limit="10 per hour")
def supabase_keepalive(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 AS ok")
        row = cur.fetchone()
    if not row or row[0] != 1:
        return jsonify(status="error", connected=False), 503
    return jsonify(status="ok", connected=True, result=1)


@app.after_request
def prevent_keepalive_caching(response):
    # Both schedulers must reach the database, including after an earlier failure.
    if request.path == "/api/supabase/keepalive":
        response.headers["Cache-Control"] = "no-store"
    return response


from api.auth import auth_bp
from api.profile import profile_bp
from api.stats import stats_bp
from api.workouts import workouts_bp
from api.sessions import sessions_bp
from api.leaderboard import leaderboard_bp
from api.achievements import achievements_bp

app.register_blueprint(auth_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(workouts_bp)
app.register_blueprint(sessions_bp)
app.register_blueprint(leaderboard_bp)
app.register_blueprint(achievements_bp)

@app.errorhandler(404)
def page_not_found(e):
    return jsonify(
        error="Not Found",
        path=request.path,
        full_url=request.url,
        message="The requested URL was not found on the server. If this is a backend request, check the route prefix.",
    ), 404

if __name__ == '__main__':
    app.run(port=5328, debug=True)
