# Webhook Debugger

本地 Webhook 调试服务 - 帮助小团队调试第三方回调接入。

## 功能特性

- ✅ 多 Provider 配置：支持多个第三方的签名算法、密钥、时间戳容忍窗口
- ✅ 签名验证：保留原始 body，严格验签，时间戳过期拒绝
- ✅ 幂等去重：按 eventId 或 payload hash 去重，重复推送不重复处理
- ✅ 状态流转：待处理 → 处理中 → 成功 / 失败待重试 → 已丢弃
- ✅ 下游模拟器：可配置成功/失败/重试场景，测试补偿逻辑
- ✅ 手动重放：单个事件重放、按 provider 批量重放
- ✅ 查询接口：事件列表、详情、处理历史、失败统计
- ✅ 导出报告：JSON/CSV/Markdown 格式导出

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化种子数据

```bash
node scripts/seed.js
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

---

## API 接口

### 健康检查

```bash
curl http://localhost:3000/health
```

### Provider 管理

#### 查看所有 Provider

```bash
curl http://localhost:3000/api/providers
```

#### 查看单个 Provider

```bash
curl http://localhost:3000/api/providers/1
```

#### 创建新 Provider

```bash
curl -X POST http://localhost:3000/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-new-provider",
    "secret": "my_secret_key",
    "algorithm": "sha256",
    "tolerance_seconds": 300,
    "signature_header": "X-Signature",
    "timestamp_header": "X-Timestamp"
  }'
```

#### 更新 Provider

```bash
curl -X PUT http://localhost:3000/api/providers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "new_secret",
    "enabled": true
  }'
```

---

## 使用示例

### 场景 1：发送合法签名请求

先运行 seed 脚本获取当前时间戳和签名：

```bash
node scripts/seed.js
```

输出会显示类似这样的 curl 示例：

```bash
curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: 1714780800" \
  -H "X-Pay-Signature: abc123..." \
  -d '{"eventId":"pay_001","type":"payment.success","amount":100.00,"orderId":"ORD_2024_001"}'
```

或者使用以下动态生成签名的方式：

```bash
# 生成时间戳
TIMESTAMP=$(date +%s)

# 准备 payload
PAYLOAD='{"eventId":"test_001","type":"payment.success","amount":99.99}'

# 计算签名 (需要 Node.js)
SIGNATURE=$(node -e "
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', 'pay_secret_12345');
hmac.update(process.argv[1]);
console.log(hmac.digest('hex'));
" "$PAYLOAD")

# 发送请求
curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: $TIMESTAMP" \
  -H "X-Pay-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### 场景 2：签名错误测试

发送错误的签名：

```bash
curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: $(date +%s)" \
  -H "X-Pay-Signature: wrong_signature_here" \
  -d '{"eventId":"fail_001","type":"test"}'
```

响应示例：
```json
{
  "success": false,
  "error": "invalid_signature",
  "message": "Signature mismatch",
  "details": {
    "provided": "wrong_signature_here",
    "expected": "actual_signature",
    "algorithm": "sha256"
  }
}
```

### 场景 3：时间戳过期测试

发送过期的时间戳（超过 5 分钟）：

```bash
# 生成 10 分钟前的时间戳
EXPIRED_TS=$(( $(date +%s) - 600 ))

PAYLOAD='{"eventId":"expired_001","type":"test"}'

SIGNATURE=$(node -e "
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', 'pay_secret_12345');
hmac.update(process.argv[1]);
console.log(hmac.digest('hex'));
" "$PAYLOAD")

curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: $EXPIRED_TS" \
  -H "X-Pay-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### 场景 4：重复推送测试

发送相同的 payload 两次：

```bash
# 第一次
TIMESTAMP=$(date +%s)
PAYLOAD='{"eventId":"dup_001","type":"test","unique_field":"value"}'
SIGNATURE=$(node -e "
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', 'pay_secret_12345');
hmac.update(process.argv[1]);
console.log(hmac.digest('hex'));
" "$PAYLOAD")

curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: $TIMESTAMP" \
  -H "X-Pay-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# 第二次（相同 payload）
curl -X POST http://localhost:3000/webhook/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pay-Timestamp: $TIMESTAMP" \
  -H "X-Pay-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

第二次响应会显示 `duplicate: true`。

### 场景 5：失败重试测试

使用 `sms-provider` 配置为总是失败：

```bash
TIMESTAMP=$(date +%s)
PAYLOAD='{"id":"sms_001","type":"sms.send","phone":"13800138000","content":"test"}'
SIGNATURE=$(node -e "
const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', 'sms_secret_67890');
hmac.update(process.argv[1]);
console.log(hmac.digest('hex'));
" "$PAYLOAD")

curl -X POST http://localhost:3000/webhook/sms-provider \
  -H "Content-Type: application/json" \
  -H "X-Sms-Timestamp: $TIMESTAMP" \
  -H "X-Sms-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

查看事件状态：

```bash
curl http://localhost:3000/api/events?provider_name=sms-provider
```

事件状态应为 `failed_retry`，且有 `next_retry_at` 字段。

### 场景 6：手动重放失败事件

查看事件列表获取事件 ID：

```bash
curl http://localhost:3000/api/events?status=failed_retry
```

重放单个事件：

```bash
# 假设事件 ID 是 1
curl -X POST http://localhost:3000/api/events/1/replay
```

批量重放某个 provider 的所有失败事件：

```bash
curl -X POST http://localhost:3000/api/events/batch/replay \
  -H "Content-Type: application/json" \
  -d '{"provider_name":"sms-provider"}'
```

### 场景 7：查询接口

#### 查看所有事件

```bash
curl http://localhost:3000/api/events
```

#### 按状态过滤

```bash
curl "http://localhost:3000/api/events?status=success"
curl "http://localhost:3000/api/events?status=failed_retry"
curl "http://localhost:3000/api/events?status=discarded"
```

#### 按 provider 过滤

```bash
curl "http://localhost:3000/api/events?provider_name=payment-gateway"
```

#### 查看单个事件详情（含处理历史）

```bash
# 假设事件 ID 是 1
curl http://localhost:3000/api/events/1
```

#### 查看事件的处理尝试历史

```bash
curl http://localhost:3000/api/events/1/attempts
```

#### 查看统计信息

```bash
curl http://localhost:3000/api/events/statistics
```

### 场景 8：导出报告

#### JSON 格式

```bash
curl "http://localhost:3000/api/export?format=json" -o report.json
```

#### CSV 格式

```bash
curl "http://localhost:3000/api/export?format=csv" -o report.csv
```

#### Markdown 格式

```bash
curl "http://localhost:3000/api/export?format=md" -o report.md
```

#### 按时间范围导出

```bash
# 最近 1 小时内
SINCE=$(( $(date +%s) - 3600 ))
curl "http://localhost:3000/api/export?format=json&since=$SINCE"

# 指定时间范围
curl "http://localhost:3000/api/export?format=md&since=1714780800&until=1714867200"
```

#### 按 provider 导出

```bash
curl "http://localhost:3000/api/export?format=json&provider=payment-gateway"
```

---

## 模拟器配置

### 查看当前模拟器配置

```bash
curl http://localhost:3000/api/providers/1/simulator
```

### 配置模拟器模式

#### 模式 1：总是成功

```bash
curl -X POST http://localhost:3000/api/providers/1/simulator \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "success",
    "event_type": "*"
  }'
```

#### 模式 2：总是失败

```bash
curl -X POST http://localhost:3000/api/providers/1/simulator \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "fail_always",
    "error_message": "Downstream service unavailable",
    "event_type": "*"
  }'
```

#### 模式 3：前 N 次失败后成功

```bash
curl -X POST http://localhost:3000/api/providers/1/simulator \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "fail_n_times",
    "fail_count": 2,
    "error_message": "Temporary error",
    "event_type": "*"
  }'
```

---

## 状态流转说明

```
                    +-----------+
                    |  pending  |
                    +-----+-----+
                          |
                          v
                    +-----------+
              +---->| processing |<----+
              |     +-----+-----+     |
              |           |           |
              |           v           |
              |     +-----------+   |
              |     |  success  |   |
              |     +-----------+   |
              |                       |
              v                       |
        +-----------+           |
        |failed_retry|-----------+
        +-----+-----+
              |
              | 超过最大重试次数
              v
        +-----------+
        | discarded |
        +-----------+
```

| 状态 | 说明 |
|------|------|
| pending | 待处理，刚收到事件 |
| processing | 处理中 |
| success | 处理成功 |
| failed_retry | 失败待重试，有 next_retry_at |
| discarded | 已丢弃，超过最大重试次数 |

---

## 项目结构

```
.
├── data/                    # SQLite 数据库目录
├── scripts/
│   └── seed.js            # 种子数据脚本
├── src/
│   ├── config.js           # 配置文件
│   ├── index.js            # 入口文件
│   ├── db/
│   │   ├── index.js        # 数据库连接
│   │   └── schema.js       # 表结构和常量
│   ├── dao/
│   │   ├── providerDao.js   # Provider 数据访问
│   │   ├── eventDao.js     # Event 数据访问
│   │   ├── attemptDao.js    # 处理尝试数据访问
│   │   ├── auditDao.js      # 审计日志数据访问
│   │   └── simulatorDao.js  # 模拟器配置数据访问
│   ├── services/
│   │   ├── signatureService.js  # 签名验证
│   │   ├── eventService.js      # 事件处理和重试
│   │   ├── simulatorService.js  # 下游模拟器
│   │   └── exportService.js     # 报告导出
│   └── routes/
│       ├── providers.js     # Provider 管理路由
│       ├── events.js        # 事件查询和重放路由
│       ├── webhook.js       # Webhook 接收路由
│       └── export.js        # 导出路由
├── package.json
└── README.md
```

---

## 配置说明

在 `src/config.js` 中可以调整：

```javascript
module.exports = {
  port: 3000,                    // 服务端口
  db: {
    path: './data/webhook.db',   // SQLite 数据库路径
  },
  signature: {
    defaultAlgorithm: 'sha256',  // 默认签名算法
    defaultTolerance: 300,        // 默认时间戳容忍（秒）
  },
  retry: {
    maxAttempts: 5,                // 最大重试次数
    backoffMultiplier: 2,          // 退避倍数
    initialDelay: 10,              // 首次重试延迟（秒）
    scheduleInterval: 60,            // 重试调度间隔（秒）
  },
};
```

---

## 审计日志

所有关键操作都会记录审计日志，包括：

| 事件类型 | 说明 |
|----------|------|
| event_received | 事件已接收 |
| signature_failed | 签名验证失败 |
| timestamp_expired | 时间戳过期 |
| event_duplicate | 重复事件 |
| event_processed | 事件处理成功 |
| event_failed | 事件处理失败 |
| event_retried | 自动重试 |
| event_replayed | 手动重放 |
| event_discarded | 事件被丢弃 |
| provider_created | Provider 创建 |
| provider_updated | Provider 更新 |
| provider_deleted | Provider 删除 |
| simulator_config_updated | 模拟器配置更新 |
| batch_replay_started | 批量重放开始 |

---

## License

MIT
