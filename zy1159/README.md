# Index Analyzer - 数据库索引分析工具

一个用于 MySQL/PostgreSQL 数据库索引分析的本地 CLI 工具，帮助你停止"拍脑袋"加索引的做法。

## 功能特性

- **多源数据导入**: 支持导入 schema.sql、slow-queries.jsonl、explain-before.json、table-stats.csv、write-load.csv 和 index-policy.yaml
- **智能索引分析**: 自动检测缺失索引、冗余索引、低效索引、未使用索引和重复索引
- **性能模拟**: 模拟候选索引对查询性能的提升和写入成本的影响
- **多格式报告**: 支持导出 Markdown、JSON、CSV 格式的分析报告
- **交互式命令**: 提供 analyze、suggest、simulate、compare、export 等子命令

## 安装

```bash
pip install -e .
```

或者使用 poetry:

```bash
poetry install
```

## 快速开始

### 1. 生成示例数据

首先生成一些示例数据来测试工具：

```bash
index-analyzer seed -o ./sample_data --with-errors
```

这会在 `./sample_data` 目录下生成以下文件：
- `schema.sql` - 示例数据库 schema
- `slow-queries.jsonl` - 慢查询日志
- `explain-before.json` - EXPLAIN 分析结果
- `table-stats.csv` - 表统计信息
- `write-load.csv` - 写入负载指标
- `index-policy.yaml` - 索引策略配置

### 2. 执行完整分析

```bash
index-analyzer \
  -s ./sample_data/schema.sql \
  -q ./sample_data/slow-queries.jsonl \
  -e ./sample_data/explain-before.json \
  -t ./sample_data/table-stats.csv \
  -w ./sample_data/write-load.csv \
  -p ./sample_data/index-policy.yaml \
  analyze
```

## CLI 命令详解

### 全局选项

```bash
index-analyzer [OPTIONS] COMMAND [ARGS]...

Options:
  -s, --schema PATH           schema.sql 文件路径
  -q, --slow-queries PATH     slow-queries.jsonl 文件路径
  -e, --explain PATH          explain-before.json 文件路径
  -t, --table-stats PATH      table-stats.csv 文件路径
  -w, --write-load PATH       write-load.csv 文件路径
  -p, --index-policy PATH     index-policy.yaml 文件路径
  --db-type [mysql|postgres]  数据库类型 [default: mysql]
  --version                   显示版本信息
  --help                      显示帮助信息
```

### analyze - 索引分析

分析数据库索引，识别各类问题。

```bash
index-analyzer analyze [OPTIONS]

Options:
  -o, --output PATH            输出文件路径（可选，不指定则输出到 stdout）
  -f, --format [json|csv|markdown]  输出格式 [default: markdown]
  --min-severity [critical|high|medium|low]  最小严重程度 [default: low]
```

**示例：**

```bash
# 输出 Markdown 格式报告到控制台
index-analyzer -s schema.sql -q slow.jsonl analyze

# 输出 JSON 格式到文件
index-analyzer -s schema.sql -q slow.jsonl analyze -o report.json -f json

# 只显示 High 及以上严重程度的问题
index-analyzer -s schema.sql analyze --min-severity high
```

### suggest - 索引建议

基于查询模式建议候选索引。

```bash
index-analyzer suggest [OPTIONS]

Options:
  -o, --output PATH            输出文件路径
  -f, --format [json|csv|markdown]  输出格式 [default: markdown]
  -n, --top-n INTEGER          显示前 N 个候选索引 [default: 10]
  --min-net-score FLOAT        最小净得分阈值 [default: 0.0]
```

**示例：**

```bash
# 显示前 5 个建议
index-analyzer -s schema.sql -q slow.jsonl suggest -n 5

# 只显示净得分超过 50 的建议
index-analyzer -s schema.sql suggest --min-net-score 50
```

### simulate - 索引模拟

模拟添加或删除索引的影响。

```bash
index-analyzer simulate [OPTIONS]

Options:
  -i, --index TEXT             要模拟的索引（格式: table:col1,col2），可多次指定
  -o, --operation [add|drop]   操作类型 [default: add]
  -f, --format [json|markdown]  输出格式 [default: markdown]
```

**示例：**

```bash
# 模拟在 users 表添加 (email, status) 索引
index-analyzer -s schema.sql -q slow.jsonl -w write-load.csv simulate -i users:email,status

# 模拟删除索引
index-analyzer -s schema.sql simulate -i users:phone -o drop

# 模拟多个索引
index-analyzer -s schema.sql simulate \
  -i users:email,status \
  -i orders:user_id,created_at
```

### compare - 索引对比

并排对比多个候选索引的预期收益和成本。

```bash
index-analyzer compare [OPTIONS]

Options:
  -i, --index TEXT             要对比的索引（格式: table:col1,col2），可多次指定
  -f, --format [json|markdown]  输出格式 [default: markdown]
```

**示例：**

```bash
# 对比两个候选索引
index-analyzer -s schema.sql -q slow.jsonl compare \
  -i users:email \
  -i users:email,status
```

### export - 导出报告

导出完整的分析报告。

```bash
index-analyzer export [OPTIONS]

Options:
  -o, --output PATH            输出文件路径 [required]
  -f, --format [json|csv|markdown]  输出格式 [default: markdown]
  --include-simulations        在报告中包含模拟结果
```

**示例：**

```bash
# 导出完整的 Markdown 报告
index-analyzer -s schema.sql -q slow.jsonl -e explain.json export -o report.md

# 导出 JSON 格式并包含模拟
index-analyzer -s schema.sql -q slow.jsonl -w write-load.csv export \
  -o full_report.json -f json --include-simulations
```

### seed - 生成示例数据

生成用于测试的示例数据文件。

```bash
index-analyzer seed [OPTIONS]

Options:
  -o, --output-dir PATH        输出目录 [default: ./sample_data]
  --with-errors                 包含用于测试的异常/错误样例
```

**示例：**

```bash
# 生成标准示例数据
index-analyzer seed

# 生成包含错误样例的数据（用于测试解析器的容错性）
index-analyzer seed -o ./test_data --with-errors
```

## 输入文件格式

### 1. schema.sql

标准的 SQL DDL 文件，支持 CREATE TABLE 和 CREATE INDEX 语句。

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive'),
    created_at DATETIME,
    INDEX idx_email (email),
    INDEX idx_email_status (email, status)
) ENGINE=InnoDB;

CREATE INDEX idx_created_at ON users(created_at);
```

### 2. slow-queries.jsonl

每行一个 JSON 对象的慢查询日志。

```json
{"query": "SELECT * FROM users WHERE email = 'user@example.com'", "Query_time": 2.345, "Rows_sent": 1, "Rows_examined": 15000, "timestamp": "2024-01-01T10:00:00", "frequency": 45}
{"query": "SELECT * FROM orders WHERE status = 'pending'", "Query_time": 5.678, "Rows_sent": 50, "Rows_examined": 500000, "timestamp": "2024-01-01T11:00:00", "frequency": 89}
```

**字段说明：**
- `query` / `sql`: SQL 查询语句
- `Query_time` / `duration` / `execution_time_ms`: 执行时间（秒或毫秒）
- `Rows_sent` / `rows_sent`: 返回的行数
- `Rows_examined` / `rows_examined`: 扫描的行数
- `timestamp` / `start_time`: 时间戳
- `frequency` / `count`: 出现频率

### 3. explain-before.json

EXPLAIN 分析结果，支持 MySQL 和 PostgreSQL 格式。

```json
[
  {
    "query": "SELECT * FROM orders WHERE status = 'pending'",
    "Plan": {
      "Node Type": "Seq Scan",
      "Relation Name": "orders",
      "Plan Rows": 50000,
      "Filter": "(status = 'pending'::text)"
    }
  }
]
```

### 4. table-stats.csv

表统计信息 CSV 文件。

```csv
table_name,row_count,data_size_bytes,index_size_bytes,last_analyzed,col_email_cardinality,col_status_cardinality
users,150000,45000000,28000000,2024-01-01T00:00:00,148500,3
orders,500000,180000000,95000000,2024-01-01T00:00:00,120000,5
```

**字段说明：**
- `table_name`: 表名
- `row_count` / `rows` / `count`: 行数
- `data_size_bytes` / `data_size`: 数据大小（字节）
- `index_size_bytes` / `index_size`: 索引大小（字节）
- `last_analyzed` / `analyzed_at`: 上次分析时间
- `col_{column_name}_{stat_name}`: 列级统计
- `idx_{index_name}_{stat_name}`: 索引级统计

### 5. write-load.csv

写入负载指标 CSV 文件。

```csv
table_name,timestamp,insert_rate,update_rate,delete_rate,total_write_ops,avg_write_latency_ms
users,2024-01-01T10:00:00,120.5,450.2,5.3,576.0,2.5
orders,2024-01-01T10:00:00,890.1,1200.5,0.0,2090.6,4.2
```

### 6. index-policy.yaml

索引策略配置文件。

```yaml
policy_name: production_optimization
database_type: mysql
max_indexes_per_table: 10
max_columns_per_index: 5
min_selectivity_for_index: 0.1
write_cost_threshold: 0.3

rules:
  - rule_id: R001
    rule_type: missing_index
    description: Flag columns used in WHERE clauses without indexes
    severity: high
    conditions:
      min_query_count: 5
      min_execution_time_ms: 500
    actions: ["suggest_index"]
    enabled: true
```

## 检测的索引问题类型

| 问题类型 | 描述 | 严重程度 |
|---------|------|---------|
| **missing** | 缺失索引 - 经常用于 WHERE 子句但没有索引的列 | High/Medium |
| **redundant** | 冗余索引 - 被其他索引覆盖的索引（如前缀索引） | Medium |
| **duplicate** | 重复索引 - 与其他索引具有相同列和类型的索引 | High |
| **unused** | 未使用索引 - 根据分析的查询似乎从未被使用的索引 | Medium/Low |
| **inefficient** | 低效索引 - 选择性低或列数过多的索引 | Low |

## 评分机制

每个候选索引会计算一个 **净得分 (Net Score)**:

```
净得分 = (预估性能提升 % * 覆盖查询数 * 0.1) - 预估写入成本增加 %
```

**性能提升因素：**
- 查询原始执行时间（越慢提升空间越大）
- 查询频率（高频查询影响更大）
- 全表扫描情况（有全表扫描时提升更明显）

**写入成本因素：**
- 表的写入吞吐量（写入越高成本越大）
- 索引列数（列越多成本越高）
- 索引类型（GIN > BTREE > HASH）

## 使用示例工作流

### 典型工作流程

```bash
# 1. 生成示例数据（如果没有真实数据）
index-analyzer seed -o ./data

# 2. 执行完整分析
index-analyzer \
  -s ./data/schema.sql \
  -q ./data/slow-queries.jsonl \
  -e ./data/explain-before.json \
  -t ./data/table-stats.csv \
  -w ./data/write-load.csv \
  analyze

# 3. 查看索引建议
index-analyzer \
  -s ./data/schema.sql \
  -q ./data/slow-queries.jsonl \
  suggest -n 5

# 4. 模拟添加某个索引的效果
index-analyzer \
  -s ./data/schema.sql \
  -q ./data/slow-queries.jsonl \
  -w ./data/write-load.csv \
  simulate -i orders:status,created_at

# 5. 对比多个候选索引
index-analyzer \
  -s ./data/schema.sql \
  -q ./data/slow-queries.jsonl \
  compare \
    -i orders:status \
    -i orders:status,created_at \
    -i orders:created_at

# 6. 导出完整报告
index-analyzer \
  -s ./data/schema.sql \
  -q ./data/slow-queries.jsonl \
  -e ./data/explain-before.json \
  -t ./data/table-stats.csv \
  -w ./data/write-load.csv \
  export -o ./report.md -f markdown --include-simulations
```

## 开发指南

### 运行测试

```bash
pytest tests/ -v

# 带覆盖率
pytest tests/ --cov=index_analyzer
```

### 项目结构

```
index_analyzer/
├── __init__.py          # 包入口
├── cli.py               # CLI 主程序
├── models.py            # 数据模型定义
├── parsers.py           # 各种格式文件解析器
├── analyzer.py          # 索引分析引擎
├── simulator.py         # 索引模拟器
├── exporter.py          # 报告导出器
└── sample_data.py       # 示例数据生成器

tests/
├── conftest.py          # pytest fixtures
├── test_parsers.py      # 解析器测试
├── test_analyzer.py     # 分析器测试
├── test_simulator.py    # 模拟器测试
└── test_exporter.py     # 导出器测试
```

## 注意事项

1. **这是一个离线分析工具**：不连接真实数据库，所有分析基于导入的文件
2. **模拟结果是估算值**：实际性能影响需要在测试环境验证
3. **建议按顺序处理**：先处理重复/冗余索引，再考虑添加新索引
4. **高写入表需谨慎**：写入频繁的表添加索引要仔细评估写入成本

## License

MIT
