import json
from http.server import BaseHTTPRequestHandler

from api.app import fetch_sample_users, postgres_error_hint


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            users = fetch_sample_users()
            body = json.dumps(
                {
                    "status": "ok",
                    "connected": True,
                    "schema": "sqlift",
                    "table": "user",
                    "sample_users": users,
                    "user_count": len(users),
                }
            ).encode("utf-8")
            self.send_response(200)
        except Exception as exc:
            body = json.dumps(
                {
                    "status": "error",
                    "connected": False,
                    "message": "Could not reach the database.",
                    "error": str(exc),
                    "hint": postgres_error_hint(exc),
                }
            ).encode("utf-8")
            self.send_response(500)

        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
