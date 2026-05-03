-- 003_add_user_status.sql
-- 添加用户状态字段

ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN last_login_at DATETIME;

CREATE INDEX idx_users_status ON users(status);
