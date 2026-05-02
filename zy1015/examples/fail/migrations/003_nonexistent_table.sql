-- 迁移 003: 引用不存在的表
-- 这个会执行失败 - 表不存在

ALTER TABLE nonexistent_table ADD COLUMN new_column TEXT;
