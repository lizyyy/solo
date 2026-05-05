# SQLite Diagnostic CLI

一个用于诊断 SQLite 数据库问题的命令行工具，帮助你分析：
- "database is locked" 错误
- WAL 文件无限增长
- 长读事务阻塞 checkpoint
- 写锁互斥问题
- 迁移表重建风险
- 配置不合理问题

## 安装

```bash
pip install -r requirements.txt
chmod +x sqlite-diagnostic
```

## 快速开始

### 1. 初始化样例数据

```bash
# 生成所有样例（正常 + 坏样例）
./sqlite-diagnostic init

# 只生成正常样例
./sqlite-diagnostic init --type normal

# 只生成坏样例
./sqlite-diagnostic init --type bad

# 指定输出目录
./sqlite-diagnostic init -o ./my-samples
```

### 2. 快速检查数据库

```bash
# 检查数据库基本信息和 pragma 配置
./sqlite-diagnostic inspect --db ./samples/normal/app.db
```

### 3. 运行完整分析

```bash
# 分析正常样例（应该很少或没有问题）
./sqlite-diagnostic analyze \
  --db ./samples/normal/app.db \
  --trace-log ./samples/normal/sqlite-trace.log \
  --migrations ./samples/normal/migrations \
  --pragma ./samples/normal/pragma.conf \
  --workload ./samples/normal/workload.log

# 分析坏样例 - 长读事务
./sqlite-diagnostic analyze \
  --trace-log ./samples/bad/long-read-transactions/sqlite-trace.log \
  --workload ./samples/bad/long-read-transactions/workload.log

# 分析坏样例 - 锁竞争
./sqlite-diagnostic analyze \
  --trace-log ./samples/bad/lock-contention/sqlite-trace.log

# 分析坏样例 - WAL 增长
./sqlite-diagnostic analyze \
  --db ./samples/bad/wal-growth/app.db \
  --pragma ./samples/bad/wal-growth/pragma.conf

# 分析坏样例 - 迁移风险
./sqlite-diagnostic analyze \
  --migrations ./samples/bad/migration-risks/migrations
```

### 4. 导出报告

```bash
# 导出 Markdown 格式
./sqlite-diagnostic analyze \
  --db ./samples/normal/app.db \
  --trace-log ./samples/normal/sqlite-trace.log \
  -o report.md -f markdown

# 导出 JSON 格式
./sqlite-diagnostic analyze \
  --db ./samples/normal/app.db \
  -o report.json -f json

# 导出 CSV 格式
./sqlite-diagnostic analyze \
  --db ./samples/normal/app.db \
  -o report.csv -f csv
```

### 5. 运行模拟

```bash
# 基本模拟
./sqlite-diagnostic simulate \
  --workload ./samples/normal/workload.log

# 模拟不同参数组合
./sqlite-diagnostic simulate \
  --workload ./samples/normal/workload.log \
  --db ./samples/normal/app.db \
  --batch-size 10 --batch-size 100 --batch-size 1000 \
  --journal-mode wal --journal-mode delete \
  --checkpoint-mode passive --checkpoint-mode full --checkpoint-mode truncate \
  --busy-timeout 1000 --busy-timeout 5000 --busy-timeout 30000 \
  -o simulation-report.md -f markdown
```

## 支持的分析项

| 分析项 | 检测内容 | 严重程度 |
|--------|----------|----------|
| 长读事务检测 | 超过阈值的读事务和慢查询 | 中/高 |
| 写锁互斥分析 | 锁冲突事件、并发写入 | 中/高 |
| Checkpoint 分析 | WAL 过大、慢 checkpoint、失败 checkpoint | 中/高 |
| Busy Timeout 分析 | 超时时间不合理、BUSY 事件 | 中 |
| 外键约束分析 | 外键是否启用 | 中 |
| 迁移风险分析 | 表重建、DROP TABLE、ALTER TABLE | 中/高 |
| WAL 增长分析 | WAL 大于主库、checkpoint 阻塞 | 中/高 |

## 支持的导入格式

### 1. SQLite 数据库文件 (app.db)

直接导入 `.db` 文件，自动读取：
- 数据库大小
- WAL 文件大小
- 所有 PRAGMA 配置

### 2. SQLite Trace 日志

支持多种格式的 trace 日志：
```
2024-01-15 10:30:00.123 [conn:1] SELECT - 45.6ms - SELECT * FROM users
2024-01-15 10:30:01.456 [conn:2] INSERT orders - lock wait: 500ms - database is locked
```

### 3. 迁移文件目录

```
migrations/
├── 001_initial.up.sql
├── 002_add_indexes.up.sql
└── 003_add_foreign_key.up.sql
```

### 4. PRAGMA 配置文件

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

### 5. 工作负载日志

```
2024-01-15 10:30:00.123 [conn:1] [txn:100] BEGIN
2024-01-15 10:30:00.125 [conn:1] [txn:100] SELECT users - 2.3ms - 1 rows affected
2024-01-15 10:30:00.128 [conn:1] [txn:100] UPDATE orders - 15.6ms - 1 rows affected
2024-01-15 10:30:00.130 [conn:1] [txn:100] COMMIT - 1.2ms
```

## 样例说明

### 正常样例 (`samples/normal/`)

一个配置合理、运行正常的 SQLite 数据库：

| 文件 | 说明 |
|------|------|
| `app.db` | 配置正确的数据库（WAL 模式、合理的 pragma） |
| `sqlite-trace.log` | 正常的 trace 日志（无锁冲突、无慢查询） |
| `migrations/` | 安全的迁移文件（无表重建） |
| `pragma.conf` | 推荐的生产配置 |
| `workload.log` | 正常的工作负载（读写比 7:3） |

### 坏样例 (`samples/bad/`)

#### 1. 长读事务 (`long-read-transactions/`)

模拟长读事务阻塞 checkpoint 的场景：

```bash
# 分析这个样例
./sqlite-diagnostic analyze \
  --trace-log ./samples/bad/long-read-transactions/sqlite-trace.log \
  --workload ./samples/bad/long-read-transactions/workload.log
```

**问题特征：**
- 读事务持续 10-60 秒
- 会阻止 WAL checkpoint
- 导致 WAL 文件持续增长

#### 2. 锁竞争 (`lock-contention/`)

模拟高并发写入导致的锁冲突：

```bash
# 分析这个样例
./sqlite-diagnostic analyze \
  --trace-log ./samples/bad/lock-contention/sqlite-trace.log
```

**问题特征：**
- 频繁的 "database is locked" 错误
- 多个连接同时写入同一张表
- 长时间持有 EXCLUSIVE 锁

#### 3. WAL 增长 (`wal-growth/`)

模拟 WAL 文件无限增长的场景：

```bash
# 分析这个样例
./sqlite-diagnostic analyze \
  --db ./samples/bad/wal-growth/app.db \
  --pragma ./samples/bad/wal-growth/pragma.conf
```

**问题特征：**
- `wal_autocheckpoint` 设置过低（100 页）
- `busy_timeout` 设置过短（1000ms）
- 大量写入操作

#### 4. 迁移风险 (`migration-risks/`)

模拟有风险的数据库迁移：

```bash
# 分析这个样例
./sqlite-diagnostic analyze \
  --migrations ./samples/bad/migration-risks/migrations
```

**风险类型：**
- `001_rebuild_table.up.sql` - 使用 CREATE TABLE ... AS SELECT 重建大表
- `002_alter_column.up.sql` - 修改列类型（SQLite 需要表重建）
- `003_drop_table.up.sql` - DROP TABLE 操作

## 完整使用示例

### 场景 1：诊断 "database is locked" 错误

```bash
# 1. 先检查数据库配置
./sqlite-diagnostic inspect --db /path/to/app.db

# 2. 分析 trace 日志中的锁冲突
./sqlite-diagnostic analyze \
  --db /path/to/app.db \
  --trace-log /path/to/sqlite-trace.log \
  -o lock-analysis.md

# 3. 查看报告
cat lock-analysis.md
```

### 场景 2：诊断 WAL 文件增长

```bash
# 1. 检查 WAL 大小和配置
./sqlite-diagnostic inspect --db /path/to/app.db

# 2. 分析长读事务和 checkpoint 问题
./sqlite-diagnostic analyze \
  --db /path/to/app.db \
  --workload /path/to/workload.log \
  -o wal-analysis.md

# 3. 模拟优化参数
./sqlite-diagnostic simulate \
  --workload /path/to/workload.log \
  --journal-mode wal --journal-mode delete \
  --checkpoint-mode passive --checkpoint-mode truncate \
  -o simulation.md
```

### 场景 3：迁移前风险评估

```bash
# 分析迁移文件
./sqlite-diagnostic analyze \
  --migrations /path/to/migrations \
  -o migration-risk.md

# 查看风险报告
cat migration-risk.md
```

## 命令参考

### `init` - 初始化样例

```bash
./sqlite-diagnostic init [OPTIONS]

选项：
  -o, --output-dir DIRECTORY  输出目录 [默认: ./samples]
  -t, --type [normal|bad|both]  生成样例类型 [默认: both]
```

### `inspect` - 快速检查

```bash
./sqlite-diagnostic inspect [OPTIONS]

选项：
  -d, --db PATH         SQLite 数据库文件路径 [必需]
  -o, --output PATH     输出文件路径
```

### `analyze` - 运行分析

```bash
./sqlite-diagnostic analyze [OPTIONS]

选项：
  -d, --db PATH         SQLite 数据库文件路径 [必需]
  -t, --trace-log PATH  SQLite trace 日志文件路径
  -m, --migrations PATH 迁移文件目录路径
  -p, --pragma PATH     PRAGMA 配置文件路径
  -w, --workload PATH   工作负载日志文件路径
  -o, --output PATH     输出文件路径
  -f, --format [markdown|json|csv]  输出格式 [默认: markdown]
```

### `simulate` - 运行模拟

```bash
./sqlite-diagnostic simulate [OPTIONS]

选项：
  -w, --workload PATH       工作负载日志文件路径 [必需]
  -d, --db PATH             基准数据库文件路径
  -b, --batch-size INTEGER  测试的批处理大小（可多个）
  -j, --journal-mode TEXT   测试的日志模式 [wal|delete|truncate|persist|memory|off]
  -c, --checkpoint-mode TEXT  测试的 Checkpoint 模式 [passive|full|restart|truncate]
  -t, --busy-timeout INTEGER  测试的 busy_timeout (毫秒)
  -o, --output PATH         输出文件路径
  -f, --format [markdown|json|csv]  输出格式 [默认: markdown]
```

## 输出格式说明

### Markdown 格式

适合人类阅读的报告格式，包含：
- 基本信息表格
- 问题分析（按严重程度排序）
- 优化建议
- 模拟结果对比

### JSON 格式

适合程序处理的格式，包含完整的结构化数据。

### CSV 格式

适合导入到表格软件进行进一步分析。

## 常见问题

### Q: 为什么 WAL 文件会无限增长？

最常见的原因：
1. **长读事务** - 读事务会阻止 checkpoint 回收 WAL 页
2. **checkpoint 配置不当** - `wal_autocheckpoint` 设置过高或过低
3. **没有 checkpoint 触发** - 应用从不执行 checkpoint

### Q: 如何避免 "database is locked" 错误？

建议：
1. 使用 WAL 模式：`PRAGMA journal_mode = WAL;`
2. 设置合理的 busy_timeout：`PRAGMA busy_timeout = 30000;`
3. 保持事务尽可能短小
4. 考虑单一写进程架构
5. 使用批量写入减少事务数量

### Q: 迁移时如何避免锁表？

对于大表迁移：
1. 考虑使用 `sqlite3_sessions` 扩展
2. 使用在线迁移工具（如 `sqldef`）
3. 在低峰期执行迁移
4. 设置更长的 busy_timeout
5. 考虑分批迁移

## 许可证

MIT License
