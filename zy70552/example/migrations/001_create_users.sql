-- UP
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100));
INSERT INTO users (id, name, email) VALUES (1, "Test", "test@example.com");

-- ROLLBACK
DROP TABLE users;