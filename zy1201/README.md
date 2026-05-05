# db-audit - 数据库性能体检 CLI

一个本地数据库性能体检工具，用于后端同学在项目上线前复盘数据库问题。

## 功能特性

- **连接池分析**：检测连接池配置是否合理，预测连接池耗尽风险
- **索引分析**：检测缺失索引、冗余索引、组合索引列数过多等问题
- **慢 SQL 扫描**：分析慢查询日志，检测全表扫描、filesort、临时表、前导通配符等问题
- **读写分离分析**：分析读写分离配置是否合理，评估实际读写比例
- **分库分表分析**：评估分片键选择是否合理，检测热点风险
- **性能模拟**：
  - 连接池耗尽模拟：模拟高并发下连接池竞争情况
  - 单条/批量写入性能对比：模拟不同批量大小的写入性能差异
- **报告导出**：支持 Markdown 和 JSON 格式报告
- **历史记录**：每次分析记录存入 SQLite，支持历史查询

## 安装

```bash
go install db-audit/cmd/db-audit@latest
```

或者从源码编译：

```bash
git clone <repo-url>
cd db-audit
go build -o db-audit ./cmd/db-audit
```

## 快速开始

### 1. 初始化工作目录

```bash
db-audit init
```

这会在当前目录创建以下示例文件：
- `db-profile.yaml` - 数据库连接池、索引、读写分离、分库分表配置
- `schema.sql` - 数据库表结构定义
- `slow.log` - MySQL 慢查询日志示例
- `write-batch.jsonl` - 写入操作日志示例

### 2. 带样例数据初始化

```bash
db-audit init --seed
```

这会同时创建一个预填充的示例分析会话，可直接用于体验报告导出功能。

### 3. 带坏配置示例初始化

```bash
db-audit init --bad-config
```

这会额外创建 `db-profile-bad.yaml`，包含各种常见的错误配置，用于测试工具的检测能力。

### 4. 执行分析

```bash
db-audit analyze
```

默认会使用当前目录的配置文件，也可以指定路径：

```bash
db-audit analyze \
  --profile ./config/db-profile.yaml \
  --schema ./sql/schema.sql \
  --slowlog ./logs/slow.log \
  --writebatch ./logs/write-batch.jsonl \
  --project my-project \
  --version v1.2.0
```

### 5. 执行性能模拟

连接池耗尽模拟：

```bash
db-audit simulate --type connection-pool --duration 10s --clients 50 --pool-size 10
```

写入性能模拟：

```bash
db-audit simulate --type write-performance --duration 5s
```

执行所有模拟：

```bash
db-audit simulate --type all
```

### 6. 导出报告

导出最新会话的 Markdown 报告：

```bash
db-audit export --format markdown --output ./report.md
```

导出指定会话的 JSON 报告：

```bash
db-audit export --session 1 --format json --output ./report.json
```

### 7. 查看历史会话

```bash
db-audit list
db-audit list --limit 20
```

## 输入文件说明

### db-profile.yaml

数据库连接池、索引、读写分离、分库分表配置文件。

```yaml
database:
  driver: mysql
  host: localhost
  port: 3306
  username: root
  password: ""
  database_name: mydb
  charset: utf8mb4

connection_pool:
  max_open_conns: 100        # 最大连接数
  max_idle_conns: 20         # 最大空闲连接数
  conn_max_lifetime: 1h      # 连接最大生命周期
  conn_max_idle_time: 30m    # 连接最大空闲时间
  acquire_timeout: 30s       # 获取连接超时时间

index:
  min_index_cardinality: 0.1      # 最小索引基数阈值
  max_composite_index_cols: 5      # 最大组合索引列数
  redundant_index_threshold: 0.8   # 冗余索引检测阈值

read_write:
  enabled: false
  read_endpoints:
    - localhost:3307
    - localhost:3308
  write_endpoint: localhost:3306
  read_ratio: 0.8

sharding:
  enabled: false
  strategy: mod
  shard_key: user_id
  shard_count: 4
  table_map:
    orders:
      shard_key: order_id
      strategy: range
```

### schema.sql

标准的 SQL CREATE TABLE 语句，支持解析：
- 列定义（名称、类型、约束）
- 主键、唯一索引、普通索引
- 外键约束

### slow.log

MySQL 慢查询日志格式，支持解析：
- 查询时间、锁等待时间
- 扫描行数、返回行数
- 全表扫描、全连接、文件排序、临时表等标志

### write-batch.jsonl

JSON Lines 格式的写入操作日志，每行一条记录：

```json
{
  "timestamp": "2026-05-04T10:00:00Z",
  "table": "orders",
  "operation": "INSERT",
  "row_count": 1,
  "column_count": 6,
  "data_size": 512,
  "duration_ms": 25,
  "transaction": "txn_001",
  "batch_size": 1
}
```

## 检测能力说明

### 连接池问题检测

| 问题 | 严重程度 | 描述 |
|------|----------|------|
| max_open_conns 未设置 | CRITICAL | 可能导致连接数无限制增长 |
| max_open_conns 过小 (< 10) | HIGH | 高并发下可能耗尽 |
| max_idle_conns > max_open_conns | MEDIUM | 配置不合理 |
| conn_max_lifetime 未设置 | MEDIUM | 可能导致连接老化 |
| acquire_timeout 未设置 | MEDIUM | 可能导致请求堆积 |

### 索引问题检测

| 问题 | 严重程度 | 描述 |
|------|----------|------|
| 表缺少主键 | CRITICAL | 影响性能和复制 |
| 慢查询中使用的列无索引 | HIGH | 导致全表扫描 |
| 组合索引列数过多 (>5) | MEDIUM | 维护成本高 |
| 主键列上重复索引 | MEDIUM | 冗余，浪费空间 |

### 慢查询问题检测

| 问题 | 严重程度 | 描述 |
|------|----------|------|
| 查询时间过长 (>10s) | CRITICAL | 严重性能问题 |
| 全表扫描 (Full Scan) | HIGH | 无索引或索引未使用 |
| 全表连接 (Full Join) | CRITICAL | 连接条件无索引 |
| 磁盘临时表 | HIGH | 内存临时表不够用 |
| 文件排序 (Filesort) | MEDIUM | ORDER BY 无索引 |
| 内存临时表 | LOW | GROUP BY/ORDER BY 导致 |
| 扫描行数 >> 返回行数 | HIGH | 索引效率低 |
| SELECT * | LOW | 不必要的数据传输 |
| 前导通配符 LIKE | MEDIUM | 无法使用索引 |
| 大 OFFSET 深分页 | MEDIUM | 效率低 |

### 读写分离问题检测

| 问题 | 描述 |
|------|------|
| 启用但无读端点 | 配置不完整 |
| 仅一个读端点 | 无法高可用 |
| 读比例配置不合理 | 应在 (0,1) 之间 |
| 实际读比例高但未启用 | 建议启用 |

### 分库分表问题检测

| 问题 | 描述 |
|------|------|
| 启用但无分片键 | 配置不完整 |
| 分片数量 <= 0 或 = 1 | 配置无效 |
| 表级分片键未配置 | 配置不完整 |
| 表级分片策略未配置 | 配置不完整 |
| 取模分片策略 | 扩容需要数据迁移 |
| 分片键区分度低 | 存在热点风险 |

## 坏配置示例 (db-profile-bad.yaml)

以下是一些常见的错误配置，工具会检测这些问题：

```yaml
connection_pool:
  max_open_conns: 5        # 太小
  max_idle_conns: 20       # 大于 max_open_conns
  conn_max_lifetime: 0     # 未设置
  acquire_timeout: 0       # 未设置

read_write:
  enabled: true
  read_endpoints: []       # 空列表
  read_ratio: 1.5          # 大于 1，无效

sharding:
  enabled: true
  shard_key: ""            # 空
  shard_count: 1           # 无意义
```

## 输出示例

### Markdown 报告示例

```markdown
# 数据库性能体检报告

**生成时间**: 2026-05-05 10:00:00
**项目名称**: my-project
**版本**: v1.2.0
**会话ID**: 1

---

## 总体评估

**总体评级**: POOR

**问题总数**: 5
- 严重 (CRITICAL): 2
- 高 (HIGH): 2
- 中 (MEDIUM): 1

### 关键建议

1. 连接池未设置最大连接数，存在连接数无限增长风险
2. 表 orders 缺少主键
...

## 瓶颈分析

| 优先级 | 类别 | 描述 | 严重程度 | 影响评分 |
|--------|------|------|----------|----------|
| 1 | connection_pool | 连接池未设置最大连接数... | CRITICAL | 10.0 |
| 2 | connection_pool | 连接池最大连接数过小 (5)... | HIGH | 8.0 |
...
```

### JSON 报告示例

```json
{
  "project_name": "my-project",
  "version": "v1.2.0",
  "generated_at": "2026-05-05T10:00:00Z",
  "session_id": 1,
  "status": "completed",
  "summary": {
    "total_bottlenecks": 5,
    "critical_count": 2,
    "high_count": 2,
    "medium_count": 1,
    "overall_rating": "POOR",
    "top_recommendations": [
      "连接池未设置最大连接数，存在连接数无限增长风险",
      "表 orders 缺少主键"
    ]
  },
  "connection_pool": {
    "max_open_conns": 5,
    "max_idle_conns": 20,
    "rating": "CRITICAL",
    "issues": [
      "max_open_conns=5 过小，可能在高并发下导致连接池耗尽"
    ],
    "suggestions": [
      "建议增大 max_open_conns 到至少 20-50"
    ]
  },
  ...
}
```

## 运行测试

```bash
go test ./tests/... -v
```

## 项目结构

```
db-audit/
├── cmd/
│   └── db-audit/
│       └── main.go         # CLI 入口
├── internal/
│   ├── analyzer/
│   │   └── analyzer.go     # 分析引擎
│   ├── cli/
│   │   └── cli.go          # CLI 命令实现
│   ├── config/
│   │   ├── model.go        # 配置数据模型
│   │   └── parser.go       # 配置文件解析器
│   ├── reporter/
│   │   └── reporter.go     # 报告生成器
│   ├── simulator/
│   │   └── simulator.go    # 性能模拟器
│   └── storage/
│       ├── model.go        # 存储数据模型
│       └── sqlite.go       # SQLite 存储实现
├── tests/
│   ├── config_test.go      # 配置解析测试
│   └── storage_test.go     # 存储层测试
├── go.mod
├── go.sum
└── README.md
```

## 常见问题

### Q: 必须提供所有输入文件吗？

A: 不需要。工具会自动检测当前目录下存在的文件，也可以通过命令行参数指定。如果某些文件缺失，对应类型的分析会被跳过。

### Q: 支持哪些数据库？

A: 当前版本主要针对 MySQL 设计，包括：
- MySQL 慢查询日志格式
- MySQL CREATE TABLE 语法

未来可能支持更多数据库。

### Q: 如何获取真实的慢查询日志？

A: 在 MySQL 中启用慢查询日志：

```sql
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 2;  -- 2秒以上的查询
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
```

### Q: 工具会连接真实数据库吗？

A: 不会。这是一个**离线分析工具**，只读取提供的配置文件和日志文件，**不会**建立任何数据库连接。这意味着：
- 可以在任何环境运行，无需数据库访问权限
- 不会对生产数据库造成任何影响
- 适合在 CI/CD 流程中作为上线前检查

## License

MIT
