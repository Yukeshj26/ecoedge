from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

CORS(app)


@app.route("/detect", methods=["POST"])
def detect():

    data = request.json

    power = data.get("power", 0)

    anomaly = power > 900

    return jsonify({
        "anomaly": anomaly
    })


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True
    )