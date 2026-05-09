-- Migration: 005 - 添加订单项表
-- Version: 2.1.0
-- Description: 订单分解为订单和订单项

-- Up
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Backfill: create order_items from orders (assuming each order has one item for demo)
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
SELECT 
    id, 
    1, 
    'Default Product', 
    1, 
    amount, 
    amount
FROM orders
WHERE id NOT IN (SELECT order_id FROM order_items);

-- Down
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
DROP TABLE IF EXISTS order_items;
