-- 样本数据 - 用于验证迁移后的 schema

-- 插入测试用户
INSERT INTO users (username, email, password_hash, is_active) VALUES
('admin', 'admin@example.com', 'hashed_password_1', 1),
('user1', 'user1@example.com', 'hashed_password_2', 1),
('user2', 'user2@example.com', 'hashed_password_3', 0);

-- 插入用户资料
INSERT INTO user_profiles (user_id, first_name, last_name, bio) VALUES
(1, 'System', 'Administrator', 'The main administrator account'),
(2, 'John', 'Doe', 'Regular user account'),
(3, 'Jane', 'Smith', 'Inactive user account');
