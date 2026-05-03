-- 003_add_user_status_rollback.sql
-- 回滚用户状态字段
-- SQLite 不支持 DROP COLUMN，需要重建表

DROP INDEX IF EXISTS idx_users_status;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, username, email, password_hash, created_at, updated_at)
SELECT id, username, email, password_hash, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
