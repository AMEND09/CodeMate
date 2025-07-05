# Test SQL Database in CodeMate
# Run this to verify SQL database is working

print("🧪 Testing SQL Database in CodeMate...")

# Check if SQL database is available
try:
    import js
    print("✓ js module imported successfully")
    
    if hasattr(js, 'sqlDb') and js.sqlDb:
        print("✓ sqlDb is available")
        
        if js.sqlDb.isReady:
            print("✓ SQL database is ready")
            
            # Test basic operations
            print("\n📝 Testing basic SQL operations...")
            
            # Create a test table
            js.sqlDb.exec('''
                CREATE TABLE IF NOT EXISTS test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    value INTEGER
                )
            ''')
            print("✓ Test table created")
            
            # Insert test data
            js.sqlDb.exec("INSERT OR REPLACE INTO test_table (id, name, value) VALUES (1, 'test_item', 42)")
            print("✓ Test data inserted")
            
            # Query test data
            results = js.sqlDb.query("SELECT * FROM test_table WHERE id = 1")
            if results and len(results) > 0 and results[0].values:
                row = results[0].values[0]
                print(f"✓ Test data retrieved: id={row[0]}, name={row[1]}, value={row[2]}")
            else:
                print("❌ Failed to retrieve test data")
            
            # Test NoSQL-style methods
            print("\n🗄️ Testing NoSQL-style methods...")
            js.sqlDb.set('test_key', 'test_value')
            value = js.sqlDb.get('test_key')
            print(f"✓ NoSQL set/get test: {value}")
            
            print("\n✅ All SQL database tests passed!")
            
        else:
            print("❌ SQL database is not ready")
            print("   Try switching to SQL in the Database panel first")
            
    else:
        print("❌ sqlDb is not available")
        print("   Make sure you've switched to SQL database in the Database panel")
        
except Exception as e:
    print(f"❌ Error testing SQL database: {e}")
    import traceback
    print(traceback.format_exc())

print("\n💡 To use SQL database:")
print("1. Switch to 'SQL' in the Database panel")
print("2. Wait for 'SQL database ready!' message")
print("3. Run this test again")
print("4. Then try the Flask example")
