# 事件订阅偏好中心

Event Subscription Preference Center - 一个面向技术的全栈应用，解决客户自主选择业务事件订阅的真实痛点，同时确保订阅配置不影响旧回调。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: Vue 3 + Vue Router + Axios
- **核心特性**: 幂等处理、配置快照、状态流转、异常处理、数据导出

## 数据模型

### 核心表结构

1. **customer_apps** - 客户应用
   - id, app_name, app_code, callback_url, status

2. **event_types** - 事件类型
   - id, event_code, event_name, description, category

3. **subscription_rules** - 订阅规则（核心）
   - id, app_id, event_type_id, version, status, is_active
   - filter_config, delivery_endpoint, delivery_method
   - idempotency_key, snapshot_before, snapshot_after
   - reviewed_by, reviewed_at, created_at, updated_at

4. **filter_conditions** - 过滤条件
   - 支持多条件组合、优先级排序

5. **delivery_records** - 投递记录
   - 记录每次投递的状态、HTTP状态、错误信息、重试次数

6. **unsubscription_history** - 退订历史
   - 记录退订原因、操作人、配置快照、幂等键

7. **idempotency_records** - 幂等记录
   - 24小时缓存，防止重复调用

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

### 2. 初始化数据库

```bash
npm run init-db
```

> 这将创建SQLite数据库文件在 `data/eventsub.db`，并自动插入示例数据：
> - 2个示例应用：电商订单系统、用户中心
> - 4个示例事件：订单创建、订单支付、用户注册、用户信息更新

### 3. 启动服务

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：单独启动后端
npm run server

# 方式三：单独启动前端
cd client && npm run dev
```

服务启动后：
- 后端 API: http://localhost:3001
- 前端页面: http://localhost:3000
- 健康检查: http://localhost:3001/api/health

## API 接口文档

### 基础路径
所有接口前缀: `/api`

### 1. 应用管理

#### 获取应用列表
```bash
GET /api/apps
```

#### 创建应用
```bash
POST /api/apps
Content-Type: application/json

{
  "app_name": "支付系统",
  "app_code": "PAYMENT_SYSTEM",
  "callback_url": "https://api.example.com/payment/callback"
}
```

### 2. 事件类型管理

#### 获取事件类型列表
```bash
GET /api/event-types
```

### 3. 订阅规则管理

#### 查询订阅列表
```bash
GET /api/subscriptions?app_id=xxx&status=pending&page=1&limit=20
```

#### 查询单条订阅详情
```bash
GET /api/subscriptions/{subscription_id}
```

#### 创建订阅规则
```bash
POST /api/subscriptions
Content-Type: application/json
x-idempotency-key: unique-key-123 (可选，用于幂等)

{
  "app_id": "app-001",
  "event_type_id": "evt-001",
  "delivery_endpoint": "https://api.example.com/webhook/order",
  "filter_config": {
    "min_amount": 100,
    "region": "CN"
  },
  "filter_conditions": [
    {
      "field_name": "amount",
      "operator": ">",
      "field_value": "100"
    }
  ]
}
```

#### 复核订阅规则
```bash
POST /api/subscriptions/{subscription_id}/review
Content-Type: application/json

{
  "action": "approve",        // "approve" 或 "reject"
  "reviewed_by": "张三",
  "comment": "配置无误，同意生效"
}
```

#### 退订规则
```bash
POST /api/subscriptions/{subscription_id}/unsubscribe
Content-Type: application/json
x-idempotency-key: unsub-key-456 (可选，防止重复退订)

{
  "reason": "业务调整，不再需要",
  "operated_by": "李四"
}
```

#### 导出订阅数据
```bash
# CSV格式
GET /api/subscriptions/export/data?format=csv

# JSON格式
GET /api/subscriptions/export/data?format=json
```

### 4. 投递记录

#### 查询投递记录
```bash
GET /api/delivery-records?subscription_id=xxx&page=1&limit=50
```

## cURL 调用示例

### 1. 健康检查
```bash
curl http://localhost:3001/api/health
```

### 2. 创建订阅
```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: my-sub-001" \
  -d '{
    "app_id": "app-001",
    "event_type_id": "evt-001",
    "delivery_endpoint": "https://webhook.site/test-order"
  }'
```

### 3. 复核通过订阅
```bash
# 先从列表获取subscription_id
curl -X POST http://localhost:3001/api/subscriptions/{subscription_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewed_by": "管理员",
    "comment": "配置正确，通过审核"
  }'
```

### 4. 退订
```bash
curl -X POST http://localhost:3001/api/subscriptions/{subscription_id}/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "业务下线",
    "operated_by": "张三"
  }'
```

### 5. 导出CSV
```bash
curl -o subscriptions.csv http://localhost:3001/api/subscriptions/export/data?format=csv
```

## 故意失败的路径示例

下面这些调用会失败，用于测试异常处理：

### 1. 创建订阅 - 应用不存在
```bash
# 应该返回 400 Bad Request: "应用不存在"
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "non-exist-app",
    "event_type_id": "evt-001"
  }'
```

### 2. 创建订阅 - 事件类型不存在
```bash
# 应该返回 400 Bad Request: "事件类型不存在"
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "app-001",
    "event_type_id": "non-exist-event"
  }'
```

### 3. 复核 - 状态已激活（重复复核）
```bash
# 找一个status=active的订阅进行复核
# 应该返回 400 Bad Request: "只有待复核状态的规则可以执行复核操作"
curl -X POST http://localhost:3001/api/subscriptions/{active_sub_id}/review \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "reviewed_by": "test"}'
```

### 4. 复核 - 无效的action参数
```bash
# 应该返回 400 Bad Request: "无效的操作，必须是 approve 或 reject"
curl -X POST http://localhost:3001/api/subscriptions/{pending_sub_id}/review \
  -H "Content-Type: application/json" \
  -d '{"action": "invalid_action", "reviewed_by": "test"}'
```

### 5. 查询不存在的订阅
```bash
# 应该返回 404 Not Found: "订阅规则不存在"
curl http://localhost:3001/api/subscriptions/non-exist-id
```

### 6. 缺少必填参数
```bash
# 应该返回 400 Bad Request: "缺少必填参数: app_id, event_type_id"
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"delivery_endpoint": "https://test.com"}'
```

## 前端功能说明

### 1. 订阅列表页
- 查看所有订阅规则，支持按状态过滤
- 新建订阅规则
- 导出CSV数据
- 点击查看进入详情页

### 2. 订阅详情页
- 查看订阅基本信息
- **前后变化对比**: 复核完成后显示snapshot_before和snapshot_after
- 查看过滤条件
- **复核操作**: 待复核状态的订阅可执行通过/拒绝
- **退订操作**: 已生效状态的订阅可执行退订
- 查看投递记录

## 核心特性说明

### 1. 幂等处理
- 通过 `x-idempotency-key` 请求头实现
- 相同key的请求24小时内只处理一次
- 第二次及以后直接返回缓存的响应
- 适用于创建、退订等可能重复调用的场景

### 2. 配置快照
- 复核时自动保存复核前后的配置快照
- 快照内容包含：status, is_active, filter_config等
- 前端提供可视化对比功能
- 满足审计追踪需求

### 3. 状态流转
```
pending (待复核)
    ↓
  approve → active (已生效)
    ↓
  reject → rejected (已拒绝)
    ↓
  unsubscribe → unsubscribed (已退订)
```

### 4. 不影响旧回调的设计
- 新订阅规则独立于原有系统
- delivery_endpoint独立配置
- filter_conditions支持灵活过滤
- 退订只影响新规则，不修改原有回调配置

## 项目结构

```
.
├── server/
│   ├── index.js              # 服务入口
│   ├── routes/
│   │   └── index.js          # 路由配置
│   ├── controllers/
│   │   ├── subscriptionController.js
│   │   └── appController.js
│   ├── middleware/
│   │   └── idempotency.js    # 幂等中间件
│   └── db/
│       └── database.js       # 数据库连接
├── client/
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── router/
│   │   └── views/
│   │       ├── SubscriptionList.vue
│   │       └── SubscriptionDetail.vue
│   ├── vite.config.js
│   └── package.json
├── data/
│   └── eventsub.db           # SQLite数据库
├── package.json
└── README.md
```

## 扩展建议

1. **添加认证**: JWT或API Key认证
2. **消息队列**: 集成RabbitMQ/Kafka处理事件投递
3. **重试机制**: 投递失败的自动重试
4. **告警功能**: 投递失败率超过阈值时告警
5. **版本管理**: 订阅规则的版本对比和回滚
