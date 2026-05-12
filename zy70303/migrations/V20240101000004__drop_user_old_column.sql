-- 直接删除用户表的旧列（不可逆操作）
-- 注意：此脚本没有对应的回滚脚本
ALTER TABLE users DROP COLUMN IF EXISTS old_column;
