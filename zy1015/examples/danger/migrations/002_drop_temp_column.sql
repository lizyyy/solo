-- 迁移 002: 删除临时列
-- ⚠️ 高风险操作：DROP COLUMN

ALTER TABLE posts DROP COLUMN temp_column;
