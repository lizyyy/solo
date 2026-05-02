-- 迁移 004: 更新数据
-- ⚠️ 高风险：UPDATE 没有 WHERE 子句

UPDATE posts SET status = 'published';
