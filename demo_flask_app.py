from flask import Flask, render_template_string, jsonify
import random
import os

app = Flask(__name__)

# Inline template since CodeMate may not have proper template directory structure
TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask Demo - CodeMate</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 5px;
        }
        button:hover { background: #005aa3; }
        .result {
            margin: 20px 0;
            padding: 10px;
            background: #f0f8ff;
            border-left: 4px solid #007acc;
            border-radius: 4px;
        }
        .error {
            background: #ffe6e6;
            border-left-color: #ff4444;
        }
        .db-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        input {
            padding: 8px;
            margin: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ msg }}</h1>
        <p>This Flask app is running successfully in CodeMate!</p>
        
        <h3>API Testing</h3>
        <button onclick="fetchRandom()">Get Random Number</button>
        <button onclick="fetchData()">Get API Data</button>
        <div id="api-result" class="result" style="display: none;"></div>
        
        <div class="db-section">
            <h3>Database Testing</h3>
            <p>Test the CodeMate database from Python:</p>
            <button onclick="testDatabase()">Test Database</button>
            <button onclick="getUsersFromDb()">Get Users from DB</button>
            <div id="db-result" class="result" style="display: none;"></div>
        </div>
    </div>

    <script>
        function showResult(elementId, content, isError = false) {
            const element = document.getElementById(elementId);
            element.innerHTML = content;
            element.className = isError ? 'result error' : 'result';
            element.style.display = 'block';
        }

        async function fetchRandom() {
            try {
                const response = await fetch('/api/random');
                const data = await response.json();
                showResult('api-result', `Random number: ${data.value}`);
            } catch (error) {
                showResult('api-result', `Error: ${error.message}`, true);
            }
        }

        async function fetchData() {
            try {
                const response = await fetch('/api/data');
                const data = await response.json();
                showResult('api-result', `
                    <strong>API Response:</strong><br>
                    Message: ${data.message}<br>
                    Timestamp: ${data.timestamp}<br>
                    Random: ${data.random_number}<br>
                    Status: ${data.status}
                `);
            } catch (error) {
                showResult('api-result', `Error: ${error.message}`, true);
            }
        }

        async function testDatabase() {
            try {
                const response = await fetch('/api/db/test');
                const data = await response.json();
                showResult('db-result', `
                    <strong>Database Test:</strong><br>
                    ${data.message}<br>
                    Test key value: ${data.test_value || 'Not set'}<br>
                    Status: ${data.status}
                `);
            } catch (error) {
                showResult('db-result', `Database Error: ${error.message}`, true);
            }
        }

        async function getUsersFromDb() {
            try {
                const response = await fetch('/api/db/users');
                const data = await response.json();
                showResult('db-result', `
                    <strong>Users in Database:</strong><br>
                    Count: ${data.count}<br>
                    Users: ${JSON.stringify(data.users, null, 2)}<br>
                    Status: ${data.status}
                `);
            } catch (error) {
                showResult('db-result', `Database Error: ${error.message}`, true);
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(TEMPLATE, msg="Flask Demo - CodeMate Edition")

@app.route('/api/random')
def api_random():
    return jsonify({'value': random.randint(1, 100)})

@app.route('/api/data')
def api_data():
    return jsonify({
        'message': 'Hello from Flask in CodeMate!',
        'timestamp': '2025-01-07',
        'random_number': random.randint(1, 1000),
        'status': 'success'
    })

@app.route('/api/db/test')
def db_test():
    try:
        # Check if db object is available (should be injected by CodeMate)
        if 'db' in globals():
            # Test basic database operations
            test_key = f"flask_test_{random.randint(1000, 9999)}"
            test_value = f"Hello from Flask at {random.randint(1, 100)}"
            
            # Try to set and get a value
            db.set(test_key, test_value)
            retrieved = db.get(test_key)
            
            return jsonify({
                'message': 'Database is available and working!',
                'test_key': test_key,
                'test_value': retrieved,
                'status': 'success'
            })
        else:
            return jsonify({
                'message': 'Database object not available in Flask context',
                'status': 'error',
                'note': 'The db object may not be injected into Flask routes'
            })
    except Exception as e:
        return jsonify({
            'message': f'Database test failed: {str(e)}',
            'status': 'error'
        })

@app.route('/api/db/users')
def db_users():
    try:
        if 'db' in globals():
            # Try to get users from the database
            users_data = db.get('users') or {}
            user_count = len(users_data)
            
            return jsonify({
                'count': user_count,
                'users': users_data,
                'status': 'success'
            })
        else:
            return jsonify({
                'message': 'Database not available',
                'count': 0,
                'users': {},
                'status': 'error'
            })
    except Exception as e:
        return jsonify({
            'message': f'Error retrieving users: {str(e)}',
            'count': 0,
            'users': {},
            'status': 'error'
        })

@app.route('/test')
def test():
    return "Flask is working in CodeMate! ✅"

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found', 'status': 404}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error', 'status': 500}), 500

if __name__ == '__main__':
    # For CodeMate compatibility - the server is handled by the environment
    print("Flask app configured for CodeMate environment")
    pass
