# 接口幂等性演示服务

专门用于演示接口幂等性的本地后端 API 服务，处理线上订单扣款时常见的超时重试、用户连点、支付网关回调重复投递等场景。

## 功能特性

- ✅ **创建订单** - 支持幂等键验证
- ✅ **提交扣款** - 完整的幂等性保护
- ✅ **模拟支付回调** - 处理重复回调场景
- ✅ **查询幂等记录** - 查看所有幂等键状态
- ✅ **并发重放压测** - 模拟高并发重复请求
- ✅ **Markdown/JSON 报告导出** - 生成系统报告

## 幂等性覆盖场景

| 场景 | 处理方式 | 状态码 |
|------|----------|--------|
| 同一幂等键重复请求 | 返回缓存响应 | 200 |
| 同一幂等键不同参数 | 报冲突错误 | 409 |
| 无幂等键请求 | 返回风险提示 | 400 |
| 处理中重试 | 返回一致状态 | 202 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 初始化数据库表并创建示例数据
npm run seed

# 或者删除所有数据后重新初始化
npm run seed -- --drop
```

### 3. 启动服务

```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动。

### 4. 运行测试

```bash
npm test
```

### 5. 运行压测

先启动服务，然后在另一个终端运行：

```bash
npm run pressure

# 或者自定义并发数
CONCURRENCY=20 REQUESTS_PER_SCENARIO=10 npm run pressure
```

## 数据库结构

使用 SQLite 存储所有数据，包括以下表：

| 表名 | 说明 |
|------|------|
| `orders` | 订单表 |
| `payment_transactions` | 扣款流水表 |
| `idempotency_keys` | 幂等键记录表 |
| `request_fingerprints` | 请求指纹表 |
| `callback_events` | 回调事件表 |
| `audit_logs` | 审计日志表 |

### 状态定义

**订单状态 (OrderStatus)**：
- `pending` - 待支付
- `paid` - 已支付
- `cancelled` - 已取消
- `refunded` - 已退款

**交易状态 (TransactionStatus)**：
- `pending` - 待处理
- `processing` - 处理中
- `success` - 成功
- `failed` - 失败
- `refunded` - 已退款

**幂等状态 (IdempotencyStatus)**：
- `processing` - 处理中
- `success` - 成功
- `failed` - 失败
- `conflict` - 冲突

## API 文档

### 通用规则

所有 **POST** 请求必须在 HTTP Header 中提供 `X-Idempotency-Key`。

幂等键建议格式：`{业务类型}-{唯一标识}`，例如：
- `order-20240505-001`
- `payment-${uuidv4()}`
- `callback-${gateway_transaction_id}`

### 健康检查

```bash
GET /health
```

**响应示例**：
```json
{
  "success": true,
  "message": "Idempotency API Demo Service is running",
  "timestamp": "2026-05-05T...",
  "version": "1.0.0"
}
```

### 1. 创建订单

```bash
POST /api/orders
Content-Type: application/json
X-Idempotency-Key: order-test-001

{
  "user_id": "user-001",
  "product_name": "iPhone 15 Pro",
  "amount": 7999.00
}
```

**成功响应 (200)**：
```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "uuid",
      "user_id": "user-001",
      "product_name": "iPhone 15 Pro",
      "amount": 7999.00,
      "status": "pending",
      "created_at": "..."
    }
  }
}
```

**重复请求 (200)**：
```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "message": "Order created successfully",
  "data": { ... },
  "idempotency_hit": true,
  "cached_response": true,
  "idempotency_key": "order-test-001"
}
```

**无幂等键 (400)**：
```json
{
  "success": false,
  "code": "IDEMPOTENCY_KEY_REQUIRED",
  "message": "Idempotency key is required for this operation",
  "risk_warning": true,
  "hint": "Please provide a unique X-Idempotency-Key header..."
}
```

**冲突 (409)**：
```json
{
  "success": false,
  "code": "IDEMPOTENCY_CONFLICT",
  "message": "Idempotency conflict: same key with different request parameters",
  "existing_request": {
    "idempotency_key": "order-test-001",
    "status": "conflict",
    "created_at": "..."
  }
}
```

### 2. 提交扣款

```bash
POST /api/payments
Content-Type: application/json
X-Idempotency-Key: payment-test-001

{
  "order_id": "order-uuid",
  "payment_method": "alipay",
  "amount": 7999.00
}
```

**成功响应 (200)**：
```json
{
  "success": true,
  "code": "PAYMENT_SUCCESS",
  "message": "Payment processed successfully",
  "data": {
    "order": {
      "id": "order-uuid",
      "status": "paid",
      "amount": 7999.00
    },
    "transaction": {
      "id": "txn-uuid",
      "status": "success",
      "gateway_transaction_id": "GATEWAY_XXX",
      "amount": 7999.00
    }
  }
}
```

### 3. 模拟支付回调

```bash
POST /api/payments/callback
Content-Type: application/json
X-Idempotency-Key: callback-gateway-001

{
  "gateway_transaction_id": "GATEWAY_XXX",
  "order_id": "order-uuid",
  "status": "success",
  "amount": 7999.00
}
```

**响应示例**：
```json
{
  "success": true,
  "code": "CALLBACK_PROCESSED",
  "message": "Payment callback processed successfully",
  "data": {
    "order": { ... },
    "transaction": { ... }
  }
}
```

**重复回调**：
```json
{
  "success": true,
  "code": "CALLBACK_DUPLICATE",
  "message": "Callback has already been processed",
  "idempotency_hit": true,
  "data": { ... }
}
```

### 4. 查询订单列表

```bash
GET /api/orders
GET /api/orders?user_id=user-001&status=paid&limit=10&offset=0
```

### 5. 查询订单详情

```bash
GET /api/orders/:orderId
```

### 6. 查询交易列表

```bash
GET /api/payments
GET /api/payments?order_id=order-uuid&status=success
```

### 7. 查询幂等记录列表

```bash
GET /api/idempotency
GET /api/idempotency?status=success&limit=20
```

### 8. 查询幂等记录详情

```bash
GET /api/idempotency/:key
```

### 9. 查询统计汇总

```bash
GET /api/idempotency/stats/summary
```

### 10. 查询审计日志

```bash
GET /api/idempotency/logs/audit
GET /api/idempotency/logs/audit?user_id=user-001&action=order_create
```

### 11. 查询回调事件

```bash
GET /api/idempotency/callbacks
```

### 12. 报告导出

```bash
# JSON 报告
GET /api/reports/json

# Markdown 报告
GET /api/reports/markdown

# 统计数据
GET /api/reports/stats
```

## Curl 示例

### 场景 1: 同一幂等键重复请求（应该只生效一次）

```bash
# 定义幂等键
KEY="order-same-key-$(date +%s)"

# 第一次请求（创建订单）
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{
    "user_id": "user-curl-001",
    "product_name": "测试商品-重复请求",
    "amount": 999.00
  }'

# 第二次请求（相同键相同参数，应该返回缓存）
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{
    "user_id": "user-curl-001",
    "product_name": "测试商品-重复请求",
    "amount": 999.00
  }'
```

### 场景 2: 同一幂等键不同参数（应该报冲突）

```bash
# 定义幂等键
KEY="order-conflict-$(date +%s)"

# 第一次请求
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{
    "user_id": "user-curl-002",
    "product_name": "商品A",
    "amount": 100.00
  }'

# 第二次请求（相同键不同参数，应该报冲突）
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $KEY" \
  -d '{
    "user_id": "user-curl-002",
    "product_name": "商品B",
    "amount": 200.00
  }'
```

### 场景 3: 无幂等键请求（应该给风险提示）

```bash
# 不提供 X-Idempotency-Key
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-curl-003",
    "product_name": "无幂等键测试",
    "amount": 500.00
  }'
```

### 场景 4: 完整支付流程

```bash
# 1. 创建订单
ORDER_KEY="order-payflow-$(date +%s)"
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $ORDER_KEY" \
  -d '{
    "user_id": "user-payflow-001",
    "product_name": "完整支付流程测试",
    "amount": 2999.00
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).data.order.id)")
echo "订单ID: $ORDER_ID"

# 2. 提交扣款
PAYMENT_KEY="payment-payflow-$(date +%s)"
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $PAYMENT_KEY" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"payment_method\": \"wechat\",
    \"amount\": 2999.00
  }"

# 3. 模拟支付回调（支付网关通知）
CALLBACK_KEY="callback-payflow-$(date +%s)"
curl -X POST http://localhost:3000/api/payments/callback \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $CALLBACK_KEY" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"status\": \"success\",
    \"amount\": 2999.00,
    \"gateway_transaction_id\": \"GATEWAY_$(date +%s)\"
  }"
```

### 场景 5: 查看报告

```bash
# JSON 报告
curl -O report.json http://localhost:3000/api/reports/json

# Markdown 报告
curl -O report.md http://localhost:3000/api/reports/markdown

# 查看统计
curl http://localhost:3000/api/idempotency/stats/summary
```

## 目录结构

```
.
├── src/
│   ├── config/
│   │   ├── database.js          # 数据库连接
│   │   └── initDatabase.js      # 数据库初始化
│   ├── middleware/
│   │   └── idempotency.js       # 幂等性中间件
│   ├── models/
│   │   ├── Order.js              # 订单模型
│   │   ├── PaymentTransaction.js # 交易模型
│   │   ├── IdempotencyKey.js     # 幂等键模型
│   │   ├── RequestFingerprint.js # 请求指纹模型
│   │   ├── CallbackEvent.js      # 回调事件模型
│   │   └── AuditLog.js           # 审计日志模型
│   ├── routes/
│   │   ├── orders.js             # 订单路由
│   │   ├── payments.js           # 支付路由
│   │   ├── idempotency.js        # 幂等记录路由
│   │   └── reports.js            # 报告路由
│   ├── utils/
│   │   ├── reportGenerator.js    # 报告生成器
│   │   └── pressureTest.js       # 压测工具
│   ├── seeders/
│   │   └── seed.js               # 数据初始化
│   └── index.js                  # 入口文件
├── tests/
│   └── idempotency.test.js       # 测试用例
├── data/                         # SQLite 数据库目录
├── package.json
└── README.md
```

## 技术栈

- **Node.js** - 运行时
- **Express** - Web 框架
- **SQLite (better-sqlite3)** - 数据库
- **Jest + Supertest** - 测试框架
- **Helmet + CORS** - 安全中间件

## 许可证

MIT License
