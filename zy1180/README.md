# PostgreSQL 迁移脚本风险分析工具

一个用于分析 PostgreSQL 数据库迁移脚本风险的本地 CLI 工具，帮助识别高危 DDL、锁等待链、长事务冲突、CONCURRENTLY 缺失、回滚不可逆步骤等问题，并生成分批上线方案。

## 功能特性

- **🔍 扫描模式 (scan)**: 解析迁移脚本，识别 DDL 操作和潜在风险
- **📋 计划模式 (plan)**: 生成分批上线执行计划，包含风险评估和回滚策略
- **🔗 重放模式 (replay)**: 结合 pg_stat_activity 数据分析锁等待链和长事务冲突
- **📊 报告导出 (export)**: 导出 Markdown/JSON 格式的详细分析报告
- **⚠️ 风险识别**:
  - 高危 DDL 操作（DROP TABLE、TRUNCATE、ALTER COLUMN TYPE 等）
  - 缺少 CONCURRENTLY 选项的索引操作
  - 不可逆操作（数据丢失风险）
  - ACCESS EXCLUSIVE 锁阻塞风险
  - 混合事务性和非事务性操作

## 安装

```bash
pip install -e .
```

或使用 poetry:

```bash
pip install poetry
poetry install
```

## 快速开始

### 1. 准备数据文件

在项目目录中准备以下文件（参考 `examples/` 目录）：

```
your-project/
├── migrations/              # 迁移脚本目录
│   ├── 0001_create_tables.sql
│   ├── 0002_add_indexes.sql
│   └── ...
├── schema.sql               # 数据库 schema
├── table-stats.csv          # 表统计信息
├── release-window.yaml      # 发布窗口配置
└── pg_stat_activity.json    # (可选) pg_stat_activity 导出
```

### 2. 执行扫描

```bash
# 基本扫描
pg-scan scan ./migrations

# 带表统计信息的扫描
pg-scan scan ./migrations --table-stats table-stats.csv

# 导出扫描报告
pg-scan scan ./migrations --table-stats table-stats.csv \
    --output report.md --format markdown
```

### 3. 生成执行计划

```bash
# 生成执行计划
pg-scan plan ./migrations \
    --table-stats table-stats.csv \
    --release-window release-window.yaml

# 导出计划报告
pg-scan plan ./migrations \
    --table-stats table-stats.csv \
    --release-window release-window.yaml \
    --output execution-plan.md
```

### 4. 重放分析（结合 pg_stat_activity）

```bash
# 分析锁等待链和长事务
pg-scan replay ./migrations pg_stat_activity.json \
    --table-stats table-stats.csv

# 导出重放分析报告
pg-scan replay ./migrations pg_stat_activity.json \
    --table-stats table-stats.csv \
    --output replay-analysis.json --format json
```

### 5. 导出完整报告

```bash
# 导出 Markdown 报告
pg-scan export ./migrations \
    --table-stats table-stats.csv \
    --release-window release-window.yaml \
    --pg-stat-activity pg_stat_activity.json \
    --output full-report.md --format markdown

# 导出 JSON 报告
pg-scan export ./migrations \
    --table-stats table-stats.csv \
    --output full-report.json --format json
```

## 数据文件格式

### table-stats.csv

表统计信息 CSV，用于评估操作风险和预估执行时间：

```csv
schema_name,table_name,row_count,size_bytes,n_live_tup,n_dead_tup,last_vacuum,last_analyze
public,users,1250000,524288000,1245000,5000,2024-01-15T03:00:00Z,2024-01-15T03:30:00Z
public,orders,8900000,2147483648,8850000,50000,2024-01-15T02:00:00Z,2024-01-15T02:30:00Z
```

**获取真实数据的 SQL：**

```sql
-- 在 PostgreSQL 中执行此查询获取表统计信息
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.reltuples::bigint AS row_count,
    pg_table_size(c.oid) AS size_bytes,
    c.reltuples::bigint AS n_live_tup,
    c.relfrozenxid::text::bigint AS n_dead_tup,  -- 近似值
    pg_stat_get_last_vacuum_time(c.oid) AS last_vacuum,
    pg_stat_get_last_analyze_time(c.oid) AS last_analyze
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_table_size(c.oid) DESC;
```

### release-window.yaml

发布窗口配置：

```yaml
environment: production

# 允许发布的星期几
allowed_days:
  - Monday
  - Tuesday
  - Wednesday
  - Thursday
  - Friday

# 允许发布的小时（24小时制）
allowed_hours:
  - 2
  - 3
  - 4
  - 5

# 单次发布最大允许时长（分钟）
max_duration_minutes: 120

# 高风险操作是否需要审批
high_risk_requires_approval: true

# 维护窗口时间
maintenance_window_start: "02:00"
maintenance_window_end: "06:00"
```

### pg_stat_activity.json

数据库活动快照，用于分析锁等待链：

```json
[
  {
    "pid": 12345,
    "usename": "app_user",
    "application_name": "webapp-01",
    "state": "active",
    "query": "SELECT * FROM orders WHERE user_id = $1 FOR UPDATE",
    "query_start": "2024-01-15T03:25:00Z",
    "xact_start": "2024-01-15T03:24:30Z",
    "wait_event": null,
    "wait_event_type": null
  },
  {
    "pid": 12346,
    "usename": "migration_user",
    "application_name": "flyway",
    "state": "active",
    "query": "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(12,2)",
    "query_start": "2024-01-15T03:25:05Z",
    "xact_start": "2024-01-15T03:25:05Z",
    "wait_event": "relation",
    "wait_event_type": "Lock",
    "blocking_pid": 12345,
    "wait_duration_seconds": 30.5
  }
]
```

**获取真实数据的 SQL：**

```sql
-- 在 PostgreSQL 中执行此查询获取活动会话信息
SELECT
    pid,
    usename,
    application_name,
    state,
    query,
    query_start,
    xact_start,
    state_change,
    wait_event,
    wait_event_type,
    backend_start
FROM pg_stat_activity
WHERE state != 'idle'
   OR wait_event IS NOT NULL;
```

## 风险类型说明

### 🔴 严重风险 (Critical)

| 类型 | 描述 | 建议 |
|------|------|------|
| `critical_ddl` | DROP TABLE、TRUNCATE、RENAME 等高危操作 | 确认是否必须执行，准备好备份和回滚方案 |
| `irreversible_operation` | 不可逆操作（数据丢失风险） | 执行前确保完整备份 |
| `alter_column_rewrite` | ALTER COLUMN TYPE 需要全表重写 | 使用 pg_repack 或在维护窗口执行 |
| `access_exclusive_lock` | 需要 ACCESS EXCLUSIVE 锁的大表操作 | 在低峰期或维护窗口执行 |

### 🟠 高风险 (High)

| 类型 | 描述 | 建议 |
|------|------|------|
| `missing_concurrently` | 索引操作缺少 CONCURRENTLY 选项 | 添加 CONCURRENTLY 避免阻塞写入 |
| `add_foreign_key` | 大表添加外键约束 | 使用 NOT VALID + VALIDATE 分步执行 |
| `add_unique_constraint` | 大表添加唯一约束 | 先 CREATE UNIQUE INDEX CONCURRENTLY |
| `mixed_transactional_ops` | 混合事务性和非事务性操作 | 将 CONCURRENTLY 操作分离到独立文件 |

### 🟡 中等风险 (Medium)

| 类型 | 描述 | 建议 |
|------|------|------|
| `multiple_access_exclusive` | 多个 ACCESS EXCLUSIVE 锁操作 | 考虑分批执行 |

## 最佳实践

### 1. 索引操作

**不推荐：**
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**推荐：**
```sql
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
```

### 2. 添加列带默认值

PostgreSQL 11+ 添加带默认值的列可以瞬间完成：

```sql
-- 安全且快速（PostgreSQL 11+）
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
```

### 3. 添加外键约束

**分步执行避免长时间锁：**

```sql
-- 第一步：创建 NOT VALID 约束（不扫描现有数据）
ALTER TABLE orders ADD CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;

-- 第二步：在低峰期 VALIDATE（只需要 SHARE UPDATE EXCLUSIVE 锁）
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user;
```

### 4. 更改列类型

对于大表，考虑使用 pg_repack 或 pg_squeeze：

```sql
-- 1. 创建新列
ALTER TABLE orders ADD COLUMN status_new VARCHAR(100);

-- 2. 批量更新数据（分批进行）
UPDATE orders SET status_new = status::VARCHAR(100) WHERE id BETWEEN 1 AND 10000;
-- ... 重复直到完成

-- 3. 在维护窗口切换列
BEGIN;
ALTER TABLE orders RENAME COLUMN status TO status_old;
ALTER TABLE orders RENAME COLUMN status_new TO status;
COMMIT;

-- 4. 确认无误后删除旧列
ALTER TABLE orders DROP COLUMN status_old;
```

## 测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=pg_migration_scanner

# 运行特定测试文件
pytest tests/test_ddl_parser.py
```

## 项目结构

```
pg-migration-scanner/
├── pg_migration_scanner/      # 主包
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── ddl_parser.py          # DDL 解析器
│   ├── risk_analyzer.py       # 风险分析引擎
│   ├── plan_generator.py      # 执行计划生成器
│   ├── data_loader.py         # 数据加载器
│   ├── exporter.py            # 报告导出器
│   ├── analyzer.py            # 核心分析器
│   └── cli.py                 # CLI 入口
├── examples/                   # 示例数据
│   ├── migrations/            # 示例迁移脚本
│   ├── schema.sql             # 示例 schema
│   ├── table-stats.csv        # 示例表统计
│   ├── release-window.yaml    # 示例发布窗口配置
│   └── pg_stat_activity.json  # 示例活动数据
├── test_data/                  # 测试数据
│   ├── bad_migrations/        # 坏样例迁移
│   └── table_stats_large.csv  # 大表统计数据
├── tests/                      # 测试文件
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_ddl_parser.py
│   ├── test_risk_analyzer.py
│   └── test_integration.py
├── pyproject.toml             # 项目配置
└── README.md
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意：** 此工具提供的风险评估和执行计划仅供参考。在生产环境执行任何 DDL 操作前，请：

1. 在测试环境验证迁移脚本
2. 确保有完整的数据库备份
3. 评估表大小和业务流量
4. 准备好回滚方案
5. 考虑使用 pg_stat_statements 监控实际执行情况
