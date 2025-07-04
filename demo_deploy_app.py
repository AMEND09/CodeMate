from flask import Flask, render_template, jsonify
import random

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html', msg="Welcome to HackMate Deploy Demo!")

@app.route('/api/')
def api():
    return jsonify({'value': random.randint(1, 100)})

@app.route('/api/data')
def get_data():
    return jsonify({
        'message': 'Hello from Flask!',
        'timestamp': '2025-07-04',
        'random_number': random.randint(1, 1000),
        'status': 'success'
    })

if __name__ == '__main__':
    app.run(debug=True)
