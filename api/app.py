from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "Backend is running!"


@app.route("/hello")
@app.route("/api/hello")
def hello():
    return jsonify(message="Hello from Flask on Vercel!")


@app.errorhandler(404)
def page_not_found(e):
    return jsonify(
        error="Not Found",
        path=request.path,
        full_url=request.url,
        message="The requested URL was not found on the server. If this is a backend request, check the route prefix.",
    ), 404
