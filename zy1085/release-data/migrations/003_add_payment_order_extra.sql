-- Description: 新增支付订单扩展表
-- Module: payment
-- Depends On: 

-- 为支付系统添加订单扩展信息表
CREATE TABLE IF NOT EXISTS payment_order_extra (
  order_id BIGINT PRIMARY KEY,
  extra_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_order_extra_order_id ON payment_order_extra(order_id);

-- Rollback:
-- DROP TABLE IF EXISTS payment_order_extra;
