# 直播间优惠叠加 API - Curl 示例

## 启动服务

```bash
npm start
```

服务默认在 http://localhost:3000 运行

---

## 场景 1: 普通下单 (平台券 + 满减)

### 1.1 创建直播场次

```bash
curl -X POST http://localhost:3000/api/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamer_id": "streamer_001",
    "streamer_name": "李佳琦直播室",
    "start_time": "2026-05-11T19:00:00Z"
  }'
```

**返回示例:**
```json
{"id":1,"message":"直播场次创建成功"}
```

### 1.2 创建商品

```bash
# 商品1: 高端面膜套装
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "name": "高端面膜套装",
    "price": 299.00,
    "stock": 100
  }'

# 商品2: 精华液
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "name": "精华液",
    "price": 399.00,
    "stock": 50
  }'

# 赠品商品: 小样试用装
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "name": "小样试用装",
    "price": 0,
    "stock": 1000
  }'
```

### 1.3 创建平台券 (无互斥)

```bash
curl -X POST http://localhost:3000/api/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "type": "platform",
    "name": "平台满500减50券",
    "discount_type": "fixed",
    "discount_value": 50,
    "min_amount": 500,
    "stock": 100,
    "is_mutual_exclusive": false
  }'
```

### 1.4 创建满减规则

```bash
curl -X POST http://localhost:3000/api/promotions/full-reduction \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "name": "直播间满800减100",
    "threshold_amount": 800,
    "discount_amount": 100,
    "priority": 1
  }'
```

### 1.5 订单试算

商品: 面膜x2 + 精华液x1 = 299*2 + 399 = 997元
优惠: 平台券50 + 满减100 = 150元
实付: 847元

```bash
curl -X POST http://localhost:3000/api/orders/preview \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_001",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ],
    "platform_coupon_id": 1
  }'
```

### 1.6 确认订单

```bash
curl -X POST http://localhost:3000/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_001",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ],
    "platform_coupon_id": 1
  }'
```

---

## 场景 2: 优惠冲突 (平台券 + 互斥主播券)

### 2.1 创建互斥主播券

```bash
curl -X POST http://localhost:3000/api/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "type": "anchor",
    "name": "主播专享9折券",
    "discount_type": "percentage",
    "discount_value": 10,
    "min_amount": 100,
    "stock": 50,
    "is_mutual_exclusive": true
  }'
```

### 2.2 尝试同时使用平台券和互斥主播券 (期望报错)

```bash
curl -X POST http://localhost:3000/api/orders/preview \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_002",
    "items": [
      {"product_id": 1, "quantity": 2}
    ],
    "platform_coupon_id": 1,
    "anchor_coupon_id": 2
  }'
```

**期望返回错误:**
```json
{
  "error": "优惠规则冲突",
  "details": [
    {
      "type": "mutual_exclusive",
      "message": "优惠券之间存在互斥关系，只能使用一张"
    }
  ]
}
```

---

## 场景 3: 部分退款

### 3.1 创建订单

```bash
curl -X POST http://localhost:3000/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_003",
    "items": [
      {"product_id": 1, "quantity": 3},
      {"product_id": 2, "quantity": 2}
    ]
  }'
```

**返回订单号**, 例如: `LS20260511123456`

### 3.2 部分退款 - 退回1盒面膜

```bash
curl -X POST http://localhost:3000/api/orders/LS20260511123456/refund/partial \
  -H "Content-Type: application/json" \
  -d '{
    "refund_items": [
      {"product_id": 1, "quantity": 1}
    ]
  }'
```

**返回示例:**
```json
{
  "order_no": "LS20260511123456",
  "refund_amount": 299,
  "refund_quantity": 1,
  "new_status": "partially_refunded"
}
```

---

## 场景 4: 整单退款 + 优惠券返还

### 4.1 创建订单 (使用平台券)

```bash
curl -X POST http://localhost:3000/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_004",
    "items": [
      {"product_id": 1, "quantity": 1}
    ],
    "platform_coupon_id": 1
  }'
```

**返回订单号**, 例如: `LS20260511123457`

### 4.2 整单退款

```bash
curl -X POST http://localhost:3000/api/orders/LS20260511123457/refund/full \
  -H "Content-Type: application/json" \
  -d '{}'
```

**返回示例:**
```json
{
  "order_no": "LS20260511123457",
  "refund_amount": 249,
  "new_status": "refunded"
}
```

### 4.3 验证平台券已返还 (同一用户再次使用)

```bash
curl -X POST http://localhost:3000/api/orders/preview \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_004",
    "items": [
      {"product_id": 1, "quantity": 2}
    ],
    "platform_coupon_id": 1
  }'
```

**应该能成功，不再报错"平台券已使用"**

---

## 场景 5: 直播场次结束后不能下单

### 5.1 结束直播场次

```bash
curl -X PUT http://localhost:3000/api/streams/1/end \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 5.2 尝试在已结束的直播中下单 (期望报错)

```bash
curl -X POST http://localhost:3000/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": 1,
    "user_id": "user_005",
    "items": [
      {"product_id": 1, "quantity": 1}
    ]
  }'
```

**期望返回错误:**
```json
{
  "error": "直播已结束"
}
```

---

## 场景 6: 查看直播统计

```bash
curl http://localhost:3000/api/statistics/stream/1
```

**返回示例:**
```json
{
  "stream_id": 1,
  "stream_name": "李佳琦直播室 的直播",
  "summary": {
    "order_count": 4,
    "total_amount": 3889,
    "pay_amount": 3289,
    "discount_cost": 150,
    "refund_amount": 548,
    "net_revenue": 2741
  },
  "promotion_usage": [
    {
      "promotion_type": "coupon_platform",
      "promotion_id": 1,
      "total_discount": 100,
      "usage_count": 2
    },
    {
      "promotion_type": "full_reduction",
      "promotion_id": 1,
      "total_discount": 100,
      "usage_count": 1
    }
  ],
  "gift_consumption": [],
  "abnormal_orders": {
    "count": 2,
    "partial_refund_count": 1,
    "full_refund_count": 1,
    "details": [
      {
        "order_no": "LS20260511123456",
        "status": "partially_refunded",
        "total_amount": 1695,
        "pay_amount": 1695,
        "discount_amount": 0
      },
      {
        "order_no": "LS20260511123457",
        "status": "refunded",
        "total_amount": 299,
        "pay_amount": 249,
        "discount_amount": 50
      }
    ]
  }
}
```

---

## API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/streams | 创建直播场次 |
| PUT | /api/streams/:id/end | 结束直播场次 |
| GET | /api/streams | 获取所有直播场次 |
| GET | /api/streams/:id | 获取单个直播场次 |
| POST | /api/products | 创建商品 |
| GET | /api/products | 获取商品列表 (支持 stream_id 筛选) |
| GET | /api/products/:id | 获取单个商品 |
| PUT | /api/products/:id | 更新商品 |
| POST | /api/coupons | 创建优惠券 |
| GET | /api/coupons | 获取优惠券列表 |
| POST | /api/promotions/full-reduction | 创建满减规则 |
| GET | /api/promotions/full-reduction | 获取满减规则列表 |
| POST | /api/promotions/gift | 创建赠品规则 |
| GET | /api/promotions/gift | 获取赠品规则列表 |
| POST | /api/orders/preview | 订单试算 |
| POST | /api/orders/confirm | 确认订单 |
| POST | /api/orders/:order_no/refund/partial | 部分退款 |
| POST | /api/orders/:order_no/refund/full | 整单退款 |
| GET | /api/orders/:order_no | 查询订单详情 |
| GET | /api/statistics/stream/:stream_id | 直播统计 |
