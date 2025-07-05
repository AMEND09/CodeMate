# Flask + SQL Database Example for CodeMate
# This shows how to use the SQL database with Flask applications

from flask import Flask, request, jsonify, render_template_string
import json
import asyncio

app = Flask(__name__)

# HTML template with SQL integration
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flask + SQL Database Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            margin-bottom: 20px;
        }
        h1, h2 { color: #fff; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, select, textarea {
            width: 100%;
            padding: 8px;
            border: none;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
        }
        button {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover { background: #45a049; }
        .users-list, .posts-list {
            background: rgba(0, 0, 0, 0.2);
            padding: 15px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .user-item, .post-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
            margin: 5px 0;
            border-radius: 3px;
            border-left: 4px solid #4CAF50;
        }
        .sql-query {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
        }
        .error { color: #ff6b6b; }
        .success { color: #51cf66; }
    </style>
</head>
<body>
    <h1>🐍 Flask + 🗄️ SQL Database Demo</h1>
    
    <!-- User Management -->
    <div class="container">
        <h2>👤 User Management</h2>
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="userName" placeholder="Enter user name">
        </div>
        <div class="form-group">
            <label>Email:</label>
            <input type="email" id="userEmail" placeholder="Enter email">
        </div>
        <button onclick="createUser()">Create User</button>
        <button onclick="loadUsers()">Refresh Users</button>
        
        <div id="users-list" class="users-list"></div>
    </div>
    
    <!-- Post Management -->
    <div class="container">
        <h2>📝 Post Management</h2>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" id="postTitle" placeholder="Enter post title">
        </div>
        <div class="form-group">
            <label>Content:</label>
            <textarea id="postContent" rows="4" placeholder="Enter post content"></textarea>
        </div>
        <div class="form-group">
            <label>Author:</label>
            <select id="postAuthor">
                <option value="">Select author...</option>
            </select>
        </div>
        <button onclick="createPost()">Create Post</button>
        <button onclick="loadPosts()">Refresh Posts</button>
        
        <div id="posts-list" class="posts-list"></div>
    </div>
    
    <!-- SQL Query Console -->
    <div class="container">
        <h2>🔍 SQL Query Console</h2>
        <div class="form-group">
            <label>SQL Query:</label>
            <textarea id="sqlQuery" rows="3" placeholder="Enter SQL query (e.g., SELECT * FROM users)"></textarea>
        </div>
        <button onclick="executeQuery()">Execute Query</button>
        <button onclick="showSampleQueries()">Sample Queries</button>
        
        <div id="query-result"></div>
    </div>
    
    <!-- Database Statistics -->
    <div class="container">
        <h2>📊 Database Statistics</h2>
        <button onclick="getStats()">Refresh Stats</button>
        <div id="stats-display"></div>
    </div>

    <script>
        // Initialize the page
        document.addEventListener('DOMContentLoaded', function() {
            initializeDatabase();
            loadUsers();
            loadPosts();
        });
        
        async function initializeDatabase() {
            try {
                const response = await fetch('/api/init-db', { method: 'POST' });
                const result = await response.json();
                console.log('Database initialized:', result);
            } catch (error) {
                console.error('Failed to initialize database:', error);
            }
        }
        
        async function createUser() {
            const name = document.getElementById('userName').value.trim();
            const email = document.getElementById('userEmail').value.trim();
            
            if (!name || !email) {
                alert('Please enter both name and email');
                return;
            }
            
            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email })
                });
                
                const result = await response.json();
                if (result.success) {
                    document.getElementById('userName').value = '';
                    document.getElementById('userEmail').value = '';
                    loadUsers();
                    loadUserSelect();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Failed to create user: ' + error.message);
            }
        }
        
        async function loadUsers() {
            try {
                const response = await fetch('/api/users');
                const users = await response.json();
                
                const usersList = document.getElementById('users-list');
                if (users.length === 0) {
                    usersList.innerHTML = '<p>No users found. Create some users first!</p>';
                } else {
                    usersList.innerHTML = users.map(user => 
                        `<div class="user-item">
                            <strong>${user.name}</strong> (${user.email})
                            <br><small>ID: ${user.id} | Joined: ${new Date(user.created_at).toLocaleDateString()}</small>
                        </div>`
                    ).join('');
                }
                
                loadUserSelect();
            } catch (error) {
                console.error('Failed to load users:', error);
            }
        }
        
        async function loadUserSelect() {
            try {
                const response = await fetch('/api/users');
                const users = await response.json();
                
                const select = document.getElementById('postAuthor');
                select.innerHTML = '<option value="">Select author...</option>' +
                    users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');
            } catch (error) {
                console.error('Failed to load user select:', error);
            }
        }
        
        async function createPost() {
            const title = document.getElementById('postTitle').value.trim();
            const content = document.getElementById('postContent').value.trim();
            const userId = document.getElementById('postAuthor').value;
            
            if (!title || !content || !userId) {
                alert('Please fill in all fields and select an author');
                return;
            }
            
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, user_id: parseInt(userId) })
                });
                
                const result = await response.json();
                if (result.success) {
                    document.getElementById('postTitle').value = '';
                    document.getElementById('postContent').value = '';
                    document.getElementById('postAuthor').value = '';
                    loadPosts();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Failed to create post: ' + error.message);
            }
        }
        
        async function loadPosts() {
            try {
                const response = await fetch('/api/posts');
                const posts = await response.json();
                
                const postsList = document.getElementById('posts-list');
                if (posts.length === 0) {
                    postsList.innerHTML = '<p>No posts found. Create some posts first!</p>';
                } else {
                    postsList.innerHTML = posts.map(post => 
                        `<div class="post-item">
                            <h3>${post.title}</h3>
                            <p>${post.content}</p>
                            <small>By: ${post.author_name} | Posted: ${new Date(post.created_at).toLocaleDateString()}</small>
                        </div>`
                    ).join('');
                }
            } catch (error) {
                console.error('Failed to load posts:', error);
            }
        }
        
        async function executeQuery() {
            const query = document.getElementById('sqlQuery').value.trim();
            if (!query) {
                alert('Please enter a SQL query');
                return;
            }
            
            try {
                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                
                const result = await response.json();
                const resultDiv = document.getElementById('query-result');
                
                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        let html = '<div class="sql-query">Query: ' + query + '</div>';
                        html += '<div class="success">✓ Query executed successfully</div>';
                        html += '<table style="width:100%; border-collapse: collapse; margin-top: 10px;">';
                        
                        // Headers
                        html += '<tr style="background: rgba(255,255,255,0.2);">';
                        result.columns.forEach(col => {
                            html += `<th style="padding: 8px; border: 1px solid rgba(255,255,255,0.3);">${col}</th>`;
                        });
                        html += '</tr>';
                        
                        // Data
                        result.data.forEach(row => {
                            html += '<tr>';
                            row.forEach(cell => {
                                html += `<td style="padding: 8px; border: 1px solid rgba(255,255,255,0.3);">${cell || 'NULL'}</td>`;
                            });
                            html += '</tr>';
                        });
                        
                        html += '</table>';
                        resultDiv.innerHTML = html;
                    } else {
                        resultDiv.innerHTML = 
                            '<div class="sql-query">Query: ' + query + '</div>' +
                            '<div class="success">✓ Query executed successfully (no results returned)</div>';
                    }
                } else {
                    resultDiv.innerHTML = 
                        '<div class="sql-query">Query: ' + query + '</div>' +
                        '<div class="error">❌ Error: ' + result.error + '</div>';
                }
            } catch (error) {
                document.getElementById('query-result').innerHTML = 
                    '<div class="error">❌ Failed to execute query: ' + error.message + '</div>';
            }
        }
        
        function showSampleQueries() {
            const samples = [
                'SELECT * FROM users;',
                'SELECT * FROM posts ORDER BY created_at DESC;',
                'SELECT u.name, COUNT(p.id) as post_count FROM users u LEFT JOIN posts p ON u.id = p.user_id GROUP BY u.id;',
                'SELECT p.title, p.content, u.name as author FROM posts p JOIN users u ON p.user_id = u.id;',
                'SELECT COUNT(*) as total_users FROM users;'
            ];
            
            document.getElementById('sqlQuery').value = samples[Math.floor(Math.random() * samples.length)];
        }
        
        async function getStats() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                document.getElementById('stats-display').innerHTML = 
                    `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px;">
                            <h3>👥 Users</h3>
                            <p style="font-size: 24px; margin: 5px 0;">${stats.user_count}</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px;">
                            <h3>📝 Posts</h3>
                            <p style="font-size: 24px; margin: 5px 0;">${stats.post_count}</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px;">
                            <h3>🗄️ Tables</h3>
                            <p style="font-size: 24px; margin: 5px 0;">${stats.table_count}</p>
                        </div>
                    </div>`;
            } catch (error) {
                console.error('Failed to get stats:', error);
            }
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/init-db', methods=['POST'])
def init_database():
    """Initialize the database with tables"""
    try:
        # Access the SQL database from CodeMate
        # Note: In CodeMate, sqlDb is available globally
        import js
        
        # Check if sqlDb is available
        if not hasattr(js, 'sqlDb') or not js.sqlDb:
            return jsonify({'success': False, 'error': 'SQL database not available in CodeMate'}), 500
        
        sql_db = js.sqlDb
        
        # Check if SQL database is ready
        if not sql_db.isReady:
            return jsonify({'success': False, 'error': 'SQL database not ready yet'}), 500
        
        # Create users table
        sql_db.exec('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create posts table
        sql_db.exec('''
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT,
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        return jsonify({'success': True, 'message': 'Database initialized successfully'})
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Database initialization error: {error_details}")
        return jsonify({'success': False, 'error': str(e), 'details': error_details}), 500

@app.route('/api/users', methods=['GET', 'POST'])
def handle_users():
    """Handle user operations"""
    try:
        import js
        
        # Check if sqlDb is available
        if not hasattr(js, 'sqlDb') or not js.sqlDb:
            return jsonify({'success': False, 'error': 'SQL database not available in CodeMate'}), 500
        
        sql_db = js.sqlDb
        
        # Check if SQL database is ready
        if not sql_db.isReady:
            return jsonify({'success': False, 'error': 'SQL database not ready yet'}), 500
        
        if request.method == 'POST':
            # Create new user
            print("Content-Type:", request.content_type)
            print("Request data:", request.data)
            
            if request.content_type != 'application/json':
                return jsonify({'success': False, 'error': 'Content-Type must be application/json'}), 415
            
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No JSON data received'}), 400
                
            name = data.get('name')
            email = data.get('email')
            
            if not name or not email:
                return jsonify({'success': False, 'error': 'Name and email are required'}), 400
            
            try:
                # Escape single quotes in the data
                safe_name = name.replace("'", "''")
                safe_email = email.replace("'", "''")
                
                sql_db.exec(f"INSERT INTO users (name, email) VALUES ('{safe_name}', '{safe_email}')")
                return jsonify({'success': True, 'message': 'User created successfully'})
            except Exception as e:
                return jsonify({'success': False, 'error': f'Database error: {str(e)}'}), 400
        
        else:
            # Get all users
            results = sql_db.query('SELECT * FROM users ORDER BY created_at DESC')
            users = []
            
            if results and len(results) > 0 and results[0].values:
                for row in results[0].values:
                    users.append({
                        'id': row[0],
                        'name': row[1],
                        'email': row[2],
                        'created_at': row[3]
                    })
            
            return jsonify(users)
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"User handling error: {error_details}")
        return jsonify({'success': False, 'error': str(e), 'details': error_details}), 500

@app.route('/api/posts', methods=['GET', 'POST'])
def handle_posts():
    """Handle post operations"""
    try:
        import js
        sql_db = js.sqlDb
        
        if request.method == 'POST':
            # Create new post
            data = request.get_json()
            title = data.get('title')
            content = data.get('content')
            user_id = data.get('user_id')
            
            if not title or not content or not user_id:
                return jsonify({'success': False, 'error': 'Title, content, and user_id are required'}), 400
            
            # Escape single quotes in the data
            safe_title = title.replace("'", "''")
            safe_content = content.replace("'", "''")
            
            sql_db.exec(f"INSERT INTO posts (title, content, user_id) VALUES ('{safe_title}', '{safe_content}', {user_id})")
            return jsonify({'success': True, 'message': 'Post created successfully'})
        
        else:
            # Get all posts with author names
            results = sql_db.query('''
                SELECT p.id, p.title, p.content, p.created_at, u.name as author_name
                FROM posts p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            ''')
            
            posts = []
            if results and len(results) > 0 and results[0].values:
                for row in results[0].values:
                    posts.append({
                        'id': row[0],
                        'title': row[1],
                        'content': row[2],
                        'created_at': row[3],
                        'author_name': row[4]
                    })
            
            return jsonify(posts)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
def execute_query():
    """Execute custom SQL query"""
    try:
        import js
        sql_db = js.sqlDb
        
        data = request.get_json()
        query = data.get('query', '').strip()
        
        if not query:
            return jsonify({'success': False, 'error': 'Query is required'}), 400
        
        # Execute the query
        results = sql_db.query(query)
        
        if results and len(results) > 0:
            result_data = {
                'success': True,
                'columns': results[0].columns if results[0].columns else [],
                'data': results[0].values if results[0].values else []
            }
        else:
            result_data = {
                'success': True,
                'columns': [],
                'data': []
            }
        
        return jsonify(result_data)
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get database statistics"""
    try:
        import js
        sql_db = js.sqlDb
        
        # Count users
        user_result = sql_db.query('SELECT COUNT(*) FROM users')
        user_count = user_result[0].values[0][0] if user_result and user_result[0].values else 0
        
        # Count posts
        post_result = sql_db.query('SELECT COUNT(*) FROM posts')
        post_count = post_result[0].values[0][0] if post_result and post_result[0].values else 0
        
        # Count tables
        table_result = sql_db.query("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = table_result[0].values[0][0] if table_result and table_result[0].values else 0
        
        return jsonify({
            'user_count': user_count,
            'post_count': post_count,
            'table_count': table_count
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Flask-lite compatibility - server run handled by browser environment
    pass
