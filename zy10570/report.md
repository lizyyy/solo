# 数据库表注释检查报告

生成时间: 5/17/2026, 11:08:59 PM

## 📊 概览统计

| 指标 | 数值 |
|------|------|
| 总表数 | 6 |
| 总字段数 | 20 |
| 表注释缺失 | 1 |
| 字段注释缺失 | 3 |
| 表注释矛盾 | 1 |
| 字段注释矛盾 | 3 |
| 解析异常行数 | 1 |

## ⚠️ 表注释缺失

| 表名 | 文件 | 行号 |
|------|------|------|
| orders | test/sample.sql | 11 |

## ⚠️ 字段注释缺失

| 表名.字段名 | 文件 | 行号 |
|-------------|------|------|
| users.created_at | test/sample.sql | 6 |
| users.updated_at | test/sample.sql | 7 |
| orders.status | test/sample.sql | 15 |

## ❌ 表注释矛盾

### products

| 注释 | 文件 | 行号 |
|------|------|------|
| 商品表 | test/sample.sql | 20 |
| 产品表 | test/sample.sql | 26 |

## ❌ 字段注释矛盾

### products.id

| 注释 | 文件 | 行号 |
|------|------|------|
| 产品ID | test/sample.sql | 21 |
| 产品主键 | test/sample.sql | 27 |

### products.name

| 注释 | 文件 | 行号 |
|------|------|------|
| 商品名称 | test/sample.sql | 22 |
| 产品名称 | test/sample.sql | 28 |

### products.price

| 注释 | 文件 | 行号 |
|------|------|------|
| 价格 | test/sample.sql | 23 |
| 售价 | test/sample.sql | 29 |

## 🔄 字段重复注释

### 注释: "用户ID"

| 字段 | 文件 |
|------|------|
| users.id | test/sample.sql |
| orders.user_id | test/sample.sql |

### 注释: "ID"

| 字段 | 文件 |
|------|------|
| category.id | test/sample.sql |
| tag.id | test/sample.sql |

### 注释: "名称"

| 字段 | 文件 |
|------|------|
| category.name | test/sample.sql |
| tag.name | test/sample.sql |

## ⚠️ 解析异常行

| 文件 | 行号 | 原因 | 内容 |
|------|------|------|------|
| test/sample.sql | 33 | 无法识别的SQL语法 | INVALID SQL SYNTAX HERE |

---

*此报告由数据库表注释检查CLI工具自动生成*
