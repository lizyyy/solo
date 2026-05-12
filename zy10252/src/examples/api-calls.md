# 生鲜分拣称重差异 API - 调用示例

## 基础信息

- **服务地址**: http://localhost:3000
- **API 根路径**: http://localhost:3000/api/v1

---

## 场景一: 正常出库流程

### 1. 创建订单

**请求**:
```bash
POST /api/v1/orders
Content-Type: application/json

{
  "orderNo": "ORD-20240512001",
  "customerId": "CUST-001",
  "customerName": "张三",
  "items": [
    { "productId": "prod-001", "expectedWeight": 0.5 },
    { "productId": "prod-002", "expectedWeight": 1.0 }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "code": 201,
  "message": "Order created successfully",
  "data": {
    "id": "order-uuid",
    "orderNo": "ORD-20240512001",
    "status": "pending",
    "items": [
      {
        "id": "item-uuid-1",
        "productId": "prod-001",
        "productName": "有机小白菜",
        "expectedWeight": 0.5,
        "actualWeight": null,
        "unitPrice": 8.99,
        "expectedAmount": 4.495,
        "status": "pending"
      }
    ],
    "totalExpectedAmount": 17.48
  }
}
```

### 2. 提交称重

**请求**:
```bash
POST /api/v1/weight
Content-Type: application/json

{
  "requestId": "req-001-12345",
  "orderId": "order-uuid",
  "orderItemId": "item-uuid-1",
  "actualWeight": 0.495,
  "operatorId": "OP-001",
  "operatorName": "李分拣",
  "deviceId": "SCALE-001",
  "batchNo": "BATCH-20240512"
}
```

**关键点**:
- `requestId` 用于幂等性控制，重复请求不会重复处理

### 3. 查看称重差异汇总

**请求**:
```bash
GET /api/v1/orders/{orderId}/summary
```

**响应**:
```json
{
  "success": true,
  "code": 200,
  "data": {
    "orderId": "order-uuid",
    "orderNo": "ORD-20240512001",
    "totalItems": 2,
    "weighedItems": 2,
    "totalExpectedWeight": 1.5,
    "totalActualWeight": 1.49,
    "totalWeightDifference": -0.01,
    "differencePercentage": 0.67,
    "totalExpectedAmount": 17.48,
    "totalActualAmount": 17.35,
    "hasAbnormalWeight": false,
    "abnormalItems": []
  }
}
```

### 4. 确认出库

**请求**:
```bash
POST /api/v1/orders/{orderId}/outbound
```

---

## 场景二: 重量差异退款流程

### 1. 创建订单 (同场景一)

### 2. 提交称重 (差异较大)

**请求**:
```bash
POST /api/v1/weight
Content-Type: application/json

{
  "requestId": "req-002-12345",
  "orderId": "order-uuid",
  "orderItemId": "item-uuid-1",
  "actualWeight": 0.45,
  "operatorId": "OP-001",
  "operatorName": "李分拣",
  "deviceId": "SCALE-001"
}
```

### 3. 创建重量差异退款

**请求**:
```bash
POST /api/v1/refunds/weight-difference
Content-Type: application/json

{
  "orderId": "order-uuid",
  "orderItemId": "item-uuid-1",
  "operatorId": "CS-001",
  "operatorName": "王客服"
}
```

**响应**:
```json
{
  "success": true,
  "code": 201,
  "data": {
    "id": "refund-uuid",
    "orderId": "order-uuid",
    "orderItemId": "item-uuid-1",
    "reason": "weight_difference",
    "reasonDetail": "预估重量: 0.5kg, 实际重量: 0.45kg, 差异: -0.05kg",
    "amount": 0.45,
    "status": "pending"
  }
}
```

### 4. 审核通过退款

**请求**:
```bash
POST /api/v1/refunds/{refundId}/approve
```

### 5. 执行退款

**请求**:
```bash
POST /api/v1/refunds/{refundId}/process
```

---

## 场景三: 异常拦截测试

### 1. 实际重量为零 (被拦截)

**请求**:
```bash
POST /api/v1/weight
Content-Type: application/json

{
  "requestId": "req-003-12345",
  "orderId": "order-uuid",
  "orderItemId": "item-uuid-1",
  "actualWeight": 0,
  "operatorId": "OP-001",
  "operatorName": "李分拣",
  "deviceId": "SCALE-001"
}
```

**响应 (400错误)**:
```json
{
  "success": false,
  "code": 400,
  "message": "Actual weight must be greater than zero",
  "errors": ["Actual weight must be greater than zero"]
}
```

### 2. 重复提交相同 requestId (幂等性)

使用相同的 `requestId` 提交两次，第二次会直接返回第一次的结果，不会重复处理。

### 3. 替换商品价格更高 (被拦截)

**请求**:
```bash
POST /api/v1/weight/replace
Content-Type: application/json

{
  "requestId": "req-004-12345",
  "orderId": "order-uuid",
  "orderItemId": "item-uuid-1",
  "newProductId": "prod-003",
  "actualWeight": 0.45,
  "operatorId": "OP-001",
  "operatorName": "李分拣",
  "deviceId": "SCALE-001"
}
```

**响应 (400错误)**:
```json
{
  "success": false,
  "code": 400,
  "message": "Replacement product price is higher by 54.00 yuan, need approval",
  "errors": ["Replacement product price is higher by 54.00 yuan, need approval"]
}
```

### 4. 出库后继续改重量 (被拦截)

订单出库后，再尝试提交称重会被拦截。

**响应 (400错误)**:
```json
{
  "success": false,
  "code": 400,
  "message": "Cannot submit weight after order is outbound",
  "errors": ["Cannot submit weight after order is outbound"]
}
```

---

## 其他查询接口

### 查询订单详情
```bash
GET /api/v1/orders/{orderId}
```

### 查询所有订单
```bash
GET /api/v1/orders
```

### 查询称重记录
```bash
GET /api/v1/weight/order/{orderId}
```

### 查询称重历史
```bash
GET /api/v1/weight/history/{orderItemId}
```

### 查询退款记录
```bash
GET /api/v1/refunds/order/{orderId}
```
