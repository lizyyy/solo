# Webhook 投递观察站

一个本地可运行的纯后端 API 服务，用于调试和观察 Webhook 回调的完整生命周期。解决支付联调中的痛点：签名验证失败、重复投递、重试不成功等问题。

## 功能特性

- ✅ **订阅管理**：创建/更新/删除 Webhook 订阅端点
- ✅ **事件模拟**：接收并模拟发送事件到订阅端点
- ✅ **HMAC 签名**：支持 SHA256 HMAC 签名投递和验证
- ✅ **失败重试**：自动重试失败的投递，支持指数退避
- ✅ **死信队列**：超过最大重试次数的事件进入死信队列
- ✅ **幂等去重**：支持幂等键防止重复处理
- ✅ **投递日志**：完整记录每次投递的详细信息
- ✅ **审计导出**：支持 JSON 和 Markdown 格式的审计报告导出
- ✅ **本地持久化**：使用 SQLite 本地存储所有数据

## 项目结构

```
webhook-delivery-observer/
├── src/
│   ├── index.js              # 主入口文件
│   ├── config.js             # 配置文件
│   ├── sample-events.js      # 示例事件数据
│   ├── storage/
│   │   ├── database.js       # SQLite 数据库初始化
│   │   └── index.js          # 存储层封装
│   ├── signature/
│   │   └── index.js          # HMAC 签名模块
│   ├── validation/
│   │   └── index.js          # 规则校验（幂等去重等）
│   ├── scheduler/
│   │   └── index.js          # 调度重试模块
│   ├── exporter/
│   │   └── index.js          # 导出模块
│   └── routes/
│       ├── subscriptions.js  # 订阅管理路由
│       ├── events.js         # 事件管理路由
│       ├── logs.js           # 投递日志路由
│       ├── dead-letters.js   # 死信队列路由
│       ├── export.js         # 导出路由
│       └── signature.js      # 签名工具路由
├── tests/
│   ├── signature.test.js     # 签名模块测试
│   ├── storage.test.js       # 存储层测试
│   └── validation.test.js    # 规则校验测试
├── data/                     # SQLite 数据目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev
```

服务默认运行在 `http://localhost:3000`

### 3. 验证服务运行

```bash
curl http://localhost:3000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "scheduler": {
    "running": true
  }
}
```

## 完整验证流程

### 步骤 1：创建一个 Webhook 订阅

首先，你需要一个用于接收 Webhook 的测试端点。你可以使用：
- 自己的本地服务
- 在线服务如 [RequestBin](https://requestbin.com/) 或 [Webhook.site](https://webhook.site/)

这里假设你的接收端点是 `http://localhost:8080/webhook`

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "http://localhost:8080/webhook",
    "secret": "my-super-secret-key-123"
  }'
```

预期响应：
```json
{
  "id": "uuid-subscription-id",
  "endpoint": "http://localhost:8080/webhook",
  "active": 1,
  "created_at": 1700000000,
  "updated_at": 1700000000
}
```

保存返回的 `id`，后续步骤会用到。

### 步骤 2：查看示例事件

系统内置了多种示例事件供测试使用：

```bash
curl http://localhost:3000/api/events/samples
```

或者查看特定类别的示例：

```bash
curl "http://localhost:3000/api/events/samples?category=payment&type=succeeded"
```

### 步骤 3：发送一个事件

使用示例事件或自定义事件进行发送：

```bash
SUBSCRIPTION_ID="你的订阅ID"

curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d "{
    \"subscription_id\": \"$SUBSCRIPTION_ID\",
    \"event_type\": \"payment.succeeded\",
    \"idempotency_key\": \"payment-2024-001\",
    \"payload\": {
      \"id\": \"pay_2024_001\",
      \"amount\": 9999,
      \"currency\": \"cny\",
      \"status\": \"succeeded\",
      \"customer\": {
        \"email\": \"user@example.com\"
      }
    }
  }"
```

### 步骤 4：查看投递日志

```bash
EVENT_ID="事件ID"

curl http://localhost:3000/api/events/$EVENT_ID/logs
```

或者查看所有投递日志：

```bash
curl http://localhost:3000/api/logs
```

### 步骤 5：使用幂等键去重

如果使用相同的 `idempotency_key` 发送事件，系统会自动检测并返回已存在的事件：

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d "{
    \"subscription_id\": \"$SUBSCRIPTION_ID\",
    \"event_type\": \"payment.succeeded\",
    \"idempotency_key\": \"payment-2024-001\",
    \"payload\": {
      \"id\": \"pay_2024_001\",
      \"amount\": 9999
    }
  }"
```

预期响应（检测到重复）：
```json
{
  "duplicate": true,
  "existing_event": {
    "id": "...",
    "event_type": "payment.succeeded",
    ...
  }
}
```

## 签名验证

### 生成签名

```bash
curl -X POST http://localhost:3000/api/signature/generate \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "my-super-secret-key-123",
    "payload": {
      "event": "test",
      "data": "value"
    }
  }'
```

### 验证签名

```bash
curl -X POST http://localhost:3000/api/signature/verify \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "my-super-secret-key-123",
    "payload": {
      "event": "test",
      "data": "value"
    },
    "signature": "sha256=生成的签名"
  }'
```

### 接收端如何验证签名

当服务发送 Webhook 时，会在请求头中包含签名：

```
X-Webhook-Signature: sha256=abc123def456...
X-Event-Id: event-uuid
X-Event-Type: payment.succeeded
X-Idempotency-Key: payment-2024-001 (如果提供)
```

接收端验证示例（Node.js）：

```javascript
const crypto = require('crypto');

function verifySignature(secret, payload, signatureHeader) {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}
```

## 死信队列管理

### 查看死信队列

```bash
curl http://localhost:3000/api/dead-letters
```

### 重试死信

```bash
DEAD_LETTER_ID="死信ID"

curl -X POST http://localhost:3000/api/dead-letters/$DEAD_LETTER_ID/retry
```

### 删除死信

```bash
curl -X DELETE http://localhost:3000/api/dead-letters/$DEAD_LETTER_ID
```

## 审计导出

### 导出 JSON 格式

```bash
# 导出所有数据
curl http://localhost:3000/api/export/json

# 导出指定订阅的数据
curl "http://localhost:3000/api/export/json?subscription_id=$SUBSCRIPTION_ID"

# 不包含某些数据
curl "http://localhost:3000/api/export/json?logs=false&dead_letters=false"
```

### 导出 Markdown 格式

```bash
# 导出为 Markdown 文件
curl http://localhost:3000/api/export/markdown -o audit-report.md
```

## 查看统计信息

```bash
curl http://localhost:3000/stats
```

## 重试机制

系统自动使用以下退避策略重试失败的投递：

| 重试次数 | 等待时间 |
|---------|---------|
| 第 1 次 | 1 秒 |
| 第 2 次 | 5 秒 |
| 第 3 次 | 15 秒 |
| 第 4 次 | 30 秒 |
| 第 5 次 | 60 秒 |

超过 5 次重试后，事件进入死信队列。

## API 完整列表

### 订阅管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/subscriptions` | 创建订阅 |
| GET | `/api/subscriptions` | 列出所有订阅 |
| GET | `/api/subscriptions/:id` | 获取订阅详情 |
| PATCH | `/api/subscriptions/:id` | 更新订阅 |
| DELETE | `/api/subscriptions/:id` | 删除订阅 |
| GET | `/api/subscriptions/:id/events` | 获取订阅的所有事件 |

### 事件管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/events` | 发送事件 |
| GET | `/api/events/samples` | 获取示例事件 |
| GET | `/api/events/:id` | 获取事件详情 |
| GET | `/api/events/:id/logs` | 获取事件投递日志 |
| POST | `/api/events/:id/retry` | 手动重试事件 |

### 日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/logs` | 获取投递日志 |
| GET | `/api/logs/stats` | 获取统计信息 |

### 死信队列

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/dead-letters` | 获取死信列表 |
| POST | `/api/dead-letters/:id/retry` | 重试死信 |
| DELETE | `/api/dead-letters/:id` | 删除死信 |

### 导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/json` | 导出 JSON 报告 |
| GET | `/api/export/markdown` | 导出 Markdown 报告 |

### 签名工具

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/signature/generate` | 生成签名 |
| POST | `/api/signature/verify` | 验证签名 |

### 系统

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/stats` | 统计信息 |

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch
```

## 配置

可以通过环境变量或修改 `src/config.js` 来配置：

```bash
# 端口
PORT=3000

# 数据库路径
DB_PATH=./data/webhook.db
```

## 常见问题排查

### 1. 投递失败但不知道原因

查看投递日志：
```bash
curl http://localhost:3000/api/logs?subscription_id=$SUBSCRIPTION_ID
```

日志会显示：
- HTTP 状态码
- 响应内容
- 错误消息

### 2. 签名验证失败

使用签名验证工具检查：
```bash
curl -X POST http://localhost:3000/api/signature/verify \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "你的密钥",
    "payload": "实际的 payload",
    "signature": "收到的签名"
  }'
```

注意：payload 必须与发送时完全一致（包括 JSON 键的顺序）。

### 3. 事件被重复处理

确保使用幂等键：
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_id": "...",
    "event_type": "...",
    "idempotency_key": "唯一的业务键",
    "payload": { ... }
  }'
```

### 4. 如何模拟失败场景

创建一个会返回错误的订阅端点，例如：
- 使用 `http://httpstat.us/500` 来模拟 500 错误
- 使用 `http://httpstat.us/400` 来模拟 400 错误

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "http://httpstat.us/500",
    "secret": "test-secret"
  }'
```

然后发送事件，观察重试机制和死信队列。

## License

MIT
