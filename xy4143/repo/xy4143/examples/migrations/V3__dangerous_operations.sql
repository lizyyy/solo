-- V3__危险操作示例
-- ⚠️ 这是一个有问题的迁移，用于演示规则检查
-- 问题：
-- 1. 没有回滚脚本
-- 2. 删除列（可能导致数据丢失）
-- 3. 删除索引
-- 4. 重命名列（可能破坏应用代码）

-- 删除一个列（危险！）
ALTER TABLE users DROP COLUMN is_active;

-- 删除索引
DROP INDEX IF EXISTS idx_users_username;

-- 重命名列（危险！）
ALTER TABLE users RENAME COLUMN updated_at TO modified_at;

-- ⚠️ 这里没有提供回滚脚本！
