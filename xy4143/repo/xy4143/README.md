# 数据库迁移彩排员 (DB Migration Rehearsal)

一个给后端小组上线前用的本地 CLI 工具，用于安全检查数据库迁移脚本。

## 功能特性

- 🎭 **Dry-Run 沙箱执行**: 在临时 SQLite/Postgres 模拟器中按顺序执行迁移
- 🔍 **智能规则检查**: 检测危险 DDL、不可逆迁移、外键/索引变化等
- 📊 **Schema 差异比较**: 自动比较执行前后的 Schema 变化
- 📝 **多格式报告导出**: Markdown 风险报告、CSV 变更清单、JSON 审计包
- 🧪 **样本数据验证**: 验证脱敏样本数据在迁移后是否能正常插入
- 🚩 **问题隔离**: 发现的问题自动记录到 `quarantine.json`

## 支持的迁移格式

- **SQL 脚本**: 支持 Flyway 风格 (`V1__xxx.sql`) 和自定义版本号
- **Prisma**: 支持 Prisma schema 文件解析
- **Alembic**: 支持 Python 迁移文件解析

## 安装

### 从源码安装

```bash
# 克隆或下载项目
cd db-migration-rehearsal

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .
```

### 验证安装

```bash
db-rehearsal --help
```

## 快速开始

### 1. 初始化项目

```bash
# 在当前目录初始化
db-rehearsal init

# 或指定目录和数据库类型
db-rehearsal init --dir ./my-project --db-type sqlite
```

这将创建以下目录结构：
```
my-project/
├── rehearsal.json      # 配置文件
├── migrations/         # 迁移脚本目录
├── baseline/           # 基线 Schema 目录
├── sample_data/        # 样本数据目录
└── output/             # 输出目录
```

### 2. 导入迁移脚本

```bash
# 导入迁移目录
db-rehearsal import-migrations-command ./path/to/your/migrations

# 同时导入基线 Schema
db-rehearsal import-migrations-command ./migrations --baseline ./schema.sql

# 递归查找
db-rehearsal import-migrations-command ./migrations --recursive
```

### 3. 执行 Dry-Run

```bash
# 在临时数据库中执行迁移
db-rehearsal dry-run

# 显示详细日志
db-rehearsal dry-run --verbose

# 遇到错误时继续执行
db-rehearsal dry-run --no-stop-on-error
```

### 4. 运行规则检查

```bash
# 运行所有检查
db-rehearsal check

# 只运行指定规则
db-rehearsal check --rules dangerous_ddl,irreversible_migration

# 跳过某些规则
db-rehearsal check --skip missing_rollback

# 警告也视为失败
db-rehearsal check --fail-on-warning
```

### 5. 验证样本数据

```bash
# 验证样本数据
db-rehearsal validate-sample-data

# 严格模式
db-rehearsal validate-sample-data --strict
```

### 6. 导出报告

```bash
# 导出所有格式
db-rehearsal report

# 只导出 Markdown
db-rehearsal report --format markdown

# 只导出 CSV
db-rehearsal report --format csv

# 只导出 JSON
db-rehearsal report --format json

# 指定输出目录
db-rehearsal report --output ./reports
```

### 7. 查看项目状态

```bash
db-rehearsal status
```

## 规则说明

| 规则 ID | 规则名称 | 严重程度 | 说明 |
|---------|---------|---------|------|
| `dangerous_ddl` | 危险 DDL 检查 | ERROR | 检测 DROP TABLE、DROP COLUMN、RENAME 等可能导致数据丢失的操作 |
| `irreversible_migration` | 不可逆迁移检查 | ERROR | 检测包含高风险操作但没有回滚脚本的迁移 |
| `missing_rollback` | 回滚完整性检查 | WARNING | 检查回滚脚本是否完整覆盖所有正向操作 |
| `foreign_key_changes` | 外键变化检查 | WARNING | 检测外键约束的添加、删除和修改 |
| `index_changes` | 索引变化检查 | WARNING | 检测索引的添加、删除和修改 |
| `duplicate_versions` | 重复版本检查 | ERROR | 检测重复的迁移版本号 |
| `data_loss_risk` | 数据丢失风险检查 | ERROR | 检测类型收缩（如 BIGINT -> INT）可能导致的数据丢失 |

## 配置文件

`rehearsal.json` 配置文件示例：

```json
{
  "project_name": "my-db-project",
  "database_type": "sqlite",
  "migrations_dir": "./migrations",
  "baseline_schema_dir": "./baseline",
  "sample_data_dir": "./sample_data",
  "output_dir": "./output",
  "rules": {
    "dangerous_ddl": {
      "enabled": true,
      "severity": "error"
    },
    "irreversible_migration": {
      "enabled": true,
      "severity": "error"
    },
    "foreign_key_changes": {
      "enabled": true,
      "severity": "warning"
    },
    "index_changes": {
      "enabled": true,
      "severity": "warning"
    },
    "duplicate_versions": {
      "enabled": true,
      "severity": "error"
    },
    "data_loss_risk": {
      "enabled": true,
      "severity": "error"
    },
    "missing_rollback": {
      "enabled": true,
      "severity": "warning"
    }
  }
}
```

## 编写迁移脚本最佳实践

### 1. 始终包含回滚脚本

```sql
-- 正向操作
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- 回滚操作（使用 -- down: 标记）
-- down:
-- DROP TABLE users;
```

### 2. 使用有意义的版本号

```
# Flyway 风格（推荐）
V1__create_users_table.sql
V2__add_email_to_users.sql
V20240101120000__add_indexes.sql

# 自定义风格
001_create_users.sql
002_add_columns.sql
```

### 3. 避免危险操作

❌ 避免：
```sql
-- 直接删除表
DROP TABLE users;

-- 直接删除列
ALTER TABLE users DROP COLUMN phone;

-- 重命名列（会破坏依赖）
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

✅ 推荐：
```sql
-- 软删除（添加标志列）
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- 先添加新列，再迁移数据，最后（可选）删除旧列
ALTER TABLE users ADD COLUMN new_name TEXT;
UPDATE users SET new_name = old_name;
-- 等应用层完全切换后再删除
```

## 输出文件说明

### quarantine.json

规则检查发现的问题会记录在此文件中：

```json
{
  "metadata": {
    "generated_at": "2024-01-01T12:00:00",
    "migrations_checked": 3
  },
  "summary": {
    "total_violations": 2,
    "errors": 1,
    "warnings": 1,
    "infos": 0
  },
  "issues": [
    {
      "rule_id": "dangerous_ddl",
      "rule_name": "危险 DDL 检查",
      "severity": "error",
      "migration_version": "3",
      "migration_file": "V3__dangerous_operations.sql",
      "description": "删除表操作: DROP TABLE users;",
      "location": {
        "operation_type": "DROP_TABLE",
        "tables": ["users"]
      },
      "suggestion": "请确保这是预期操作，或者考虑使用软删除"
    }
  ]
}
```

### Markdown 报告

包含：
- 规则检查结果（摘要 + 详细问题）
- Schema 差异（变更摘要 + 详细变更）
- 执行结果（执行日志 + 失败详情）

### CSV 文件

- `issues.csv`: 所有问题清单
- `changes.csv`: Schema 变更清单

### JSON 审计包

完整的审计数据，包含所有检查结果、执行结果和 Schema 差异。

## 样本数据格式

支持三种格式：

### 1. SQL 格式 (.sql)

```sql
INSERT INTO users (username, email) VALUES
('user1', 'user1@example.com'),
('user2', 'user2@example.com');
```

### 2. JSON 格式 (.json)

```json
[
  {
    "table": "users",
    "data": {
      "username": "user1",
      "email": "user1@example.com"
    }
  },
  {
    "table": "users",
    "username": "user2",
    "email": "user2@example.com"
  }
]
```

### 3. CSV 格式 (.csv)

文件名作为表名（如 `users.csv`）：

```csv
username,email,is_active
user1,user1@example.com,1
user2,user2@example.com,1
```

## 验证流程

完整的上线前验证流程：

```bash
# 1. 初始化项目（首次使用）
db-rehearsal init --dir ./release-check

# 2. 导入本次发布的迁移脚本
db-rehearsal import-migrations-command ./path/to/new/migrations --baseline ./current_schema.sql

# 3. 复制样本数据到 sample_data 目录
# cp ./test_data/*.sql ./release-check/sample_data/

# 4. 执行 Dry-Run
db-rehearsal dry-run

# 5. 运行规则检查
db-rehearsal check

# 6. 验证样本数据
db-rehearsal validate-sample-data

# 7. 导出报告
db-rehearsal report

# 8. 审查 output 目录中的报告
# - quarantine.json: 问题清单
# - migration_report.md: 详细报告
# - issues.csv: 问题 CSV
# - audit_package.json: 完整审计包
```

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_parser.py

# 运行带覆盖率的测试
pytest --cov=db_migration_rehearsal
```

## 项目结构

```
db_migration_rehearsal/
├── __init__.py          # 包初始化
├── cli.py               # CLI 入口
├── config.py            # 配置管理
├── migration_parser.py  # 迁移解析器（SQL/Prisma/Alembic）
├── importer.py          # 迁移导入器
├── sandbox.py           # 执行沙箱
├── schema_diff.py       # Schema 差异比较
├── rules.py             # 规则引擎
├── exporter.py          # 报告导出
└── sample_data.py       # 样本数据验证

examples/
├── migrations/          # 示例迁移脚本
├── baseline/            # 示例基线 Schema
└── sample_data/         # 示例样本数据

tests/
├── __init__.py
├── test_parser.py       # 解析器测试
├── test_sandbox.py      # 沙箱测试
└── test_rules.py        # 规则测试
```

## 常见问题

### Q: 支持哪些数据库类型？

A: 目前完全支持 SQLite（用于本地测试），PostgreSQL 支持正在开发中。Dry-Run 主要使用 SQLite 沙箱进行测试。

### Q: 如何处理重复的迁移版本？

A: `duplicate_versions` 规则会检测重复版本号。建议使用时间戳版本号（如 `V20240101120000__xxx.sql`）来避免重复。

### Q: 回滚脚本的标记格式是什么？

A: 使用以下任一标记：
- `-- down:`
- `-- rollback:`
- `-- revert:`
- `-- undo:`

标记之后的所有内容都将被视为回滚脚本。

### Q: 可以在 CI/CD 中使用吗？

A: 可以。`check` 命令在发现错误时会返回非零退出码，可以用于阻断 CI/CD 流程：

```yaml
# GitHub Actions 示例
- name: Check migrations
  run: |
    db-rehearsal init
    db-rehearsal import-migrations-command ./migrations
    db-rehearsal check
  continue-on-error: false
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
