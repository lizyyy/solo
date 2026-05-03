-- 002_add_user_profiles_rollback.sql
-- 回滚用户资料表

DROP INDEX IF EXISTS idx_user_profiles_user_id;
DROP TABLE IF EXISTS user_profiles;
