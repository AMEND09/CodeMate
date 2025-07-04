from flask import Flask, render_template
import random

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html", msg="Hello from Flask-Lite!")

@app.route("/api/")
def api():
    return {'value': random.random()}

@app.route("/test")
def test():
    return "Flask-Lite is working!"

if __name__ == '__main__':
    # Flask-lite compatibility - server run handled by browser environment
    pass
