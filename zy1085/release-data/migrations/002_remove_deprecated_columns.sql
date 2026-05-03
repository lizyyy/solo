-- Description: 修改用户表，移除废弃字段
-- Module: auth
-- Depends On: 001_add_user_login_index.sql
-- ⚠️ 破坏性变更：此迁移会删除数据

-- 移除 deprecated 字段（已废弃）
ALTER TABLE users DROP COLUMN IF EXISTS old_phone_number;
ALTER TABLE users DROP COLUMN IF EXISTS legacy_address;

-- Rollback:
-- ALTER TABLE users ADD COLUMN old_phone_number VARCHAR(20);
-- ALTER TABLE users ADD COLUMN legacy_address TEXT;
-- 注意：数据已丢失，需要从备份恢复
