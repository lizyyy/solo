# 数据表分区归档预演 CLI

一个用于在执行实际数据归档前进行预演和影响分析的本地 CLI 工具。

## 场景

> 老业务表归档前没人能确认哪些记录会被搬走、哪些报表会受影响。

这个工具帮助你：
- 解析分区策略，了解归档范围
- 预估影响行数和时间
- 执行 dry-run 验证而不影响实际数据
- 生成可追踪的回滚计划
- 提供详细的 SQL 片段报告
- 保留异常行信息用于排查

## 功能特性

- ✅ **分区策略解析**：支持 List、Range、Hash 三种分区策略
- ✅ **影响预估**：统计每个分区的记录数，估算执行时间
- ✅ **Dry-Run 预演**：验证配置和策略而不执行实际归档
- ✅ **回滚清单**：自动保存归档记录，支持精确回滚
- ✅ **SQL 片段报告**：生成归档和删除的 SQL 语句
- ✅ **异常行保留**：验证数据完整性，标记潜在问题
- ✅ **可重复导入**：支持多次执行而不产生冲突
- ✅ **校验说明**：清晰的错误和警告信息

## 安装

```bash
# 克隆或下载代码后，在项目根目录执行

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .

# 验证安装
archive-cli --version
```

## 快速开始 - 完整验收流程

### 1. 生成测试数据

```bash
# 运行测试数据生成脚本
python examples/generate_test_data.py
```

这将创建一个 SQLite 测试数据库，包含：
- `orders` 表：1000 条订单记录
- `transactions` 表：2000 条交易记录

### 2. 验证配置文件

```bash
# 验证 List 分区配置（按状态归档）
archive-cli validate-config --config examples/config_list_partition.yaml

# 验证 Range 分区配置（按日期范围归档）
archive-cli validate-config --config examples/config_range_partition.yaml

# 验证 Hash 分区配置（按哈希值归档）
archive-cli validate-config --config examples/config_hash_partition.yaml
```

### 3. 执行 Dry-Run 预演

```bash
# 使用 List 分区策略预演
archive-cli dryrun run --config examples/config_list_partition.yaml --verbose

# 使用 Range 分区策略预演
archive-cli dryrun run --config examples/config_range_partition.yaml --verbose

# 使用 Hash 分区策略预演
archive-cli dryrun run --config examples/config_hash_partition.yaml --verbose
```

Dry-run 会：
- 分析所有分区的影响行数
- 验证表结构和数据完整性
- 生成 SQL 片段
- 生成回滚计划
- 保存所有报告到 `./archive_reports/` 目录

### 4. 查看生成的报告

```bash
# 查看报告目录
ls -la archive_reports/

# 查看最新的 JSON 报告（示例，文件名根据时间戳生成）
cat archive_reports/dry_run_*.json | python -m json.tool

# 查看 SQL 片段
cat archive_reports/dry_run_*_sql.sql

# 查看回滚计划
cat archive_reports/dry_run_*_rollback.md
```

### 5. 执行实际归档（谨慎！）

```bash
# 先做一次预演确认
archive-cli archive execute --config examples/config_list_partition.yaml --dry-run

# 如果确认无误，执行实际归档（需要确认）
archive-cli archive execute --config examples/config_list_partition.yaml

# 或跳过确认直接执行（生产环境不推荐）
archive-cli archive execute --config examples/config_list_partition.yaml --confirm
```

### 6. 管理回滚

```bash
# 列出可用的回滚记录
archive-cli rollback list --config examples/config_list_partition.yaml

# 验证回滚记录的有效性
archive-cli rollback validate --config examples/config_list_partition.yaml --timestamp <TIMESTAMP>

# 回滚预演（默认）
archive-cli rollback execute --config examples/config_list_partition.yaml --timestamp <TIMESTAMP>

# 实际执行回滚（谨慎！）
archive-cli rollback execute --config examples/config_list_partition.yaml --timestamp <TIMESTAMP> --force
```

## 配置文件说明

### 数据库配置

```yaml
database:
  connection_string: "sqlite:///./examples/test_db.sqlite"  # SQLAlchemy 连接字符串
  schema: null  # 可选的 schema 名称
```

### 归档配置

```yaml
archive:
  source_table: "orders"           # 源表名
  target_table: "orders_archive"   # 目标归档表名
  primary_key: "order_id"          # 主键列名（用于回滚）
  batch_size: 1000                 # 批处理大小
  
  partition:
    type: "list"                   # 分区类型：list, range, hash
    column: "status"               # 分区列名
    
    # List 分区特有
    values:
      - "COMPLETED"
      - "CANCELLED"
      - "REFUNDED"
    
    # Range 分区特有
    # interval: "1m"               # 间隔：d(天), w(周), m(月), q(季度), y(年)
    # start_date: "2022-01-01"
    # end_date: "2023-01-01"
    
    # Hash 分区特有
    # values: [0, 1, 2, 3]         # 哈希桶数量（values 数组长度）
  
  archive_condition: "order_date < '2023-01-01'"  # 额外的归档条件
  validate_columns:                # 数据校验列
    - "customer_id"
    - "total_amount"
  exclude_columns: []              # 排除的列
```

### 报告配置

```yaml
report:
  output_dir: "./archive_reports"  # 报告输出目录
  format: "json"                   # 报告格式
  include_sql: true                # 是否包含 SQL 片段
  include_sample_data: true        # 是否包含样本数据
  sample_limit: 10                 # 样本数据条数
```

## 分区策略详解

### List 分区（按值列表）

适合按状态、类型等枚举值进行归档。

```yaml
partition:
  type: "list"
  column: "status"
  values:
    - "COMPLETED"
    - "CANCELLED"
    - "REFUNDED"
```

### Range 分区（按范围）

适合按日期、数值范围进行归档。

```yaml
partition:
  type: "range"
  column: "txn_date"
  interval: "1m"                    # 1个月
  start_date: "2022-01-01"
  end_date: "2023-01-01"
```

支持的间隔格式：
- `1d` - 1天
- `7d` - 7天
- `1w` - 1周
- `1m` - 1月（约30天）
- `3m` - 1季度（约90天）
- `1y` - 1年（约365天）

### Hash 分区（按哈希）

适合均匀分布数据到多个桶中。

```yaml
partition:
  type: "hash"
  column: "account_id"
  values: [0, 1, 2, 3]             # 分为4个桶
```

## 报告内容说明

### JSON 报告结构

```json
{
  "report_type": "dry_run",
  "timestamp": "2024-01-01T00:00:00",
  "config": { ... },
  "summary": {
    "success": true,
    "total_partitions": 3,
    "partitions_with_data": 2,
    "total_rows_to_archive": 500,
    "estimated_duration_minutes": 0.5,
    "error_count": 0,
    "warning_count": 1
  },
  "details": {
    "errors": [],
    "warnings": [],
    "partitions": [
      {
        "name": "partition_COMPLETED",
        "condition": "status = :value",
        "parameters": {"value": "COMPLETED"},
        "row_count": 250,
        "status": "pending"
      }
    ]
  },
  "sql_snippets": [
    {
      "partition_name": "partition_COMPLETED",
      "operation": "SELECT (Archive)",
      "sql": "SELECT * FROM orders WHERE status = :value",
      "parameters": {"value": "COMPLETED"},
      "estimated_rows": 250
    }
  ],
  "rollback_plan": {
    "description": "Rollback plan to restore archived data",
    "steps": [ ... ],
    "validation_checks": [ ... ]
  }
}
```

### 回滚记录结构

回滚记录保存在 `archive_reports/rollback_records/` 目录下，包含：

- 归档时间戳
- 源表和目标表信息
- 每个分区归档的主键列表
- 归档时间

## 支持的数据库

通过 SQLAlchemy 支持以下数据库：
- SQLite（用于测试）
- MySQL
- PostgreSQL
- Oracle
- SQL Server
- 其他 SQLAlchemy 支持的数据库

修改 `connection_string` 即可切换数据库。

## 生产环境注意事项

1. **始终先执行 Dry-Run**：在实际归档前务必先预演
2. **检查所有警告**：不要忽略任何警告信息
3. **验证回滚机制**：确保回滚功能可用
4. **备份数据**：在执行前创建完整备份
5. **小批量测试**：先用小数据集验证流程
6. **监控执行**：长时间归档操作需要监控
7. **低峰执行**：在业务低峰期执行归档

## 故障排除

### 配置错误
- 检查 YAML 语法
- 确认表名和列名正确
- 验证分区策略配置

### 数据库连接错误
- 检查连接字符串格式
- 确认数据库服务运行
- 验证用户权限

### 数据校验错误
- 检查源表和目标表结构
- 验证主键列配置
- 查看警告信息中的具体原因

## 项目结构

```
archive_cli/
├── __init__.py          # 包初始化
├── cli.py               # CLI 入口
├── config.py            # 配置管理
├── database.py          # 数据库操作
├── strategy.py          # 分区策略
├── executor.py          # 执行器（dry-run 和实际归档）
├── report.py            # 报告生成
└── rollback.py          # 回滚管理

examples/
├── generate_test_data.py    # 测试数据生成
├── config_list_partition.yaml
├── config_range_partition.yaml
└── config_hash_partition.yaml

requirements.txt
setup.py
README.md
```

## License

MIT License
