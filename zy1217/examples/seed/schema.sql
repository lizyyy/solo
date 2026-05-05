CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  order_status VARCHAR(20),
  total_amount DECIMAL(10,2),
  created_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE order_items (
  item_id INT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE products (
  product_id INT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50),
  price DECIMAL(10,2),
  stock_quantity INT,
  created_at DATETIME
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_total ON orders(total_amount);
