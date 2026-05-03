# SQLite 迁移回放和回滚风险体检 CLI

一个用于本地演练数据库迁移、检测风险变更、验证回滚脚本的命令行工具，为小团队上线前检查提供保障。

## 功能特性

- 📁 **智能扫描**：自动识别迁移文件并按版本号排序
- 🚀 **真实回放**：在临时数据库中完整执行迁移流程
- 📸 **快照对比**：每步迁移后保存 Schema 和数据快照
- 🔍 **风险检测**：自动识别删表、删字段、类型变更等高风险操作
- 🔄 **回滚验证**：验证回滚脚本是否能正确恢复到初始状态
- 📊 **多格式报告**：支持 JSON、Markdown、HTML 三种报告格式
- ⚙️ **灵活配置**：通过 YAML/JSON 配置 seed 数据和断言规则
- 🎯 **数据完整性**：监控关键表的数据变化，确保迁移不丢数据

## 安装

```bash
npm install
```

## 快速开始

### 1. 查看示例项目

项目包含一套完整的示例，位于 `examples/` 目录：

```
examples/
├── migrations/           # 迁移文件目录
│   ├── 001_init.sql
│   ├── 001_init_rollback.sql
│   ├── 002_add_user_profiles.sql
│   ├── 002_add_user_profiles_rollback.sql
│   ├── 003_add_user_status.sql
│   ├── 003_add_user_status_rollback.sql
│   ├── 004_add_posts_table.sql
│   └── 004_add_posts_table_rollback.sql
├── config.yaml           # 配置文件
└── seed.sql              # Seed 数据
```

### 2. 运行完整迁移体检

```bash
npm test
```

或者手动执行：

```bash
node src/cli.js check \
  --migrations-dir ./examples/migrations \
  --config ./examples/config.yaml \
  --output ./examples/report
```

### 3. 查看生成的报告

报告将输出到指定目录，包含三种格式：

- `report.json` - 完整的结构化数据
- `report.md` - 适合阅读的 Markdown 格式
- `report.html` - 可视化的 HTML 报告

## 命令说明

### check 命令（核心功能）

运行完整的迁移体检流程。

```bash
sqlite-migration-checker check [选项]
```

**选项：**

| 选项 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `--migrations-dir` | `-m` | 迁移文件目录（必需） | - |
| `--config` | `-c` | 配置文件路径 (YAML/JSON) | - |
| `--output` | `-o` | 报告输出目录 | `./report` |
| `--formats` | `-f` | 输出格式 (json, markdown, html) | 全部 |
| `--verbose` | `-v` | 详细输出 | `false` |
| `--in-memory` | `--mem` | 使用内存数据库 | `true` |
| `--skip-rollback` | `--sr` | 跳过回滚测试 | `false` |

**示例：**

```bash
# 基础体检
sqlite-migration-checker check -m ./migrations

# 带配置文件和报告输出
sqlite-migration-checker check \
  -m ./migrations \
  -c ./config.yaml \
  -o ./report

# 只生成 JSON 报告
sqlite-migration-checker check \
  -m ./migrations \
  -f json

# 跳过回滚测试（快速检查）
sqlite-migration-checker check \
  -m ./migrations \
  --skip-rollback
```

### list 命令

列出迁移文件，检查排序和回滚脚本状态。

```bash
sqlite-migration-checker list --migrations-dir ./migrations
```

**输出示例：**

```
============================================================
迁移文件列表:
============================================================

发现 4 个迁移文件，4 个回滚脚本

迁移明细:

  v1: 001_init.sql
    回滚: ✅ 有回滚

  v2: 002_add_user_profiles.sql
    回滚: ✅ 有回滚

  v3: 003_add_user_status.sql
    回滚: ✅ 有回滚

  v4: 004_add_posts_table.sql
    回滚: ✅ 有回滚
```

### init 命令

初始化一个新的示例项目结构。

```bash
sqlite-migration-checker init --dir ./my-project
```

## 配置文件说明

支持 YAML 和 JSON 两种格式的配置文件。

### 完整配置示例

```yaml
# SQLite 迁移体检配置文件

# Seed 数据 (SQL 文件或直接数据)
seed:
  # 方式1: 引用 SQL 文件
  - "seed.sql"
  
  # 方式2: 直接定义数据
  # - type: data
  #   table: users
  #   rows:
  #     - username: "admin"
  #       email: "admin@example.com"
  #       password_hash: "hashed_password"

# 断言规则
assertions:
  # 检查表是否存在
  - type: table_exists
    table: users
    shouldExist: true
  
  # 检查字段是否存在
  - type: column_exists
    table: users
    column: email
  
  # 检查表行数
  - type: row_count
    table: users
    count: 0
    operator: ">="  # 支持: =, >, >=, <, <=
  
  # 原始 SQL 查询 (返回结果会被记录)
  # - type: raw
  #   sql: "SELECT COUNT(*) as count FROM users"

# 需要监控数据变化的表
watchTables:
  - users
  - user_profiles
  - posts

# 输出配置
output:
  markdown: true
  json: true
  html: true
```

### 断言类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `table_exists` | 检查表是否存在 | `{ type: 'table_exists', table: 'users' }` |
| `column_exists` | 检查字段是否存在 | `{ type: 'column_exists', table: 'users', column: 'email' }` |
| `row_count` | 检查表行数 | `{ type: 'row_count', table: 'users', count: 10, operator: '>=' }` |
| `raw` | 执行原始 SQL | `{ type: 'raw', sql: 'SELECT * FROM users' }` |

## 迁移文件命名规范

### 迁移文件格式

```
{版本号}_{描述}.sql
```

示例：
- `001_init.sql`
- `002_add_index.sql`
- `003_rename_column.sql`

### 回滚文件格式

```
{版本号}_{描述}_rollback.sql
```

示例：
- `001_init_rollback.sql`
- `002_add_index_rollback.sql`

### 版本号规则

- 版本号必须是正整数
- 支持前导零（如 `001`, `002`）
- 会自动按数字顺序排序执行
- 检测跳号和重复版本号

## 风险检测规则

### 高风险变更 (🔴)

| 类型 | 说明 | 示例 |
|------|------|------|
| `table_removed` | 删除表 | `DROP TABLE users` |
| `column_removed` | 删除字段 | (通过重建表实现) |
| `column_type_changed` | 字段类型变更 | `INTEGER` → `TEXT` |
| `pk_changed` | 主键属性变更 | 修改主键定义 |
| `rollback_failed` | 回滚执行失败 | 回滚脚本报错 |
| `rollback_schema_mismatch` | 回滚后 Schema 不一致 | 回滚未完全恢复 |

### 中风险变更 (🟠)

| 类型 | 说明 | 示例 |
|------|------|------|
| `notnull_added` | 新增 NOT NULL 约束 | 已有数据的表加 NOT NULL |

### 低风险变更 (🟡)

| 类型 | 说明 | 示例 |
|------|------|------|
| `default_changed` | 默认值变更 | `DEFAULT 0` → `DEFAULT 1` |

### 警告 (⚠️)

| 类型 | 说明 |
|------|------|
| `missing_rollback` | 迁移缺少回滚脚本 |
| `version_gap` | 版本号跳号 |
| `duplicate_version` | 重复版本号 |

## SQLite 迁移最佳实践

### 1. 始终提供回滚脚本

每个迁移都应该有对应的回滚脚本，即使是简单的操作。

**好的实践：**
```sql
-- 迁移: 001_init.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL
);

-- 回滚: 001_init_rollback.sql
DROP TABLE IF EXISTS users;
```

### 2. SQLite 字段删除注意事项

SQLite **不支持** `ALTER TABLE DROP COLUMN`。要删除字段需要：

1. 创建新表（不包含要删除的字段）
2. 复制数据到新表
3. 删除旧表
4. 重命名新表

**示例：**
```sql
-- 回滚删除字段操作
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL
);

INSERT INTO users_new (id, username)
SELECT id, username FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
```

### 3. 使用事务保护

对于多步骤的迁移操作，使用事务确保原子性：

```sql
BEGIN TRANSACTION;

-- 操作1
CREATE TABLE new_table (...);

-- 操作2
INSERT INTO new_table SELECT * FROM old_table;

-- 操作3
DROP TABLE old_table;

COMMIT;
```

### 4. 外键约束

SQLite 默认禁用外键约束。本工具会自动启用：

```sql
PRAGMA foreign_keys = ON;
```

如果迁移涉及外键操作，请确保顺序正确。

### 5. 索引命名规范

建议使用统一的索引命名规范：
- 普通索引：`idx_{表名}_{字段名}`
- 唯一索引：`idx_{表名}_{字段名}_unique` 或直接 `UNIQUE INDEX`

**示例：**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);
```

## 报告示例

### 控制台输出

```
[INFO] 开始 SQLite 迁移体检...
[STEP 1/4] 执行迁移 v1: 001_init.sql
[SUCCESS] 迁移 v1 执行成功 (2ms)
[STEP 2/4] 执行迁移 v2: 002_add_user_profiles.sql
[SUCCESS] 迁移 v2 执行成功 (1ms)
[STEP 3/4] 执行迁移 v3: 003_add_user_status.sql
[SUCCESS] 迁移 v3 执行成功 (1ms)
[STEP 4/4] 执行迁移 v4: 004_add_posts_table.sql
[SUCCESS] 迁移 v4 执行成功 (1ms)
[SUCCESS] 断言通过: {"type":"table_exists","table":"users","shouldExist":true}
[INFO] 开始回滚测试...
[SUCCESS] 回滚测试通过
[SUCCESS] 迁移体检完成！

============================================================
体检结果汇总:
============================================================

状态: ✅ 通过

迁移执行:
  - 总数: 4
  - 成功: 4
  - 失败: 0
  - 有回滚脚本: 4

断言:
  - 通过: 6
  - 失败: 0

============================================================
🎉 迁移体检通过！可以安全上线。
```

### HTML 报告预览

HTML 报告包含：
- 🎨 美观的响应式界面
- 📊 风险等级可视化
- 📋 详细的变更记录
- 🔄 回滚测试结果
- ✅ 断言执行状态

## 项目结构

```
.
├── src/
│   ├── cli.js                 # 命令行入口
│   ├── migration-checker.js   # 核心检查逻辑
│   ├── migration-scanner.js   # 迁移文件扫描
│   ├── db-engine.js           # SQLite 数据库引擎
│   ├── schema-diff.js         # Schema 对比
│   ├── config-loader.js       # 配置文件加载
│   ├── report-generator.js    # 报告生成
│   └── utils/
│       └── logger.js          # 日志工具
├── examples/
│   ├── migrations/            # 示例迁移文件
│   ├── config.yaml            # 示例配置
│   └── seed.sql               # 示例 seed 数据
├── package.json
└── README.md
```

## 开发说明

### 运行测试

```bash
npm test
```

### 本地开发

```bash
# 使用示例数据测试
node src/cli.js check -m ./examples/migrations -c ./examples/config.yaml -o ./examples/report

# 查看帮助
node src/cli.js --help
```

### 核心模块说明

| 模块 | 职责 |
|------|------|
| `MigrationChecker` | 编排整个检查流程 |
| `MigrationScanner` | 扫描和解析迁移文件 |
| `DbEngine` | SQLite 数据库操作 |
| `SchemaDiff` | Schema 对比和风险检测 |
| `ConfigLoader` | 配置加载和断言执行 |
| `ReportGenerator` | 多格式报告生成 |

## 常见问题

### Q1: 迁移执行失败怎么办？

工具会在第一个失败的迁移处停止，并在报告中显示详细的错误信息，包括：
- 失败的迁移版本
- SQL 错误消息
- 导致错误的 SQL 语句

### Q2: 回滚测试失败意味着什么？

回滚测试失败表示：
1. 回滚脚本本身有语法错误
2. 回滚后 Schema 与初始状态不一致
3. 部分迁移缺少回滚脚本

**建议：** 在上线前修复所有回滚问题。

### Q3: 如何处理数据迁移？

可以使用 `seed` 配置插入测试数据，然后：
1. 配置 `watchTables` 监控这些表
2. 使用 `row_count` 断言验证数据行数
3. 工具会自动记录每步迁移后的数据快照

### Q4: 支持哪些 SQLite 特性？

工具支持所有标准 SQLite 操作：
- 表创建/修改/删除
- 索引管理
- 外键约束
- 视图和触发器（通过 Schema 快照捕获）

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示：** 在上线前运行此工具，可以有效避免迁移相关的生产事故。建议将其集成到 CI/CD 流程中。
