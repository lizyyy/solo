-- 迁移 002: 语法错误
-- 这个会执行失败 - 缺少列定义

CREATE TABLE broken_table (
  id INTEGER PRIMARY KEY,
  -- 错误：缺少列名
  TEXT NOT NULL
);
