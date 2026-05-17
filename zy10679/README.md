# 报表订阅服务邮件订阅退回处理 - 本地数据库环境

## 🚀 快速启动

### 前置要求
- Docker & Docker Compose

### 一键启动
```bash
docker-compose up -d
```

### 验证启动
```bash
# 查看容器状态
docker-compose ps

# 查看数据库日志
docker-compose logs -f postgres
```

## 🔌 连接信息

### PostgreSQL 数据库
- **主机**: localhost
- **端口**: 5432
- **数据库名**: report_subscription
- **用户名**: app_user
- **密码**: app_password

### pgAdmin (Web 管理界面)
- **URL**: http://localhost:5050
- **邮箱**: admin@example.com
- **密码**: admin123

## 📊 数据结构说明

### 核心表

| 表名 | 说明 |
|------|------|
| `subscribers` | 订阅人信息 |
| `reports` | 报表配置 |
| `report_subscriptions` | 订阅记录表（核心） |
| `bounce_history` | 退回历史记录表 |
| `subscription_audit_log` | 订阅操作审计日志 |
| `export_records` | 导出记录 |
| `export_subscription_mapping` | 导出-订阅关联 |
| `import_records` | 导入记录 |
| `import_bad_rows` | 导入坏行记录 |

### 枚举值

#### subscription_status (订阅状态)
- `PENDING` - 待发送
- `BOUNCING` - 退回中
- `SUSPENDED` - 暂停
- `RESUMED` - 已恢复

#### bounce_reason (退回原因)
- `MAILBOX_FULL` - 邮箱已满
- `INVALID_RECIPIENT` - 收件人无效
- `SPAM_REJECTED` - 被反垃圾邮件拒绝
- `DNS_FAILURE` - DNS解析失败
- `CONNECTION_TIMEOUT` - 连接超时
- `CONTENT_REJECTED` - 内容被拒绝
- `RELAY_DENIED` - 中继被拒绝
- `OTHER` - 其他

#### action_type (操作类型)
- `SEND` - 发送
- `BOUNCE` - 退回
- `RETRY` - 重试
- `SUSPEND` - 暂停
- `RESUME` - 恢复
- `MANUAL_RESEND` - 人工补发
- `IMPORT` - 导入
- `EXPORT` - 导出

## ✅ 验收测试数据说明

### 1. 完整流转记录 - 赵云的销售日报订阅

**完整流程**:
```
PENDING (待发送)
→ SEND (发送)
→ BOUNCE (退回: 邮箱已满)
→ RETRY (重试发送)
→ BOUNCE (再次退回)
→ RETRY (再次重试)
→ BOUNCE (第三次退回)
→ RESUME (用户邮箱恢复)
→ MANUAL_RESEND (人工补发历史退回报表)
→ RESUMED (已恢复)
```

**关键数据**:
- 3条原始退回记录
- 3条补发记录
- 历史可追溯（`original_history_id` 关联）
- 导出记录中同时包含原始退回和补发记录

### 2. 冲突记录 - 杨柳的财务日报订阅

**模拟场景**:
- 异步回调重复处理
- 人工补录重复点击
- 重复点击暂停按钮

**识别方法**:
- 查看 `bounce_history` 中相同 `sent_at` 的多条记录
- 查看 `subscription_audit_log` 中相同时间戳的重复操作
- 审计日志的 `comments` 字段标记重复操作

### 3. 导入坏行记录

**导入批次**: `IMP-20260515-001`

| 行号 | 错误类型 | 错误说明 |
|------|----------|----------|
| 5 | VALIDATION_ERROR | 邮箱格式不正确 |
| 8 | REFERENCE_ERROR | 报表编码不存在 |

## 🔍 常用查询

### 1. 订阅列表（含状态统计）
```sql
SELECT 
    s.subscription_id,
    sb.email,
    sb.name as subscriber_name,
    sb.department,
    r.report_code,
    r.report_name,
    s.status,
    s.bounce_count,
    s.retry_count,
    s.last_bounce_at,
    s.last_bounce_reason
FROM v_subscription_details s
ORDER BY s.updated_at DESC;
```

### 2. 退回历史详情（含补发关联）
```sql
SELECT 
    bh.history_id,
    bh.subscription_id,
    bh.email,
    bh.subscriber_name,
    bh.report_code,
    bh.report_name,
    bh.bounce_reason,
    bh.bounce_timestamp,
    bh.sent_at,
    bh.action_taken,
    bh.is_resend,
    bh.resend_count,
    bh.original_history_id,
    CASE WHEN bh.is_resend THEN '补发记录' ELSE '原始退回' END as record_type
FROM v_bounce_history_details bh
ORDER BY bh.bounce_timestamp DESC;
```

### 3. 冲突检测 - 重复退回记录
```sql
SELECT 
    subscription_id,
    sent_at,
    email_subject,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(history_id) as history_ids
FROM bounce_history
GROUP BY subscription_id, sent_at, email_subject
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

### 4. 导出记录与明细关联验证
```sql
SELECT 
    er.export_batch_id,
    er.export_type,
    er.file_name,
    er.record_count as export_record_count,
    COUNT(esm.mapping_id) as actual_mapping_count,
    array_agg(esm.export_row_number ORDER BY esm.export_row_number) as export_rows
FROM export_records er
LEFT JOIN export_subscription_mapping esm ON er.export_id = esm.export_id
GROUP BY er.export_id, er.export_batch_id, er.export_type, er.file_name, er.record_count;
```

### 5. 操作审计日志（完整追踪）
```sql
SELECT 
    al.log_id,
    al.subscription_id,
    sb.email,
    r.report_code,
    al.action,
    al.action_by,
    al.action_timestamp,
    al.old_status,
    al.new_status,
    al.old_retry_count,
    al.new_retry_count,
    al.old_bounce_count,
    al.new_bounce_count,
    al.comments
FROM subscription_audit_log al
LEFT JOIN subscribers sb ON al.subscriber_id = sb.subscriber_id
LEFT JOIN reports r ON al.report_id = r.report_id
ORDER BY al.action_timestamp DESC;
```

### 6. 导入坏行记录
```sql
SELECT 
    bad.bad_row_id,
    imp.import_batch_id,
    imp.import_type,
    bad.row_number,
    bad.error_type,
    bad.error_message,
    bad.is_resolved,
    bad.raw_row_data
FROM import_bad_rows bad
JOIN import_records imp ON bad.import_id = imp.import_id
ORDER BY bad.row_number;
```

## 🔄 数据完整性设计

### 避免重复点击/重复处理
1. **`bounce_history` 表设计**:
   - `original_history_id` 字段：补发记录关联原始记录
   - `is_resend` 标记：区分原始退回和补发
   - `resend_count`：补发次数统计

2. **幂等性建议**:
   - 处理退回时基于 `message_id` 去重
   - 操作前检查状态是否已变更
   - 使用数据库乐观锁（版本号）

### 历史记录不覆盖
- 所有操作都记录在 `subscription_audit_log`
- 补发记录不删除原始退回记录
- `export_subscription_mapping` 记录导出时的精确快照

## 🧹 清理环境

```bash
# 停止容器
docker-compose down

# 停止并删除数据卷（完全重置）
docker-compose down -v

# 重启数据库（重新执行初始化脚本）
docker-compose down -v && docker-compose up -d
```

## 📝 文件结构

```
.
├── docker-compose.yml      # Docker Compose 配置
├── .env.example            # 环境变量示例
├── README.md               # 本文档
└── schema/
    ├── 01_ddl.sql          # 表结构定义
    ├── 02_seed_data.sql    # 基础种子数据
    └── 03_acceptance_test_data.sql  # 验收测试数据
```
