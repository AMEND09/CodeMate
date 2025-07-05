-- SQL Database Examples for CodeMate
-- This file demonstrates how to use the SQL database in CodeMate

-- 1. Create a simple users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    age INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert some sample data
INSERT INTO users (name, email, age) VALUES 
    ('Alice Johnson', 'alice@example.com', 28),
    ('Bob Smith', 'bob@example.com', 32),
    ('Carol Davis', 'carol@example.com', 25),
    ('David Wilson', 'david@example.com', 35);

-- 3. Create a posts table with foreign key
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- 4. Insert some posts
INSERT INTO posts (title, content, user_id) VALUES 
    ('Welcome to CodeMate', 'This is my first post using the SQL database!', 1),
    ('Learning SQL', 'SQL is really powerful for data management.', 2),
    ('Collaborative Coding', 'I love how we can share databases in real-time.', 1),
    ('Database Design', 'Proper schema design is crucial for applications.', 3);

-- 5. Example queries you can run:

-- Get all users
SELECT * FROM users;

-- Get users with their post count
SELECT u.name, u.email, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.name, u.email
ORDER BY post_count DESC;

-- Get posts with author names
SELECT p.title, p.content, u.name as author, p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
ORDER BY p.created_at DESC;

-- Find users by age range
SELECT name, email, age FROM users WHERE age BETWEEN 25 AND 30;

-- Update a user's information
UPDATE users SET age = 29 WHERE name = 'Alice Johnson';

-- Delete a specific post
DELETE FROM posts WHERE title = 'Learning SQL';

-- Advanced: Create an index for better performance
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Advanced: Create a view
CREATE VIEW user_posts AS
SELECT u.name, u.email, p.title, p.created_at
FROM users u
JOIN posts p ON u.id = p.user_id;

-- Query the view
SELECT * FROM user_posts WHERE name = 'Alice Johnson';

-- Use these commands in the terminal:
-- db sql CREATE TABLE test (id INTEGER, name TEXT);
-- db sql INSERT INTO test VALUES (1, 'Hello World');
-- db sql SELECT * FROM test;
