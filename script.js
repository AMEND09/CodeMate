// Initialize Gun with the peer relay server
const gun = GUN(['https://gun-manhattan.herokuapp.com/gun']);

// Enhanced room ID handling for read-only mode
let roomId;
let isReadOnly = false;

// User management for collaboration
let currentUser = null;
let users = new Map(); // Store active users
let userColors = new Map(); // Store user colors
let availableColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#10AC84', '#EE5A24', '#0ABDE3', '#FFC312', '#C44569',
    '#F8B500', '#7D5BA6', '#20BF6B', '#FA8231', '#8395A7'
];
let usedColors = new Set();

function generateUserId() {
    // Create a more unique ID with timestamp + random
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

function assignUserColor(userId) {
    if (userColors.has(userId)) {
        return userColors.get(userId);
    }
    
    // Find an unused color
    let color;
    if (usedColors.size < availableColors.length) {
        do {
            color = availableColors[Math.floor(Math.random() * availableColors.length)];
        } while (usedColors.has(color));
    } else {
        // If all colors are used, pick a random one
        color = availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    usedColors.add(color);
    userColors.set(userId, color);
    return color;
}

function initializeUser() {
    // Always generate a new user ID for each session to avoid conflicts
    const userId = generateUserId();
    localStorage.setItem('CodeMate-user-id', userId);
    
    const username = localStorage.getItem('CodeMate-username');
    if (!username) {
        // Show username modal
        showUsernameModal();
        return false;
    }
    
    currentUser = {
        id: userId,
        name: username,
        color: assignUserColor(userId),
        joinTime: Date.now(),
        activeFile: null
    };
    
    setupUserSync();
    return true;
}

function showUsernameModal() {
    const modal = document.getElementById('username-modal');
    modal.style.display = 'block';
    
    // Focus on input when modal opens
    setTimeout(() => {
        document.getElementById('username-input').focus();
    }, 100);
}

function setUsername() {
    const usernameInput = document.getElementById('username-input');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a valid username');
        usernameInput.focus();
        return;
    }
    
    if (username.length > 30) {
        alert('Username must be 30 characters or less');
        usernameInput.focus();
        return;
    }
    
    // Store username
    localStorage.setItem('CodeMate-username', username);
    
    // Create new user with fresh ID for this session
    const userId = generateUserId();
    currentUser = {
        id: userId,
        name: username,
        color: assignUserColor(userId),
        joinTime: Date.now(),
        activeFile: null
    };
    
    // Hide modal
    document.getElementById('username-modal').style.display = 'none';
    
    // Setup user sync
    setupUserSync();
    
    // Initialize the rest of the app
    initializeApp();
}

function setupUserSync() {
    if (!currentUser) return;
      // Add current user to local users map immediately
    users.set(currentUser.id, currentUser);
    console.log('Setting up user sync for:', currentUser.name, 'ID:', currentUser.id);
    console.log('Room ID:', roomId);
    updateActiveUsers();

    const usersRef = gun.get('CodeMate').get(roomId).get('users');
    const userRef = usersRef.get(currentUser.id);
    
    // Sync current user to Gun
    console.log('Syncing user to Gun:', currentUser);
    userRef.put(currentUser);
    
    // Listen for user changes
    usersRef.map().on((userData, userId) => {
        console.log('Gun user change:', userId, userData);
        if (userData && userId && userId !== '_' && userData.name && userData.id) {
            console.log('Adding user to local map:', userId, userData.name);
            users.set(userId, userData);
            updateActiveUsers();
            updateFileEditors();
        } else if ((userData === null || !userData || !userData.name) && userId && userId !== '_') {
            console.log('Removing user from local map:', userId);
            users.delete(userId);
            updateActiveUsers();
            updateFileEditors();
        }
    });
    
    // Clean up when user leaves
    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            usersRef.get(currentUser.id).put(null);
        }
    });
    
    // Periodic heartbeat to show user is active
    setInterval(() => {
        if (currentUser) {
            currentUser.lastActive = Date.now();
            userRef.put(currentUser);
        }
    }, 5000);
    
    // Clean up inactive users
    setInterval(() => {
        const now = Date.now();
        users.forEach((user, userId) => {
            if (user.lastActive && now - user.lastActive > 15000) { // 15 seconds
                users.delete(userId);
                updateActiveUsers();
                updateFileEditors();
            }
        });
    }, 10000);
}

function updateActiveUsers() {
    const usersList = document.getElementById('users-list');
    // Include ALL users (including current user) for the display
    const usersArray = Array.from(users.entries()).filter(([userId, user]) => userId !== '_' && user.name);
    
    console.log('updateActiveUsers called. Total users in map:', users.size);
    console.log('Filtered users array:', usersArray.map(([id, user]) => `${id}: ${user.name}`));
    
    usersList.innerHTML = '';
    
    if (usersArray.length === 0) {
        usersList.innerHTML = '<div class="users-summary">No users online</div>';
        return;
    }
    
    // Create users dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'users-dropdown-container';
    
    // Create the clickable summary
    const summary = document.createElement('div');
    summary.className = 'users-summary';
    summary.innerHTML = `${usersArray.length} user${usersArray.length > 1 ? 's' : ''} online ▼`;
    
    // Create the dropdown content
    const dropdown = document.createElement('div');
    dropdown.className = 'users-dropdown-content hidden';
    
    usersArray.forEach(([userId, user]) => {
        const userItem = document.createElement('div');
        userItem.className = 'user-dropdown-item';
        
        // Mark current user
        const isCurrentUser = userId === currentUser?.id;
        const userStatus = isCurrentUser 
            ? (user.activeFile ? `editing ${user.activeFile}` : 'You')
            : (user.activeFile ? `editing ${user.activeFile}` : 'idle');
        
        userItem.innerHTML = `
            <div class="user-avatar" style="background-color: ${user.color || '#666'}">
                ${user.name.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <div class="user-name">${user.name}${isCurrentUser ? ' (You)' : ''}</div>
                <div class="user-status">${userStatus}</div>
            </div>
        `;
        dropdown.appendChild(userItem);
    });
    
    // Toggle dropdown on click
    summary.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        summary.innerHTML = dropdown.classList.contains('hidden') 
            ? `${usersArray.length} user${usersArray.length > 1 ? 's' : ''} online ▼`
            : `${usersArray.length} user${usersArray.length > 1 ? 's' : ''} online ▲`;
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            summary.innerHTML = `${usersArray.length} user${usersArray.length > 1 ? 's' : ''} online ▼`;
        }
    });
    
    dropdownContainer.appendChild(summary);
    dropdownContainer.appendChild(dropdown);
    usersList.appendChild(dropdownContainer);
    
    console.log('Updated users list:', usersArray.length, 'users');
}

function updateFileEditors() {
    console.log('Updating file editors, users:', users.size);
    console.log('Current users:', Array.from(users.entries()));
    
    document.querySelectorAll('.file-item').forEach(fileItem => {
        const filename = fileItem.dataset.filename;
        if (!filename) {
            console.log('File item missing filename dataset');
            return;
        }
        
        // Remove any existing editor dots
        const existingDots = fileItem.querySelectorAll('.editor-dot');
        existingDots.forEach(dot => dot.remove());
        
        // Find users editing this file
        let editorsCount = 0;
        users.forEach((user, userId) => {
            if (user && user.activeFile === filename && userId !== currentUser?.id && user.name) {
                console.log(`User ${user.name} is editing ${filename}`);
                
                // Create a simple colored dot
                const editorDot = document.createElement('div');
                editorDot.className = 'editor-dot';
                editorDot.style.backgroundColor = user.color || '#999';
                editorDot.title = `${user.name} is editing this file`;
                
                // Insert the dot before the file actions
                const fileActions = fileItem.querySelector('.file-actions');
                if (fileActions) {
                    fileItem.insertBefore(editorDot, fileActions);
                } else {
                    fileItem.appendChild(editorDot);
                }
                
                editorsCount++;
            }
        });
        
        console.log(`File ${filename} has ${editorsCount} editors`);
    });
}

// Add a manual trigger for debugging
window.debugFileEditors = function() {
    console.log('=== DEBUG FILE EDITORS ===');
    console.log('Users:', users);
    console.log('Current user:', currentUser);
    console.log('File items:', document.querySelectorAll('.file-item').length);
    updateFileEditors();
};

function updateUserActiveFile(filename) {
    if (currentUser) {
        console.log('Updating user active file:', filename, 'for user:', currentUser.name);
        currentUser.activeFile = filename;
        currentUser.lastActive = Date.now();
        
        // Update local users map
        users.set(currentUser.id, currentUser);
        
        const userRef = gun.get('CodeMate').get(roomId).get('users').get(currentUser.id);
        userRef.put(currentUser);
        
        // Update UI immediately
        updateActiveUsers();
        setTimeout(() => updateFileEditors(), 100);
    }
}

function initializeApp() {
    // This will be called after username is set or for read-only mode
    renderFileTree();
    renderTabs();
    updateEditor();
    initializePanelResizing();
    
    // Initialize database
    initializeDatabase();
    
    console.log('App initialized with user:', currentUser);
}

// Handle username input on Enter key
document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username-input');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                setUsername();
            }
        });
    }
});

// Make setUsername globally available
window.setUsername = setUsername;

// Initialize room
initializeRoomWithViewMode();

// Initialize user after room is set up
if (!isReadOnly) {
    // Only initialize user for collaborative mode
    if (!initializeUser()) {
        // User modal is shown, initialization will continue after username is set
    }
} else {
    // For read-only mode, initialize app directly
    initializeApp();
}

// File system and state management
let files = {
    'index.html': {
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style.css">
    <title>My Flask App</title>
</head>
<body>
    <h1>{{ msg }}</h1>
    <button>Get Random Number</button>
    <p></p>

    <script>
        const button = document.querySelector('button')
        const p = document.querySelector('p')
        button.addEventListener('click', (e) => {
            fetch('/api/').then(res => res.json())
            .then(data => p.textContent = data.value)
        })
    </script>
</body>
</html>`,
        type: 'html'
    },
    'style.css': {
        content: `body {
    font-family: sans-serif;
    margin: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    min-height: 100vh;
}

h1 {
    font-size: 2.5em;
    margin-bottom: 30px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

button {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 15px 30px;
    font-size: 16px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s;
    margin-bottom: 20px;
}

button:hover {
    background: #45a049;
}

p {
    font-size: 1.2em;
    padding: 20px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    backdrop-filter: blur(10px);
    min-height: 50px;
}`,
        type: 'css'
    },
    'script.js': {
        content: `console.log('Flask app loaded!');

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        document.getElementById('data-display').innerHTML = \`
            <h3>Server Response:</h3>
            <pre>\${JSON.stringify(data, null, 2)}</pre>
        \`;
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('data-display').innerHTML = \`
            <h3>Error:</h3>
            <p>Could not fetch data from server.</p>
        \`;
    }
}

// Add some interactivity
document.addEventListener('DOMContentLoaded', function() {
    const h1 = document.querySelector('h1');
    if (h1) {
        h1.addEventListener('click', function() {
            this.style.transform = this.style.transform === 'scale(1.1)' ? 'scale(1)' : 'scale(1.1)';
            this.style.transition = 'transform 0.3s ease';
        });
    }
});`,
        type: 'js'
    },
    'app.py': {
        content: `from flask import Flask, render_template, jsonify
import random

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html", msg="Hello, World!")

@app.route("/api/")
def api():
    return jsonify({'value': random.random()})

if __name__ == '__main__':
    # Flask-lite compatibility - server run handled by browser environment
    pass`,
        type: 'python'
    },
    'requirements.txt': {
        content: `Flask==2.3.3
Flask-CORS==4.0.0
Werkzeug==2.3.7`,
        type: 'txt'
    },
    'database_example.js': {
        content: `// CodeMate Database Example
// The database is available as 'db' and is shared across all users

async function databaseDemo() {
    console.log('=== CodeMate Database Demo ===');
    
    // Store some data
    await db.set('username', 'Alice');
    await db.set('age', 25);
    await db.set('settings', { theme: 'dark', notifications: true });
    
    // Retrieve data
    const name = await db.get('username');
    const age = await db.get('age');
    const settings = await db.get('settings');
    
    console.log('Name:', name);
    console.log('Age:', age);
    console.log('Settings:', settings);
    
    // Work with arrays
    await db.set('todos', []); // Initialize empty array
    await db.push('todos', 'Buy groceries');
    await db.push('todos', 'Walk the dog');
    await db.push('todos', 'Finish project');
    
    const todos = await db.get('todos');
    console.log('Todo list:', todos);
    
    // Increment a counter
    await db.set('views', 0);
    await db.increment('views');
    await db.increment('views', 5);
    
    const views = await db.get('views');
    console.log('Page views:', views);
    
    // List all data
    const allData = await db.list();
    console.log('All database data:', allData);
    
    // Watch for changes (real-time)
    db.watch('username', (newValue, key) => {
        console.log(\`User \${key} changed to: \${newValue}\`);
    });
    
    console.log('Database demo complete! Try changing values from another browser tab.');
}

// Run the demo
databaseDemo().catch(console.error);

// You can also use these commands in the terminal:
// db set message "Hello from the database!"
// db get message
// db list
// db help`,
        type: 'js'
    },
    'database_example.py': {
        content: `# CodeMate Database Example (Python)
# The database is available as 'db' and is shared across all users

import asyncio
import json

async def database_demo():
    print('=== CodeMate Database Demo (Python) ===')
    
    # Store some data
    await db.set('python_user', 'Bob')
    await db.set('python_score', 100)
    await db.set('python_config', {'language': 'python', 'version': '3.11'})
    
    # Retrieve data
    name = await db.get('python_user')
    score = await db.get('python_score')
    config = await db.get('python_config')
    
    print(f'Python User: {name}')
    print(f'Score: {score}')
    print(f'Config: {config}')
    
    # Work with arrays
    await db.set('python_tasks', [])  # Initialize empty array
    await db.push('python_tasks', 'Learn async/await')
    await db.push('python_tasks', 'Build a web app')
    await db.push('python_tasks', 'Deploy to production')
    
    tasks = await db.get('python_tasks')
    print(f'Python tasks: {tasks}')
    
    # Increment a counter
    await db.increment('python_downloads', 10)
    downloads = await db.get('python_downloads')
    print(f'Downloads: {downloads}')
    
    # List all data
    all_data = await db.list()
    print(f'All database data: {all_data}')
    
    print('Python database demo complete!')

# Run the demo
asyncio.create_task(database_demo())

# You can also use these commands in the terminal:
# db set py_message "Hello from Python!"
# db get py_message
# db list`,
        type: 'python'
    }
};

let currentFile = 'index.html';
let activeFiles = new Set(['index.html']);
let codeMirrorInstance = null;

// Get Gun references for file system
const filesDoc = gun.get('CodeMate').get(roomId).get('files');

// Pyodide setup
let pyodide = null;
let pyodideReady = false;
let flaskProcess = null;

async function initializePyodide() {
    try {
        const statusEl = document.getElementById('python-status');
        statusEl.textContent = 'Python Loading...';
        statusEl.className = 'python-status loading';
        
        pyodide = await loadPyodide();
        
        // Install Flask and other packages
        await pyodide.loadPackage(['micropip']);
        
        // Install packages using micropip in async context
        await pyodide.runPythonAsync(`
import micropip
await micropip.install(['flask', 'flask-cors'])
        `);
        
        // Redirect Python output to console
        pyodide.runPython(`
import sys
import io
from js import addToConsole

class JSConsole:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text.strip():
            addToConsole(text.strip(), 'log')
    
    def flush(self):
        pass

# Replace stdout and stderr
sys.stdout = JSConsole()
sys.stderr = JSConsole()
        `);
        
        pyodideReady = true;
        statusEl.textContent = 'Python Ready';
        statusEl.className = 'python-status ready';
        
        // Set up Python database if available
        if (db) {
            setupPythonDatabase();
        }
        
        console.log('Pyodide loaded successfully with Flask support');
    } catch (error) {
        console.error('Failed to load Pyodide:', error);
        const statusEl = document.getElementById('python-status');
        statusEl.textContent = 'Python Error';
        statusEl.className = 'python-status loading';
    }
}

// Initialize Pyodide
initializePyodide();

// Set up real-time collaboration for files - using exact pattern from your example
function setupFileSync() {
    Object.keys(files).forEach(filename => {
        setupFileSyncForFile(filename);
        // Sync initial content to Gun
        syncFileToGun(filename);
    });
}

// Set up GunJS sync for a specific file
function setupFileSyncForFile(filename) {
    console.log('Setting up GunJS sync for file:', filename);
    const fileRef = gun.get('CodeMate').get(roomId).get(filename);
    
    // Listen for changes - exactly like your example: note.on((data) => { view.value = data });
    fileRef.on((data) => {
        if (data && typeof data === 'string') {
            console.log('GunJS file received:', filename, 'Content length:', data.length);
            
            // Update local file if content is different
            if (files[filename] && files[filename].content !== data) {
                console.log('Updating local file content from Gun:', filename);
                files[filename].content = data;
                
                // Update editor if this file is currently open
                if (currentFile === filename && codeMirrorInstance) {
                    const cursorPos = codeMirrorInstance.getCursor();
                    codeMirrorInstance.setValue(data);
                    codeMirrorInstance.setCursor(cursorPos);
                }
                
                renderFileTree();
            }
        }
    });
}

setupFileSync();

// Also check for files that exist in Gun but not locally
function discoverFilesFromGun() {
    console.log('Starting file discovery from Gun...');
    const roomRef = gun.get('CodeMate').get(roomId);
    
    // Listen for any new files in the room
    roomRef.on((data) => {
        if (data && typeof data === 'object') {
            console.log('Gun room data received:', Object.keys(data));
            Object.keys(data).forEach(key => {
                // Skip special Gun properties
                if (key.startsWith('_') || key === 'files') return;
                
                // If this is a file we don't have locally, add it
                if (!files[key] && typeof data[key] === 'string') {
                    console.log('Discovered new file from Gun:', key);
                    
                    // Determine file type from extension
                    const extension = key.split('.').pop().toLowerCase();
                    const typeMap = {
                        'html': 'html',
                        'css': 'css',
                        'js': 'js',
                        'py': 'python',
                        'txt': 'txt',
                        'json': 'json',
                        'md': 'md'
                    };
                    
                    files[key] = {
                        content: data[key],
                        type: typeMap[extension] || 'txt'
                    };
                    
                    // Set up sync for this file
                    setupFileSyncForFile(key);
                    
                    // Update UI
                    renderFileTree();
                }
            });
        }
    });
}

discoverFilesFromGun();

// Sync file changes to Gun - exactly like your example: view.oninput = () => { note.put(view.value) };
function syncFileToGun(filename) {
    if (files[filename]) {
        console.log('Syncing file to Gun:', filename, 'Content length:', files[filename].content.length);
        const fileRef = gun.get('CodeMate').get(roomId).get(filename);
        fileRef.put(files[filename].content); // Store just the content string, not the object
        console.log('File sync completed for:', filename);
    } else {
        console.warn('Attempted to sync non-existent file:', filename);
    }
}

// File management functions
function getFileIcon(type) {
    const icons = {
        'html': '📄',
        'css': '🎨',
        'js': '📜',
        'python': '🐍',
        'txt': '📝',
        'json': '📋',
        'md': '📖'
    };
    return icons[type] || '📄';
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'js': 'js',
        'py': 'python',
        'txt': 'txt',
        'json': 'json',
        'md': 'md'
    };
    return typeMap[ext] || 'txt';
}

function renderFileTree() {
    const fileTree = document.getElementById('file-tree');
    fileTree.innerHTML = '';
    
    Object.keys(files).forEach(filename => {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${currentFile === filename ? 'active' : ''}`;
        fileItem.dataset.filename = filename; // Store filename in dataset
        fileItem.innerHTML = `
            <span class="file-icon">${getFileIcon(files[filename].type)}</span>
            <span class="file-name">${filename}</span>
            <div class="file-actions">
                <button class="file-action" onclick="renameFile('${filename}')" title="Rename">✏️</button>
                <button class="file-action" onclick="deleteFile('${filename}')" title="Delete">🗑️</button>
            </div>
        `;
        
        fileItem.addEventListener('click', () => openFile(filename));
        fileTree.appendChild(fileItem);
    });
    
    // Update file editing indicators after rendering
    updateFileEditors();
}

function openFile(filename) {
    currentFile = filename;
    activeFiles.add(filename);
    updateEditor();
    renderTabs();
    renderFileTree();
    
    // Update user active file in Gun
    updateUserActiveFile(filename);
}

function closeFile(filename) {
    activeFiles.delete(filename);
    if (currentFile === filename) {
        const remaining = Array.from(activeFiles);
        currentFile = remaining.length > 0 ? remaining[0] : null;
    }
    renderTabs();
    if (currentFile) {
        updateEditor();
    }
}

function renderTabs() {
    const tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    
    activeFiles.forEach(filename => {
        const tab = document.createElement('div');
        tab.className = `tab ${currentFile === filename ? 'active' : ''}`;
        tab.innerHTML = `
            <span class="file-icon">${getFileIcon(files[filename].type)}</span>
            <span>${filename}</span>
            <span class="tab-close" onclick="closeFile('${filename}')">&times;</span>
        `;
        
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                openFile(filename);
            }
        });
        
        tabs.appendChild(tab);
    });
}

function updateEditor() {
    if (currentFile && files[currentFile]) {
        // Initialize CodeMirror if not already done
        if (!codeMirrorInstance) {
            initializeCodeMirror();
        }
        
        // Get file type for syntax highlighting
        const fileType = files[currentFile].type;
        const mode = getCodeMirrorMode(fileType);
        
        // Update CodeMirror content and mode
        codeMirrorInstance.setValue(files[currentFile].content);
        codeMirrorInstance.setOption('mode', mode);
        
        // Update placeholder based on file type
        const placeholders = {
            'html': 'Write your HTML here...',
            'css': 'Write your CSS here...',
            'js': 'Write your JavaScript here...',
            'python': 'Write your Python code here...',
            'txt': 'Write your text here...',
            'json': 'Write your JSON here...',
            'md': 'Write your Markdown here...'
        };
        
        const placeholder = placeholders[fileType] || 'Write your code here...';
        codeMirrorInstance.setOption('placeholder', placeholder);
        
        // Refresh the editor
        setTimeout(() => {
            codeMirrorInstance.refresh();
            codeMirrorInstance.focus();
            
            // Apply read-only mode if needed
            if (isReadOnly) {
                codeMirrorInstance.setOption('readOnly', true);
                codeMirrorInstance.setOption('cursorBlinkRate', -1); // Hide cursor
            }
        }, 100);
    }
}

function getCodeMirrorMode(fileType) {
    const modeMap = {
        'html': 'htmlmixed',
        'css': 'css',
        'js': 'javascript',
        'python': 'python',
        'json': {name: 'javascript', json: true},
        'md': 'markdown',
        'txt': 'text/plain'
    };
    return modeMap[fileType] || 'text/plain';
}

function initializeCodeMirror() {
    const textarea = document.getElementById('code-editor');
    
    codeMirrorInstance = CodeMirror.fromTextArea(textarea, {
        lineNumbers: true,
        theme: 'monokai',
        indentUnit: 4,
        lineWrapping: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        scrollbarStyle: 'native',
        viewportMargin: 50,
        extraKeys: {
            'Ctrl-Space': 'autocomplete',
            'Tab': function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection('add');
                } else {
                    cm.replaceSelection('    ');
                }
            }
        }
    });
    
    // Set up change listener with debouncing for better collaboration
    let syncTimeout = null;
    codeMirrorInstance.on('change', function(cm, changeObj) {
        if (currentFile && files[currentFile]) {
            const content = codeMirrorInstance.getValue();
            files[currentFile].content = content;
            
            // Debounce sync to avoid too many network requests
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                syncFileToGun(currentFile);
                
                // Update user active file in Gun
                updateUserActiveFile(currentFile);
            }, 300); // Reduced from 500ms to 300ms for better responsiveness
        }
    });
    
    // Set initial size and refresh
    codeMirrorInstance.setSize('100%', '100%');
    
    // Force refresh after a short delay to ensure proper rendering
    setTimeout(() => {
        codeMirrorInstance.refresh();
    }, 100);
}

// Editor event handling
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI immediately
    renderFileTree();
    renderTabs();
    updateEditor();
    
    // Initialize panel resizing
    initializePanelResizing();
    
    console.log('DOMContentLoaded - UI initialized');
});

// New file functionality
function showNewFileModal() {
    if (isReadOnly) {
        addToConsole('Cannot create files in read-only mode', 'error');
        return;
    }
    document.getElementById('new-file-modal').style.display = 'block';
}

function hideNewFileModal() {
    document.getElementById('new-file-modal').style.display = 'none';
    document.getElementById('new-file-name').value = '';
    document.getElementById('new-file-type').value = 'html';
}

function createNewFile() {
    const name = document.getElementById('new-file-name').value.trim();
    const type = document.getElementById('new-file-type').value;
    
    if (!name) {
        alert('Please enter a file name');
        return;
    }
    
    if (files[name]) {
        alert('File already exists');
        return;
    }
    
    const templates = {
        'html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>New Page</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>',
        'css': '/* Add your styles here */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
        'js': '// Add your JavaScript here\nconsole.log("Hello from JavaScript!");',
        'python': '# Add your Python code here\nprint("Hello from Python!")',
        'txt': '',
        'json': '{\n    "name": "example",\n    "value": "data"\n}',
        'md': '# New Document\n\nWrite your markdown here...'
    };
    
    files[name] = {
        content: templates[type] || '',
        type: type
    };
    
    // Set up GunJS sync for the new file using the centralized function
    setupFileSyncForFile(name);
    
    // Sync the initial content to Gun
    syncFileToGun(name);
    openFile(name);
    hideNewFileModal();
}

function deleteFile(filename) {
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        delete files[filename];
        console.log('Deleting file from Gun:', filename);
        const fileRef = gun.get('CodeMate').get(roomId).get(filename);
        fileRef.put(null);
        
        if (currentFile === filename) {
            closeFile(filename);
        }
        
        renderFileTree();
    }
}

function renameFile(oldName) {
    const newName = prompt('Enter new file name:', oldName);
    if (newName && newName !== oldName && !files[newName]) {
        files[newName] = files[oldName];
        delete files[oldName];
        
        console.log('Renaming file in Gun:', oldName, '->', newName);
        const oldFileRef = gun.get('CodeMate').get(roomId).get(oldName);
        oldFileRef.put(null);
        
        // Set up listener for new file using centralized function
        setupFileSyncForFile(newName);
        
        syncFileToGun(newName);
        
        if (currentFile === oldName) {
            currentFile = newName;
        }
        
        if (activeFiles.has(oldName)) {
            activeFiles.delete(oldName);
            activeFiles.add(newName);
        }
        
        renderFileTree();
        renderTabs();
    }
}

// Code execution functions
function runCode() {
    if (isReadOnly) {
        addToTerminal('Cannot run code in read-only mode', 'error');
        return;
    }
    
    const fileType = currentFile ? files[currentFile].type : 'html';
    
    if (fileType === 'python') {
        runPythonCode();
    } else {
        runWebCode();
    }
}

function runWebCode() {
    const htmlFile = files['main.html'] || files[Object.keys(files).find(f => files[f].type === 'html')];
    const cssFile = files['style.css'] || files[Object.keys(files).find(f => files[f].type === 'css')];
    const jsFile = files['script.js'] || files[Object.keys(files).find(f => files[f].type === 'js')];
    
    if (!htmlFile) {
        addToConsole('No HTML file found to run', 'warn');
        return;
    }
    
    let html = htmlFile.content;
    const css = cssFile ? cssFile.content : '';
    const js = jsFile ? jsFile.content : '';
    
    const fullHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <style>${css}</style>
        </head>
        <body>
            ${html.replace(/<!DOCTYPE html>.*?<body[^>]*>/is, '').replace(/<\/body>.*?<\/html>/is, '')}
            <script>
                // Override console methods to send to parent
                const originalConsole = {
                    log: console.log,
                    error: console.error,
                    warn: console.warn,
                    info: console.info
                };
                
                ['log', 'error', 'warn', 'info'].forEach(method => {
                    console[method] = function(...args) {
                        originalConsole[method].apply(console, args);
                        parent.postMessage({
                            type: 'console',
                            method: method,
                            args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
                        }, '*');
                    };
                });
                
                // Override error handling
                window.onerror = function(message, source, lineno, colno, error) {
                    parent.postMessage({
                        type: 'console',
                        method: 'error',
                        args: [message + ' (Line ' + lineno + ')']
                    }, '*');
                };
                
                try {
                    ${js}
                } catch (error) {
                    console.error('JavaScript Error:', error.message);
                }
            </script>
        </body>
        </html>
    `;
    
    const iframe = document.getElementById('preview-frame');
    iframe.srcdoc = fullHTML;
    
    // Switch to preview tab
    switchOutputTab('preview');
}

async function runPythonCode() {
    if (!pyodideReady) {
        addToConsole('Python is still loading. Please wait...', 'warn');
        return;
    }
    
    const code = currentFile ? files[currentFile].content : '';
    if (!code.trim()) {
        addToConsole('No Python code to run', 'warn');
        return;
    }
    
    // Switch to console tab
    switchOutputTab('console');
    
    addToConsole('Running Python code...', 'info');
    
    try {
        // Run the Python code
        pyodide.runPython(code);
        addToConsole('Python code executed successfully', 'info');
    } catch (error) {
        addToConsole('Python Error: ' + error.message, 'error');
    }
}

// Flask-lite implementation based on Sippy-Cup
let flaskApp = null;
let pyodideStartResponse = null;

// Flask-lite CSS handler - exact Sippy-Cup implementation
function getCss() {
    try {
        pyodide.runPython(`
with open("templates/style.css", "r") as file:
    css = file.readlines()    
        `);
        let css = pyodide.globals.get("css").toJs();
        return css.join('');
    } catch (error) {
        console.log('No CSS file found or error reading CSS');
        return '';
    }
}

// Flask-lite request handler using exact Sippy-Cup approach
function handleRequest(requestMethod = "GET", route = "/") {
    if (!flaskApp || !pyodideStartResponse) {
        return {
            value: {
                body: new TextEncoder().encode("Flask app not initialized"),
                headers: {'Content-Type': 'text/plain'},
                status: 503
            }
        };
    }

    try {
        const environ = {
            'wsgi.url_scheme': 'http',
            'REQUEST_METHOD': requestMethod,
            'PATH_INFO': route
        };
        
        let r = flaskApp(pyodide.toPy(environ), pyodideStartResponse).toJs();
        let response = r.__next__();
        console.log('response before converting to string', response);
        
        response = response.toString();
        response = response.slice(2, response.length - 1);
        
        // Clean up the response by removing escaped newlines and fixing formatting
        response = response.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
        
        // Inject CSS and trim whitespace
        response = response.replace(`<link rel="stylesheet" href="style.css">`, `<style>${getCss()}</style>`);
        response = response.trim();
        
        const textEncoder = new TextEncoder();
        console.log(response);
        console.log('sippycup response: ', textEncoder.encode(response));
        
        // Get headers and status from Python globals
        const headers = pyodide.globals.get('headers').toJs();
        const requestStatus = pyodide.globals.get('requestStatus');
        
        // Extract numeric status code (Flask returns "200 OK" format)
        const statusCode = parseInt(requestStatus.toString().split(' ')[0]) || 200;
        
        console.log('Raw requestStatus:', requestStatus);
        console.log('Parsed statusCode:', statusCode);
        
        return {
            value: {
                body: textEncoder.encode(response),
                headers: headers,
                status: statusCode
            },
            stdout: `127.0.0.1 - - [${logDate()}] "${requestMethod} ${route} HTTP/1.1" ${statusCode} -\n`
        };
    } catch (error) {
        console.error('Flask request error:', error);
        return {
            value: {
                body: new TextEncoder().encode(`Internal Server Error: ${error.message}`),
                headers: {'Content-Type': 'text/plain'},
                status: 500
            }
        };
    }
}

function logDate() {
    const logDateFormat = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let now = new Date();
    let dateParts = {};
    logDateFormat.formatToParts(now).map(x => dateParts[x.type] = x.value);
    return `${dateParts.day}/${dateParts.month}/${dateParts.year} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
}

async function runFlaskApp() {
    if (isReadOnly) {
        addToTerminal('Cannot run Flask app in read-only mode', 'error');
        return;
    }
    
    if (!pyodideReady) {
        addToTerminal('Python is still loading. Please wait...', 'warn');
        return;
    }
    
    const appFile = files['app.py'];
    if (!appFile) {
        addToTerminal('No app.py file found. Please create a Flask application file.', 'warn');
        return;
    }
    
    // Switch to terminal tab
    switchOutputTab('terminal');
    
    addToTerminal('Starting Flask-lite application...', 'info');
    
    try {
        // Set up Flask-lite environment - exact SippyCup approach
        pyodide.runPython(`
import os
try:
    os.mkdir('templates')
except FileExistsError:
    pass
        `);
        
        // Load Flask package
        await pyodide.loadPackage("micropip");
        const micropip = pyodide.pyimport("micropip");
        await micropip.install('flask');
        
        // Write template files to Pyodide filesystem - exact SippyCup approach
        const htmlFiles = Object.keys(files).filter(name => name.endsWith('.html'));
        for (const filename of htmlFiles) {
            const content = files[filename].content;
            pyodide.runPython(`
with open("templates/${filename}", "w") as file:
    file.write("""${content}""")
            `);
        }

        // Write CSS files - exact SippyCup approach
        const cssFiles = Object.keys(files).filter(name => name.endsWith('.css'));
        for (const filename of cssFiles) {
            const content = files[filename].content;
            pyodide.runPython(`
with open("templates/${filename}", "w") as file:
    file.write("""${content}""")
            `);
        }

        // Set up start_response function - exact SippyCup approach
        pyodide.runPython(`
# Initialize global variables
headers = {}
requestStatus = '200 OK'

def start_response(status, responseHeaders, exc_info=None):   
    global requestStatus, headers
    requestStatus = status
    headersObject = {}
    for key, value in responseHeaders:
        headersObject[key] = value
    headers = headersObject
        `);

        // Execute the Flask app code - exact SippyCup approach
        pyodide.runPython(appFile.content);
        
        // Get the Flask app and start_response function
        flaskApp = pyodide.globals.get('app');
        pyodideStartResponse = pyodide.globals.get('start_response');
        
        // Set up simple preview like SippyCup
        setupSimpleFlaskPreview();
        
        addToTerminal('', 'log');
        addToTerminal('=== Flask-lite Development Server ===', 'info');
        addToTerminal(' * Serving Flask app \'app\'', 'info');
        addToTerminal(' * Running on http://127.0.0.1:5000', 'info');
        addToTerminal('', 'log');
        addToTerminal('View your Flask-lite app in the Preview tab!', 'info');
        
        // Switch to preview tab to show the Flask app
        switchOutputTab('preview');
        
    } catch (error) {
        addToTerminal('Flask-lite Error: ' + error.message, 'error');
        console.error('Flask-lite startup error:', error);
    }
}

// Simple Flask preview setup like SippyCup
function setupSimpleFlaskPreview() {
    // Make a request to the root route to get the initial page
    const response = handleRequest('GET', '/');
    const responseData = new TextDecoder().decode(response.value.body);
    
    // Create a modified HTML that includes fetch monkey-patching for API calls
    const modifiedHTML = responseData.replace(
        '<script>',
        `<script>
            // Monkey-patch fetch to handle API calls
            const originalFetch = window.fetch;
            window.fetch = async function(url, options = {}) {
                if (url.startsWith('/api/') || url.startsWith('/')) {
                    // Send message to parent to handle Flask request
                    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
                    
                    return new Promise((resolve, reject) => {
                        const messageHandler = (event) => {
                            if (event.data.type === 'flask-response' && event.data.requestId === requestId) {
                                window.removeEventListener('message', messageHandler);
                                
                                // Create Response object
                                const response = new Response(event.data.data, {
                                    status: event.data.status,
                                    headers: event.data.headers
                                });
                                resolve(response);
                            }
                        };
                        
                        window.addEventListener('message', messageHandler);
                        
                        // Send request to parent
                        parent.postMessage({
                            type: 'flask-request',
                            requestId: requestId,
                            path: url,
                            method: options.method || 'GET'
                        }, '*');
                        
                        // Timeout after 5 seconds
                        setTimeout(() => {
                            window.removeEventListener('message', messageHandler);
                            reject(new Error('Request timeout'));
                        }, 5000);
                    });
                }
                
                return originalFetch(url, options);
            };
        `
    );
    
    // Display the response in the preview iframe
    const previewFrame = document.getElementById('preview-frame');
    previewFrame.srcdoc = modifiedHTML;
    
    // Set up message listener for API requests
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'flask-request') {
            try {
                const { path, method, requestId } = event.data;
                console.log('Handling Flask request:', method, path);
                
                const response = handleRequest(method || 'GET', path || '/');
                const responseData = new TextDecoder().decode(response.value.body);
                
                console.log('Flask response data:', responseData);
                
                // Send response back to iframe
                previewFrame.contentWindow.postMessage({
                    type: 'flask-response',
                    requestId,
                    data: responseData,
                    status: response.value.status,
                    headers: response.value.headers
                }, '*');
            } catch (error) {
                console.error('Flask request error:', error);
                previewFrame.contentWindow.postMessage({
                    type: 'flask-response',
                    requestId: event.data.requestId,
                    data: JSON.stringify({error: error.message}),
                    status: 500,
                    headers: {'Content-Type': 'application/json'}
                }, '*');
            }
        }
    });
}

// Generate HTML content for Flask preview with monkey-patched fetch
function generateFlaskPreviewHTML() {
    const mainHTML = files['index.html'];
    let htmlContent = mainHTML ? mainHTML.content : '<h1>No HTML file found</h1><p>Create an index.html file to preview your Flask app.</p>';
    
    // Get CSS content
    const cssFiles = Object.keys(files).filter(name => name.endsWith('.css'));
    let cssContent = '';
    cssFiles.forEach(filename => {
        // Properly escape CSS content to prevent injection issues
        const escapedContent = files[filename].content
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
        cssContent += escapedContent + '\n';
    });
    
    // Get JS content (excluding Python files)
    const jsFiles = Object.keys(files).filter(name => name.endsWith('.js') && !name.endsWith('.py'));
    let jsContent = '';
    jsFiles.forEach(filename => {
        // Properly escape the JavaScript content to prevent syntax errors
        const escapedContent = files[filename].content
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
        jsContent += escapedContent + '\n';
    });
    
    // Monkey patch fetch and add communication layer
    const monkeyPatchScript = `
        <script>
            // Monkey patch fetch for Flask communication
            const originalFetch = window.fetch;
            
            window.fetch = async function(url, options = {}) {
                // Check if this is a request to our Flask app
                if (url.startsWith('/') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
                    // Extract path from URL
                    const path = url.startsWith('/') ? url : new URL(url).pathname;
                    
                    // Generate unique request ID
                    const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
                    
                    // Send request to parent window
                    return new Promise((resolve, reject) => {                        // Set up response listener
                        const responseHandler = (event) => {
                            if (event.data.type === 'flask-response' && event.data.requestId === requestId) {
                                window.removeEventListener('message', responseHandler);
                                const response = event.data.response;
                                
                                // Clean up the response data to remove escape characters and newlines
                                let cleanData = response.data;
                                if (typeof cleanData === 'string') {
                                    // Remove escape characters and trim whitespace
                                    cleanData = cleanData.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
                                }
                                
                                // Create a Response object similar to fetch
                                const responseObj = new Response(cleanData, {
                                    status: response.status,
                                    statusText: response.statusText || 'OK',
                                    headers: response.headers
                                });
                                
                                resolve(responseObj);
                            }
                        };
                        
                        window.addEventListener('message', responseHandler);
                        
                        // Send request
                        parent.postMessage({
                            type: 'flask-request',
                            requestId,
                            path,
                            method: options.method || 'GET',
                            data: options.body || null,
                            headers: options.headers || {}
                        }, '*');
                        
                        // Set timeout
                        setTimeout(() => {
                            window.removeEventListener('message', responseHandler);
                            reject(new Error('Request timeout'));
                        }, 10000);
                    });
                }
                
                // For external URLs, use original fetch
                return originalFetch(url, options);
            };
            
            // Add helper functions for common requests
            window.get = (url) => fetch(url);
            window.post = (url, data) => fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            console.log('Flask communication layer initialized');
        </script>
    `;
    
    // Inject our CSS and JS into the HTML
    const finalHTML = htmlContent
        .replace('</head>', `<style>${cssContent}</style>\n${monkeyPatchScript}\n</head>`)
        .replace('</body>', `<script>${jsContent}</script>\n</body>`);
    
    return finalHTML;
}

// Handle Flask requests from iframe using Sippy-Cup approach
async function handleFlaskRequestFromIframe(path, method = 'GET', data = null, headers = {}) {
    if (!flaskApp) {
        return {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
            data: 'Flask-lite app not initialized',
            success: false
        };
    }
    
    try {
        // Use Sippy-Cup style request handling
        const response = handleRequest(method, path);
        
        // Convert response to expected format - use exact Sippy-Cup approach
        const responseData = new TextDecoder().decode(response.value.body).trim();
        
        return {
            status: response.value.status,
            statusText: getStatusText(response.value.status),
            headers: response.value.headers,
            data: responseData,
            success: response.value.status < 400
        };
    } catch (error) {
        return {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'Content-Type': 'text/plain' },
            data: 'Internal Server Error: ' + error.message,
            success: false
        };
    }
}

// Output tab switching
function switchOutputTab(tab) {
    const tabs = ['preview', 'console', 'terminal', 'database'];
    
    tabs.forEach(t => {
        const element = document.getElementById(t + '-container') || document.getElementById(t + '-frame');
        if (element) {
            element.classList.toggle('hidden', t !== tab);
        }
    });
    
    // Update tab styles
    document.querySelectorAll('.output-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`[onclick="switchOutputTab('${tab}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Refresh database when switching to database tab
    if (tab === 'database') {
        setTimeout(() => refreshDatabase(), 100);
    }
}

// Console functionality
function addToConsole(message, type = 'log') {
    const consoleOutput = document.getElementById('console-output');
    const logElement = document.createElement('div');
    logElement.className = `console-log ${type}`;
    logElement.textContent = message;
    consoleOutput.appendChild(logElement);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Terminal functionality
function addToTerminal(message, type = 'log') {
    const terminalOutput = document.getElementById('terminal-output');
    const logElement = document.createElement('div');
    logElement.className = `console-log ${type}`;
    logElement.textContent = message;
    terminalOutput.appendChild(logElement);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function clearTerminal() {
    document.getElementById('terminal-output').innerHTML = '';
}

// Package installation and management functions
async function handlePipInstall(command) {
    const packageName = command.substring('pip install '.length).trim();
    
    if (!packageName) {
        addToTerminal('Usage: pip install <package_name>', 'error');
        return;
    }
    
    if (!pyodideReady) {
        addToTerminal('Python environment not ready. Please wait for Python to load.', 'error');
        return;
    }
    
    addToTerminal(`Installing Python package: ${packageName}`, 'info');
    addToTerminal('This may take a moment...', 'log');
    
    try {
        // Use micropip to install the package
        await pyodide.runPythonAsync(`
import micropip
await micropip.install('${packageName}')
        `);
        
        addToTerminal(`✓ Successfully installed ${packageName}`, 'info');
        
        // Update requirements.txt if it exists
        if (files['requirements.txt']) {
            const currentRequirements = files['requirements.txt'].content;
            if (!currentRequirements.includes(packageName)) {
                files['requirements.txt'].content += `\n${packageName}`;
                syncFileToGun('requirements.txt');
                addToTerminal(`Added ${packageName} to requirements.txt`, 'log');
            }
        } else {
            // Create requirements.txt
            files['requirements.txt'] = {
                content: packageName,
                type: 'txt'
            };
            syncFileToGun('requirements.txt');
            addToTerminal('Created requirements.txt', 'log');
            renderFileTree();
        }
        
    } catch (error) {
        addToTerminal(`✗ Failed to install ${packageName}: ${error.message}`, 'error');
        addToTerminal('Package may not be available in Pyodide or may have compatibility issues', 'warn');
    }
}

function handlePipCommand(command) {
    const args = command.split(' ');
    const subcommand = args[1];
    
    switch (subcommand) {
        case 'list':
            listPythonPackages();
            break;
        case 'show':
            if (args[2]) {
                showPythonPackageInfo(args[2]);
            } else {
                addToTerminal('Usage: pip show <package_name>', 'error');
            }
            break;
        case 'freeze':
            freezePythonPackages();
            break;
        case '--version':
            addToTerminal('pip 23.0.1 (Pyodide micropip)', 'log');
            break;
        case 'help':
            showPipHelp();
            break;
        default:
            addToTerminal(`Unknown pip command: ${subcommand}`, 'error');
            addToTerminal('Available pip commands: install, list, show, freeze, --version, help', 'info');
    }
}

async function listPythonPackages() {
    if (!pyodideReady) {
        addToTerminal('Python environment not ready', 'error');
        return;
    }
    
    try {
        await pyodide.runPythonAsync(`
import micropip
import json

# Get list of installed packages
installed = micropip.list()
package_list = []

for name, info in installed.items():
    if hasattr(info, 'version'):
        package_list.append(f"{name}=={info.version}")
    else:
        package_list.append(name)

print("\\n".join(sorted(package_list)))
        `);
        
    } catch (error) {
        addToTerminal('Error listing packages: ' + error.message, 'error');
    }
}

async function showPythonPackageInfo(packageName) {
    if (!pyodideReady) {
        addToTerminal('Python environment not ready', 'error');
        return;
    }
    
    try {
        await pyodide.runPythonAsync(`
import micropip
import importlib.metadata

try:
    metadata = importlib.metadata.metadata('${packageName}')
    print(f"Name: {metadata['Name']}")
    print(f"Version: {metadata['Version']}")
    if 'Summary' in metadata:
        print(f"Summary: {metadata['Summary']}")
    if 'Home-page' in metadata:
        print(f"Home-page: {metadata['Home-page']}")
except Exception as e:
    print(f"Package '${packageName}' not found or error: {e}")
        `);
        
    } catch (error) {
        addToTerminal(`Error getting package info: ${error.message}`, 'error');
    }
}

async function freezePythonPackages() {
    if (!pyodideReady) {
        addToTerminal('Python environment not ready', 'error');
        return;
    }
    
    try {
        await pyodide.runPythonAsync(`
import micropip

# Get list of installed packages
installed = micropip.list()
freeze_list = []

for name, info in installed.items():
    if hasattr(info, 'version'):
        freeze_list.append(f"{name}=={info.version}")
    else:
        freeze_list.append(name)

print("\\n".join(sorted(freeze_list)))
        `);
        
    } catch (error) {
        addToTerminal('Error freezing packages: ' + error.message, 'error');
    }
}

async function handleNpmInstall(command) {
    const packageName = command.substring('npm install '.length).trim();
    
    if (!packageName) {
        addToTerminal('Usage: npm install <package_name>', 'error');
        return;
    }
    
    addToTerminal(`Simulating npm install: ${packageName}`, 'info');
    addToTerminal('Note: This is a simulation. Actual npm packages cannot be installed in browser environment.', 'warn');
    
    // Simulate installation delay
    setTimeout(() => {
        addToTerminal(`✓ Simulated installation of ${packageName}`, 'log');
        
        // Update or create package.json
        let packageJson;
        if (files['package.json']) {
            try {
                packageJson = JSON.parse(files['package.json'].content);
            } catch (e) {
                packageJson = {
                    "name": "CodeMate-project",
                    "version": "1.0.0",
                    "dependencies": {}
                };
            }
        } else {
            packageJson = {
                "name": "CodeMate-project",
                "version": "1.0.0",
                "dependencies": {}
            };
        }
        
        // Add dependency
        if (!packageJson.dependencies) {
            packageJson.dependencies = {};
        }
        packageJson.dependencies[packageName] = "^1.0.0";
        
        // Update or create package.json file
        files['package.json'] = {
            content: JSON.stringify(packageJson, null, 2),
            type: 'json'
        };
        
        syncFileToGun('package.json');
        addToTerminal(`Added ${packageName} to package.json`, 'log');
        renderFileTree();
        
    }, 1000);
}

function handleNpmCommand(command) {
    const args = command.split(' ');
    const subcommand = args[1];
    
    switch (subcommand) {
        case 'list':
        case 'ls':
            listNpmPackages();
            break;
        case 'init':
            initNpmProject();
            break;
        case 'start':
            addToTerminal('npm start: Running development server...', 'info');
            addToTerminal('In a real environment, this would start your application', 'log');
            break;
        case 'test':
            addToTerminal('npm test: Running tests...', 'info');
            addToTerminal('No tests found. Create test files to run tests.', 'log');
            break;
        case 'build':
            addToTerminal('npm build: Building project...', 'info');
            addToTerminal('In a real environment, this would build your project for production', 'log');
            break;
        case '--version':
            addToTerminal('npm 9.6.4 (simulated)', 'log');
            break;
        case 'help':
            showNpmHelp();
            break;
        default:
            addToTerminal(`Unknown npm command: ${subcommand}`, 'error');
            addToTerminal('Available npm commands: install, list, init, start, test, build, --version, help', 'info');
    }
}

function listNpmPackages() {
    if (files['package.json']) {
        try {
            const packageJson = JSON.parse(files['package.json'].content);
            if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
                addToTerminal('Dependencies:', 'info');
                for (const [name, version] of Object.entries(packageJson.dependencies)) {
                    addToTerminal(`  ${name}@${version}`, 'log');
                }
            } else {
                addToTerminal('No dependencies found', 'log');
            }
            
            if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0) {
                addToTerminal('Dev Dependencies:', 'info');
                for (const [name, version] of Object.entries(packageJson.devDependencies)) {
                    addToTerminal(`  ${name}@${version}`, 'log');
                }
            }
        } catch (e) {
            addToTerminal('Error reading package.json: Invalid JSON', 'error');
        }
    } else {
        addToTerminal('No package.json found. Run "npm init" to create one.', 'log');
    }
}

function initNpmProject() {
    const packageJson = {
        "name": "CodeMate-project",
        "version": "1.0.0",
        "description": "A CodeMate collaborative coding project",
        "main": "index.js",
        "scripts": {
            "start": "node server.js",
            "test": "echo \"Error: no test specified\" && exit 1",
            "build": "echo \"No build script specified\""
        },
        "dependencies": {},
        "devDependencies": {},
        "keywords": ["CodeMate", "collaborative", "coding"],
        "author": "CodeMate User",
        "license": "MIT"
    };
    
    files['package.json'] = {
        content: JSON.stringify(packageJson, null, 2),
        type: 'json'
    };
    
    syncFileToGun('package.json');
    addToTerminal('Created package.json', 'info');
    renderFileTree();
}

function showPipHelp() {
    addToTerminal('pip - Python Package Installer', 'info');
    addToTerminal('', 'log');
    addToTerminal('Available commands:', 'info');
    addToTerminal('  pip install <package>    Install a Python package', 'log');
    addToTerminal('  pip list                 List installed packages', 'log');
    addToTerminal('  pip show <package>       Show package information', 'log');
    addToTerminal('  pip freeze               Output installed packages in requirements format', 'log');
    addToTerminal('  pip --version            Show pip version', 'log');
    addToTerminal('  pip help                 Show this help message', 'log');
    addToTerminal('', 'log');
    addToTerminal('Examples:', 'info');
    addToTerminal('  pip install requests', 'log');
    addToTerminal('  pip install numpy pandas', 'log');
    addToTerminal('  pip show flask', 'log');
}

function showNpmHelp() {
    addToTerminal('npm - Node Package Manager (Simulated)', 'info');
    addToTerminal('', 'log');
    addToTerminal('Available commands:', 'info');
    addToTerminal('  npm install <package>    Install a package (simulated)', 'log');
    addToTerminal('  npm list                 List installed packages', 'log');
    addToTerminal('  npm init                 Create package.json', 'log');
    addToTerminal('  npm start                Run start script', 'log');
    addToTerminal('  npm test                 Run test script', 'log');
    addToTerminal('  npm build                Run build script', 'log');
    addToTerminal('  npm --version            Show npm version', 'log');
    addToTerminal('  npm help                 Show this help message', 'log');
    addToTerminal('', 'log');
}

function showTerminalHelp() {
    addToTerminal('CodeMate Terminal - Available Commands', 'info');
    addToTerminal('', 'log');
    addToTerminal('File Operations:', 'info');
    addToTerminal('  ls                       List files in workspace', 'log');
    addToTerminal('  pwd                      Show current directory', 'log');
    addToTerminal('  cat <filename>           Display file contents', 'log');
    addToTerminal('  clear                    Clear terminal output', 'log');
    addToTerminal('', 'log');
    addToTerminal('Python & Flask:', 'info');
    addToTerminal('  python app.py            Start Flask-lite server', 'log');
    addToTerminal('  pip install <package>    Install Python package', 'log');
    addToTerminal('  pip list                 List Python packages', 'log');
    addToTerminal('  pip help                 Show pip help', 'log');
    addToTerminal('', 'log');
    addToTerminal('Node.js & npm (Simulated):', 'info');
    addToTerminal('  npm install <package>    Simulate npm package install', 'log');
    addToTerminal('  npm list                 List npm packages', 'log');
    addToTerminal('  npm init                 Create package.json', 'log');
    addToTerminal('  npm help                 Show npm help', 'log');
    addToTerminal('', 'log');
    addToTerminal('HTTP Testing:', 'info');
    addToTerminal('  curl <path>              Test Flask routes', 'log');
    addToTerminal('  curl POST <path> <data>  Test POST requests', 'log');
    addToTerminal('', 'log');
    addToTerminal('Database:', 'info');
    addToTerminal('  db set <key> <value>     Store data', 'log');
    addToTerminal('  db get <key>             Retrieve data', 'log');
    addToTerminal('  db list                  List all data', 'log');
    addToTerminal('  db help                  Show database help', 'log');
    addToTerminal('', 'log');
    addToTerminal('General:', 'info');
    addToTerminal('  help                     Show this help message', 'log');
}

// Initialize with welcome messages
setTimeout(() => {
    addToConsole('Welcome to CodeMate Console! Type JavaScript or Python code and press Enter to execute.', 'info');
    addToConsole('You can also see console output from your code here.', 'info');
    addToConsole('Python support is loading... Please wait for "Python Ready" status.', 'info');
    
    addToTerminal('Welcome to CodeMate Terminal!', 'info');
    addToTerminal('🚀 New: Use "Deploy" button to create shareable links for your project!', 'info');
    addToTerminal('Available commands:', 'info');
    addToTerminal('  ls - list files', 'log');
    addToTerminal('  pwd - current directory', 'log');
    addToTerminal('  cat <filename> - view file contents', 'log');
    addToTerminal('  clear - clear terminal', 'log');
    addToTerminal('  python app.py - start Flask app', 'log');
    addToTerminal('  pip install <package> - install Python packages', 'log');
    addToTerminal('  npm install <package> - install npm packages (simulated)', 'log');
    addToTerminal('  curl [METHOD] <path> [data] - test Flask routes', 'log');
    addToTerminal('  db <command> - database operations', 'log');
    addToTerminal('  help - show all available commands', 'log');
    addToTerminal('', 'log');
    addToTerminal('Package Management:', 'info');
    addToTerminal('• Real Python package installation via pip', 'log');
    addToTerminal('• Simulated npm package management', 'log');
    addToTerminal('• Automatic requirements.txt and package.json updates', 'log');
    addToTerminal('• Package listing and information commands', 'log');
    addToTerminal('', 'log');
    addToTerminal('Examples:', 'info');
    addToTerminal('  pip install requests numpy pandas', 'log');
    addToTerminal('  npm install express lodash', 'log');
    addToTerminal('  pip list, npm list', 'log');
    addToTerminal('  python app.py, then curl /api/data', 'log');
}, 1000);

// Console and Terminal input handling
document.addEventListener('DOMContentLoaded', function() {
    const consoleInput = document.getElementById('console-input');
    const terminalInput = document.getElementById('terminal-input');
    
    if (consoleInput) {
        consoleInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                const code = this.value.trim();
                if (code) {
                    addToConsole('> ' + code, 'info');
                    
                    // Check if it's Python code (simple heuristic)
                    if (code.includes('print(') || code.includes('import ') || code.includes('def ') || code.includes('for ')) {
                        // Execute as Python if Pyodide is ready
                        if (pyodideReady) {
                            try {
                                pyodide.runPython(code);
                            } catch (error) {
                                addToConsole('Python Error: ' + error.message, 'error');
                            }
                        } else {
                            addToConsole('Python is still loading. Please wait...', 'warn');
                        }
                    } else {
                        // Execute as JavaScript
                        try {
                            const result = eval(code);
                            if (result !== undefined) {
                                addToConsole(String(result), 'log');
                            }
                        } catch (error) {
                            addToConsole('JavaScript Error: ' + error.message, 'error');
                        }
                    }
                    
                    this.value = '';
                }
            }
        });
    }
    
    if (terminalInput) {
        terminalInput.addEventListener('keypress', async function(event) {
            if (event.key === 'Enter') {
                const command = this.value.trim();
                if (command) {
                    addToTerminal('$ ' + command, 'info');
                    
                    // Handle terminal commands
                    if (command === 'ls') {
                        addToTerminal(Object.keys(files).join('  '), 'log');
                    } else if (command === 'pwd') {
                        addToTerminal('/workspace', 'log');
                    } else if (command.startsWith('cat ')) {
                        const filename = command.substring(4);
                        if (files[filename]) {
                            addToTerminal(files[filename].content, 'log');
                        } else {
                            addToTerminal(`cat: ${filename}: No such file or directory`, 'error');
                        }
                    } else if (command === 'clear') {
                        clearTerminal();
                    } else if (command === 'python app.py') {
                        runFlaskApp();
                    } else if (command.startsWith('curl ')) {
                        // Enhanced curl command parsing
                        const curlArgs = command.substring(5).trim();
                        
                        if (curlArgs.length === 0) {
                            addToTerminal('Usage: curl [METHOD] <path> [data]', 'error');
                            addToTerminal('Examples:', 'info');
                            addToTerminal('  curl /', 'log');
                            addToTerminal('  curl /api/users', 'log');
                            addToTerminal('  curl POST /api/users {"name": "Alice"}', 'log');
                            addToTerminal('  curl PUT /api/users/1 {"name": "Bob"}', 'log');
                            addToTerminal('  curl DELETE /api/users/1', 'log');
                            return;
                        }
                        
                        // Parse different curl formats
                        const parts = curlArgs.split(' ');
                        let method = 'GET';
                        let path = '';
                        let data = null;
                        
                        if (parts.length === 1) {
                            // curl /path
                            path = parts[0];
                        } else if (parts.length === 2) {
                            // curl METHOD /path or curl /path data
                            if (parts[0].toUpperCase() === 'POST' || parts[0].toUpperCase() === 'PUT' || 
                                parts[0].toUpperCase() === 'DELETE' || parts[0].toUpperCase() === 'PATCH') {
                                method = parts[0].toUpperCase();
                                path = parts[1];
                            } else {
                                path = parts[0];
                                data = parts[1];
                            }
                        } else if (parts.length >= 3) {
                            // curl METHOD /path data
                            method = parts[0].toUpperCase();
                            path = parts[1];
                            data = parts.slice(2).join(' ');
                        }
                        
                        // Validate method
                        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
                        if (!validMethods.includes(method)) {
                            addToTerminal(`Invalid HTTP method: ${method}`, 'error');
                            addToTerminal(`Valid methods: ${validMethods.join(', ')}`, 'info');
                            return;
                        }
                        
                        // Validate path
                        if (!path.startsWith('/')) {
                            path = '/' + path;
                        }
                        
                        testFlaskRoute(path, method, data);
                    } else if (command.startsWith('pip install ')) {
                        await handlePipInstall(command);
                    } else if (command.startsWith('pip ')) {
                        handlePipCommand(command);
                    } else if (command.startsWith('npm install ')) {
                        await handleNpmInstall(command);
                    } else if (command.startsWith('npm ')) {
                        handleNpmCommand(command);
                    } else if (command === 'pip list') {
                        await listPythonPackages();
                    } else if (command === 'npm list') {
                        listNpmPackages();
                    } else if (command.startsWith('db ')) {
                        await handleDatabaseCommand(command);
                    } else if (command === 'help' || command === '--help') {
                        showTerminalHelp();
                    } else {
                        addToTerminal(`Command not found: ${command}`, 'error');
                        addToTerminal('Type "help" for available commands', 'info');
                    }
                    
                    this.value = '';
                }
            }
        });
    }
});

// Listen for console messages from iframe
window.addEventListener('message', function(event) {
    if (event.data.type === 'console') {
        addToConsole(event.data.args.join(' '), event.data.method);
    }
});

// Deploy functionality
function deployApp() {
    updateDeployInfo();
    document.getElementById('deploy-modal').style.display = 'block';
}

function hideDeployModal() {
    document.getElementById('deploy-modal').style.display = 'none';
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
    const deployModal = document.getElementById('deploy-modal');
    const newFileModal = document.getElementById('new-file-modal');
    
    if (event.target === deployModal) {
        hideDeployModal();
    }
    
    if (event.target === newFileModal) {
        hideNewFileModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const deployModal = document.getElementById('deploy-modal');
        const newFileModal = document.getElementById('new-file-modal');
        
        if (deployModal.style.display === 'block') {
            hideDeployModal();
        }
        
        if (newFileModal.style.display === 'block') {
            hideNewFileModal();
        }
    }
});

function updateDeployInfo() {
    const baseUrl = window.location.origin + window.location.pathname;
    const roomHash = '#' + roomId;
    const viewOnlyHash = '#view-' + roomId;
    
    // Update collaborative link
    document.getElementById('collab-link').value = baseUrl + roomHash;
    
    // Update preview link (read-only)
    document.getElementById('preview-link').value = baseUrl + viewOnlyHash;
    
    // Update project stats
    document.getElementById('deploy-room-id').textContent = roomId;
    document.getElementById('deploy-file-count').textContent = Object.keys(files).length;
    document.getElementById('deploy-created-date').textContent = new Date().toLocaleDateString();
}

function copyToClipboard(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        navigator.clipboard.writeText(input.value).then(() => {
            button.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        });
    } catch (err) {
        // Fallback for older browsers
        document.execCommand('copy');
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
        }, 2000);
    }
}

function downloadProject() {
    try {
        // Create a simple archive file with all project files
        const projectData = createProjectArchive();
        const blob = new Blob([projectData], { type: 'text/plain' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CodeMate-project-${roomId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addToConsole(`Project downloaded as CodeMate-project-${roomId}.txt`, 'info');
    } catch (error) {
        console.error('Error creating project archive:', error);
        // Fallback: download as individual files
        downloadAsIndividualFiles();
    }
}

function createProjectArchive() {
    let archive = `CodeMate Project Archive
Room ID: ${roomId}
Created: ${new Date().toISOString()}
Files: ${Object.keys(files).length}

${'='.repeat(80)}

`;
    
    Object.keys(files).forEach(filename => {
        const fileContent = files[filename].content;
        archive += `--- FILE: ${filename} ---\n`;
        archive += `Type: ${files[filename].type}\n`;
        archive += `Length: ${fileContent.length} characters\n`;
        archive += `${'='.repeat(40)}\n`;
        archive += fileContent;
        archive += `\n${'='.repeat(40)}\n\n`;
    });
    
    archive += `End of Archive\n${'='.repeat(80)}`;
    
    return archive;
}

function downloadAsIndividualFiles() {
    addToConsole('Downloading individual files...', 'info');
    
    // Download each file individually
    Object.keys(files).forEach((filename, index) => {
        setTimeout(() => {
            const content = files[filename].content;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            addToConsole(`Downloaded: ${filename}`, 'info');
        }, index * 100); // Stagger downloads to avoid browser blocking
    });
}

// Enhanced room ID handling for read-only mode
function initializeRoomWithViewMode() {
    const hash = location.hash.replace('#', '');
    
    if (hash.startsWith('view-')) {
        // Read-only mode
        roomId = hash.substring(5); // Remove 'view-' prefix
        isReadOnly = true;
        document.body.classList.add('read-only-mode');
        
        // Update UI to show read-only status
        document.getElementById('room-id').textContent = roomId + ' (View Only)';
        document.getElementById('sync-status').textContent = 'Read Only Mode';
        document.getElementById('sync-status').className = 'sync-status ready';
        
        // Hide editing controls
        const newFileBtn = document.querySelector('.new-file-btn');
        const deployBtn = document.querySelector('.deploy-button');
        if (newFileBtn) newFileBtn.style.display = 'none';
        if (deployBtn) deployBtn.style.display = 'none';
        
    } else {
        // Normal collaborative mode
        roomId = hash || Math.random().toString(36).substring(2, 8);
        isReadOnly = false;
        document.getElementById('room-id').textContent = roomId;
    }
    
    location.hash = (isReadOnly ? 'view-' : '') + roomId;
}

// Helper function to clear user data (for testing)
function clearUserData() {
    localStorage.removeItem('CodeMate-user-id');
    localStorage.removeItem('CodeMate-username');
    users.clear();
    usedColors.clear();
    userColors.clear();
    currentUser = null;
    console.log('User data cleared');
}

// Make it available globally for debugging
window.clearUserData = clearUserData;

// Panel resizing functionality
function initializePanelResizing() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const bottomPanel = document.querySelector('.bottom-panel');
    
    // Create resize handles
    const verticalHandle = document.createElement('div');
    verticalHandle.className = 'resize-handle vertical-handle';
    verticalHandle.style.cssText = `
        position: absolute;
        top: 0;
        right: -3px;
        width: 6px;
        height: 100%;
        background: #444;
        cursor: col-resize;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.2s;
    `;
    
    const horizontalHandle = document.createElement('div');
    horizontalHandle.className = 'resize-handle horizontal-handle';
    horizontalHandle.style.cssText = `
        position: absolute;
        top: -3px;
        left: 0;
        width: 100%;
        height: 6px;
        background: #444;
        cursor: row-resize;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.2s;
    `;
    
    // Add handles to panels
    if (sidebar) {
        sidebar.style.position = 'relative';
        sidebar.appendChild(verticalHandle);
        
        // Show handle on hover
        sidebar.addEventListener('mouseenter', () => {
            verticalHandle.style.opacity = '0.5';
        });
        sidebar.addEventListener('mouseleave', () => {
            verticalHandle.style.opacity = '0';
        });
    }
    
    if (bottomPanel) {
        bottomPanel.style.position = 'relative';
        bottomPanel.appendChild(horizontalHandle);
        
        // Show handle on hover
        bottomPanel.addEventListener('mouseenter', () => {
            horizontalHandle.style.opacity = '0.5';
        });
        bottomPanel.addEventListener('mouseleave', () => {
            horizontalHandle.style.opacity = '0';
        });
    }
    
    // Vertical resizing (sidebar width)
    let isResizingVertical = false;
    let startX = 0;
    let startWidth = 0;
    
    if (verticalHandle) {
        verticalHandle.addEventListener('mousedown', (e) => {
            isResizingVertical = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            verticalHandle.style.opacity = '1';
        });
    }
    
    // Horizontal resizing (bottom panel height)
    let isResizingHorizontal = false;
    let startY = 0;
    let startHeight = 0;
    
    if (horizontalHandle) {
        horizontalHandle.addEventListener('mousedown', (e) => {
            isResizingHorizontal = true;
            startY = e.clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(bottomPanel).height, 10);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
            horizontalHandle.style.opacity = '1';
        });
    }
    
    // Mouse move handler
    document.addEventListener('mousemove', (e) => {
        if (isResizingVertical && sidebar) {
            const width = startWidth + e.clientX - startX;
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.5;
            
            if (width >= minWidth && width <= maxWidth) {
                sidebar.style.width = width + 'px';
                if (mainContent) {
                    mainContent.style.marginLeft = width + 'px';
                }
                
                // Refresh the editor
                if (codeMirrorInstance) {
                    setTimeout(() => codeMirrorInstance.refresh(), 10);
                }
            }
        }
        
        if (isResizingHorizontal && bottomPanel) {
            const height = startHeight - (e.clientY - startY);
            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.7;
            
            if (height >= minHeight && height <= maxHeight) {
                bottomPanel.style.height = height + 'px';
                
                // Refresh the editor
                if (codeMirrorInstance) {
                    setTimeout(() => codeMirrorInstance.refresh(), 10);
                }
            }
        }
    });
    
    // Mouse up handler
    document.addEventListener('mouseup', () => {
        if (isResizingVertical || isResizingHorizontal) {
            isResizingVertical = false;
            isResizingHorizontal = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            if (verticalHandle) verticalHandle.style.opacity = '0';
            if (horizontalHandle) horizontalHandle.style.opacity = '0';
            
            // Save panel sizes to localStorage
            if (sidebar) {
                localStorage.setItem('CodeMate-sidebar-width', sidebar.style.width);
            }
            if (bottomPanel) {
                localStorage.setItem('CodeMate-bottom-panel-height', bottomPanel.style.height);
            }
        }
    });
    
    // Restore saved panel sizes
    const savedSidebarWidth = localStorage.getItem('CodeMate-sidebar-width');
    const savedBottomHeight = localStorage.getItem('CodeMate-bottom-panel-height');
    
    if (savedSidebarWidth && sidebar) {
        sidebar.style.width = savedSidebarWidth;
        if (mainContent) {
            mainContent.style.marginLeft = savedSidebarWidth;
        }
    }
    
    if (savedBottomHeight && bottomPanel) {
        bottomPanel.style.height = savedBottomHeight;
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (codeMirrorInstance) {
            setTimeout(() => codeMirrorInstance.refresh(), 100);
        }
    });
    
    console.log('Panel resizing initialized with draggable handles');
}

// Basic Database functionality using Gun.js
class CodeMateDB {
    constructor(roomId) {
        this.roomId = roomId;
        this.db = gun.get('CodeMate').get(roomId).get('database');
        console.log('CodeMateDB initialized for room:', roomId);
    }

    // Set a key-value pair
    async set(key, value) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    value: value,
                    timestamp: Date.now(),
                    type: typeof value
                };
                this.db.get(key).put(data, (ack) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        console.log(`DB Set: ${key} =`, value);
                        resolve(value);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Get a value by key
    async get(key) {
        return new Promise((resolve, reject) => {
            this.db.get(key).once((data) => {
                if (data && data.value !== undefined) {
                    console.log(`DB Get: ${key} =`, data.value);
                    resolve(data.value);
                } else {
                    resolve(null);
                }
            });
        });
    }

    // Delete a key
    async delete(key) {
        return new Promise((resolve, reject) => {
            this.db.get(key).put(null, (ack) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                } else {
                    console.log(`DB Delete: ${key}`);
                    resolve(true);
                }
            });
        });
    }

    // Get all keys (list all data)
    async list() {
        return new Promise((resolve) => {
            const results = {};
            this.db.map().once((data, key) => {
                if (data && data.value !== undefined && key !== '_') {
                    results[key] = {
                        value: data.value,
                        timestamp: data.timestamp,
                        type: data.type
                    };
                }
            });
            
            // Give it a moment to collect all data
            setTimeout(() => {
                console.log('DB List:', results);
                resolve(results);
            }, 100);
        });
    }

    // Add to an array (push)
    async push(arrayKey, value) {
        const currentArray = await this.get(arrayKey) || [];
        if (!Array.isArray(currentArray)) {
            throw new Error(`Key "${arrayKey}" is not an array`);
        }
        currentArray.push(value);
        return await this.set(arrayKey, currentArray);
    }

    // Increment a number
    async increment(key, amount = 1) {
        const current = await this.get(key) || 0;
        const newValue = current + amount;
        return await this.set(key, newValue);
    }

    // Watch for changes to a key
    watch(key, callback) {
        this.db.get(key).on((data) => {
            if (data && data.value !== undefined) {
                callback(data.value, key);
            }
        });
    }

    // Simple query functionality
    async query(filterFn) {
        const allData = await this.list();
        const results = {};
        
        Object.keys(allData).forEach(key => {
            const item = allData[key];
            if (filterFn(item.value, key)) {
                results[key] = item;
            }
        });
        
        return results;
    }
}

// Initialize database for current room
let db = null;

function initializeDatabase() {
    if (roomId) {
        db = new CodeMateDB(roomId);
        
        // Make it available globally for user scripts
        window.db = db;
        
        // Add Python database functions
        if (pyodideReady && pyodide) {
            setupPythonDatabase();
        }
        
        console.log('Database initialized and available as window.db');
        addToConsole('Database ready! Use db.set(), db.get(), db.list() in your code', 'info');
    }
}

// Python database integration
function setupPythonDatabase() {
    if (!pyodide || !db) return;
    
    try {
        pyodide.runPython(`
import js
import json
from pyodide.ffi import to_js, create_proxy

class Database:
    def __init__(self):
        self.js_db = js.db
    
    def set(self, key, value):
        """Set a key-value pair in the database"""
        return self.js_db.set(key, value)
    
    def get(self, key):
        """Get a value by key from the database"""
        return self.js_db.get(key)
    
    def delete(self, key):
        """Delete a key from the database"""
        return self.js_db.delete(key)
    
    def list(self):
        """List all data in the database"""
        return self.js_db.list()
    
    def push(self, array_key, value):
        """Add to array"""
        return self.js_db.push(array_key, value)
    
    def increment(self, key, amount=1):
        """Increment a numeric value"""
        return self.js_db.increment(key, amount)
    
    def watch(self, key, callback):
        """Watch for changes to a key"""
        js_callback = create_proxy(callback)
        return self.js_db.watch(key, js_callback)
    
    def query(self, filter_func):
        """Simple query with filter function"""
        js_filter = create_proxy(filter_func)
        return self.js_db.query(js_filter)

# Make database available in Python
db = Database()
        `);
        console.log('Python database integration ready');
        addToConsole('Python database ready! Use db.set(), db.get(), db.list() in Python', 'info');
    } catch (error) {
        console.error('Failed to setup Python database:', error);
    }
}

// Database terminal commands
async function handleDatabaseCommand(command) {
    if (!db) {
        addToTerminal('Database not initialized', 'error');
        return;
    }
    
    const args = command.split(' ').slice(1); // Remove 'db' prefix
    const subcommand = args[0];
    
    try {
        switch (subcommand) {
            case 'set':
                if (args.length < 3) {
                    addToTerminal('Usage: db set <key> <value>', 'error');
                    addToTerminal('Example: db set username "John Doe"', 'log');
                    return;
                }
                const key = args[1];
                let value = args.slice(2).join(' ');
                
                // Try to parse as JSON if it looks like JSON
                if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false' || !isNaN(value)) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        value = value; // Keep as string if JSON parsing fails
                    }
                } else {
                    value = value;
                }
                
                await db.set(key, value);
                
                addToTerminal(`✓ Set ${key} = ${JSON.stringify(value)}`, 'info');
                break;
                
            case 'get':
                if (args.length < 2) {
                    addToTerminal('Usage: db get <key>', 'error');
                    addToTerminal('Example: db get username', 'log');
                    return;
                }
                const getValue = await db.get(args[1]);
                if (getValue !== null) {
                    addToTerminal(`${args[1]} = ${JSON.stringify(getValue)}`, 'log');
                } else {
                    addToTerminal(`Key "${args[1]}" not found`, 'warn');
                }
                break;
                
            case 'delete':
            case 'del':
                if (args.length < 2) {
                    addToTerminal('Usage: db delete <key>', 'error');
                    addToTerminal('Example: db delete username', 'log');
                    return;
                }
                await db.delete(args[1]);
                addToTerminal(`✓ Deleted key "${args[1]}"`, 'info');
                break;
                
            case 'list':
            case 'ls':
                const allData = await db.list();
                const keys = Object.keys(allData);
                if (keys.length === 0) {
                    addToTerminal('Database is empty', 'log');
                } else {
                    addToTerminal(`Database contains ${keys.length} items:`, 'info');
                    keys.forEach(key => {
                        const item = allData[key];
                        const date = new Date(item.timestamp).toLocaleString();
                        addToTerminal(`  ${key} (${item.type}) = ${JSON.stringify(item.value)} [${date}]`, 'log');
                    });
                }
                break;
                
            case 'push':
                if (args.length < 3) {
                    addToTerminal('Usage: db push <array_key> <value>', 'error');
                    addToTerminal('Example: db push todos "Buy milk"', 'log');
                    return;
                }
                const arrayKey = args[1];
                let pushValue = args.slice(2).join(' ');
                
                // Try to parse as JSON
                if (pushValue.startsWith('{') || pushValue.startsWith('[') || pushValue === 'true' || pushValue === 'false' || !isNaN(pushValue)) {
                    try {
                        pushValue = JSON.parse(pushValue);
                    } catch (e) {
                        pushValue = pushValue;
                    }
                } else {
                    pushValue = pushValue;
                }
                
                await db.push(arrayKey, pushValue);
                addToTerminal(`✓ Pushed ${JSON.stringify(pushValue)} to array "${arrayKey}"`, 'info');
                break;
                
            case 'inc':
            case 'increment':
                if (args.length < 2) {
                    addToTerminal('Usage: db increment <key> [amount]', 'error');
                    addToTerminal('Example: db increment counter 5', 'log');
                    return;
                }
                const incKey = args[1];
                const amount = args[2] ? parseInt(args[2]) : 1;
                const newValue = await db.increment(incKey, amount);
                addToTerminal(`✓ Incremented "${incKey}" to ${newValue}`, 'info');
                break;
                
            case 'clear':
                if (confirm('Are you sure you want to clear all database data? This cannot be undone.')) {
                    const allData = await db.list();
                    const keys = Object.keys(allData);
                    for (const key of keys) {
                        await db.delete(key);
                    }
                    addToTerminal(`✓ Cleared database (${keys.length} items removed)`, 'info');
                } else {
                    addToTerminal('Database clear cancelled', 'log');
                }
                break;
                
            case 'help':
                showDatabaseHelp();
                break;
                
            default:
                addToTerminal(`Unknown database command: ${subcommand}`, 'error');
                addToTerminal('Available commands: set, get, delete, list, push, increment, clear, help', 'info');
        }
    } catch (error) {
        addToTerminal(`Database error: ${error.message}`, 'error');
    }
}

function showDatabaseHelp() {
    addToTerminal('CodeMate Database - Available Commands', 'info');
    addToTerminal('', 'log');
    addToTerminal('Basic Operations:', 'info');
    addToTerminal('  db set <key> <value>     Store a value', 'log');
    addToTerminal('  db get <key>             Retrieve a value', 'log');
    addToTerminal('  db delete <key>          Delete a key', 'log');
    addToTerminal('  db list                  List all data', 'log');
    addToTerminal('', 'log');
    addToTerminal('Advanced Operations:', 'info');
    addToTerminal('  db push <key> <value>    Add to array', 'log');
    addToTerminal('  db increment <key> [n]   Increment number', 'log');
    addToTerminal('  db clear                 Clear all data', 'log');
    addToTerminal('', 'log');
    addToTerminal('Examples:', 'info');
    addToTerminal('  db set name "Alice"', 'log');
    addToTerminal('  db set age 25', 'log');
    addToTerminal('  db set config {"theme": "dark"}', 'log');
    addToTerminal('  db push todos "Buy milk"', 'log');
    addToTerminal('  db increment counter 1', 'log');
    addToTerminal('', 'log');
    addToTerminal('Note: Database is shared across all users in this room!', 'warn');
}

// Database Panel Functions
async function refreshDatabase() {
    if (!db) {
        showDatabaseError('Database not initialized');
        return;
    }
    
    try {
        const allData = await db.list();
        const keys = Object.keys(allData);
        
        // Update stats
        const statsEl = document.getElementById('database-stats');
        if (keys.length === 0) {
            statsEl.innerHTML = 'Database is empty';
        } else {
            statsEl.innerHTML = `${keys.length} item${keys.length > 1 ? 's' : ''} in database | Last updated: ${new Date().toLocaleTimeString()}`;
        }
        
        // Update table
        const tableEl = document.getElementById('database-table');
        if (keys.length === 0) {
            tableEl.innerHTML = `
                <div class="database-empty">
                    <div class="database-empty-icon">🗃️</div>
                    <div>No data in database</div>
                    <div style="margin-top: 8px; font-size: 11px;">Add some data using the input below or terminal commands</div>
                </div>
            `;
        } else {
            const entries = keys.sort().map(key => {
                const item = allData[key];
                return createDatabaseEntryHTML(key, item);
            }).join('');
            
            tableEl.innerHTML = entries;
        }
        
        console.log('Database panel refreshed:', keys.length, 'items');
    } catch (error) {
        showDatabaseError('Failed to load database: ' + error.message);
    }
}

function createDatabaseEntryHTML(key, item) {
    const { value, timestamp, type } = item;
    const date = new Date(timestamp).toLocaleString();
    
    // Format value based on type
    let formattedValue;
    let valueClass = 'database-value';
    
    if (type === 'object') {
        formattedValue = JSON.stringify(value, null, 2);
        valueClass += ' json';
    } else if (type === 'string') {
        formattedValue = '"' + value + '"';
        valueClass += ' string';
    } else if (type === 'number') {
        formattedValue = value.toString();
        valueClass += ' number';
    } else if (type === 'boolean') {
        formattedValue = value.toString();
        valueClass += ' boolean';
    } else {
        formattedValue = String(value);
    }
    
    return `
        <div class="database-entry" data-key="${key}">
            <div class="database-entry-header">
                <div>
                    <span class="database-key">${key}</span>
                    <span class="database-type">${type}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="database-timestamp">${date}</span>
                    <div class="database-actions-entry">
                        <button class="database-edit-btn" onclick="editDatabaseEntry('${key}')">✏️</button>
                        <button class="database-delete-btn" onclick="deleteDatabaseEntry('${key}')">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="${valueClass}">${formattedValue}</div>
        </div>
    `;
}

async function addDatabaseEntry() {
    const keyInput = document.getElementById('database-key-input');
    const valueInput = document.getElementById('database-value-input');
    
    const key = keyInput.value.trim();
    const valueStr = valueInput.value.trim();
    
    if (!key) {
        alert('Please enter a key');
        keyInput.focus();
        return;
    }
    
    if (!valueStr) {
        alert('Please enter a value');
        valueInput.focus();
        return;
    }
    
    try {
        // Try to parse as JSON first
        let value;
        if (valueStr.startsWith('{') || valueStr.startsWith('[') || 
            valueStr === 'true' || valueStr === 'false' || 
            (!isNaN(valueStr) && valueStr !== '')) {
            try {
                value = JSON.parse(valueStr);
            } catch (e) {
                value = valueStr; // Keep as string if JSON parsing fails
            }
        } else {
            value = valueStr;
        }
        
        await db.set(key, value);
        
        // Clear inputs
        keyInput.value = '';
        valueInput.value = '';
        
        // Refresh the database view
        await refreshDatabase();
        
        console.log('Added database entry:', key, '=', value);
    } catch (error) {
        alert('Failed to add entry: ' + error.message);
    }
}

async function editDatabaseEntry(key) {
    try {
        const currentValue = await db.get(key);
        let valueStr;
        
        if (typeof currentValue === 'object') {
            valueStr = JSON.stringify(currentValue, null, 2);
        } else if (typeof currentValue === 'string') {
            valueStr = currentValue;
        } else {
            valueStr = String(currentValue);
        }
        
        const newValueStr = prompt(`Edit value for "${key}":`, valueStr);
        if (newValueStr === null) return; // User cancelled
        
        // Parse new value
        let newValue;
        if (newValueStr.startsWith('{') || newValueStr.startsWith('[') || 
            newValueStr === 'true' || newValueStr === 'false' || 
            (!isNaN(newValueStr) && newValueStr !== '')) {
            try {
                newValue = JSON.parse(newValueStr);
            } catch (e) {
                newValue = newValueStr;
            }
        } else {
            newValue = newValueStr;
        }
        
        await db.set(key, newValue);
        await refreshDatabase();
        
        console.log('Updated database entry:', key, '=', newValue);
    } catch (error) {
        alert('Failed to edit entry: ' + error.message);
    }
}

async function deleteDatabaseEntry(key) {
    if (confirm(`Are you sure you want to delete "${key}"?`)) {
        try {
            await db.delete(key);
            await refreshDatabase();
            console.log('Deleted database entry:', key);
        } catch (error) {
            alert('Failed to delete entry: ' + error.message);
        }
    }
}

async function clearDatabase() {
    if (confirm('Are you sure you want to clear ALL database data? This cannot be undone.')) {
        try {
            const allData = await db.list();
            const keys = Object.keys(allData);
            
            for (const key of keys) {
                await db.delete(key);
            }
            
            await refreshDatabase();
            console.log('Cleared database:', keys.length, 'items removed');
        } catch (error) {
            alert('Failed to clear database: ' + error.message);
        }
    }
}

function showAddDataModal() {
    const keyInput = document.getElementById('database-key-input');
    keyInput.focus();
}

function showDatabaseError(message) {
    const statsEl = document.getElementById('database-stats');
    const tableEl = document.getElementById('database-table');
    
    statsEl.innerHTML = '<span style="color: #e57373;">Error: ' + message + '</span>';
    tableEl.innerHTML = '<div class="database-empty">' +
        '<div class="database-empty-icon">⚠️</div>' +
        '<div style="color: #e57373;">' + message + '</div>' +
        '</div>';
}

// Handle Enter key in database inputs
document.addEventListener('DOMContentLoaded', function() {
    const keyInput = document.getElementById('database-key-input');
    const valueInput = document.getElementById('database-value-input');
    
    if (keyInput && valueInput) {
        keyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                valueInput.focus();
            }
        });
        
        valueInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addDatabaseEntry();
            }
        });
    }
});