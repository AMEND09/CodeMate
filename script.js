// Initialize Gun with the peer relay server
const gun = GUN(['https://gun-manhattan.herokuapp.com/gun']);

// Get or create room ID
const roomId = location.hash.replace('#', '') || Math.random().toString(36).substring(2, 8);
location.hash = roomId;
document.getElementById('room-id').textContent = roomId;

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
    }
};

let currentFile = 'index.html';
let activeFiles = new Set(['index.html']);
let codeMirrorInstance = null;

// Get Gun references for file system
const filesDoc = gun.get('hackmate').get(roomId).get('files');

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
        const fileRef = gun.get('hackmate').get(roomId).get(filename);
        
        // Listen for changes - exactly like your example: note.on((data) => { view.value = data });
        fileRef.on((data) => {
            if (data && typeof data === 'string') {
                console.log('GunJS file received:', filename, 'Content length:', data.length);
                
                // Update local file if content is different
                if (files[filename] && files[filename].content !== data) {
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
    });
}

setupFileSync();

// Sync file changes to Gun - exactly like your example: view.oninput = () => { note.put(view.value) };
function syncFileToGun(filename) {
    if (files[filename]) {
        console.log('Syncing file to Gun:', filename, 'Content length:', files[filename].content.length);
        const fileRef = gun.get('hackmate').get(roomId).get(filename);
        fileRef.put(files[filename].content); // Store just the content string, not the object
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
}

function openFile(filename) {
    currentFile = filename;
    activeFiles.add(filename);
    updateEditor();
    renderTabs();
    renderFileTree();
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
            }, 500);
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
    
    // Set up GunJS listener for the new file - exactly like your example
    const fileRef = gun.get('hackmate').get(roomId).get(name);
    fileRef.on((data) => {
        if (data && typeof data === 'string') {
            console.log('GunJS file received:', name, 'Content length:', data.length);
            if (files[name] && files[name].content !== data) {
                files[name].content = data;
                if (currentFile === name && codeMirrorInstance) {
                    const cursorPos = codeMirrorInstance.getCursor();
                    codeMirrorInstance.setValue(data);
                    codeMirrorInstance.setCursor(cursorPos);
                }
                renderFileTree();
            }
        }
    });
    
    syncFileToGun(name);
    openFile(name);
    hideNewFileModal();
}

function deleteFile(filename) {
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        delete files[filename];
        console.log('Deleting file from Gun:', filename);
        const fileRef = gun.get('hackmate').get(roomId).get(filename);
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
        const oldFileRef = gun.get('hackmate').get(roomId).get(oldName);
        oldFileRef.put(null);
        
        // Set up listener for new file
        const newFileRef = gun.get('hackmate').get(roomId).get(newName);
        newFileRef.on((data) => {
            if (data && typeof data === 'string') {
                console.log('GunJS file received:', newName, 'Content length:', data.length);
                if (files[newName] && files[newName].content !== data) {
                    files[newName].content = data;
                    if (currentFile === newName && codeMirrorInstance) {
                        const cursorPos = codeMirrorInstance.getCursor();
                        codeMirrorInstance.setValue(data);
                        codeMirrorInstance.setCursor(cursorPos);
                    }
                    renderFileTree();
                }
            }
        });
        
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
    const tabs = ['preview', 'console', 'terminal'];
    
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

// Enhanced Flask-lite route testing function
async function testFlaskRoute(path, method = 'GET', data = null, headers = null) {
    if (!pyodideReady) {
        addToTerminal('Python is not ready yet', 'error');
        return;
    }
    
    try {
        // Check if Flask app exists
        if (!flaskApp) {
            addToTerminal('Flask-lite app not running. Run "python app.py" first.', 'error');
            return;
        }
        
        addToTerminal(`→ ${method} ${path}`, 'info');
        
        // Use Sippy-Cup style request handling
        const response = handleRequest(method, path);
        
        // Convert response
        const responseData = new TextDecoder().decode(response.value.body);
        
        // Color code status
        let statusColor = 'log';
        if (response.value.status >= 200 && response.value.status < 300) {
            statusColor = 'info';
        } else if (response.value.status >= 400) {
            statusColor = 'error';
        } else if (response.value.status >= 300) {
            statusColor = 'warn';
        }
        
        addToTerminal(`← ${response.value.status} ${getStatusText(response.value.status)}`, statusColor);
        
        // Show response data
        if (responseData) {
            addToTerminal('Response:', 'log');
            
            // Pretty print JSON if possible
            try {
                const jsonData = JSON.parse(responseData.trim());
                addToTerminal(JSON.stringify(jsonData, null, 2), 'log');
            } catch (e) {
                // For HTML responses, show truncated version
                if (responseData.includes('<!DOCTYPE') || responseData.includes('<html')) {
                    addToTerminal('HTML Response (truncated):', 'log');
                    addToTerminal(responseData.substring(0, 200) + '...', 'log');
                } else {
                    addToTerminal(responseData, 'log');
                }
            }
        }
        
        // Show important headers
        if (response.value.headers) {
            const importantHeaders = ['Content-Type', 'Content-Length', 'Location', 'Set-Cookie'];
            const relevantHeaders = {};
            
            for (const [key, value] of Object.entries(response.value.headers)) {
                if (importantHeaders.includes(key)) {
                    relevantHeaders[key] = value;
                }
            }
            
            if (Object.keys(relevantHeaders).length > 0) {
                addToTerminal(`Headers: ${JSON.stringify(relevantHeaders, null, 2)}`, 'log');
            }
        }
        
        addToTerminal('', 'log'); // Empty line for spacing
        
    } catch (error) {
        addToTerminal(`Request failed: ${error.message}`, 'error');
        console.error('Flask-lite route test error:', error);
    }
}

// Helper function to get HTTP status text
function getStatusText(status) {
    const statusTexts = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable'
    };
    return statusTexts[status] || 'Unknown';
}

// Listen for console messages from iframe
window.addEventListener('message', function(event) {
    if (event.data.type === 'console') {
        addToConsole(event.data.args.join(' '), event.data.method);
    }
});

// Console input handling
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
        terminalInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                const command = this.value.trim();
                if (command) {
                    addToTerminal('$ ' + command, 'info');
                    
                    // Simple command simulation
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
                        
                        // Parse curl command with various formats
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
                    } else {
                        addToTerminal(`Command not found: ${command}`, 'error');
                        addToTerminal('Available commands: ls, pwd, cat <filename>, clear, python app.py, curl [METHOD] <path> [data]', 'info');
                        addToTerminal('Flask testing: Start Flask with "python app.py", then use curl commands', 'info');
                    }
                    
                    this.value = '';
                }
            }
        });
    }
});

// Panel resizing functionality
function initializePanelResizing() {
    const resizeHandles = document.querySelectorAll('.resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startWidth = 0;
    let targetPanel = null;
    
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentHandle = handle;
            startX = e.clientX;
            
            const direction = handle.getAttribute('data-direction');
            if (direction === 'sidebar') {
                targetPanel = document.getElementById('sidebar');
                startWidth = targetPanel.offsetWidth;
            } else if (direction === 'editor') {
                targetPanel = document.getElementById('output-panel');
                startWidth = targetPanel.offsetWidth;
            }
            
            document.body.classList.add('resizing');
            e.preventDefault();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !currentHandle || !targetPanel) return;
        
        const direction = currentHandle.getAttribute('data-direction');
        const deltaX = e.clientX - startX;
        
        if (direction === 'sidebar') {
            // Resizing sidebar
            const newWidth = startWidth + deltaX;
            const minWidth = 150;
            const maxWidth = 500;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                targetPanel.style.width = newWidth + 'px';
            }
        } else if (direction === 'editor') {
            // Resizing output panel (resize from right side, so subtract delta)
            const newWidth = startWidth - deltaX;
            const minWidth = 200;
            const maxWidth = 800;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                targetPanel.style.width = newWidth + 'px';
            }
        }
        
        // Refresh CodeMirror when resizing
        if (codeMirrorInstance) {
            setTimeout(() => {
                codeMirrorInstance.refresh();
            }, 10);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            targetPanel = null;
            document.body.classList.remove('resizing');
            
            // Final CodeMirror refresh
            if (codeMirrorInstance) {
                setTimeout(() => {
                    codeMirrorInstance.refresh();
                }, 100);
            }
        }
    });
}

// Initialize with welcome messages
setTimeout(() => {
    addToConsole('Welcome to HackMate Console! Type JavaScript or Python code and press Enter to execute.', 'info');
    addToConsole('You can also see console output from your code here.', 'info');
    addToConsole('Python support is loading... Please wait for "Python Ready" status.', 'info');
    
    addToTerminal('Welcome to HackMate Terminal!', 'info');
    addToTerminal('Available commands:', 'info');
    addToTerminal('  ls - list files', 'log');
    addToTerminal('  pwd - current directory', 'log');
    addToTerminal('  cat <filename> - view file contents', 'log');
    addToTerminal('  clear - clear terminal', 'log');
    addToTerminal('  python app.py - start Flask app', 'log');
    addToTerminal('  curl [METHOD] <path> [data] - test Flask routes', 'log');
    addToTerminal('  curl /, curl POST /api/users {"name": "Alice"}', 'log');
    addToTerminal('  curl PUT /api/users/1 {"name": "Bob"}', 'log');
    addToTerminal('  curl DELETE /api/users/1', 'log');
    addToTerminal('', 'log');
    addToTerminal('Enhanced Flask Features:', 'info');
    addToTerminal('• Async request handling', 'log');
    addToTerminal('• JSON response formatting', 'log');
    addToTerminal('• Proper HTTP status codes', 'log');
    addToTerminal('• Error handling and debugging', 'log');
    addToTerminal('', 'log');
    addToTerminal('Example: python app.py, then curl /api/data', 'info');
}, 1000);
