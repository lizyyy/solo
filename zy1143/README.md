# LocalMQ - 本地消息队列服务

一个轻量级的本地消息队列服务，用 Go 实现，支持持久化、优先级队列、延迟消息、可见性超时、重试策略和死信队列。

## 特性

- **多队列支持**: 创建多个独立的队列/主题
- **消息属性**: body、priority、delay_seconds、max_attempts、idempotency_key、metadata
- **消费者模式**: reserve → ack/nack 模式，支持可见性超时
- **重试策略**: 固定间隔 (fixed) 和指数退避 (exponential)
- **死信队列**: 超过最大重试次数的消息进入死信
- **持久化**: SQLite 本地存储，服务重启不丢失数据
- **运维接口**: stats、peek、筛选、延长租约、重放死信、导出报告

## 快速开始

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run ./cmd/server
```

可选参数:
```bash
go run ./cmd/server -port 8080 -db ./data/localmq.db
```

### 3. 填充种子数据（服务启动后）

```bash
go run ./scripts/seed.go
```

## API 文档

### 健康检查

```bash
curl http://localhost:8080/health
```

### 队列管理

#### 创建队列

```bash
curl -X POST http://localhost:8080/api/v1/queues \
  -H "Content-Type: application/json" \
  -d '{
    "name": "orders",
    "description": "Order processing queue",
    "retry_strategy": "exponential",
    "retry_delay_seconds": 5,
    "max_delay_seconds": 60,
    "visibility_timeout_seconds": 30
  }'
```

参数说明:
- `retry_strategy`: `fixed` 固定间隔 或 `exponential` 指数退避
- `retry_delay_seconds`: 基础重试延迟（秒）
- `max_delay_seconds`: 最大延迟上限
- `visibility_timeout_seconds`: 可见性超时时间

#### 获取队列列表

```bash
curl http://localhost:8080/api/v1/queues
```

#### 获取单个队列信息

```bash
curl 'http://localhost:8080/api/v1/queues?name=orders'
```

### 消息操作

#### 入队消息

```bash
curl -X POST http://localhost:8080/api/v1/messages/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "orders",
    "body": "{\"order_id\": 1001, \"user_id\": 123}",
    "priority": 5,
    "delay_seconds": 0,
    "max_attempts": 3,
    "idempotency_key": "order-1001-20240101",
    "metadata": {"source": "web", "timestamp": 1704067200}
  }'
```

参数说明:
- `priority`: 优先级，越高越先处理，默认 0
- `delay_seconds`: 延迟秒数，消息在延迟后才可见，默认 0
- `max_attempts`: 最大重试次数，默认 3
- `idempotency_key`: 幂等键，同一队列内唯一，防止重复入队
- `metadata`: 自定义元数据

#### 消费消息 (Reserve)

```bash
curl -X POST http://localhost:8080/api/v1/messages/reserve \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "orders",
    "worker_id": "worker-001",
    "limit": 1
  }'
```

返回示例:
```json
[
  {
    "id": 1,
    "queue_name": "orders",
    "body": "{\"order_id\": 1001}",
    "priority": 5,
    "attempts": 0,
    "max_attempts": 3,
    "status": "reserved",
    "reserved_by": "worker-001",
    "reserved_at": "2024-01-01T12:00:00Z",
    "visible_at": "2024-01-01T12:00:30Z",
    "created_at": "2024-01-01T12:00:00Z",
    "metadata": {}
  }
]
```

#### 确认成功 (Ack)

```bash
curl -X POST http://localhost:8080/api/v1/messages/ack \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": 1,
    "worker_id": "worker-001"
  }'
```

#### 处理失败 (Nack)

```bash
curl -X POST http://localhost:8080/api/v1/messages/nack \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": 1,
    "worker_id": "worker-001",
    "error_reason": "Database connection timeout",
    "force_retry": false
  }'
```

消息会根据队列的重试策略计算下次可见时间。如果超过最大重试次数，消息进入死信状态。

#### 延长租约

如果处理时间超过 visibility_timeout，可以延长租约:

```bash
curl -X POST http://localhost:8080/api/v1/messages/extend-lease \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": 1,
    "worker_id": "worker-001",
    "seconds": 60
  }'
```

### 运维接口

#### 获取队列统计

```bash
curl 'http://localhost:8080/api/v1/queues/stats?queue=orders'
```

返回:
```json
{
  "queue_name": "orders",
  "total": 100,
  "pending": 5,
  "ready": 50,
  "reserved": 10,
  "succeeded": 30,
  "failed": 0,
  "dead": 5
}
```

#### 查看消息 (Peek)

查看消息但不修改状态:

```bash
# 查看所有消息
curl 'http://localhost:8080/api/v1/messages/peek?queue=orders'

# 按状态筛选
curl 'http://localhost:8080/api/v1/messages/peek?queue=orders&status=dead'

# 限制数量
curl 'http://localhost:8080/api/v1/messages/peek?queue=orders&limit=10'
```

状态值: `pending`, `ready`, `reserved`, `succeeded`, `dead`

#### 获取单条消息详情

```bash
curl 'http://localhost:8080/api/v1/messages?id=1'
```

#### 获取消息审计日志

```bash
curl 'http://localhost:8080/api/v1/messages/audit?message_id=1'
```

#### 重放死信

```bash
# 重放指定队列的所有死信
curl -X POST http://localhost:8080/api/v1/messages/replay-dead \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "orders"
  }'

# 按死信原因筛选
curl -X POST http://localhost:8080/api/v1/messages/replay-dead \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "orders",
    "dead_reasons": ["max_attempts_exceeded"]
  }'

# 指定消息 ID 重放
curl -X POST http://localhost:8080/api/v1/messages/replay-dead \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "orders",
    "message_ids": [1, 2, 3],
    "new_delay_seconds": 60
  }'
```

#### 导出报告

```bash
# JSON 格式
curl 'http://localhost:8080/api/v1/queues/export?queue=orders&format=json' -o orders.json

# CSV 格式
curl 'http://localhost:8080/api/v1/queues/export?queue=orders&format=csv' -o orders.csv

# Markdown 格式
curl 'http://localhost:8080/api/v1/queues/export?queue=orders&format=md' -o orders.md
```

## 典型工作流

### 1. 生产者 - 发送消息

```bash
curl -X POST http://localhost:8080/api/v1/messages/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "queue_name": "emails",
    "body": "Hello World",
    "max_attempts": 5
  }'
```

### 2. 消费者 - 处理消息

```bash
# 1. 获取消息
RESP=$(curl -s -X POST http://localhost:8080/api/v1/messages/reserve \
  -H "Content-Type: application/json" \
  -d '{"queue_name":"emails","worker_id":"worker-1","limit":1}')

MSG_ID=$(echo $RESP | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -n "$MSG_ID" ]; then
  echo "Processing message $MSG_ID..."
  
  # 处理成功
  curl -X POST http://localhost:8080/api/v1/messages/ack \
    -H "Content-Type: application/json" \
    -d "{\"message_id\":$MSG_ID,\"worker_id\":\"worker-1\"}"
    
  # 或处理失败
  # curl -X POST http://localhost:8080/api/v1/messages/nack \
  #   -H "Content-Type: application/json" \
  #   -d "{\"message_id\":$MSG_ID,\"worker_id\":\"worker-1\",\"error_reason\":\"something went wrong\"}"
fi
```

## 边界情况处理

| 场景 | 行为 | HTTP 状态码 |
|------|------|-------------|
| 幂等键已存在 | 返回冲突 | 409 Conflict |
| 重复 ack/nack | 返回消息未被保留 | 409 Conflict |
| 租约过期后 ack | 返回消息未被保留 | 409 Conflict |
| 其他 worker 尝试 ack | 返回不是该 worker 保留的 | 409 Conflict |
| 消息不存在 | 返回消息未找到 | 404 Not Found |
| 非法参数 | 返回参数错误 | 400 Bad Request |

## 消息生命周期

```
pending (延迟中) → ready (待消费) → reserved (处理中)
                                                      ↓
                              nack (重试) ────────────┘
                                │
                                ↓ (超过 max_attempts)
                              dead (死信) → 重放后回到 ready
                                                      ↓
                              ack (成功) → succeeded (完成)
```

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 服务入口
├── internal/
│   ├── api/
│   │   └── handler.go       # HTTP 处理器
│   ├── models/
│   │   └── models.go        # 数据模型定义
│   ├── service/
│   │   └── service.go       # 业务逻辑
│   └── storage/
│       └── sqlite.go        # SQLite 持久化
├── scripts/
│   └── seed.go              # 种子数据脚本
├── data/                    # SQLite 数据目录 (运行时生成)
├── go.mod
└── README.md
```

## 运行测试

```bash
go test -v ./...
```

## 配置说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| -port | 8080 | HTTP 服务端口 |
| -db | ./data/localmq.db | SQLite 数据库路径 |
| -cleanup | true | 启用后台过期消息清理 |

## 与 Redis List 对比

| 特性 | LocalMQ | Redis List |
|------|---------|-------------|
| 持久化 | SQLite | AOF/RDB |
| 优先级队列 | 支持 | 不支持 |
| 延迟消息 | 支持 | 需额外实现 |
| 可见性超时 | 支持 | 不支持 |
| 重试策略 | 内置 | 需自己实现 |
| 死信队列 | 内置 | 需自己实现 |
| 幂等键 | 内置 | 需自己实现 |
| 审计日志 | 内置 | 无 |
| 运维接口 | 丰富 | 有限 |
