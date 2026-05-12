-- 回滚：删除订单表状态列
ALTER TABLE orders DROP COLUMN IF EXISTS status;
