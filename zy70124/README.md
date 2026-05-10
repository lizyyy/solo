# 演出票务限购 API

解决热门演出售票时，证件、账号、支付渠道限购被绕过的问题。

## 核心能力

| 能力 | 说明 |
|------|------|
| **票档库存** | 多票档独立管理，原子扣减，支持预售预留 |
| **实名限购** | 证件号、账号、支付渠道三维度校验 |
| **候补队列** | 售罄自动入队，退票后按顺序匹配 |
| **退票回补** | 库存原路退回，自动通知候补用户 |
| **风控拦截** | 黑名单、频率限制、异常行为检测 |
| **销售报表** | 实时统计、渠道分析、异常识别 |
| **补偿任务** | 失败自动重试，无需人工清库 |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

输出示例：
```
========================================
  演出票务限购 API 已启动
  服务地址: http://localhost:3000
  健康检查: http://localhost:3000/health
========================================

默认限购规则:
  - 单证件每场限购: 2 张
  - 单账号每场限购: 4 张
  - 单支付渠道每场限购: 2 张
```

### 3. 运行测试

**方式一：Node.js 端到端测试（推荐，覆盖所有场景）**
```bash
npm run test
```

**方式二：CURL 交互式测试**
```bash
# 终端 1 启动服务
npm start

# 终端 2 运行测试
npm run test:curl
```

---

## 默认限购规则

可在 `src/config.js` 中修改：

```javascript
limit: {
  perIdCard: 2,      // 单证件号单场限购
  perAccount: 4,     // 单账号单场限购
  perPayment: 2      // 单支付渠道单场限购（需结合证件号）
}
```

每个票档也可以单独设置上限，优先于全局配置。

---

## API 接口

### 一、演出管理

**1. 创建演出**
```bash
curl -X POST http://localhost:3000/api/shows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "周杰伦「嘉年华」北京站",
    "startTime": "2024-12-20 19:30:00",
    "endTime": "2024-12-20 22:00:00",
    "venue": "北京鸟巢体育场",
    "description": "年度最期待演唱会"
  }'
```

返回（业务语言）：
```json
{
  "success": true,
  "message": "演出创建成功",
  "data": { "showId": "uuid-xxx" }
}
```

**2. 创建票档**
```bash
curl -X POST http://localhost:3000/api/shows/{showId}/tiers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP 内场票",
    "price": 2888,
    "totalQuantity": 100,
    "perIdCardLimit": 2,
    "perAccountLimit": 4,
    "perPaymentLimit": 2
  }'
```

**3. 查询票档库存**
```bash
curl http://localhost:3000/api/shows/tiers/{tierId}
```

### 二、订单购票

**1. 创建订单**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tierId": "{tierId}",
    "accountId": "user_001",
    "idCardNo": "110101199001011234",
    "paymentChannel": "alipay_001",
    "quantity": 1,
    "holders": [
      { "name": "张三", "idCard": "110101199001011234" }
    ]
  }'
```

**成功返回：**
```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "order": {
    "id": "order-uuid",
    "status": "pending_payment",
    "showName": "周杰伦「嘉年华」北京站",
    "tierName": "VIP 内场票",
    "quantity": 1,
    "totalAmount": "¥2,888.00",
    "message": "订单已创建，请在 15 分钟内完成支付"
  }
}
```

**限购拦截返回：**
```json
{
  "success": false,
  "reason": "该证件已购买 1 张，本场限购 2 张，超出 1 张",
  "code": "LIMIT_ID_CARD",
  "action": "限购拦截"
}
```

**售罄入队返回：**
```json
{
  "success": false,
  "reason": "库存不足，当前可售 0 张",
  "code": "OUT_OF_STOCK",
  "action": "已加入候补队列",
  "queue": {
    "queueId": "queue-uuid",
    "position": 3,
    "status": "waiting",
    "estimateWait": "前面还有 2 人"
  }
}
```

**2. 支付订单**
```bash
curl -X POST http://localhost:3000/api/orders/{orderId}/pay
```

**3. 退票**
```bash
curl -X POST http://localhost:3000/api/orders/{orderId}/refund \
  -H "Content-Type: application/json" \
  -d '{ "reason": "用户临时有事" }'
```

**退票成功返回（自动处理候补）：**
```json
{
  "success": true,
  "code": "REFUND_SUCCESS",
  "order": {
    "id": "order-uuid",
    "status": "refunded",
    "showName": "周杰伦「嘉年华」北京站",
    "tierName": "VIP 内场票",
    "refundAmount": "¥2,888.00"
  },
  "queueAction": "退票释放的 1 张票已匹配给候补队列的 1 位用户",
  "matchedUsers": [
    {
      "queueId": "queue-uuid",
      "accountId": "user_waiting_001",
      "idCardNo": "110101199001019999",
      "quantity": 1,
      "status": "matched",
      "action": "已匹配到票，待确认购买"
    }
  ]
}
```

**4. 查询订单**
```bash
curl http://localhost:3000/api/orders/{orderId}
curl http://localhost:3000/api/orders?accountId=user_001
```

**5. 候补队列管理**
```bash
# 查看候补状态
curl http://localhost:3000/api/orders/queue/{queueId}

# 取消候补
curl -X DELETE http://localhost:3000/api/orders/queue/{queueId}
```

### 三、管理后台

**1. 系统总览**
```bash
curl http://localhost:3000/api/admin/dashboard
```

**2. 演出销售报表**
```bash
curl http://localhost:3000/api/shows/{showId}/report
```

返回包含：
- 各票档销量、营收、售罄率
- 按状态统计的订单数
- 高频购票用户（按账号、按证件）

**3. 补偿任务管理**
```bash
# 查看任务列表
curl http://localhost:3000/api/admin/compensation/tasks
curl http://localhost:3000/api/admin/compensation/tasks?status=failed

# 手动触发补偿
curl -X POST http://localhost:3000/api/admin/compensation/run \
  -H "Content-Type: application/json" \
  -d '{ "limit": 10 }'

# 查看单个任务
curl http://localhost:3000/api/admin/compensation/tasks/{taskId}

# 重置失败任务，重新执行
curl -X POST http://localhost:3000/api/admin/compensation/tasks/{taskId}/retry
```

**4. 风控记录**
```bash
curl http://localhost:3000/api/admin/risks
curl http://localhost:3000/api/admin/risks?accountId=user_suspect
```

---

## 核心流程说明

### 购票流程
```
创建订单
    ↓
风控拦截 (黑名单/频率/数量) ──否──→ 失败
    ↓ 是
限购校验 (证件/账号/支付) ──否──→ 限购拦截
    ↓ 是
库存扣减 ──不足──→ 加入候补队列
    ↓ 成功
创建订单 → 等待支付
    ↓
支付确认 ──风控再次校验──→ 支付成功 / 支付失败
    ↓ 成功
生成电子票
```

### 退票流程
```
退票申请
    ↓
订单状态校验 (仅已支付可退)
    ↓
订单标记为已退款
    ↓
电子票标记为已退票
    ↓
库存回补
    ↓
候补队列匹配 (按顺序)
    ↓
如失败 → 创建补偿任务
```

### 补偿机制

当任意步骤失败时，系统会：
1. 记录 `compensation_tasks` 表
2. 包含：任务类型、关联 ID、重试次数、下次重试时间
3. 可手动触发：`POST /api/admin/compensation/run`
4. 失败任务可重置：`POST /api/admin/compensation/tasks/{id}/retry`

**补偿任务类型：**
- `restore_inventory` - 库存回补
- `update_order_status` - 订单状态更新

---

## 测试的关键场景

运行 `npm run test` 会验证以下场景：

| 场景 | 验证点 |
|------|--------|
| 正常购票 | 下单 → 支付 → 库存扣减 |
| 证件号限购 | 同一证件买第 3 张被拦截 |
| 支付渠道限购 | 同一支付宝换账号也被拦 |
| 账号限购 | 同一账号买第 5 张被拦（换证件换渠道也不行） |
| 售罄候补 | 库存为 0 时自动入队 |
| 退票回补 | 退票后库存回补 + 候补自动匹配 |
| 风控黑名单 | 预设账号无法购票 |
| 超额购买 | 单次买 11 张被拦 |
| 补偿任务 | 创建 → 执行 → 状态变为成功 |
| 销售报表 | 各维度统计正确生成 |

---

## 排障指南

| 现象 | 可能原因 | 下一步 |
|------|----------|--------|
| 下单返回 `LIMIT_ID_CARD` | 该证件号已买过票 | 查接口：`GET /api/orders?idCardNo=xxx` |
| 下单返回 `LIMIT_ACCOUNT` | 该账号已达上限 | 查接口：`GET /api/orders?accountId=xxx` |
| 下单返回 `RISK_BLOCKED_*` | 在风控黑名单中 | 查接口：`GET /api/admin/risks` |
| 订单状态异常 | 补偿任务未执行 | 查接口：`GET /api/admin/compensation/tasks` |
| 候补一直没消息 | 没人退票，或位置靠后 | 查接口：`GET /api/orders/queue/{queueId}` |
| 报表数据不对 | 实时计算，刷新即可 | 重试：`GET /api/shows/{showId}/report` |

---

## 项目结构

```
ticket-limit-api/
├── src/
│   ├── app.js                 # 应用入口
│   ├── config.js              # 配置（限购规则等）
│   ├── db/
│   │   └── index.js           # 数据库连接与表结构
│   ├── services/
│   │   ├── inventory.js       # 库存管理
│   │   ├── limit.js           # 限购校验
│   │   ├── risk.js            # 风控拦截
│   │   ├── queue.js           # 候补队列
│   │   ├── compensation.js    # 补偿任务
│   │   ├── order.js           # 订单流程（主入口）
│   │   └── report.js          # 销售报表
│   └── routes/
│       ├── shows.js           # 演出/票档接口
│       ├── orders.js          # 订单/候补接口
│       └── admin.js           # 后台管理接口
├── tests/
│   ├── e2e/
│   │   └── main-flow.test.js  # Node.js 端到端测试
│   └── curl/
│       └── main-flow.sh       # CURL 交互式测试
├── data/                      # SQLite 数据库（运行时生成）
├── package.json
└── README.md
```

---

## 数据模型

### 核心表

| 表名 | 作用 | 关键字段 |
|------|------|----------|
| `shows` | 演出 | name, start_time, venue |
| `ticket_tiers` | 票档 | show_id, price, total_quantity, sold_quantity, *各种限购上限* |
| `orders` | 订单 | account_id, id_card_no, payment_channel, quantity, status |
| `order_tickets` | 电子票 | order_id, ticket_no, holder_name |
| `queue_items` | 候补 | tier_id, account_id, position, status |
| `compensation_tasks` | 补偿任务 | type, reference_id, status, retry_count |
| `risk_records` | 风控记录 | type, account_id, id_card_no, reason |

---

## 黑名单配置

在 `src/services/risk.js` 中配置：

```javascript
const BLOCKED_PAYMENTS = new Set(['risk_payment_001', 'risk_payment_002']);
const BLOCKED_ACCOUNTS = new Set(['risk_account_001', 'risk_account_002']);
const BLOCKED_ID_CARDS = new Set(['11010119900000000X']);
```

---

## 下一步建议

- 引入 JWT 认证
- 接入真实支付网关回调
- 增加消息队列（RabbitMQ/Kafka）处理候补通知
- 添加定时任务自动执行补偿
- 增加 Redis 缓存库存和限购计数
- 接入第三方证件核验服务
