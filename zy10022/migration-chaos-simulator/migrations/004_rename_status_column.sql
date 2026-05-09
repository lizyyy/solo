-- Migration: 004 - 重命名 status 列（零停机策略）
-- Version: 2.0.0
-- Description: 将 status 列重命名为 user_status，使用双写策略

-- Up
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN user_status VARCHAR(50) DEFAULT 'active';

-- Step 2: Backfill existing data
UPDATE users SET user_status = status WHERE user_status IS NULL;

-- Step 3: Create trigger for dual-write
-- (Application should also write to both columns during transition)

CREATE OR REPLACE FUNCTION sync_user_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_status IS DISTINCT FROM OLD.status THEN
        NEW.user_status := NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_user_status
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION sync_user_status();

-- Down
DROP TRIGGER IF EXISTS trigger_sync_user_status ON users;
DROP FUNCTION IF EXISTS sync_user_status();
ALTER TABLE users DROP COLUMN IF EXISTS user_status;
