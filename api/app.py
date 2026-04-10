import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

from api.utils import limiter
limiter.init_app(app)


@app.route("/")
def home():
    return "Backend is running!"


from api.home import home_bp

app.register_blueprint(home_bp)



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
