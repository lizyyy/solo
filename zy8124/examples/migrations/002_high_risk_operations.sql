-- 002_high_risk_operations.sql
-- 包含高风险操作和边界情况的迁移脚本

-- 高风险：创建索引不使用 CONCURRENTLY
CREATE INDEX idx_posts_created_at ON posts(created_at);

-- 高风险：修改列类型
ALTER TABLE posts ALTER COLUMN status TYPE VARCHAR(30);

-- 高风险：设置 NOT NULL 约束
ALTER TABLE posts ALTER COLUMN content SET NOT NULL;

-- 高风险：没有 WHERE 条件的 UPDATE
UPDATE users SET updated_at = CURRENT_TIMESTAMP;

-- 中风险：添加列
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;

-- 中风险：添加列带默认值（PostgreSQL 11+ 是安全的）
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- 高风险：删除列
ALTER TABLE users DROP COLUMN password_hash;

-- 高风险：添加唯一约束
ALTER TABLE users ADD CONSTRAINT uk_users_username UNIQUE(username);

-- 高风险：添加外键
ALTER TABLE posts ADD CONSTRAINT fk_posts_user 
    FOREIGN KEY (user_id) REFERENCES users(id);

-- 高风险：TRUNCATE
TRUNCATE TABLE comments;

-- 边界情况：事务块中混合 DDL 和 DML
BEGIN;
    ALTER TABLE posts ADD COLUMN view_count INTEGER DEFAULT 0;
    UPDATE posts SET view_count = 0;
COMMIT;

-- 边界情况：CONCURRENTLY 位置错误（应该在 CREATE INDEX 之后）
CREATE INDEX idx_comments_created_at ON comments(created_at) CONCURRENTLY;

-- 边界情况：事务块中使用 CONCURRENTLY（这会导致错误）
BEGIN;
    CREATE INDEX CONCURRENTLY idx_users_updated_at ON users(updated_at);
COMMIT;

-- 低风险：使用 CONCURRENTLY 的正确示例
CREATE INDEX CONCURRENTLY idx_posts_title ON posts(title);

-- 低风险：分批 UPDATE 示例（有 WHERE 条件）
UPDATE posts SET status = 'published' WHERE status = 'public' AND id < 1000;

-- 低风险：分批 DELETE 示例（有 WHERE 条件）
DELETE FROM comments WHERE created_at < '2020-01-01' AND id < 1000;