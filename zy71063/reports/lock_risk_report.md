# SQL 迁移锁风险分析报告

**生成时间**: 2026-05-24 19:30:10

## 执行结果

**退出码**: 2

**说明**: 高风险，建议谨慎执行

## 分析概览

| 指标 | 数值 |
|------|------|
| 迁移文件总数 | 4 |
| ALTER 语句总数 | 4 |
| 事务包裹 | 0 |
| 有回滚脚本 | 1 |
| 顺序问题 | 3 |

### 风险等级分布

| 风险等级 | 数量 |
|----------|------|
| 安全 (SAFE) | 0 |
| 低 (LOW) | 2 |
| 中 (MEDIUM) | 0 |
| 高 (HIGH) | 2 |
| 严重 (CRITICAL) | 0 |

## 风险发现详情

### 高 (HIGH) (2 项)

#### 发现 #1

- **表名**: `products`
- **操作类型**: `modify_column`
- **锁级别**: `exclusive`
- **预估耗时**: 30 秒
- **原因**: 操作类型: modify_column | 锁级别: 排他锁 (读写都阻塞) | 表行数: 50,000 | 表大小: 25.0 MB
- **缓解建议**: 考虑使用 pt-online-schema-change 或 gh-ost 在线变更工具 | 在业务低峰期执行 | 必须在业务低峰期执行 | 执行前备份数据 | 建议先在测试环境验证

#### 发现 #2

- **表名**: `products`
- **操作类型**: `modify_column`
- **锁级别**: `exclusive`
- **预估耗时**: 30 秒
- **原因**: 操作类型: modify_column | 锁级别: 排他锁 (读写都阻塞) | 表行数: 50,000 | 表大小: 25.0 MB
- **缓解建议**: 考虑使用 pt-online-schema-change 或 gh-ost 在线变更工具 | 在业务低峰期执行 | 必须在业务低峰期执行 | 执行前备份数据 | 建议先在测试环境验证

### 低 (LOW) (2 项)

#### 发现 #1

- **表名**: `users`
- **操作类型**: `add_column`
- **锁级别**: `metadata`
- **预估耗时**: 5 秒
- **原因**: 操作类型: add_column | 锁级别: 元数据锁 (仅阻塞DDL) | 表行数: 2,500,000 | 表大小: 350.0 MB
- **缓解建议**: 添加 ALGORITHM=INPLACE LOCK=NONE 减少锁影响

#### 发现 #2

- **表名**: `orders`
- **操作类型**: `add_index`
- **锁级别**: `metadata`
- **预估耗时**: 1500 秒
- **原因**: 操作类型: add_index | 锁级别: 元数据锁 (仅阻塞DDL) | 表行数: 15,000,000 | 表大小: 2800.0 MB | 使用了 ALGORITHM=INPLACE | 使用了 LOCK=NONE
- **缓解建议**: 建议使用 CREATE INDEX CONCURRENTLY 或 ALTER TABLE ... ADD INDEX ALGORITHM=INPLACE LOCK=NONE

## 迁移顺序/完整性问题

| # | 类型 | 文件 | 描述 |
|---|------|------|------|
| 1 | missing_rollback | 001_add_user_email.sql | 迁移文件包含 DDL 变更但未找到对应的回滚脚本 |
| 2 | missing_rollback | 002_add_order_index.sql | 迁移文件包含 DDL 变更但未找到对应的回滚脚本 |
| 3 | missing_rollback | 003_modify_product_price_rollback.sql | 迁移文件包含 DDL 变更但未找到对应的回滚脚本 |

## 迁移文件清单

| 文件 | 语句数 | 事务包裹 | 有回滚 |
|------|--------|----------|--------|
| 001_add_user_email.sql | 1 | 否 | 否 |
| 002_add_order_index.sql | 1 | 否 | 否 |
| 003_modify_product_price.sql | 1 | 否 | 是 |
| 003_modify_product_price_rollback.sql | 1 | 否 | 否 |

---
*本报告由 sql-lock-risk 工具自动生成*