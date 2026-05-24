-- 为订单表添加用户ID索引
ALTER TABLE orders ADD INDEX idx_user_id (user_id) ALGORITHM=INPLACE LOCK=NONE;
