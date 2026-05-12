-- 为订单表添加状态列（大表，带默认值，可能导致全表重写）
ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';
