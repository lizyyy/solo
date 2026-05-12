-- 为订单项表创建索引（大表，使用 CONCURRENTLY 避免锁表）
CREATE INDEX CONCURRENTLY idx_order_items_order_id ON order_items (order_id);
