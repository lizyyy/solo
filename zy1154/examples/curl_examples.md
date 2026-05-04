# Saga Demo API - CURL 示例

## 基础信息
- 服务地址: http://localhost:8080
- 数据库: SQLite (./data/saga.db)

---

## 健康检查

```bash
curl http://localhost:8080/health
```

---

## Seed 数据操作

### 查看 Seed 状态
```bash
curl http://localhost:8080/api/seed/status
```

### 重置 Seed 数据
```bash
curl -X POST http://localhost:8080/api/seed/reset
```

---

## 订单操作

### 创建订单（成功场景）
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER-001",
    "product_id": "PROD-001",
    "quantity": 2
  }'
```

### 创建订单（使用优惠券）
```bash
# 先获取可用优惠券
curl http://localhost:8080/api/coupons

# 创建订单时使用优惠券
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER-001",
    "product_id": "PROD-001",
    "quantity": 5,
    "coupon_id": "<coupon_id_from_above>"
  }'
```

### 查询订单
```bash
# 按用户查询订单
curl "http://localhost:8080/api/orders?user_id=USER-001"

# 查询单个订单
curl http://localhost:8080/api/orders/<order_id>
```

---

## 失败注入测试

### 注册失败（模拟库存扣减失败）
```bash
curl -X POST http://localhost:8080/api/failures \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "inventory",
    "operation": "deduct",
    "failure_type": "database_error"
  }'
```

### 查看活跃的失败注入
```bash
curl http://localhost:8080/api/failures
```

### 查看所有失败注入（包括已禁用的）
```bash
curl "http://localhost:8080/api/failures?all=true"
```

### 禁用特定失败注入
```bash
curl -X DELETE http://localhost:8080/api/failures/inventory/deduct
```

### 禁用所有失败注入
```bash
curl -X DELETE http://localhost:8080/api/failures
```

---

## 异常场景测试流程

### 场景 1: 支付成功但库存扣减失败
```bash
# 1. 注册库存扣减失败
curl -X POST http://localhost:8080/api/failures \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "inventory",
    "operation": "deduct",
    "failure_type": "database_error"
  }'

# 2. 创建订单（会触发补偿流程）
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER-001",
    "product_id": "PROD-001",
    "quantity": 1
  }'

# 3. 等待几秒后查看 Saga 状态（应该是 failed 或 compensating）
curl http://localhost:8080/api/sagas/<saga_id>

# 4. 查看 Saga 步骤详情
curl http://localhost:8080/api/sagas/<saga_id>/steps

# 5. 查看补偿任务
curl http://localhost:8080/api/compensations

# 6. 禁用失败注入
curl -X DELETE http://localhost:8080/api/failures/inventory/deduct

# 7. 重试失败的补偿任务
curl -X POST http://localhost:8080/api/compensations/<task_id>/retry
```

### 场景 2: 优惠券锁住后订单回滚
```bash
# 1. 获取可用优惠券
curl http://localhost:8080/api/coupons

# 2. 注册订单确认失败（在优惠券锁住后）
curl -X POST http://localhost:8080/api/failures \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order",
    "operation": "confirm",
    "failure_type": "service_unavailable"
  }'

# 3. 创建带优惠券的订单
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER-002",
    "product_id": "PROD-002",
    "quantity": 3,
    "coupon_id": "<coupon_id>"
  }'

# 4. 查看优惠券状态（应该被释放）
curl http://localhost:8080/api/coupons/<coupon_id>
```

### 场景 3: 余额不足导致补偿
```bash
# 1. 查看 USER-003 余额（只有 500）
curl http://localhost:8080/api/balances/USER-003

# 2. 创建超出余额的订单（PROD-001 价格 100，买 10 个需要 1000）
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER-003",
    "product_id": "PROD-001",
    "quantity": 10
  }'

# 3. 查看 Saga 状态
curl http://localhost:8080/api/sagas/<saga_id>

# 4. 查看库存是否被释放
curl http://localhost:8080/api/inventory/PROD-001
```

---

## Saga 状态查询

### 列出所有 Saga
```bash
curl http://localhost:8080/api/sagas
```

### 按状态筛选 Saga
```bash
curl "http://localhost:8080/api/sagas?status=failed"
curl "http://localhost:8080/api/sagas?status=compensated"
curl "http://localhost:8080/api/sagas?status=completed"
```

### 查看 Saga 详情
```bash
curl http://localhost:8080/api/sagas/<saga_id>
```

### 查看 Saga 步骤
```bash
curl http://localhost:8080/api/sagas/<saga_id>/steps
```

### 重试失败的 Saga
```bash
curl -X POST http://localhost:8080/api/sagas/<saga_id>/retry
```

---

## 补偿任务管理

### 列出所有补偿任务
```bash
curl http://localhost:8080/api/compensations
```

### 按 Saga 筛选补偿任务
```bash
curl "http://localhost:8080/api/compensations?saga_id=<saga_id>"
```

### 重试补偿任务
```bash
curl -X POST http://localhost:8080/api/compensations/<task_id>/retry
```

---

## 人工处理任务

### 列出待处理人工任务
```bash
curl "http://localhost:8080/api/manual-tasks?status=pending"
```

### 开始处理人工任务
```bash
curl -X POST http://localhost:8080/api/manual-tasks/<task_id>/start \
  -H "Content-Type: application/json" \
  -d '{
    "assigned_to": "admin@example.com"
  }'
```

### 解决人工任务
```bash
curl -X POST http://localhost:8080/api/manual-tasks/<task_id>/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "手动补偿了库存和余额，用户已退款"
  }'
```

### 升级人工任务
```bash
curl -X POST http://localhost:8080/api/manual-tasks/<task_id>/escalate
```

---

## 资源查询

### 查询库存
```bash
# 列出所有库存
curl http://localhost:8080/api/inventory

# 查询特定产品库存
curl http://localhost:8080/api/inventory/PROD-001

# 查询库存日志
curl http://localhost:8080/api/inventory/PROD-001/logs
```

### 查询余额
```bash
# 查询用户余额
curl http://localhost:8080/api/balances/USER-001

# 查询余额日志
curl http://localhost:8080/api/balances/USER-001/logs
```

### 查询优惠券
```bash
# 列出所有优惠券
curl http://localhost:8080/api/coupons

# 查询特定优惠券
curl http://localhost:8080/api/coupons/<coupon_id>
```

---

## Outbox 事件查询

### 列出所有 Outbox 事件
```bash
curl http://localhost:8080/api/outbox/events
```

### 列出待发布事件
```bash
curl http://localhost:8080/api/outbox/events/pending
```

---

## 一致性审计报告

### 获取 JSON 格式报告
```bash
# 默认 24 小时
curl http://localhost:8080/api/reports/consistency

# 指定时间范围（小时）
curl "http://localhost:8080/api/reports/consistency?hours=48"
```

### 导出报告

#### 导出 JSON
```bash
curl -o report.json "http://localhost:8080/api/reports/consistency/export?format=json"
```

#### 导出 CSV
```bash
curl -o report.csv "http://localhost:8080/api/reports/consistency/export?format=csv"
```

#### 导出 Markdown
```bash
curl -o report.md "http://localhost:8080/api/reports/consistency/export?format=markdown"
# 或
curl -o report.md "http://localhost:8080/api/reports/consistency/export?format=md"
```

---

## 失败类型说明

| 类型 | 说明 |
|------|------|
| `network_timeout` | 网络超时（会等待 5 秒后返回错误） |
| `database_error` | 数据库错误 |
| `service_unavailable` | 服务不可用 |
| `partial_success` | 部分成功 |
| `noop` | 无操作（不触发失败） |

---

## 完整测试脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"

echo "=== 1. 健康检查 ==="
curl "$BASE_URL/health"
echo ""

echo "=== 2. 查看 Seed 状态 ==="
curl "$BASE_URL/api/seed/status"
echo ""

echo "=== 3. 创建成功订单 ==="
curl -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"USER-001","product_id":"PROD-001","quantity":2}'
echo ""

echo "=== 4. 注册库存扣减失败 ==="
curl -X POST "$BASE_URL/api/failures" \
  -H "Content-Type: application/json" \
  -d '{"service_name":"inventory","operation":"deduct","failure_type":"database_error"}'
echo ""

echo "=== 5. 创建会失败的订单 ==="
curl -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"USER-002","product_id":"PROD-002","quantity":1}'
echo ""

echo "=== 6. 等待补偿执行（5秒）==="
sleep 5

echo "=== 7. 查看所有 Saga ==="
curl "$BASE_URL/api/sagas"
echo ""

echo "=== 8. 查看补偿任务 ==="
curl "$BASE_URL/api/compensations"
echo ""

echo "=== 9. 禁用失败注入 ==="
curl -X DELETE "$BASE_URL/api/failures"
echo ""

echo "=== 10. 生成一致性报告 ==="
curl "$BASE_URL/api/reports/consistency"
echo ""
```
