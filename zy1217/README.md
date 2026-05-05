# db-workload-gate

数据库 Workload 回放闸门工具 - 数据库改造上线前的综合分析工具

## 功能特性

- 📊 **多维度分析**: 连接池排队、逐条/批量写入差异、缺失或冗余索引、慢SQL、读写分离路由误判、分库分表热点
- ✅ **配置校验**: 全面的坏配置检测，确保输入数据格式正确
- 📝 **报告生成**: 支持 Markdown 和 JSON 格式的详细报告输出
- 💾 **SQLite 留痕**: 历史分析记录持久化，支持回溯和对比
- 🎯 **上线判定**: 自动判断是否可以安全上线，识别阻塞项

## 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（可选）
npm link
```

## 快速开始

### 1. 准备输入文件

将以下文件放置在工作目录中：

| 文件名 | 描述 | 必需 |
|--------|------|------|
| `db-profile.yaml` | 数据库配置和连接池参数 | ✅ |
| `schema.sql` | 数据库表结构和索引定义 | ✅ |
| `sql-trace.jsonl` | SQL 执行追踪记录 | ✅ |
| `write-batches.csv` | 批量写入操作记录 | ✅ |
| `sharding-plan.yaml` | 分库分表配置 | ❌ |

### 2. 使用样例数据测试

```bash
# 复制样例文件到当前目录
cp -r examples/seed/* ./

# 执行完整分析
npm run dev -- analyze
```

### 3. 查看分析结果

分析完成后，会在当前目录生成：
- `analysis-report-<timestamp>.md` - Markdown 格式报告
- `analysis-trace.db` - SQLite 历史记录数据库

## 命令说明

### analyze - 执行完整分析

```bash
db-gate analyze [options]
```

**选项:**

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `-p, --profile <path>` | db-profile.yaml 文件路径 | `db-profile.yaml` |
| `-s, --schema <path>` | schema.sql 文件路径 | `schema.sql` |
| `-t, --trace <path>` | sql-trace.jsonl 文件路径 | `sql-trace.jsonl` |
| `-b, --batches <path>` | write-batches.csv 文件路径 | `write-batches.csv` |
| `-d, --sharding <path>` | sharding-plan.yaml 文件路径 | 无 |
| `--slow-threshold <ms>` | 慢 SQL 阈值（毫秒） | `500` |
| `-o, --output <format>` | 输出格式: markdown\|json\|both | `markdown` |
| `--output-dir <dir>` | 输出目录 | `.` |
| `--no-sqlite` | 禁用 SQLite 留痕 | 开启 |
| `--sqlite-path <path>` | SQLite 数据库路径 | `./analysis-trace.db` |
| `--skip-validation` | 跳过配置校验 | 关闭 |

**示例:**

```bash
# 基本用法
db-gate analyze

# 指定文件路径
db-gate analyze \
  -p ./config/db-profile.yaml \
  -s ./config/schema.sql \
  -t ./data/sql-trace.jsonl \
  -b ./data/write-batches.csv \
  -d ./config/sharding-plan.yaml

# 自定义慢 SQL 阈值和输出格式
db-gate analyze \
  --slow-threshold 1000 \
  -o both \
  --output-dir ./reports
```

### validate - 仅执行配置校验

```bash
db-gate validate [options]
```

**选项:** 与 `analyze` 命令相同（除输出相关选项）

**示例:**

```bash
# 校验配置
db-gate validate

# 校验坏配置样例
cd examples/bad-config
db-gate validate
```

### history - 查看历史分析记录

```bash
db-gate history [options]
```

**选项:**

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--sqlite-path <path>` | SQLite 数据库路径 | `./analysis-trace.db` |
| `-l, --limit <number>` | 显示最近 N 条记录 | `10` |

**示例:**

```bash
# 查看最近 10 条记录
db-gate history

# 查看最近 50 条记录
db-gate history -l 50
```

### seed - 样例文件提示

```bash
db-gate seed [options]
```

**选项:**

| 选项 | 描述 |
|------|------|
| `--bad-config` | 提示坏配置样例位置 |

## 输入文件格式

### db-profile.yaml

数据库和连接池配置文件。

```yaml
database:
  type: mysql           # 数据库类型: mysql | postgresql | sqlite
  host: localhost
  port: 3306
  database: ecommerce

connectionPool:
  maxConnections: 50        # 最大连接数
  minConnections: 10        # 最小连接数
  maxWaitQueueSize: 100     # 最大等待队列大小
  connectionTimeoutMs: 30000 # 连接超时时间（毫秒）
  idleTimeoutMs: 600000     # 空闲超时时间（毫秒）

readWriteSeparation:
  enabled: true                     # 是否启用读写分离
  readReplicas: 3                   # 从库数量
  routingStrategy: round-robin      # 路由策略: round-robin | least-connections | latency-based

sharding:
  enabled: true             # 是否启用分库分表
  shardCount: 4             # 分片数量
  shardKey: user_id         # 分片键
  algorithm: hash           # 分片算法: hash | range | modulo
```

### schema.sql

数据库表结构和索引定义文件。

```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  created_at DATETIME
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  order_status VARCHAR(20),
  total_amount DECIMAL(10,2),
  created_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### sql-trace.jsonl

SQL 执行追踪记录，每行一个 JSON 对象。

```json
{"timestamp": 1704067200000, "traceId": "trace-001", "spanId": "span-001", "sql": "SELECT * FROM users WHERE user_id = ?", "params": [1001], "durationMs": 45, "connectionId": "conn-001", "isRead": true, "shardKey": "1001", "shardId": 1, "rowsReturned": 1}
{"timestamp": 1704067201000, "traceId": "trace-001", "spanId": "span-002", "sql": "INSERT INTO orders (order_id, user_id, order_status, total_amount, created_at) VALUES (?, ?, ?, ?, ?)", "params": [10001, 1002, "PENDING", 299.99, "2024-01-01 00:00:02"], "durationMs": 85, "connectionId": "conn-002", "isRead": false, "shardKey": "1002", "shardId": 2, "rowsAffected": 1}
```

**字段说明:**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `timestamp` | number | ✅ | Unix 时间戳（毫秒） |
| `traceId` | string | ✅ | 追踪 ID |
| `spanId` | string | ✅ | Span ID |
| `sql` | string | ✅ | SQL 语句 |
| `params` | array | ✅ | 参数数组 |
| `durationMs` | number | ✅ | 执行耗时（毫秒） |
| `connectionId` | string | ✅ | 连接 ID |
| `isRead` | boolean | ✅ | 是否为读操作 |
| `shardKey` | string | ❌ | 分片键值 |
| `shardId` | number | ❌ | 分片 ID |
| `rowsReturned` | number | ❌ | 返回行数（读操作） |
| `rowsAffected` | number | ❌ | 影响行数（写操作） |

### write-batches.csv

批量写入操作记录。

```csv
batchId,timestamp,table,operation,rowCount,values,shardKey,shardId
batch-001,1704067220000,order_items,INSERT,10,"[{"item_id":60001,"order_id":10002,"product_id":201,"quantity":2,"price":99.99}]",1007,1
batch-002,1704067221000,products,UPDATE,5,"[{"product_id":201,"stock_quantity":95}]",,
```

**字段说明:**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `batchId` | string | ✅ | 批次 ID |
| `timestamp` | number | ✅ | Unix 时间戳（毫秒） |
| `table` | string | ✅ | 表名 |
| `operation` | string | ✅ | 操作类型: INSERT\|UPDATE\|DELETE |
| `rowCount` | number | ✅ | 行数 |
| `values` | string | ✅ | JSON 数组格式的值 |
| `shardKey` | string | ❌ | 分片键值 |
| `shardId` | number | ❌ | 分片 ID |

### sharding-plan.yaml

分库分表配置（可选）。

```yaml
shards:
  - id: 0
    name: shard-0
    host: shard-0.example.com
    port: 3306
    database: ecommerce_shard0
    weight: 1
  - id: 1
    name: shard-1
    host: shard-1.example.com
    port: 3306
    database: ecommerce_shard1
    weight: 1

tables:
  - table: users
    shardKey: user_id
    shardCount: 4
    algorithm: hash
  - table: orders
    shardKey: user_id
    shardCount: 4
    algorithm: hash

routingRules:
  - pattern: "SELECT.*FROM users WHERE user_id = ?"
    shardIds: [0, 1, 2, 3]
    priority: 10
```

## 分析维度

### 1. 连接池分析

- 连接利用率计算
- 排队率和队列大小分析
- 超时风险检测
- 连接超时配置合理性检查

**问题类型:**
- `blocker`: 连接池利用率过高、存在超时 SQL
- `warning`: 最小连接数设置过低、排队率过高
- `info`: 空闲超时时间较短

### 2. 写入性能分析

- 单条写入 vs 批量写入对比
- 批次大小分布分析
- 小批量写入检测
- 慢写入操作识别

**问题类型:**
- `warning`: 批量写入过小、存在慢写入
- `info`: 存在大量单条 INSERT

### 3. 索引分析

- 已使用索引识别
- 未使用索引检测
- 缺失索引建议
- 重复/冗余索引检测
- 全表扫描估算

**问题类型:**
- `blocker`: 缺失必要索引
- `warning`: 未使用的索引、重复索引、全表扫描

### 4. 慢 SQL 分析

- 慢查询统计（总数、平均耗时、P95 耗时）
- 相似 SQL 分组分析
- 超慢查询检测（>5秒）

**问题类型:**
- `blocker`: 慢查询比例过高（>10%）、存在超慢查询
- `warning`: 慢查询比例偏高（5%-10%）、存在慢读/慢写

### 5. 读写分离路由分析

- 读/写请求计数
- 读请求路由误判检测（如 FOR UPDATE）
- 写请求路由误判检测
- 从库利用率分析
- 主库读比例分析

**问题类型:**
- `blocker`: 写请求路由误判
- `warning`: 读请求路由误判、未启用读写分离
- `info`: 主库读比例较高、轮询策略负载不均

### 6. 分库分表热点分析

- 分片数据分布统计
- 热点数据识别
- 分片不均衡比例计算
- 未使用分片检测
- 跨分片查询检测

**问题类型:**
- `blocker`: 严重的分库分表热点、分片数据分布严重不均衡
- `warning`: 潜在分表热点、分片数据分布不均衡、跨分片查询
- `info`: 存在未使用的分片

## 输出报告

### Markdown 报告

报告包含以下章节：

1. **📊 概览** - 上线判定和问题统计
2. **❌ 阻塞项 (Blockers)** - 必须修复的问题
3. **⚠️ 警告项 (Warnings)** - 建议修复的问题
4. **ℹ️ 信息项 (Infos)** - 一般性提示
5. **💡 参数建议** - 优先级排序的优化建议
6. **📈 详细指标** - 各维度的详细指标数据
7. **📝 原始数据统计** - 输入数据的统计信息

### JSON 报告

JSON 格式的完整分析结果，适合程序解析。

```json
{
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "summary": {
    "canDeploy": false,
    "blockerCount": 2,
    "warningCount": 5,
    "infoCount": 3
  },
  "issues": [
    {
      "id": "ISSUE-1",
      "category": "slow-sql",
      "severity": "blocker",
      "title": "慢查询比例过高",
      "description": "慢查询比例达到 15%，严重影响系统性能",
      "affectedObjects": [],
      "evidence": "建议将慢查询比例控制在 5% 以下"
    }
  ],
  "suggestions": [
    {
      "id": "SUGG-1",
      "title": "优化 Top N 慢查询",
      "description": "建议优先优化以下慢查询...",
      "priority": "high",
      "implementation": "1. 检查索引是否正确使用..."
    }
  ],
  "metrics": {
    "connectionPool": {...},
    "writePerformance": {...},
    "indexUsage": {...},
    "slowSQL": {...},
    "routing": {...},
    "sharding": {...}
  },
  "rawData": {
    "traceCount": 1000,
    "batchCount": 50,
    "tableCount": 4
  }
}
```

## 配置校验

工具在执行分析前会进行全面的配置校验。校验分为：

### 错误 (Errors)

必须修复的问题，会导致程序终止：

- 缺少必需的配置字段
- 无效的配置值（如负数连接数）
- 不支持的枚举值
- 重复的表名/索引名
- 引用不存在的对象

### 警告 (Warnings)

建议修复的问题，不会导致程序终止：

- 缺少可选但建议的配置字段
- 配置值超出合理范围
- 潜在的配置冲突
- 数据量不足

### 使用坏配置测试

```bash
cd examples/bad-config
db-gate validate
```

这将输出大量错误和警告，展示配置校验器的检测能力。

## SQLite 留痕

每次分析完成后，结果会保存到 SQLite 数据库中，用于：

- 历史记录回溯
- 多次分析对比
- 趋势分析

### 数据库结构

**analysis_sessions 表:**

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | TEXT | 会话 ID（主键） |
| `timestamp` | INTEGER | 分析时间 |
| `can_deploy` | INTEGER | 是否可以上线 |
| `blocker_count` | INTEGER | 阻塞项数量 |
| `warning_count` | INTEGER | 警告项数量 |
| `info_count` | INTEGER | 信息项数量 |
| `trace_count` | INTEGER | Trace 记录数 |
| `batch_count` | INTEGER | 批次记录数 |
| `table_count` | INTEGER | 表数量 |
| `config_hash` | TEXT | 配置哈希（可选） |

**issues 表:**

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | TEXT | 问题 ID（主键） |
| `session_id` | TEXT | 会话 ID（外键） |
| `category` | TEXT | 问题类别 |
| `severity` | TEXT | 严重程度 |
| `title` | TEXT | 标题 |
| `description` | TEXT | 描述 |
| `affected_objects` | TEXT | 受影响对象（JSON 数组） |
| `evidence` | TEXT | 证据 |

**suggestions 表:**

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | TEXT | 建议 ID（主键） |
| `session_id` | TEXT | 会话 ID（外键） |
| `title` | TEXT | 标题 |
| `description` | TEXT | 描述 |
| `priority` | TEXT | 优先级 |
| `implementation` | TEXT | 实施建议 |

## 样例数据

### 正常配置样例

位于 `examples/seed/` 目录：

- `db-profile.yaml` - 合理的数据库配置
- `schema.sql` - 包含 4 张表和多个索引的示例 Schema
- `sql-trace.jsonl` - 20 条 SQL 追踪记录，包含各种场景
- `write-batches.csv` - 7 个批量写入记录
- `sharding-plan.yaml` - 4 个分片的分库分表配置

**包含的测试场景:**
- 正常的读/写操作
- 慢 SQL（>500ms）
- 超慢 SQL（>5s）
- 带 FOR UPDATE 的读操作
- 全表扫描类查询
- LIKE 前缀查询
- 不同分片的操作

### 坏配置样例

位于 `examples/bad-config/` 目录：

- `db-profile.yaml` - 包含多种无效配置
- `schema.sql` - 重复表名、无效列定义、引用不存在的表
- `sql-trace.jsonl` - 负时间戳、空 SQL、负数行数
- `sharding-plan.yaml` - 重复分片 ID、无效配置值

**包含的测试场景:**
- 无效的数据库类型
- 负数连接数
- 最小连接数 > 最大连接数
- 不支持的路由策略
- 重复表定义
- 缺少列类型
- 负时间戳
- 空 SQL 语句
- 重复分片 ID
- 负权重值

## 命令示例

### 完整分析流程

```bash
# 使用默认文件名
db-gate analyze

# 输出两种格式的报告
db-gate analyze -o both

# 自定义慢 SQL 阈值
db-gate analyze --slow-threshold 1000

# 跳过配置校验（快速模式）
db-gate analyze --skip-validation

# 禁用 SQLite 留痕
db-gate analyze --no-sqlite
```

### 配置校验

```bash
# 校验当前目录的配置
db-gate validate

# 校验指定路径的配置
db-gate validate \
  -p ./config/db-profile.yaml \
  -s ./config/schema.sql
```

### 历史记录

```bash
# 查看最近 10 条记录
db-gate history

# 查看最近 50 条记录
db-gate history -l 50

# 使用自定义 SQLite 路径
db-gate history --sqlite-path ./custom.db
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 成功，无阻塞项（可以上线） |
| `1` | 存在阻塞项或执行错误（不可以上线） |

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev -- analyze

# 构建
npm run build

# 运行测试
npm test
```

## 项目结构

```
db-workload-gate/
├── src/
│   ├── cli.ts                    # CLI 入口
│   ├── index.ts                  # 模块导出
│   ├── types/
│   │   └── index.ts              # 类型定义
│   ├── parsers/
│   │   └── config-parser.ts      # 配置文件解析器
│   ├── analyzers/
│   │   ├── base-analyzer.ts      # 基础分析器
│   │   ├── connection-pool-analyzer.ts    # 连接池分析
│   │   ├── write-performance-analyzer.ts  # 写入性能分析
│   │   ├── index-analyzer.ts     # 索引分析
│   │   ├── slow-sql-analyzer.ts  # 慢 SQL 分析
│   │   ├── routing-analyzer.ts   # 路由分析
│   │   ├── sharding-analyzer.ts  # 分库分表分析
│   │   └── analysis-engine.ts    # 主分析引擎
│   ├── validation/
│   │   └── config-validator.ts   # 配置校验器
│   ├── trace/
│   │   └── sqlite-trace.ts       # SQLite 留痕
│   └── reporting/
│       └── report-generator.ts   # 报告生成器
├── examples/
│   ├── seed/                     # 正常配置样例
│   │   ├── db-profile.yaml
│   │   ├── schema.sql
│   │   ├── sql-trace.jsonl
│   │   ├── write-batches.csv
│   │   └── sharding-plan.yaml
│   └── bad-config/               # 坏配置样例
│       ├── db-profile.yaml
│       ├── schema.sql
│       ├── sql-trace.jsonl
│       └── sharding-plan.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
