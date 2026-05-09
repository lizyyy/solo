-- Migration: 003 - 添加邮箱唯一索引（高风险）
-- Version: 1.2.0
-- Risk: HIGH - 需要先清理重复数据
-- Description: 为 email 添加唯一约束

-- Up - Phase 1: Check for duplicates
-- First identify and fix duplicates before running this

-- Step 1: Find duplicates (run this first in dry-run)
-- SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;

-- Step 2: Add unique index CONCURRENTLY to avoid table lock
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_unique ON users(email);

-- Step 3: Add constraint
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE USING INDEX idx_users_email_unique;

-- Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
DROP INDEX IF EXISTS idx_users_email_unique;
