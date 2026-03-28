from flask import Flask, jsonify
from flask_cors import CORS # Import CORS

app = Flask(__name__)
CORS(app) # This enables your frontend to call this API

@app.route('/api/hello')
def hello():
    return jsonify(message="Hello from Flask on Vercel!")