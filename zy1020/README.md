# Webhook 回放 & 幂等演练服务

一个给独立开发者用于测试支付、仓储、GitHub 等 Webhook 集成的本地回放和幂等演练服务。

## 功能特性

- 📋 **事件模板管理** - 维护多组事件模板（order.paid、stock.locked、repo.pushed 等）
- 🎯 **多种投递策略** - 正常顺序、乱序、重复投递、延迟投递、签名错误、部分失败重试
- 📊 **投递结果记录** - 请求体摘要、HMAC 签名、HTTP 状态码、耗时、错误信息、重试次数
- 🔑 **幂等账本** - 同一个幂等键重复投递时，标记首次处理还是重复事件
- 💀 **死信队列** - 失败到最后的事件可以重新投递
- 📝 **报告导出** - 支持 Markdown 和 JSON 格式的报告导出
- 🧪 **示例接收端** - 内置签名验证、幂等去重、失败测试路径

## 项目结构

```
src/
├── index.ts              # 主服务入口
├── types/
│   └── index.ts          # 类型定义
├── storage/
│   └── index.ts          # SQLite 持久化存储
├── signature/
│   └── index.ts          # HMAC 签名服务
├── dispatcher/
│   └── index.ts          # 调度/投递服务（核心策略实现）
├── routes/
│   └── index.ts          # API 路由
├── report/
│   └── index.ts          # 报告导出服务
└── receiver/
    ├── index.ts          # 示例接收端入口
    └── routes.ts         # 示例接收端路由
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动主服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 启动示例接收端（另一个终端）

```bash
npm run dev:receiver
```

接收端将在 `http://localhost:3001` 启动。

### 编译生产版本

```bash
npm run build
npm start
```

---

## API 接口示例

以下示例假设主服务运行在 `http://localhost:3000`，示例接收端运行在 `http://localhost:3001`。

### 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

### 2. 事件模板管理

#### 创建模板

```bash
# 订单支付事件模板
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Paid Event",
    "eventType": "order.paid",
    "payload": {
      "orderId": "ORD-2024-001",
      "amount": 99.99,
      "currency": "CNY",
      "customerId": "CUS_123",
      "paidAt": "2024-01-15T10:30:00Z"
    },
    "secret": "order-secret-123",
    "defaultRetryCount": 3,
    "defaultDelayMs": 1000,
    "idempotencyKeyPath": "orderId"
  }'

# 库存锁定事件模板
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stock Locked Event",
    "eventType": "stock.locked",
    "payload": {
      "sku": "SKU-001",
      "quantity": 2,
      "orderId": "ORD-2024-001",
      "lockedAt": "2024-01-15T10:30:00Z"
    },
    "secret": "stock-secret-456",
    "defaultRetryCount": 3,
    "defaultDelayMs": 1000,
    "idempotencyKeyPath": "orderId"
  }'

# GitHub Push 事件模板
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GitHub Push Event",
    "eventType": "repo.pushed",
    "payload": {
      "repo": "my-org/my-repo",
      "branch": "main",
      "commitId": "a1b2c3d4",
      "commits": [
        { "id": "a1b2c3d4", "message": "feat: add new feature" }
      ],
      "pusher": "developer@example.com"
    },
    "secret": "repo-secret-789",
    "defaultRetryCount": 2,
    "defaultDelayMs": 500,
    "idempotencyKeyPath": "commitId"
  }'
```

#### 查看所有模板

```bash
curl http://localhost:3000/api/templates
```

#### 查看单个模板

```bash
curl http://localhost:3000/api/templates/<template_id>
```

#### 更新模板

```bash
curl -X PUT http://localhost:3000/api/templates/<template_id> \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Order Paid Event",
    "defaultDelayMs": 2000
  }'
```

#### 删除模板

```bash
curl -X DELETE http://localhost:3000/api/templates/<template_id>
```

---

### 3. 发起演练

#### 策略说明

| 策略 | 说明 | 参数 |
|------|------|------|
| `normal` | 正常顺序投递 | `delayMs` (间隔毫秒) |
| `out_of_order` | 乱序投递 | `delayMs` |
| `duplicate` | 重复投递 | `duplicateCount` (重复次数) |
| `delayed` | 延迟投递 | `delayMs` (每次延迟) |
| `signature_error` | 签名错误 | `signatureInvalidCount` (数量) |
| `partial_failure` | 部分失败 | `failureCount` (失败数量) |

#### 正常顺序投递

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Normal Order Test",
    "strategy": "normal",
    "templateIds": ["<template_id_1>", "<template_id_2>"],
    "targetUrl": "http://localhost:3001/webhook/order-paid",
    "delayMs": 500
  }'
```

#### 乱序投递

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Out of Order Test",
    "strategy": "out_of_order",
    "templateIds": ["<template_id_1>", "<template_id_2>", "<template_id_3>"],
    "targetUrl": "http://localhost:3001/webhook",
    "delayMs": 100
  }'
```

#### 重复投递（测试幂等性）

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Delivery Test",
    "strategy": "duplicate",
    "templateIds": ["<template_id>"],
    "targetUrl": "http://localhost:3001/webhook/order-paid",
    "duplicateCount": 2,
    "delayMs": 500
  }'
```

#### 延迟投递

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delayed Delivery Test",
    "strategy": "delayed",
    "templateIds": ["<template_id_1>", "<template_id_2>"],
    "targetUrl": "http://localhost:3001/webhook",
    "delayMs": 2000
  }'
```

#### 签名错误

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Signature Error Test",
    "strategy": "signature_error",
    "templateIds": ["<template_id_1>", "<template_id_2>", "<template_id_3>"],
    "targetUrl": "http://localhost:3001/webhook",
    "signatureInvalidCount": 1
  }'
```

#### 部分失败重试

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Partial Failure Test",
    "strategy": "partial_failure",
    "templateIds": ["<template_id_1>", "<template_id_2>", "<template_id_3>"],
    "targetUrl": "http://localhost:3001/webhook",
    "failureCount": 1
  }'
```

---

### 4. 查看演练结果

#### 查看演练详情

```bash
curl http://localhost:3000/api/simulations/<simulation_id>
```

#### 查看演练的所有投递

```bash
curl http://localhost:3000/api/simulations/<simulation_id>/deliveries
```

#### 查看单个投递详情

```bash
curl http://localhost:3000/api/deliveries/<delivery_id>
```

---

### 5. 死信队列管理

#### 查看待处理死信

```bash
curl http://localhost:3000/api/dead-letters
```

#### 重放单个死信

```bash
curl -X POST http://localhost:3000/api/dead-letters/<dead_letter_id>/replay
```

#### 重放所有待处理死信

```bash
curl -X POST http://localhost:3000/api/dead-letters/replay-all
```

---

### 6. 幂等账本

#### 查看所有幂等记录

```bash
curl http://localhost:3000/api/idempotency-ledger
```

#### 查看单个幂等键的记录

```bash
curl http://localhost:3000/api/idempotency-ledger/<idempotency_key>
```

---

### 7. 报告导出

#### 导出演练报告 (JSON)

```bash
curl -O http://localhost:3000/api/reports/simulations/<simulation_id>/json
```

#### 导出演练报告 (Markdown)

```bash
curl -O http://localhost:3000/api/reports/simulations/<simulation_id>/markdown
```

#### 导出完整报告 (JSON)

```bash
curl -O http://localhost:3000/api/reports/full/json
```

#### 导出完整报告 (Markdown)

```bash
curl -O http://localhost:3000/api/reports/full/markdown
```

---

### 8. 签名测试

#### 生成签名

```bash
curl -X POST http://localhost:3000/api/signature/test \
  -H "Content-Type: application/json" \
  -d '{
    "payload": { "orderId": "ORD-001", "amount": 99.99 },
    "secret": "my-secret-key"
  }'
```

#### 验证签名

```bash
curl -X POST http://localhost:3000/api/signature/verify \
  -H "Content-Type: application/json" \
  -d '{
    "payload": { "orderId": "ORD-001", "amount": 99.99 },
    "signature": "abc123...",
    "secret": "my-secret-key",
    "timestamp": 1705312200000
  }'
```

---

### 9. 统计信息

```bash
curl http://localhost:3000/api/stats
```

---

## 示例接收端接口

示例接收端运行在 `http://localhost:3001`，提供以下功能：

### 健康检查

```bash
curl http://localhost:3001/health
```

### 通用 Webhook 端点（带签名验证和幂等）

```bash
# 先用主服务生成签名，再用正确的签名调用
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: t=<timestamp>,v1=<signature>" \
  -H "X-Webhook-Event: order.paid" \
  -H "X-Idempotency-Key: ORD-001" \
  -d '{
    "orderId": "ORD-001",
    "amount": 99.99
  }'
```

### 事件专用端点

```bash
# order.paid 事件
curl -X POST http://localhost:3001/webhook/order-paid \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: t=<timestamp>,v1=<signature>" \
  -H "X-Idempotency-Key: ORD-001" \
  -d '{ "orderId": "ORD-001", "amount": 99.99 }'

# stock.locked 事件
curl -X POST http://localhost:3001/webhook/stock-locked \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: t=<timestamp>,v1=<signature>" \
  -H "X-Idempotency-Key: ORD-001" \
  -d '{ "sku": "SKU-001", "quantity": 2 }'

# repo.pushed 事件
curl -X POST http://localhost:3001/webhook/repo-pushed \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: t=<timestamp>,v1=<signature>" \
  -H "X-Idempotency-Key: a1b2c3d4" \
  -d '{ "repo": "my-org/my-repo", "commitId": "a1b2c3d4" }'
```

### 失败测试路径

```bash
# 500 服务器错误
curl -X POST http://localhost:3001/webhook/fail?type=server_error

# 429 限流
curl -X POST http://localhost:3001/webhook/fail?type=rate_limit

# 502 网关错误
curl -X POST http://localhost:3001/webhook/fail?type=bad_gateway

# 503 服务不可用
curl -X POST http://localhost:3001/webhook/fail?type=unavailable

# 504 超时（15秒延迟）
curl -X POST http://localhost:3001/webhook/fail?type=timeout
```

### 幂等键管理

```bash
# 查看所有已处理的幂等键
curl http://localhost:3001/webhook/idempotency-keys

# 清除所有幂等键
curl -X DELETE http://localhost:3001/webhook/idempotency-keys
```

---

## 完整测试流程示例

### 1. 启动所有服务

终端 1:
```bash
npm run dev
```

终端 2:
```bash
npm run dev:receiver
```

### 2. 创建模板

```bash
# 创建 order.paid 模板
ORDER_TEMPLATE=$(curl -s -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Paid",
    "eventType": "order.paid",
    "payload": {
      "orderId": "ORD-TEST-001",
      "amount": 99.99,
      "currency": "CNY"
    },
    "secret": "order-secret-123",
    "defaultRetryCount": 3,
    "defaultDelayMs": 1000,
    "idempotencyKeyPath": "orderId"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "Created template: $ORDER_TEMPLATE"
```

### 3. 测试各种场景

#### 场景 1：正常投递

```bash
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Normal Test\",
    \"strategy\": \"normal\",
    \"templateIds\": [\"$ORDER_TEMPLATE\"],
    \"targetUrl\": \"http://localhost:3001/webhook/order-paid\",
    \"delayMs\": 100
  }"
```

#### 场景 2：重复投递（测试幂等性）

```bash
# 发起重复投递演练
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Duplicate Test\",
    \"strategy\": \"duplicate\",
    \"templateIds\": [\"$ORDER_TEMPLATE\"],
    \"targetUrl\": \"http://localhost:3001/webhook/order-paid\",
    \"duplicateCount\": 2,
    \"delayMs\": 500
  }"
```

#### 场景 3：签名错误

```bash
# 先清除接收端的幂等键
curl -X DELETE http://localhost:3001/webhook/idempotency-keys

# 发起签名错误演练
curl -X POST http://localhost:3000/api/simulations \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Signature Error Test\",
    \"strategy\": \"signature_error\",
    \"templateIds\": [\"$ORDER_TEMPLATE\"],
    \"targetUrl\": \"http://localhost:3001/webhook/order-paid\",
    \"signatureInvalidCount\": 1
  }"
```

### 4. 查看结果

```bash
# 查看所有演练
curl http://localhost:3000/api/simulations

# 查看幂等账本
curl http://localhost:3000/api/idempotency-ledger

# 查看死信队列
curl http://localhost:3000/api/dead-letters

# 查看统计
curl http://localhost:3000/api/stats
```

---

## 数据持久化

所有数据存储在项目根目录的 `webhook-simulator.db` SQLite 数据库中，包括：
- 事件模板
- 演练记录
- 投递详情
- 死信队列
- 幂等账本

重启服务后数据不会丢失。

## 签名机制

服务使用 HMAC-SHA256 签名算法，签名头格式：

```
X-Webhook-Signature: t=<timestamp>,v1=<signature>
```

其中：
- `t`：Unix 时间戳（毫秒）
- `v1`：HMAC-SHA256 签名，计算方式为 `HMAC(secret, timestamp + "." + payload_json)`

服务端验证时会检查时间戳是否在 5 分钟内。

---

## 许可证

MIT
