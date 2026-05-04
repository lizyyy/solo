# Rehearsal Room API - Curl 示例

## 基础配置

```bash
BASE_URL="http://localhost:3000/api"
```

## 健康检查

```bash
curl -X GET "$BASE_URL/health"
```

## 房间管理

### 获取所有房间

```bash
curl -X GET "$BASE_URL/rooms"
```

### 获取单个房间

```bash
curl -X GET "$BASE_URL/rooms/1"
```

### 创建房间

```bash
curl -X POST "$BASE_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "D房 - 新排练室",
    "type": "rehearsal",
    "capacity": 6,
    "baseRatePerHour": 120,
    "equipment": "鼓组、贝斯箱、吉他箱",
    "status": "active"
  }'
```

### 更新房间

```bash
curl -X PUT "$BASE_URL/rooms/1" \
  -H "Content-Type: application/json" \
  -d '{
    "baseRatePerHour": 160,
    "notes": "价格调整"
  }'
```

### 查看房间可用性

```bash
curl -X GET "$BASE_URL/rooms/1/availability?date=2024-01-15"
```

## 设备管理

### 获取所有设备

```bash
curl -X GET "$BASE_URL/devices"
```

### 按类别筛选设备

```bash
curl -X GET "$BASE_URL/devices?category=microphone"
```

### 创建设备

```bash
curl -X POST "$BASE_URL/devices" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shure SM7B 话筒",
    "category": "microphone",
    "model": "SM7B",
    "serialNumber": "MIC005",
    "rentalRatePerHour": 50,
    "depositRequired": 2000,
    "status": "available",
    "condition": "good"
  }'
```

### 查看设备可用性

```bash
curl -X GET "$BASE_URL/devices/1/availability?date=2024-01-15"
```

## 客户管理

### 获取所有客户

```bash
curl -X GET "$BASE_URL/customers"
```

### 搜索客户

```bash
curl -X GET "$BASE_URL/customers?keyword=张三"
```

### 创建客户

```bash
curl -X POST "$BASE_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "陈七",
    "phone": "13800138006",
    "email": "chenqi@example.com",
    "notes": "新客户，首次来店"
  }'
```

### 获取客户的预约记录

```bash
curl -X GET "$BASE_URL/customers/1/bookings"
```

## 预约管理 - 完整流程

### 1. 创建预约

```bash
curl -X POST "$BASE_URL/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "roomId": 1,
    "startTime": "2024-01-15T14:00:00+08:00",
    "endTime": "2024-01-15T17:00:00+08:00",
    "deviceIds": [1, 2],
    "notes": "乐队排练，需要额外话筒",
    "createdBy": "店员A"
  }'
```

**注意**：记录返回的预约 ID（`data.id`），后续操作需要使用。

### 2. 获取预约详情

```bash
BOOKING_ID=1
curl -X GET "$BASE_URL/bookings/$BOOKING_ID"
```

### 3. 支付押金

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/pay-deposit" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 800,
    "paymentMethod": "微信",
    "referenceNumber": "WX20240115001",
    "notes": "客户扫码支付",
    "paidBy": "店员A"
  }'
```

### 4. 到店登记

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/check-in" \
  -H "Content-Type: application/json" \
  -d '{
    "checkedBy": "店员A",
    "actualStartTime": "2024-01-15T14:05:00+08:00"
  }'
```

### 5. 开始使用

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/start-use" \
  -H "Content-Type: application/json" \
  -d '{
    "startedBy": "店员A"
  }'
```

### 6. 临时添加设备

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/add-devices" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIds": [3],
    "addedBy": "店员A"
  }'
```

**注意**：返回结果中会包含押金警告，如果需要补充押金。

### 7. 延长使用时间（加时）

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/extend" \
  -H "Content-Type: application/json" \
  -d '{
    "newEndTime": "2024-01-15T19:00:00+08:00",
    "extendedBy": "店员A"
  }'
```

### 8. 换房

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/change-room" \
  -H "Content-Type: application/json" \
  -d '{
    "newRoomId": 2,
    "changedBy": "店员A",
    "notes": "A房音响出问题，换到B房"
  }'
```

### 9. 记录设备损耗

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/damage" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": 1,
    "damageType": "scratch",
    "description": "话筒网罩有明显划痕",
    "estimatedCost": 50,
    "reportedBy": "店员A",
    "notes": "客户承认是他们造成的"
  }'
```

### 10. 预览结算

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/settlement/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "actualEndTime": "2024-01-15T19:30:00+08:00",
    "damageRecords": [
      {
        "deviceId": 1,
        "damageType": "scratch",
        "description": "话筒网罩有明显划痕",
        "estimatedCost": 50
      }
    ]
  }'
```

### 11. 完成结算

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/settlement/process" \
  -H "Content-Type: application/json" \
  -d '{
    "actualEndTime": "2024-01-15T19:30:00+08:00",
    "damageRecords": [
      {
        "deviceId": 1,
        "damageType": "scratch",
        "description": "话筒网罩有明显划痕",
        "estimatedCost": 50
      }
    ],
    "additionalPaymentAmount": 0,
    "refundAmount": 100,
    "paymentMethod": "微信",
    "notes": "结算完成，退还押金100元",
    "processedBy": "店员B"
  }'
```

## 取消预约

```bash
BOOKING_ID=1
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "客户临时有事",
    "cancelledBy": "店员A"
  }'
```

## 查看押金流水

```bash
BOOKING_ID=1
curl -X GET "$BASE_URL/bookings/$BOOKING_ID/deposits"
```

## 导出功能

### 导出班次交接清单

#### JSON 格式

```bash
curl -X GET "$BASE_URL/exports/shift-handover?date=2024-01-15&format=json"
```

#### Markdown 格式

```bash
curl -X GET "$BASE_URL/exports/shift-handover?date=2024-01-15&format=markdown" \
  -o "shift-handover-2024-01-15.md"
```

#### CSV 格式

```bash
curl -X GET "$BASE_URL/exports/shift-handover?date=2024-01-15&format=csv" \
  -o "shift-handover-2024-01-15.csv"
```

### 导出日结对账单

```bash
# JSON
curl -X GET "$BASE_URL/exports/daily-reconciliation?date=2024-01-15&format=json"

# Markdown
curl -X GET "$BASE_URL/exports/daily-reconciliation?date=2024-01-15&format=markdown" \
  -o "daily-reconciliation-2024-01-15.md"

# CSV
curl -X GET "$BASE_URL/exports/daily-reconciliation?date=2024-01-15&format=csv" \
  -o "daily-reconciliation-2024-01-15.csv"
```

### 导出设备维修待办

```bash
# JSON
curl -X GET "$BASE_URL/exports/repair-todo?date=2024-01-15&format=json"

# Markdown
curl -X GET "$BASE_URL/exports/repair-todo?date=2024-01-15&format=markdown" \
  -o "repair-todo-2024-01-15.md"

# CSV
curl -X GET "$BASE_URL/exports/repair-todo?date=2024-01-15&format=csv" \
  -o "repair-todo-2024-01-15.csv"
```

## 错误响应示例

### 房间时间冲突

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "预约存在冲突，请检查房间和设备可用性",
    "conflicts": [
      {
        "type": "room",
        "message": "房间时间冲突",
        "details": [
          {
            "bookingId": 2,
            "bookingNumber": "BK202401151234",
            "startTime": "2024-01-15T14:00:00+08:00",
            "endTime": "2024-01-15T17:00:00+08:00",
            "status": "deposit_paid"
          }
        ]
      }
    ]
  }
}
```

### 状态流转错误

```json
{
  "success": false,
  "error": {
    "code": "STATE_TRANSITION_ERROR",
    "message": "预约状态不能从 \"待确认\" 切换到 \"已到店\"",
    "currentState": "pending_confirmation",
    "targetState": "checked_in"
  }
}
```

### 押金不足

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_DEPOSIT",
    "message": "押金不足，需要 800 元，当前支付 500 元，还需 300 元",
    "required": 800,
    "available": 500
  }
}
```

### 资源不存在

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "预约不存在",
    "resource": "booking"
  }
}
```
