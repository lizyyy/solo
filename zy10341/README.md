# Schema 注册审批 API

基于 Spring Boot 的 Schema 注册审批服务，集中管理 Schema 的注册、兼容校验、审批流程和发布审计。

## 技术栈

- Java 8
- Spring Boot 2.7.18
- Spring Data JPA
- H2 Database (文件持久化)
- Lombok

## 核心数据对象

1. **EventTopic** - 事件主题
2. **SchemaVersion** - Schema 版本
3. **CompatibilityCheck** - 兼容检查记录
4. **ApprovalRecord** - 审批意见
5. **Consumer** - 消费者
6. **ConsumerNotification** - 消费者通知记录
7. **PublishRecord** - 发布记录

## 核心规则

- **Schema 注册**: 基于 RequestId 的幂等性保证
- **兼容校验**: 按 Topic 配置的兼容性级别进行校验（NONE/BACKWARD/FORWARD/FULL）
- **审批门禁**: 支持多级审批，状态流转严格控制
- **消费者通知**: Schema 发布后自动通知相关消费者，并记录通知历史
- **发布审计**: 完整的操作历史记录

## 快速启动

### 方式一：使用 Maven Wrapper（推荐，无需安装 Maven）

```bash
# 编译项目
./mvnw clean package -DskipTests

# 启动服务
./mvnw spring-boot:run
```

### 方式二：使用已安装的 Maven

```bash
# 编译项目
mvn clean package -DskipTests

# 启动服务
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080

### H2 控制台

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

### 2. 注册消费者

```bash
curl -X POST http://localhost:8080/api/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "order_created",
    "consumerGroup": "order-consumer-v1",
    "serviceName": "order-service",
    "ownerTeam": "consumer-team",
    "contactEmail": "consumer@example.com",
    "notifyOnSchemaChange": true,
    "createdBy": "admin"
  }'
```

### 3. 注册 Schema

```bash
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "order_created",
    "schemaContent": "{\"type\":\"record\",\"name\":\"Order\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"amount\",\"type\":\"number\"}]}",
    "description": "订单创建 Schema v1",
    "requestId": "req-001",
    "createdBy": "developer"
  }'
```

### 4. 触发兼容性检查

```bash
curl -X POST http://localhost:8080/api/schemas/1/compatibility-check \
  -H "Content-Type: application/json" \
  -d '{"operator": "checker"}'
```

### 5. 提交审批

```bash
curl -X POST http://localhost:8080/api/schemas/1/submit-approval \
  -H "Content-Type: application/json" \
  -d '{"operator": "developer"}'
```

### 6. 审批 Schema

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

### 7. 发布 Schema

```bash
curl -X POST http://localhost:8080/api/schemas/1/publish \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'
```

### 8. 查询历史记录

```bash
# 获取 Topic 下所有 Schema 版本
curl http://localhost:8080/api/schemas/topic/order_created

# 获取兼容检查历史
curl http://localhost:8080/api/schemas/1/compatibility-history

# 获取审批历史
curl http://localhost:8080/api/schemas/1/approval-history

# 获取发布历史
curl http://localhost:8080/api/schemas/1/publish-history

# 获取消费者通知历史（验证消费者通知功能）
curl http://localhost:8080/api/schemas/1/notification-history

# 获取 Topic 下的消费者列表
curl http://localhost:8080/api/consumers/topic/order_created
```

## 如何造测试数据

### 完整流程示例（含兼容校验和消费者通知验证）

```bash
# 1. 创建 Topic (BACKWARD 兼容性级别)
curl -X POST http://localhost:8080/api/topics \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","description":"支付事件","compatibilityLevel":"BACKWARD","ownerTeam":"payment-team","businessDomain":"finance","createdBy":"admin"}'

# 2. 注册 2 个消费者（用于验证通知功能）
curl -X POST http://localhost:8080/api/consumers \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","consumerGroup":"payment-consumer-v1","serviceName":"payment-service","ownerTeam":"consumer-team","notifyOnSchemaChange":true,"createdBy":"admin"}'

curl -X POST http://localhost:8080/api/consumers \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","consumerGroup":"payment-consumer-v2","serviceName":"billing-service","ownerTeam":"billing-team","notifyOnSchemaChange":true,"createdBy":"admin"}'

# 3. 注册 Schema v1 (第一个版本，兼容检查自动通过)
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{\"type\":\"record\",\"name\":\"Payment\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"amount\",\"type\":\"number\"}]}","description":"Payment v1","requestId":"payment-v1","createdBy":"dev1"}'

# 4. 触发兼容检查 -> 提交审批 -> 审批通过 -> 发布
curl -X POST http://localhost:8080/api/schemas/1/compatibility-check -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/1/submit-approval -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/approve -H "Content-Type: application/json" -d '{"schemaVersionId":1,"approver":"lead","isApproved":true,"approvalStep":1,"totalSteps":1}'
curl -X POST http://localhost:8080/api/schemas/1/publish -H "Content-Type: application/json" -d '{"operator":"ops"}'

# 5. 验证消费者通知（查看通知历史，应该有 2 条记录）
curl http://localhost:8080/api/schemas/1/notification-history

# 6. 注册 Schema v2 (兼容版本 - 只添加字段)
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{\"type\":\"record\",\"name\":\"Payment\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"amount\",\"type\":\"number\"},{\"name\":\"currency\",\"type\":\"string\",\"default\":\"CNY\"}]}","description":"Payment v2 (add currency field with default)","requestId":"payment-v2","createdBy":"dev1"}'

# 7. 触发兼容检查（应该通过 - BACKWARD 兼容性允许添加带默认值的字段）
curl -X POST http://localhost:8080/api/schemas/2/compatibility-check -H "Content-Type: application/json" -d '{"operator":"dev1"}'
```

## 如何触发异常和验证兼容校验

### 1. 重复提交（幂等性测试）

```bash
# 使用相同的 requestId 注册两次，第二次会直接返回已存在的记录，不创建新的
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{}","requestId":"same-id","createdBy":"dev"}'
```

### 2. 兼容性校验失败（BACKWARD 模式下删除字段）

```bash
# 先发布 v1
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{\"type\":\"record\",\"name\":\"Payment\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"amount\",\"type\":\"number\"}]}","description":"Payment v1","requestId":"test-v1","createdBy":"dev1"}'

curl -X POST http://localhost:8080/api/schemas/3/compatibility-check -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/3/submit-approval -H "Content-Type: application/json" -d '{"operator":"dev1"}'
curl -X POST http://localhost:8080/api/schemas/approve -H "Content-Type: application/json" -d '{"schemaVersionId":3,"approver":"lead","isApproved":true,"approvalStep":1,"totalSteps":1}'
curl -X POST http://localhost:8080/api/schemas/3/publish -H "Content-Type: application/json" -d '{"operator":"ops"}'

# 再注册 v2 并删除 amount 字段（BACKWARD 不兼容）
curl -X POST http://localhost:8080/api/schemas/register \
  -H "Content-Type: application/json" \
  -d '{"topicName":"payment_event","schemaContent":"{\"type\":\"record\",\"name\":\"Payment\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"}]}","description":"Payment v2 (remove amount field)","requestId":"test-v2","createdBy":"dev1"}'

# 触发兼容检查 - 应该失败！提示删除字段导致不兼容
curl -X POST http://localhost:8080/api/schemas/4/compatibility-check -H "Content-Type: application/json" -d '{"operator":"dev1"}'

# 查看兼容检查历史确认失败原因
curl http://localhost:8080/api/schemas/4/compatibility-history
```

### 3. 无效的状态流转

```bash
# DRAFT 状态不能直接提交审批，需要先通过兼容检查
curl -X POST http://localhost:8080/api/schemas/1/submit-approval \
  -H "Content-Type: application/json" \
  -d '{"operator": "dev"}'
# 返回错误: SCHEMA_003 - Schema must pass compatibility check before approval
```

### 4. 重复发布

```bash
# 已发布的 Schema 不能再次发布
curl -X POST http://localhost:8080/api/schemas/1/publish \
  -H "Content-Type: application/json" \
  -d '{"operator": "ops"}'
# 返回错误: SCHEMA_008 - Schema already published
```

## 如何查看处理记录

### 1. 通过 H2 控制台查看

访问 http://localhost:8080/h2-console，执行 SQL:

```sql
-- 查看所有 Schema 版本和状态
SELECT ID, VERSION, STATUS, CREATED_AT, UPDATED_AT FROM SCHEMA_VERSION ORDER BY CREATED_AT DESC;

-- 查看兼容检查历史
SELECT * FROM COMPATIBILITY_CHECK ORDER BY CREATED_AT DESC;

-- 查看审批历史
SELECT * FROM APPROVAL_RECORD ORDER BY CREATED_AT DESC;

-- 查看发布历史
SELECT * FROM PUBLISH_RECORD ORDER BY CREATED_AT DESC;

-- 查看消费者通知历史（验证通知功能）
SELECT * FROM CONSUMER_NOTIFICATION ORDER BY CREATED_AT DESC;
```

### 2. 通过 API 查看完整处理链路

```bash
# 查看单个 Schema 详情（含当前状态）
curl http://localhost:8080/api/schemas/1

# 查看完整处理链路
echo "=== 兼容检查历史 ===" && curl -s http://localhost:8080/api/schemas/1/compatibility-history
echo "=== 审批历史 ===" && curl -s http://localhost:8080/api/schemas/1/approval-history
echo "=== 发布历史 ===" && curl -s http://localhost:8080/api/schemas/1/publish-history
echo "=== 消费者通知历史 ===" && curl -s http://localhost:8080/api/schemas/1/notification-history
```

## 兼容性级别说明

| 级别 | 说明 |
|------|------|
| NONE | 不做兼容性检查 |
| BACKWARD | 新 Schema 可以读取旧数据（允许新增带默认值的字段，不允许删除字段） |
| FORWARD | 旧 Schema 可以读取新数据（允许删除字段，不允许新增必填字段） |
| FULL | 同时满足 BACKWARD 和 FORWARD |

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
