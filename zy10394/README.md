# API 状态订阅聚合器

一个基于 Go 的 API 状态变更订阅聚合服务，支持状态聚合、订阅过滤、投递调度、失败补发等核心功能。

## 核心特性

- **幂等性处理**：订阅和状态变更均支持 idempotent_key，确保重复提交不产生脏数据
- **状态聚合**：统一管理业务对象的状态变更历史
- **订阅过滤**：支持灵活的过滤表达式，如 `to_status=paid, from_status=pending`
- **投递调度**：定时任务处理待投递通知，按订阅分配
- **失败补发**：自动重试失败的投递，达到配置次数后标记为失败
- **快照查询**：每个订阅的状态变更独立生成快照，按 subscription_id 正确关联查询
- **持久化存储**：使用 SQLite 存储，重启后数据完整可查

## 技术栈

- **Go 1.21+**
- **Gin Web Framework** - HTTP 服务
- **GORM + SQLite** - 数据持久化
- **Zap** - 日志记录
- **Cron** - 定时任务调度

## 项目结构

```
.
├── main.go              # 程序入口
├── go.mod               # 依赖管理
├── models/              # 数据模型定义
│   └── models.go
├── storage/             # 数据存储层
│   └── storage.go
├── service/             # 业务逻辑层
│   └── service.go
├── api/                 # API 接口层
│   └── handler.go
└── data/                # 数据文件目录（运行时创建）
```

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run main.go
```

服务默认监听 `:8080` 端口

## API 接口文档

### 健康检查

```bash
GET /api/v1/health
```

### 创建订阅

```bash
POST /api/v1/subscriptions
Content-Type: application/json

{
  "topic_name": "order_status",
  "business_type": "order",
  "business_id": "ORD123456",
  "subscriber_id": "system_001",
  "subscriber": "订单系统",
  "filter_expr": "",
  "endpoint": "http://localhost:9000/webhook/order",
  "method": "POST",
  "headers": {
    "X-Auth-Token": "secret-token"
  },
  "timeout": 30,
  "retry_count": 3,
  "retry_interval": 60,
  "idempotent_key": "sub_ORD123456_001"
}
```

### 状态变更推进

```bash
POST /api/v1/status/change
Content-Type: application/json

{
  "business_type": "order",
  "business_id": "ORD123456",
  "topic_name": "order_status",
  "from_status": "pending",
  "to_status": "paid",
  "change_reason": "用户支付完成",
  "operator_id": "user_001",
  "operator_name": "张三",
  "idempotent_key": "change_ORD123456_paid_20240115"
}
```

### 查询历史记录

```bash
POST /api/v1/status/history
Content-Type: application/json

{
  "business_type": "order",
  "business_id": "ORD123456",
  "topic_name": "order_status",
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-12-31T23:59:59Z",
  "page": 1,
  "page_size": 20
}
```

### 查询订阅详情

```bash
GET /api/v1/subscriptions/{subscription_id}
```

### 查询订阅快照

```bash
GET /api/v1/subscriptions/{subscription_id}/snapshots
```

## 数据流示例

### 成功流示例

1. **创建订阅** → 系统自动创建主题和业务对象
2. **状态变更** → 从 pending → paid
3. **自动投递** → 系统 5 秒内自动投递到配置的 endpoint
4. **投递成功** → 状态更新为 success

### 问题流示例

1. **状态变更** → 从 paid → shipped
2. **投递失败**（如 endpoint 不可达）→ 标记为 retrying
3. **自动重试** → 按配置的 retry_interval 间隔重试
4. **达到最大重试次数** → 标记为 failed
5. **人工排查** → 通过 history 接口查看所有投递记录和错误信息

## 核心数据对象

### SubscriptionTopic（订阅主题）
- `name`: 主题名称（唯一）
- `description`: 描述
- `enabled`: 是否启用

### BusinessObject（业务对象）
- `type`: 业务类型（如 order、user）
- `identifier`: 业务标识（如订单号）
- `metadata`: 元数据（JSON）

### Subscription（订阅）
- `topic_id`: 主题 ID
- `business_id`: 业务对象 ID
- `subscriber_id`: 订阅方标识
- `filter_expr`: 过滤表达式

### DeliveryPreference（投递偏好）
- `endpoint`: 回调地址
- `method`: HTTP 方法
- `headers`: 请求头（JSON）
- `timeout`: 超时时间（秒）
- `retry_count`: 最大重试次数
- `retry_interval`: 重试间隔（秒）

### StatusChange（状态变更）
- `from_status`: 源状态
- `to_status`: 目标状态
- `change_reason`: 变更原因
- `operator_id`: 操作人 ID
- `operator_name`: 操作人姓名
- `idempotent_key`: 幂等键（唯一）

### DeliveryRecord（投递记录）
- `status`: 状态（pending/success/failed/retrying）
- `attempt_count`: 尝试次数
- `response_code`: HTTP 响应码
- `response_body`: 响应体
- `error_message`: 错误信息

### SubscriptionSnapshot（订阅快照）
- `snapshot_at`: 快照时间
- `snapshot_data`: 快照数据（JSON）
- `conclusion`: 结论说明

## 过滤表达式语法

订阅时可以通过 `filter_expr` 配置过滤条件，只有满足条件的状态变更才会触发通知：

```
# 单条件：只通知状态变为 paid 的变更
filter_expr: "to_status=paid"

# 多条件（逗号分隔）：同时满足才通知
filter_expr: "to_status=paid, from_status=pending"

# 按操作人过滤
filter_expr: "operator_id=user_001"
```

支持的过滤键：
- `to_status` - 目标状态
- `from_status` - 源状态
- `operator_id` - 操作人ID
- `topic_id` - 主题ID

## 已修复问题

### v1.1 修复内容

1. **订阅幂等性问题**
   - 问题：订阅的 idempotent_key 未持久化，重复创建产生脏数据
   - 修复：Subscription 模型新增 IdempotentKey 字段，存储层新增 GetSubscriptionByIdempotentKey 查询

2. **订阅过滤恒返回 true**
   - 问题：matchFilter 函数直接返回 true，过滤配置不生效
   - 修复：实现完整的过滤表达式解析引擎，支持多条件逗号分隔匹配

3. **快照关联错误**
   - 问题：createSnapshot 将 status_change.ID 写入 subscription_id，导致查询不到
   - 修复：重构快照创建逻辑，在 createDeliveryRecords 循环内为每个订阅独立创建快照，使用真实的 sub.ID 关联
