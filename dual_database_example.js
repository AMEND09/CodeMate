// Dual Database Example for CodeMate
// This example shows how to use both NoSQL (Gun.js) and SQL (SQLite) databases

async function dualDatabaseDemo() {
    console.log('=== CodeMate Dual Database Demo ===');
    
    // === NoSQL Database (Gun.js) Examples ===
    console.log('\n--- NoSQL Database Examples ---');
    
    // Simple key-value storage
    await db.set('app_name', 'CodeMate');
    await db.set('version', '2.0');
    await db.set('features', ['real-time collaboration', 'dual databases', 'code execution']);
    
    // Retrieve and display
    const appName = await db.get('app_name');
    const version = await db.get('version');
    const features = await db.get('features');
    
    console.log('NoSQL Data:');
    console.log('App Name:', appName);
    console.log('Version:', version);
    console.log('Features:', features);
    
    // Working with arrays
    await db.set('todo_list', []);
    await db.push('todo_list', 'Setup dual database system');
    await db.push('todo_list', 'Create example files');
    await db.push('todo_list', 'Test real-time sync');
    
    const todos = await db.get('todo_list');
    console.log('Todo List:', todos);
    
    // === SQL Database (SQLite) Examples ===
    console.log('\n--- SQL Database Examples ---');
    
    // Create a products table
    await sqlDb.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price DECIMAL(10,2),
            category TEXT,
            in_stock BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Insert sample products
    await sqlDb.exec(`
        INSERT INTO products (name, price, category) VALUES 
        ('MacBook Pro', 1999.99, 'Laptops'),
        ('iPhone 15', 999.99, 'Phones'),
        ('iPad Air', 599.99, 'Tablets'),
        ('AirPods Pro', 249.99, 'Audio')
    `);
    
    // Query products
    const products = await sqlDb.query('SELECT * FROM products ORDER BY price DESC');
    console.log('SQL Products:');
    if (products.length > 0) {
        products[0].values.forEach(row => {
            const [id, name, price, category, inStock, createdAt] = row;
            console.log(`${name} - $${price} (${category})`);
        });
    }
    
    // === Data Migration Example ===
    console.log('\n--- Data Migration Example ---');
    
    // Get NoSQL data and store in SQL
    const allNoSQLData = await db.list();
    
    // Create a metadata table for NoSQL data in SQL
    await sqlDb.exec(`
        CREATE TABLE IF NOT EXISTS nosql_backup (
            key TEXT PRIMARY KEY,
            value TEXT,
            type TEXT,
            backed_up_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Backup NoSQL data to SQL
    for (const [key, item] of Object.entries(allNoSQLData)) {
        const valueStr = typeof item.value === 'object' ? 
            JSON.stringify(item.value) : String(item.value);
        
        await sqlDb.exec(
            'INSERT OR REPLACE INTO nosql_backup (key, value, type) VALUES (?, ?, ?)',
            [key, valueStr, item.type]
        );
    }
    
    console.log('Backed up NoSQL data to SQL database');
    
    // === Performance Comparison ===
    console.log('\n--- Performance Comparison ---');
    
    // Time NoSQL operations
    const startNoSQL = performance.now();
    for (let i = 0; i < 100; i++) {
        await db.set(`test_key_${i}`, `test_value_${i}`);
    }
    const endNoSQL = performance.now();
    
    // Time SQL operations
    const startSQL = performance.now();
    for (let i = 0; i < 100; i++) {
        await sqlDb.exec(
            'INSERT OR REPLACE INTO kv_store (key, value, type) VALUES (?, ?, ?)',
            [`sql_test_key_${i}`, `sql_test_value_${i}`, 'string']
        );
    }
    const endSQL = performance.now();
    
    console.log(`NoSQL 100 operations: ${(endNoSQL - startNoSQL).toFixed(2)}ms`);
    console.log(`SQL 100 operations: ${(endSQL - startSQL).toFixed(2)}ms`);
    
    // Clean up test data
    for (let i = 0; i < 100; i++) {
        await db.delete(`test_key_${i}`);
    }
    await sqlDb.exec('DELETE FROM kv_store WHERE key LIKE "sql_test_key_%"');
    
    console.log('\n=== Demo Complete ===');
    console.log('Both databases are ready for use!');
    console.log('Switch between them using the dropdown in the Database panel.');
}

// Run the demo
dualDatabaseDemo().catch(console.error);

// === Utility Functions ===

// Export NoSQL data to SQL
async function exportNoSQLToSQL() {
    const data = await db.list();
    await sqlDb.exec(`
        CREATE TABLE IF NOT EXISTS nosql_export (
            key TEXT PRIMARY KEY,
            value TEXT,
            type TEXT,
            original_timestamp DATETIME,
            exported_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    for (const [key, item] of Object.entries(data)) {
        const valueStr = typeof item.value === 'object' ? 
            JSON.stringify(item.value) : String(item.value);
        
        await sqlDb.exec(
            `INSERT OR REPLACE INTO nosql_export 
             (key, value, type, original_timestamp) VALUES (?, ?, ?, ?)`,
            [key, valueStr, item.type, new Date(item.timestamp).toISOString()]
        );
    }
    
    console.log('NoSQL data exported to SQL table "nosql_export"');
}

// Import SQL data to NoSQL
async function importSQLToNoSQL(tableName, keyColumn, valueColumn) {
    const results = await sqlDb.query(`SELECT ${keyColumn}, ${valueColumn} FROM ${tableName}`);
    
    if (results.length > 0) {
        for (const row of results[0].values) {
            const [key, value] = row;
            await db.set(`sql_${key}`, value);
        }
        console.log(`Imported ${results[0].values.length} records from SQL to NoSQL`);
    }
}

// Make utility functions available globally
window.exportNoSQLToSQL = exportNoSQLToSQL;
window.importSQLToNoSQL = importSQLToNoSQL;

// Example usage in terminal:
// db set user_count 150
// db sql SELECT COUNT(*) as total_products FROM products;
// db sql INSERT INTO products (name, price, category) VALUES ('New Product', 99.99, 'Gadgets');
// db get user_count
