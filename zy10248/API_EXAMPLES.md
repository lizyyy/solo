# 会议室设备损坏追责系统 - API 示例

## 启动说明

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后访问：`http://localhost:3000`

---

## 完整业务流程示例

### 1. 创建会议室

```bash
curl -X POST http://localhost:3000/api/meeting-rooms \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "name": "第一会议室",
    "location": "A栋3楼",
    "capacity": 20,
    "status": "active"
  }'
```

### 2. 添加设备

```bash
# 添加投影仪
curl -X POST http://localhost:3000/api/equipment \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "name": "EPSON投影仪",
    "type": "projector",
    "brand": "EPSON",
    "model": "CB-X49",
    "serialNumber": "EPS2024001",
    "meetingRoomId": "会议室ID",
    "status": "normal",
    "purchaseDate": "2024-01-15",
    "price": 4999.00
  }'
```

### 3. 创建预约

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-operator-id: user001" \
  -H "x-operator-name: 张三" \
  -d '{
    "meetingRoomId": "会议室ID",
    "title": "项目周会",
    "organizerId": "user001",
    "organizerName": "张三",
    "startTime": "2024-05-20T09:00:00",
    "endTime": "2024-05-20T10:00:00",
    "status": "confirmed"
  }'
```

### 4. 会前设备检查

```bash
curl -X POST http://localhost:3000/api/inspections \
  -H "Content-Type: application/json" \
  -H "x-operator-id: user001" \
  -H "x-operator-name: 张三" \
  -d '{
    "bookingId": "预约ID",
    "type": "pre",
    "inspectorId": "user001",
    "inspectorName": "张三",
    "inspectionTime": "2024-05-20T08:55:00",
    "equipmentStatus": [
      {
        "equipmentId": "设备ID",
        "name": "EPSON投影仪",
        "status": "normal",
        "remark": "正常使用"
      }
    ],
    "hasDamage": false,
    "status": "submitted"
  }'
```

### 5. 会后设备检查（发现损坏）

```bash
curl -X POST http://localhost:3000/api/inspections \
  -H "Content-Type: application/json" \
  -H "x-operator-id: user001" \
  -H "x-operator-name: 张三" \
  -d '{
    "bookingId": "预约ID",
    "type": "post",
    "inspectorId": "user001",
    "inspectorName": "张三",
    "inspectionTime": "2024-05-20T10:05:00",
    "equipmentStatus": [
      {
        "equipmentId": "设备ID",
        "name": "EPSON投影仪",
        "status": "damaged",
        "remark": "镜头有划痕"
      }
    ],
    "hasDamage": true,
    "damageDescription": "投影仪镜头发现明显划痕",
    "status": "submitted"
  }'
```

### 6. 提交损坏报告

```bash
curl -X POST http://localhost:3000/api/damage-reports \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "equipmentId": "设备ID",
    "bookingId": "预约ID",
    "inspectionId": "检查记录ID",
    "reporterId": "admin001",
    "reporterName": "系统管理员",
    "reportTime": "2024-05-20T10:30:00",
    "damageType": "accident",
    "severity": "moderate",
    "description": "投影仪镜头划痕，需要维修或更换",
    "estimatedCost": 1500.00,
    "status": "pending",
    "liabilityStatus": "unassigned"
  }'
```

### 7. 责任确认

```bash
curl -X POST http://localhost:3000/api/liability/confirmations \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "damageReportId": "损坏报告ID",
    "bookingId": "预约ID",
    "confirmedById": "admin001",
    "confirmedByName": "系统管理员",
    "confirmationTime": "2024-05-20T14:00:00",
    "liablePersonId": "user001",
    "liablePersonName": "张三",
    "liabilityType": "direct",
    "liabilityRatio": 100,
    "compensationAmount": 1500.00,
    "description": "会后检查发现设备损坏，由使用人承担全部责任",
    "status": "confirmed"
  }'
```

### 8. 创建赔付记录

```bash
curl -X POST http://localhost:3000/api/liability/compensations \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "liabilityConfirmationId": "责任确认ID",
    "payerId": "user001",
    "payerName": "张三",
    "amount": 1500.00,
    "paymentMethod": "salary_deduction",
    "remarks": "从5月工资中扣除",
    "status": "pending"
  }'
```

### 9. 确认赔付支付

```bash
curl -X PATCH http://localhost:3000/api/liability/compensations/赔付记录ID/pay \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员" \
  -d '{
    "paymentTime": "2024-05-25T10:00:00",
    "receivedById": "finance001",
    "receivedByName": "财务小李",
    "receiptNumber": "CP20240525001"
  }'
```

### 10. 导出待处理赔付列表

```bash
# 导出所有待支付的赔付
curl -X GET http://localhost:3000/api/liability/compensations/export?status=pending \
  -o 待处理赔付列表.csv
```

---

## 特殊场景处理

### 场景1：无检查记录自动归责

如果预约完成但未做会前或会后检查，发现设备损坏时可以自动归责：

```bash
curl -X POST http://localhost:3000/api/liability/confirmations/auto-assign-from-booking/预约ID \
  -H "Content-Type: application/json" \
  -H "x-operator-id: admin001" \
  -H "x-operator-name: 系统管理员"
```

**处理逻辑：**
- 系统检测预约是否缺少 pre 或 post 检查记录
- 如果缺少，自动创建责任确认，责任类型为 `no_inspection`
- 责任人设为预约组织者
- 更新预约状态标记有责任

### 场景2：设备已坏仍被预约

系统在创建预约时会自动检查会议室是否有损坏设备：

```bash
# 如果会议室有损坏设备，预约接口会返回以下错误：
{
  "success": false,
  "code": "HAS_DAMAGED_EQUIPMENT",
  "message": "该会议室有设备损坏：EPSON投影仪，请选择其他会议室或先处理损坏"
}
```

### 场景3：同一损坏重复报修

系统检测3天内相似描述的报告，防止重复提交：

```bash
# 重复提交会返回以下错误：
{
  "success": false,
  "code": "DUPLICATE_REPORT_DETECTED",
  "message": "检测到相似报告（报告号：DR202405200001），请确认是否重复报修"
}
```

### 场景4：赔付后再次修改责任人

赔付完成后责任确认会被锁定，无法修改：

```bash
# 尝试修改已锁定的责任确认会返回：
{
  "success": false,
  "code": "LIABILITY_LOCKED",
  "message": "该责任确认已锁定（已赔付完成），不能修改"
}
```

---

## 核心查询接口

### 查询会议室列表

```bash
curl -X GET "http://localhost:3000/api/meeting-rooms?page=1&pageSize=10"
```

### 查询设备列表

```bash
curl -X GET "http://localhost:3000/api/equipment?type=projector&status=normal"
```

### 查询预约列表

```bash
curl -X GET "http://localhost:3000/api/bookings?status=confirmed&date=2024-05-20"
```

### 查询损坏报告

```bash
curl -X GET "http://localhost:3000/api/damage-reports?liabilityStatus=unassigned&page=1&pageSize=10"
```

### 查询责任确认列表

```bash
curl -X GET "http://localhost:3000/api/liability/confirmations?status=confirmed&liablePersonId=user001"
```

### 查询赔付记录

```bash
curl -X GET "http://localhost:3000/api/liability/compensations?status=pending"
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| VALIDATION_ERROR | 参数验证失败 |
| MEETING_ROOM_NOT_FOUND | 会议室不存在 |
| EQUIPMENT_NOT_FOUND | 设备不存在 |
| BOOKING_NOT_FOUND | 预约不存在 |
| INSPECTION_NOT_FOUND | 检查记录不存在 |
| DAMAGE_REPORT_NOT_FOUND | 损坏报告不存在 |
| LIABILITY_NOT_FOUND | 责任确认记录不存在 |
| COMPENSATION_NOT_FOUND | 赔付记录不存在 |
| DUPLICATE_NAME | 名称重复 |
| DUPLICATE_SERIAL_NUMBER | 序列号重复 |
| INVALID_TIME_RANGE | 时间范围无效 |
| TIME_CONFLICT | 时间冲突 |
| HAS_DAMAGED_EQUIPMENT | 会议室有损坏设备 |
| DUPLICATE_INSPECTION | 检查记录已存在 |
| DUPLICATE_REPORT_DETECTED | 检测到重复报告 |
| LIABILITY_ALREADY_CONFIRMED | 责任已确认 |
| LIABILITY_LOCKED | 责任确认已锁定 |
| COMPENSATION_ALREADY_PAID | 赔付已支付 |
| ENDPOINT_NOT_FOUND | 接口不存在 |

---

## 数据库实体关系

1. **MeetingRoom (会议室)** - 1:N - **Equipment (设备)**
2. **MeetingRoom** - 1:N - **Booking (预约)**
3. **Booking** - 1:N - **Inspection (检查记录)**
4. **Equipment** - 1:N - **DamageReport (损坏报告)**
5. **DamageReport** - 1:N - **LiabilityConfirmation (责任确认)**
6. **LiabilityConfirmation** - 1:N - **Compensation (赔付)**
7. 所有实体都有 **ActionHistory (操作历史)** 记录
