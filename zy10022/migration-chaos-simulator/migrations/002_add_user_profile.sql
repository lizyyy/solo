-- Migration: 002 - 添加用户资料表
-- Version: 1.1.0
-- Description: 新增 user_profiles 表并关联 users

-- Up
CREATE TABLE IF NOT EXISTS user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    birth_date DATE,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Backfill existing users with empty profiles
INSERT INTO user_profiles (user_id, first_name, last_name)
SELECT id, SPLIT_PART(username, '_', 1), SPLIT_PART(username, '_', 2)
FROM users
WHERE id NOT IN (SELECT user_id FROM user_profiles);

-- Down
DROP INDEX IF EXISTS idx_user_profiles_user_id;
DROP TABLE IF EXISTS user_profiles;
