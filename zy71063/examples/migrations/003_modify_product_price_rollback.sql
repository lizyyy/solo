-- 回滚: 恢复产品价格字段类型
ALTER TABLE products MODIFY COLUMN price DECIMAL(10, 2) NULL;
