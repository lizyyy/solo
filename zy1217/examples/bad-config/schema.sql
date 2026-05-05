CREATE TABLE users (
  user_id INT,
  username,
  email VARCHAR(100) NOT NULL,
  created_at DATETIME
);

CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50)
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES non_existent_table(id)
);

CREATE INDEX idx_orders ON orders(user_id);
CREATE INDEX idx_orders ON orders(user_id, created_at);
