# SQLite 迁移体检 CLI

一个本地使用的 SQLite 数据库迁移检查工具，帮助你在上线前发现迁移文件中的问题。

## 功能特性

- ✅ **迁移文件顺序检查**：检测编号重复、跳号、命名不规范
- ✅ **SQL 执行测试**：在临时数据库中试运行所有迁移
- ✅ **破坏性操作检测**：DROP TABLE、DROP COLUMN、TRUNCATE 等危险操作
- ✅ **不安全 DML 检测**：DELETE/UPDATE 缺少 WHERE 子句
- ✅ **重复索引检测**：相同列的重复索引、同名索引
- ✅ **Schema 变化摘要**：迁移前后表结构对比
- ✅ **多格式报告**：终端摘要 + JSON + Markdown 报告

## 安装

```bash
npm install
```

## 快速开始

### 运行自检测试

```bash
npm run self-test
```

这会自动安装依赖并运行所有示例场景，验证工具是否正常工作。

### 运行示例场景

#### 1. 通过示例（安全的迁移）

```bash
npm run test:pass
```

这个示例包含安全的迁移操作：
- 新增表和列
- 创建索引
- 无破坏性操作

#### 2. 危险示例（包含危险操作）

```bash
npm run test:danger
```

这个示例会检测到以下问题：
- `DROP TABLE old_logs` - 删除整表
- `ALTER TABLE posts DROP COLUMN temp_column` - 删除列
- `DELETE FROM users` - 无 WHERE 的 DELETE
- `UPDATE posts SET status = 'published'` - 无 WHERE 的 UPDATE
- 重复索引

#### 3. 失败示例（执行错误）

```bash
npm run test:fail
```

这个示例会检测到执行错误：
- SQL 语法错误
- 引用不存在的表

## 命令行用法

```bash
node src/cli.js --schema <schema.sql> --migrations <migrations-dir> [options]
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--schema` | 初始 schema.sql 文件路径 | 必填 |
| `--migrations` | migrations 目录路径 | 必填 |
| `--output` | 报告输出目录 | `./reports` |
| `--no-stop-on-error` | 遇到错误时继续执行后续迁移 | false |
| `--json-only` | 只生成 JSON 报告 | false |
| `--md-only` | 只生成 Markdown 报告 | false |

### 示例

```bash
# 基本用法
node src/cli.js --schema ./schema.sql --migrations ./migrations

# 指定输出目录
node src/cli.js --schema ./schema.sql --migrations ./migrations --output ./my-reports

# 遇到错误时继续执行
node src/cli.js --schema ./schema.sql --migrations ./migrations --no-stop-on-error
```

## 项目结构

```
.
├── src/
│   ├── cli.js          # CLI 入口
│   ├── parser.js       # 文件解析器
│   ├── executor.js     # SQLite 执行器
│   ├── rules.js        # 规则检查器
│   └── reporter.js     # 报告生成器
├── examples/
│   ├── pass/           # 通过示例
│   │   ├── schema.sql
│   │   └── migrations/
│   ├── danger/         # 危险示例
│   │   ├── schema.sql
│   │   └── migrations/
│   └── fail/           # 失败示例
│       ├── schema.sql
│       └── migrations/
├── test/
│   └── self-test.js    # 自检测试
├── reports/            # 报告输出目录
├── package.json
└── README.md
```

## 检查规则

### 严重级别说明

| 级别 | 颜色 | 说明 |
|------|------|------|
| critical | 🔴 红色 | 严重问题，必须修复 |
| error | 🟠 橙色 | 错误，必须修复 |
| high | 🟡 黄色 | 高风险，建议修复 |
| warning | 🟢 绿色 | 警告，建议检查 |
| low | ⚪ 灰色 | 低风险 |
| info | ℹ️ | 信息性提示 |

### 检测规则详情

#### 1. 文件顺序检查

- **重复编号**：两个迁移文件使用相同编号
- **跳号**：编号不连续（如 001, 003 缺少 002）
- **命名不规范**：文件名不以数字开头

#### 2. 破坏性操作检测

- `DROP TABLE` - 删除整表（严重）
- `DROP COLUMN` - 删除列（高风险）
- `DROP INDEX` - 删除索引（低风险）
- `TRUNCATE` - 清空表（严重）

#### 3. 不安全 DML 检测

- `DELETE` 无 `WHERE` 子句 - 会删除所有行（严重）
- `UPDATE` 无 `WHERE` 子句 - 会更新所有行（高风险）
- 有 `WHERE` 的 DML 也会提示（信息）

#### 4. 重复索引检测

- 同名索引 - 索引名称重复（错误）
- 同列索引 - 不同索引覆盖相同列（警告）

#### 5. 执行错误检测

- SQL 语法错误
- 引用不存在的表/列
- 约束违反
- 其他执行时错误

## 报告输出

工具会生成两份报告和终端摘要：

### 终端摘要

```
============================================================
           SQLite 迁移体检结果
============================================================

执行摘要:
  Schema: examples/danger/schema.sql
  Migrations: examples/danger/migrations (5 个文件)
  执行状态: ✅ 通过

问题统计:
  🔴 严重: 1
  🟠 错误: 0
  🟡 高风险: 2
  🟢 警告: 1

⚠️ 发现需要立即关注的问题！

严重 (1):
  • 检测到 DROP TABLE 操作（表: old_logs）
    文件: 001_drop_old_logs.sql
  ...
```

### JSON 报告 (`report.json`)

包含完整的结构化数据：

```json
{
  "summary": {
    "timestamp": "2026-05-02T...",
    "schemaPath": "...",
    "migrationsDir": "...",
    "migrationCount": 5,
    "executionSuccess": true,
    "issues": {
      "total": 5,
      "critical": 1,
      "error": 0,
      ...
    }
  },
  "issues": [...],
  "schemaChanges": {...}
}
```

### Markdown 报告 (`report.md`)

格式化的详细报告，包含：

1. 执行摘要表格
2. 问题统计
3. 详细问题列表（带 SQL 片段和建议）
4. Schema 变化摘要
5. 迁移文件列表

## 迁移文件命名规范

工具期望迁移文件按以下格式命名：

```
<数字>_<描述>.sql
```

示例：
- `001_create_users.sql` ✓
- `002_add_email_column.sql` ✓
- `1_init.sql` ✓
- `create_table.sql` ✗（无编号）

文件按数字顺序执行，建议使用补零（如 001, 002）确保排序正确。

## 注意事项

1. **临时数据库**：工具会创建临时 SQLite 数据库执行迁移，执行完成后自动清理，不会影响你的真实数据。

2. **不支持的操作**：SQLite 有一些限制，例如 `ALTER TABLE DROP COLUMN` 需要 SQLite 3.35.0+。工具使用的 `better-sqlite3` 通常支持较新功能。

3. **外键约束**：SQLite 默认不启用外键约束检查。如果你的迁移依赖外键，可能需要手动调整测试。

## 故障排除

### 依赖安装失败

`better-sqlite3` 需要编译原生模块。如果安装失败：

```bash
# 确保有构建工具
# macOS:
xcode-select --install

# 然后重新安装
npm rebuild better-sqlite3
```

### 退出码

- `0`：所有检查通过，无严重/错误级别问题
- `1`：发现严重/错误级别问题，或执行失败

## License

MIT
