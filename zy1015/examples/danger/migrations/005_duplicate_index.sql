-- 迁移 005: 创建重复索引
-- ⚠️ 问题：创建与现有索引相同列的索引

CREATE INDEX idx_posts_user_id_new ON posts(user_id);
