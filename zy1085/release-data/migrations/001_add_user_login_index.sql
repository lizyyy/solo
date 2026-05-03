-- Description: 为用户表添加登录时间索引
-- Module: auth
-- Depends On: 

-- 为用户表添加登录时间索引，提升登录日志查询性能
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_time);

-- Rollback:
-- DROP INDEX IF EXISTS idx_users_last_login;
