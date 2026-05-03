# PostgreSQL 迁移脚本锁表风险预检 CLI

一个用于预检 PostgreSQL 数据库迁移脚本锁表风险的命令行工具。

## 功能特性

- 🔍 **SQL 解析**: 解析 ALTER、CREATE INDEX、UPDATE、DELETE 等语句
- 🔒 **锁级别分析**: 识别 ACCESS EXCLUSIVE、SHARE 等高风险锁
- 📊 **风险评估**: 基于操作类型、表大小、流量窗口评估风险等级
- 🛠️ **边界情况检测**: 检测事务块混合 DDL/DML、CONCURRENTLY 位置错误等
- 📝 **多格式输出**: 生成 Markdown 报告、CSV 汇总、HTML 时间线可视化
- 💡 **智能建议**: 提供低风险替代方案和拆分步骤

## 安装

### 使用 npm

```bash
npm install
```

### 使用 pnpm

```bash
pnpm install
```

## 使用方法

### 基本用法

```bash
# 使用默认路径
node src/index.js

# 或指定参数
node src/index.js --migrations ./migrations --schema ./schema_snapshot.json --traffic ./traffic_windows.yaml --output ./output
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--migrations` | 迁移脚本目录 (migrations/*.sql) | `migrations` |
| `--schema` | Schema 快照文件 (schema_snapshot.json) | `schema_snapshot.json` |
| `--traffic` | 流量窗口配置 (traffic_windows.yaml) | `traffic_windows.yaml` |
| `--output` | 输出目录 | `.` |

### 运行示例

项目包含完整的示例数据，可以直接运行测试：

```bash
# 使用 npm
npm run test

# 或手动运行
node src/index.js --migrations examples/migrations --schema examples/schema_snapshot.json --traffic examples/traffic_windows.yaml --output output
```

## 输出文件

运行后会在输出目录生成以下三个文件：

### 1. risk_report.md

详细的风险报告 Markdown 文件，包含：

- 风险概要统计
- 检测到的警告
- 改进建议
- 按表汇总的风险
- 每个迁移文件的详细分析
- PostgreSQL 锁级别说明

### 2. table_risks.csv

按表汇总的风险数据 CSV 文件，包含：

| 列名 | 说明 |
|------|------|
| table_name | 表名 |
| high_risk_count | 高风险操作数 |
| medium_risk_count | 中风险操作数 |
| low_risk_count | 低风险操作数 |
| no_risk_count | 无风险操作数 |
| max_lock_level | 最大锁级别 |
| estimated_duration_seconds | 预计总时长(秒) |
| estimated_duration_text | 预计总时长(格式化) |

### 3. timeline.html

交互式的 HTML 时间线可视化，包含：

- 风险分布饼图
- 执行时间线（带工具提示）
- 改进建议列表
- 悬停显示详细信息

可以直接在浏览器中打开查看。

## 支持的操作类型

### DDL 操作

| 操作类型 | 锁级别 | 风险等级 | 说明 |
|---------|--------|---------|------|
| `ALTER TABLE ... ADD COLUMN` | ACCESS EXCLUSIVE | 中 | 添加列（PostgreSQL 11+ 带默认值是瞬时的） |
| `ALTER TABLE ... DROP COLUMN` | ACCESS EXCLUSIVE | 高 | 删除列（元数据操作） |
| `ALTER TABLE ... ALTER COLUMN ... TYPE` | ACCESS EXCLUSIVE | 高 | 修改列类型（可能重写表） |
| `ALTER TABLE ... ALTER COLUMN ... SET NOT NULL` | ACCESS EXCLUSIVE | 高 | 设置 NOT NULL（需要扫描表） |
| `ALTER TABLE ... ADD CONSTRAINT` | ACCESS EXCLUSIVE | 高 | 添加约束 |
| `ALTER TABLE ... ADD FOREIGN KEY` | SHARE ROW EXCLUSIVE | 高 | 添加外键 |
| `CREATE INDEX` | SHARE | 高 | 创建索引（阻塞写入） |
| `CREATE INDEX CONCURRENTLY` | SHARE UPDATE EXCLUSIVE | 低 | 创建索引（不阻塞写入）✅ |
| `DROP INDEX` | ACCESS EXCLUSIVE | 中 | 删除索引 |
| `DROP INDEX CONCURRENTLY` | SHARE UPDATE EXCLUSIVE | 低 | 删除索引（不阻塞写入）✅ |
| `CREATE TABLE` | ACCESS EXCLUSIVE | 低 | 创建新表（无数据） |
| `DROP TABLE` | ACCESS EXCLUSIVE | 高 | 删除表 |
| `TRUNCATE` | ACCESS EXCLUSIVE | 高 | 清空表 |

### DML 操作

| 操作类型 | 锁级别 | 风险等级 | 说明 |
|---------|--------|---------|------|
| `UPDATE` (有 WHERE) | ROW EXCLUSIVE | 低 | 条件更新 |
| `UPDATE` (无 WHERE) | ROW EXCLUSIVE | 高 | 全表更新 ⚠️ |
| `DELETE` (有 WHERE) | ROW EXCLUSIVE | 低 | 条件删除 |
| `DELETE` (无 WHERE) | ROW EXCLUSIVE | 高 | 全表删除 ⚠️ |
| `INSERT` | ROW EXCLUSIVE | 低 | 插入数据 |

## 边界情况检测

### 1. 事务块中混合 DDL 和 DML

**风险**: 可能导致长时间锁表

**检测示例**:
```sql
BEGIN;
    -- DDL 操作
    ALTER TABLE posts ADD COLUMN view_count INTEGER;
    
    -- DML 操作
    UPDATE posts SET view_count = 0;
COMMIT;
```

**建议**: 将 DDL 和 DML 分开执行，或在低峰期执行。

### 2. CONCURRENTLY 位置错误

**风险**: PostgreSQL 语法错误

**检测示例**:
```sql
-- 错误写法
CREATE INDEX idx_comments_created_at ON comments(created_at) CONCURRENTLY;

-- 正确写法
CREATE INDEX CONCURRENTLY idx_comments_created_at ON comments(created_at);
```

**建议**: CONCURRENTLY 必须紧跟在 CREATE INDEX 之后。

### 3. 事务块中使用 CONCURRENTLY

**风险**: PostgreSQL 运行时错误

**检测示例**:
```sql
BEGIN;
    -- 错误：CONCURRENTLY 不能在事务块中
    CREATE INDEX CONCURRENTLY idx_users_updated_at ON users(updated_at);
COMMIT;
```

**建议**: CONCURRENTLY 操作必须在事务外部执行。

## 配置文件格式

### schema_snapshot.json

数据库 Schema 快照，包含表结构、大小、行数等信息。

```json
{
  "version": "1.0",
  "tables": [
    {
      "name": "users",
      "row_count": 500000,
      "table_size": 157286400,
      "columns": [
        {
          "name": "id",
          "type": "integer",
          "nullable": false
        }
      ]
    }
  ],
  "indexes": [
    {
      "name": "idx_users_email",
      "table": "users",
      "columns": ["email"]
    }
  ]
}
```

### traffic_windows.yaml

流量窗口配置，定义不同时段的表流量情况。

```yaml
windows:
  - name: "高峰时段"
    start_time: "09:00"
    end_time: "18:00"
    tables:
      - name: "users"
        traffic_level: "high"
        write_qps: 500
        concurrent_connections: 200
        high_risk: true
```

## 低风险替代方案

### 1. 创建索引

**高风险**:
```sql
CREATE INDEX idx_posts_created_at ON posts(created_at);
```

**低风险替代**:
```sql
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts(created_at);
```

### 2. 修改列类型

**高风险**:
```sql
ALTER TABLE posts ALTER COLUMN status TYPE VARCHAR(30);
```

**低风险替代步骤**:
1. 添加新列（带默认值）
2. 后台分批更新新列
3. 使用 CONCURRENTLY 创建索引
4. 低峰期切换列
5. 删除旧列

### 3. 设置 NOT NULL

**高风险**:
```sql
ALTER TABLE posts ALTER COLUMN content SET NOT NULL;
```

**低风险替代步骤**:
1. 检查 NULL 值
2. 分批更新为非 NULL
3. 添加 NOT VALID 的 CHECK 约束
4. VALIDATE 约束
5. 低峰期设置 NOT NULL

### 4. 大批量 UPDATE/DELETE

**高风险**:
```sql
UPDATE users SET updated_at = CURRENT_TIMESTAMP;
```

**低风险替代**:
```sql
-- 分批执行
UPDATE users SET updated_at = CURRENT_TIMESTAMP 
WHERE id > last_id AND id <= last_id + 1000;
```

## 项目结构

```
pg-migration-risk-check/
├── src/
│   ├── index.js              # CLI 入口
│   ├── sqlParser.js          # SQL 解析器
│   ├── riskAssessor.js       # 风险评估器
│   ├── schemaParser.js       # Schema 解析器
│   ├── trafficParser.js      # 流量配置解析器
│   └── reportGenerator.js    # 报告生成器
├── examples/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_high_risk_operations.sql
│   ├── schema_snapshot.json
│   └── traffic_windows.yaml
├── package.json
└── README.md
```

## PostgreSQL 锁级别说明

| 锁级别 | 级别值 | 冲突锁 | 典型场景 |
|--------|--------|--------|---------|
| ACCESS SHARE | 1 | ACCESS EXCLUSIVE | SELECT |
| ROW SHARE | 2 | EXCLUSIVE, ACCESS EXCLUSIVE | SELECT FOR UPDATE |
| ROW EXCLUSIVE | 3 | SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, ACCESS EXCLUSIVE | INSERT/UPDATE/DELETE |
| SHARE UPDATE EXCLUSIVE | 4 | SHARE UPDATE EXCLUSIVE+ | VACUUM, CREATE INDEX CONCURRENTLY |
| SHARE | 5 | ROW EXCLUSIVE+ | CREATE INDEX |
| SHARE ROW EXCLUSIVE | 6 | ROW EXCLUSIVE+ | CREATE TRIGGER |
| EXCLUSIVE | 7 | 大部分锁 | REFRESH MATERIALIZED VIEW |
| ACCESS EXCLUSIVE | 8 | 所有锁 | ALTER TABLE, DROP TABLE, TRUNCATE |

锁级别越高，冲突越多，风险越大。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！