# Schema 注册审批 API

基于 Spring Boot 的 Schema 注册审批服务，集中管理 Schema 的注册、兼容校验、审批流程和发布审计。

## 技术栈

- Java 17
- Spring Boot 3.2
- Spring Data JPA
- H2 Database (文件持久化)
- Lombok

## 核心数据对象

1. **EventTopic** - 事件主题
2. **SchemaVersion** - Schema 版本
3. **CompatibilityCheck** - 兼容检查记录
4. **ApprovalRecord** - 审批意见
5. **Consumer** - 消费者
6. **PublishRecord** - 发布记录

## 核心规则

- **Schema 注册**: 基于 RequestId 的幂等性保证
- **兼容校验**: 按 Topic 配置的兼容性级别进行校验
- **审批门禁**: 支持多级审批，状态流转严格控制
- **消费者通知**: Schema 发布后自动通知相关消费者
- **发布审计**: 完整的操作历史记录

## 快速启动

### 1. 编译项目

```bash
mvn clean package
```

### 2. 启动服务

```bash
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080

### 3. H2 控制台

访问: http://localhost:8080/h2-console

- JDBC URL: `jdbc:h2:file:./data/schema_db`
- User Name: `sa`
- Password: (空)

## API 接口说明

### 1. 创建 Topic

```bash
curl -X POST http://localhost:8080/api/topics \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "order_created",
    "description": "订单创建事件",
    "compatibilityLevel": "BACKWARD",
    "ownerTeam": "order-team",
    "businessDomain": "trade",
    "createdBy": "admin"
  }'
```

### 2. 注册 Schema

```bash
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "order_created",
    "schemaContent": "{\"type\":\"record\",\"name\":\"Order\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"}]}",
    "description": "订单创建 Schema v1",
    "requestId": "req-001",
    "createdBy": "developer"
  }'
```

### 3. 触发兼容性检查

```bash
curl -X POST http://localhost:8080/api/schemas/1/compatibility-check \
  -H "Content-Type: application/json" \
  -d '{"operator": "checker"}'
```

### 4. 提交审批

```bash
curl -X POST http://localhost:8080/api/schemas/1/submit-approval \
  -H "Content-Type: application/json" \
  -d '{"operator": "developer"}'
```

### 5. 审批 Schema

```bash
curl -X POST http://localhost:8080/api/schemas/approve \
  -H "Content-Type: application/json" \
  -d '{
    "schemaVersionId": 1,
    "approver": "manager",
    "approvalComment": "审批通过",
    "isApproved": true,
    "approvalStep": 1,
    "totalSteps": 1
  }'
```

### 6. 发布 Schema

```bash
curl -X POST http://localhost:8080/api/schemas/1/publish \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'
```

### 7. 查询历史记录

```bash
# 获取 Topic 下所有 Schema 版本
curl http://localhost:8080/api/schemas/topic/order_created

# 获取兼容检查历史
curl http://localhost:8080/api/schemas/1/compatibility-history

# 获取审批历史
curl http://localhost:8080/api/schemas/1/approval-history

# 获取发布历史
curl http://localhost:8080/api/schemas/1/publish-history
```

## 如何造测试数据

### 完整流程示例

```bash
# 1. 创建 Topic
curl -X POST http://localhost:8080/api/topics \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","description":"支付事件","compatibilityLevel":"FULL","ownerTeam":"payment-team","businessDomain":"finance","createdBy":"admin"}'

# 2. 注册 Schema v1
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{}","description":"Payment v1","requestId":"payment-v1","createdBy":"dev1"}'

# 3. 兼容检查 -> 提交审批 -> 审批通过 -> 发布
curl -X POST http://localhost:8080/api/schemas/1/compatibility-check -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/1/submit-approval -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/approve -H "Content-Type: application/json" -d '{"schemaVersionId":1,"approver":"lead","isApproved":true,"approvalStep":1,"totalSteps":1}'
curl -X POST http://localhost:8080/api/schemas/1/publish -H "Content-Type: application/json" -d '{"operator":"ops"}'

# 4. 注册 Schema v2 (新版本)
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{}","description":"Payment v2","requestId":"payment-v2","createdBy":"dev1"}'
```

## 如何触发异常

### 1. 重复提交 (幂等性测试)

```bash
# 使用相同的 requestId 注册两次
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"order_created","schemaContent":"{}","requestId":"same-id","createdBy":"dev"}'

# 第二次调用会返回已存在的记录（不会创建新的）
```

### 2. 无效的状态流转

```bash
# DRAFT 状态不能直接提交审批，需要先通过兼容检查
curl -X POST http://localhost:8080/api/schemas/1/submit-approval \
  -H "Content-Type: application/json" \
  -d '{"operator": "dev"}'
# 返回错误: SCHEMA_003 - Schema must pass compatibility check before approval
```

### 3. 重复发布

```bash
# 已发布的 Schema 不能再次发布
curl -X POST http://localhost:8080/api/schemas/1/publish \
  -H "Content-Type: application/json" \
  -d '{"operator": "ops"}'
# 返回错误: SCHEMA_008 - Schema already published
```

### 4. Topic 不存在

```bash
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"not_exist_topic","schemaContent":"{}","requestId":"test","createdBy":"dev"}'
# 返回错误: TOPIC_001 - Topic not found: not_exist_topic
```

## 如何查看处理记录

### 1. 通过 H2 控制台查看

访问 http://localhost:8080/h2-console，执行 SQL:

```sql
-- 查看所有 Schema 版本
SELECT * FROM SCHEMA_VERSION;

-- 查看兼容检查历史
SELECT * FROM COMPATIBILITY_CHECK ORDER BY CREATED_AT DESC;

-- 查看审批历史
SELECT * FROM APPROVAL_RECORD ORDER BY CREATED_AT DESC;

-- 查看发布历史
SELECT * FROM PUBLISH_RECORD ORDER BY CREATED_AT DESC;

-- 查看状态流转
SELECT ID, VERSION, STATUS, CREATED_AT, UPDATED_AT 
FROM SCHEMA_VERSION 
ORDER BY CREATED_AT DESC;
```

### 2. 通过 API 查看

```bash
# 查看单个 Schema 详情（含当前状态）
curl http://localhost:8080/api/schemas/1

# 查看完整处理链路
echo "=== Schema 信息 ===" && curl -s http://localhost:8080/api/schemas/1 | jq
echo "=== 兼容检查历史 ===" && curl -s http://localhost:8080/api/schemas/1/compatibility-history | jq
echo "=== 审批历史 ===" && curl -s http://localhost:8080/api/schemas/1/approval-history | jq
echo "=== 发布历史 ===" && curl -s http://localhost:8080/api/schemas/1/publish-history | jq
```

## 状态流转图

```
DRAFT
  │
  ├─> PENDING_COMPATIBILITY_CHECK
  │       │
  │       ├─> COMPATIBILITY_CHECK_PASSED
  │       │        │
  │       │        └─> PENDING_APPROVAL
  │       │                │
  │       │                ├─> APPROVED
  │       │                │        │
  │       │                │        └─> PUBLISHED
  │       │                │
  │       │                └─> REJECTED
  │       │
  │       └─> COMPATIBILITY_CHECK_FAILED (可重试)
  │
  └─> (保持 DRAFT，可重复触发检查)
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| TOPIC_001 | Topic 不存在 |
| TOPIC_002 | Topic 已存在 |
| SCHEMA_001 | Schema 版本不存在 |
| SCHEMA_002 | 重复请求 |
| SCHEMA_003 | 无效的状态流转 |
| SCHEMA_004 | 兼容性检查失败 |
| SCHEMA_005 | 审批已处理 |
| SCHEMA_006 | 无效的审批步骤 |
| SCHEMA_007 | Schema 未审批 |
| SCHEMA_008 | Schema 已发布 |
