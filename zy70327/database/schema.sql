-- 慢接口自动归档数据库 schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 归档状态枚举
CREATE TYPE archive_status AS ENUM (
  'pending',      -- 待看
  'processing',   -- 处理中
  'resolved',     -- 已修复
  'false_positive' -- 误报
);

-- 归档类别枚举
CREATE TYPE archive_category AS ENUM (
  'database_slow',      -- 数据库慢
  'downstream_slow',    -- 下游慢
  'cache_penetration',  -- 缓存穿透
  'parameter_error',    -- 参数异常
  'unknown'             -- 未知
);

-- 归档表 - 存储归档后的慢接口问题
CREATE TABLE IF NOT EXISTS archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_path TEXT NOT NULL,                 -- API 路径
  http_method TEXT NOT NULL,              -- HTTP 方法
  category archive_category NOT NULL DEFAULT 'unknown',  -- 归档类别
  status archive_status NOT NULL DEFAULT 'pending',      -- 处理状态
  responsible TEXT,                        -- 负责人
  notes TEXT,                              -- 处理备注
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),  -- 首次出现时间
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),   -- 最后出现时间
  occurrence_count INTEGER NOT NULL DEFAULT 1,  -- 出现次数
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(api_path, http_method)
);

CREATE INDEX IF NOT EXISTS idx_archives_status ON archives(status);
CREATE INDEX IF NOT EXISTS idx_archives_category ON archives(category);
CREATE INDEX IF NOT EXISTS idx_archives_last_seen ON archives(last_seen_at);

-- 样本表 - 存储慢请求样本
CREATE TABLE IF NOT EXISTS samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_id UUID NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
  trace_id TEXT,                          -- traceId (可能为空)
  request_url TEXT NOT NULL,
  http_method TEXT NOT NULL,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_time_ms INTEGER NOT NULL,      -- 响应时间 (ms)
  user_id TEXT,
  ip_address TEXT,
  sql_summaries JSONB,                    -- SQL 摘要数组
  external_deps JSONB,                    -- 外部依赖数组
  raw_log TEXT,                           -- 原始日志
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samples_archive_id ON samples(archive_id);
CREATE INDEX IF NOT EXISTS idx_samples_trace_id ON samples(trace_id);
CREATE INDEX IF NOT EXISTS idx_samples_created_at ON samples(created_at);

-- 历史记录表 - 存储状态变更和操作历史
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  archive_id UUID NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                   -- 操作类型: status_change, note_update, category_change 等
  old_value TEXT,                         -- 旧值
  new_value TEXT,                         -- 新值
  operator TEXT,                          -- 操作人
  comment TEXT,                           -- 备注/说明
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_archive_id ON history(archive_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);

-- SQL 摘要表 - 存储详细的 SQL 信息
CREATE TABLE IF NOT EXISTS sql_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  sql_hash TEXT NOT NULL,                 -- SQL 哈希值，用于去重
  sql_template TEXT NOT NULL,             -- SQL 模板（去掉参数）
  execution_time_ms INTEGER NOT NULL,     -- 执行时间 (ms)
  rows_affected INTEGER,                  -- 影响行数
  database_type TEXT,                     -- 数据库类型: mysql, postgresql 等
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sql_summaries_sample_id ON sql_summaries(sample_id);
CREATE INDEX IF NOT EXISTS idx_sql_summaries_sql_hash ON sql_summaries(sql_hash);

-- 外部依赖表 - 存储详细的外部依赖调用信息
CREATE TABLE IF NOT EXISTS external_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  dep_name TEXT NOT NULL,                 -- 依赖名称
  dep_type TEXT NOT NULL,                 -- 依赖类型: http, redis, mq 等
  execution_time_ms INTEGER NOT NULL,     -- 执行时间 (ms)
  endpoint TEXT,                          -- 端点/地址
  status TEXT,                            -- 状态: success, timeout, error 等
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_deps_sample_id ON external_dependencies(sample_id);
CREATE INDEX IF NOT EXISTS idx_external_deps_dep_name ON external_dependencies(dep_name);

-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_archives_updated_at BEFORE UPDATE ON archives
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();