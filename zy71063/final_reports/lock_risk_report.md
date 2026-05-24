# SQL 迁移锁风险分析报告

**生成时间**: 2026-05-24 22:02:29

## 执行结果

**退出码**: 1

**说明**: 中风险或缺少回滚脚本，建议检查

## 分析概览

| 指标 | 数值 |
|------|------|
| 迁移文件总数 | 4 |
| ALTER 语句总数 | 4 |
| 事务包裹 | 0 |
| 有回滚脚本 | 1 |
| 顺序问题 | 2 |

### 风险等级分布

| 风险等级 | 数量 |
|----------|------|
| 安全 (SAFE) | 0 |
| 低 (LOW) | 2 |
| 中 (MEDIUM) | 0 |
| 高 (HIGH) | 0 |
| 严重 (CRITICAL) | 0 |

## 风险发现详情

### 低 (LOW) (2 项)

#### 发现 #1

- **表名**: `users`
- **操作类型**: `add_column`
- **锁级别**: `metadata`
- **预估耗时**: 5 秒
- **原因**: 操作类型: add_column | 锁级别: 元数据锁 (仅阻塞DDL) | 表行数: 2,500,000 | 表大小: 350.0 MB | 现有索引数: 3
- **缓解建议**: 添加 ALGORITHM=INPLACE LOCK=NONE 减少锁影响

#### 发现 #2

- **表名**: `orders`
- **操作类型**: `add_index`
- **锁级别**: `metadata`
- **预估耗时**: 1500 秒
- **原因**: 操作类型: add_index | 锁级别: 元数据锁 (仅阻塞DDL) | 表行数: 15,000,000 | 表大小: 2800.0 MB | 现有索引数: 3 | ⚠️ 索引已存在 | 使用了 ALGORITHM=INPLACE | 使用了 LOCK=NONE
- **缓解建议**: 建议使用 CREATE INDEX CONCURRENTLY 或 ALTER TABLE ... ADD INDEX ALGORITHM=INPLACE LOCK=NONE

## 迁移顺序/完整性问题

| # | 类型 | 文件 | 描述 |
|---|------|------|------|
| 1 | missing_rollback | 001_add_user_email.sql | 迁移文件包含 DDL 变更但未找到对应的回滚脚本 |
| 2 | missing_rollback | 002_add_order_index.sql | 迁移文件包含 DDL 变更但未找到对应的回滚脚本 |

## 迁移文件清单

| 文件 | 语句数 | 事务包裹 | 有回滚 |
|------|--------|----------|--------|
| 001_add_user_email.sql | 1 | 否 | 否 |
| 002_add_order_index.sql | 1 | 否 | 否 |
| 003_modify_product_price.sql | 1 | 否 | 是 |
| 003_modify_product_price_rollback.sql | 1 | 否 | 否 |

---
*本报告由 sql-lock-risk 工具自动生成*