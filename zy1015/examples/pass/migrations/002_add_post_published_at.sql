-- 迁移 002: 为 posts 表添加发布时间字段
-- 安全的迁移：添加可空列

ALTER TABLE posts ADD COLUMN published_at DATETIME;

CREATE INDEX idx_posts_published_at ON posts(published_at);
