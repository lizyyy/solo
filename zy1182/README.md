# SDB - Simple Database

一个轻量级的单文件数据库引擎，用于学习和演示数据库核心概念。

## 特性

- **单文件存储**: 所有数据存储在一个 `.sdb` 文件中
- **页式存储**: 4KB 固定大小页面，支持多种页面类型
- **简单索引**: 主键自动索引，支持创建自定义索引
- **事务支持**: Write-Ahead Log (WAL) 实现 ACID 事务
- **崩溃恢复**: 自动检测并从崩溃中恢复
- **CSV 导入/导出**: 支持 CSV 格式的数据导入导出
- **SQL-like 查询**: 支持类 SQL 的查询语法
- **诊断报告**: 生成详细的数据库状态报告

## 快速开始

### 环境要求

- Python 3.7+
- 无需额外依赖

### 安装

克隆或下载代码到本地：

```bash
cd sdb
```

### 基本使用

#### 1. 创建数据库

```bash
python sdb_cli.py --db mydb.sdb create
```

#### 2. 打开数据库（交互式模式）

```bash
python sdb_cli.py --db mydb.sdb open
```

进入交互式模式后，可以使用以下命令：

```
sdb> help          # 显示帮助
sdb> tables        # 列出所有表
sdb> describe users  # 查看表结构
sdb> diagnostics   # 查看诊断信息
sdb> exit          # 退出
```

#### 3. 创建表

使用命令行：

```bash
python sdb_cli.py --db mydb.sdb create-table users \
  "id INTEGER PRIMARY KEY AUTO_INCREMENT, \
   name TEXT NOT NULL, \
   email TEXT UNIQUE, \
   age INTEGER, \
   is_active BOOLEAN DEFAULT true, \
   created_at DATETIME"
```

或在交互式模式中：

```sql
-- 类 SQL 语法（支持简单的 CREATE TABLE）
-- 注意：当前需要使用 create-table 命令创建表
```

#### 4. 插入数据

使用命令行：

```bash
python sdb_cli.py --db mydb.sdb insert users \
  '{"name": "Alice", "email": "alice@example.com", "age": 25, "is_active": true}'
```

使用类 SQL 语法：

```bash
python sdb_cli.py --db mydb.sdb sql \
  "INSERT INTO users (name, email, age) VALUES ('Bob', 'bob@example.com', 30)"
```

#### 5. 查询数据

```bash
# 查询所有行
python sdb_cli.py --db mydb.sdb query users

# 带过滤条件
python sdb_cli.py --db mydb.sdb query users --filters '{"age": 25}'

# 选择特定列
python sdb_cli.py --db mydb.sdb query users --columns "name,email"

# 排序和限制
python sdb_cli.py --db mydb.sdb query users --order-by name --limit 10
```

使用类 SQL 语法：

```bash
python sdb_cli.py --db mydb.sdb sql \
  "SELECT name, email FROM users WHERE age > 20 ORDER BY name LIMIT 5"
```

#### 6. 更新数据

```bash
python sdb_cli.py --db mydb.sdb update users 1 '{"age": 26}'
```

或使用 SQL：

```bash
python sdb_cli.py --db mydb.sdb sql "UPDATE users SET age = 26 WHERE id = 1"
```

#### 7. 删除数据

```bash
python sdb_cli.py --db mydb.sdb delete users 1
```

或使用 SQL：

```bash
python sdb_cli.py --db mydb.sdb sql "DELETE FROM users WHERE id = 1"
```

### 事务

SDB 支持完整的事务操作：

```bash
# 开始事务
python sdb_cli.py --db mydb.sdb begin

# 执行操作（在事务中）
python sdb_cli.py --db mydb.sdb insert users '{"name": "Charlie", "email": "charlie@example.com"}'
python sdb_cli.py --db mydb.sdb update users 2 '{"age": 31}'

# 提交事务
python sdb_cli.py --db mydb.sdb commit

# 或者回滚（放弃所有更改）
# python sdb_cli.py --db mydb.sdb rollback
```

在交互式模式中：

```
sdb> begin
sdb> INSERT INTO users (name, email) VALUES ('Dave', 'dave@example.com')
sdb> commit
```

### 索引

#### 创建索引

```bash
# 普通索引
python sdb_cli.py --db mydb.sdb create-index users idx_age age

# 唯一索引
python sdb_cli.py --db mydb.sdb create-index users idx_email email --unique
```

#### 索引命中

查询时会自动使用索引：
- 主键查询自动使用主键索引
- 唯一索引列查询使用唯一索引
- 普通索引列查询使用普通索引

### CSV 导入/导出

#### 导入 CSV

```bash
# 先创建表
python sdb_cli.py --db mydb.sdb create-table users \
  "id INTEGER PRIMARY KEY, name TEXT, email TEXT, age INTEGER, is_active BOOLEAN, created_at DATETIME"

# 导入数据
python sdb_cli.py --db mydb.sdb import-csv users seed_data/users.csv
```

#### 导出 CSV

```bash
python sdb_cli.py --db mydb.sdb export-csv users output.csv
```

### 诊断报告

```bash
# 输出到控制台
python sdb_cli.py --db mydb.sdb diagnostics

# 输出到文件
python sdb_cli.py --db mydb.sdb diagnostics --output diag.json
```

诊断报告包含：
- 数据库路径和页面信息
- 事务状态
- WAL 文件状态
- 所有表的详细信息（列、索引、行数等）

## 数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `INTEGER` | 整数 | `1`, `42`, `-100` |
| `REAL` | 浮点数 | `3.14`, `99.99` |
| `TEXT` | 字符串 | `"hello"`, `'world'` |
| `BOOLEAN` | 布尔值 | `true`, `false`, `1`, `0` |
| `DATETIME` | 日期时间 | `'2024-01-15T10:30:00'` |
| `BLOB` | 二进制数据 | (十六进制字符串) |

## 约束

| 约束 | 说明 |
|------|------|
| `PRIMARY KEY` | 主键，唯一且非空 |
| `NOT NULL` | 不允许 NULL 值 |
| `UNIQUE` | 唯一值约束 |
| `AUTO_INCREMENT` | 自动递增（用于主键） |
| `DEFAULT` | 默认值 |

## 内部架构

### 页面结构

每个文件由固定大小的页面（4KB）组成：

```
┌─────────────────────────────────────┐
│          Page Header (16 bytes)      │
├─────────────────────────────────────┤
│  Page Type (4B) │ Next Page (4B)     │
│  Prev Page (4B) │ Data Length (4B)   │
├─────────────────────────────────────┤
│           Page Data (可变)            │
├─────────────────────────────────────┤
│           Padding (填充)              │
└─────────────────────────────────────┘
```

### 页面类型

| 类型 | 说明 |
|------|------|
| `HEADER` | 文件头页面（页 0） |
| `TABLE_META` | 表元数据页面 |
| `DATA` | 数据页面 |
| `INDEX` | 索引页面 |
| `FREE` | 空闲页面 |

### Write-Ahead Log (WAL)

事务使用 WAL 实现持久性：

1. 开始事务时创建 `.wal` 文件
2. 所有修改先写入 WAL
3. 提交时写入 COMMIT 记录并刷盘
4. 崩溃恢复时：
   - 如果找到 COMMIT 记录，重做所有更改
   - 如果没有 COMMIT 记录，丢弃更改

## 示例脚本

### 运行异常样例

```bash
python exception_examples.py
```

这个脚本演示了以下场景：
1. 重复主键约束
2. 类型不匹配
3. 唯一约束违反
4. NOT NULL 约束违反
5. 事务回滚
6. 事务提交
7. 无效列引用
8. 更新/删除不存在的行
9. 索引使用

### 使用 Seed 数据

```bash
# 创建数据库
python sdb_cli.py --db test.sdb create

# 创建 users 表
python sdb_cli.py --db test.sdb create-table users \
  "id INTEGER PRIMARY KEY, name TEXT, email TEXT, age INTEGER, is_active BOOLEAN, created_at DATETIME"

# 创建 orders 表
python sdb_cli.py --db test.sdb create-table orders \
  "id INTEGER PRIMARY KEY, user_id INTEGER, product_name TEXT, quantity INTEGER, price REAL, order_date DATETIME"

# 导入数据
python sdb_cli.py --db test.sdb import-csv users seed_data/users.csv
python sdb_cli.py --db test.sdb import-csv orders seed_data/orders.csv

# 查询
python sdb_cli.py --db test.sdb query users
python sdb_cli.py --db test.sdb query orders
```

## 编程接口

### 直接使用 SDBCore

```python
from sdb import SDBCore, ColumnDef, DataType, SDBError

# 创建并打开数据库
db = SDBCore("mydb.sdb")
db.create()

# 创建表
db.create_table(
    "users",
    [
        ColumnDef("id", DataType.INTEGER, is_primary_key=True, is_auto_increment=True),
        ColumnDef("name", DataType.TEXT, nullable=False),
        ColumnDef("email", DataType.TEXT, is_unique=True),
        ColumnDef("age", DataType.INTEGER)
    ]
)

# 插入数据
row_id = db.insert("users", {"name": "Alice", "email": "alice@example.com", "age": 25})

# 查询
results = db.query("users", filters={"age": 25})

# 事务
db.begin_transaction()
try:
    db.insert("users", {"name": "Bob", "email": "bob@example.com", "age": 30})
    db.update("users", row_id, {"age": 26})
    db.commit()
except Exception as e:
    db.rollback()
    print(f"Error: {e}")

# 关闭
db.close()
```

## 限制

这是一个用于学习目的的简化数据库实现，有以下限制：

1. **单页数据**: 每个表的数据只存储在一个页面中（最大约 4KB）
2. **简单索引**: 不是真正的 B+ 树，而是简单的哈希映射
3. **单表查询**: 不支持 JOIN
4. **简单 WHERE**: 只支持等值条件，不支持范围查询（>、<、LIKE 等）
5. **单线程**: 不支持并发访问

## 测试

运行测试：

```bash
python -m pytest test_sdb.py -v
```

测试覆盖：
- 基本 CRUD 操作
- 约束验证（主键、唯一、非空）
- 事务提交和回滚
- 索引创建和使用
- CSV 导入导出
- 崩溃恢复模拟

## 项目结构

```
sdb/
├── sdb.py              # 核心数据库引擎
├── sdb_cli.py          # 命令行接口
├── exception_examples.py # 异常样例演示
├── test_sdb.py         # 测试文件
├── seed_data/          # 测试数据
│   ├── users.csv
│   └── orders.csv
└── README.md           # 本文档
```

## 许可证

MIT License

## 贡献

这是一个学习项目，欢迎提出问题和建议！
