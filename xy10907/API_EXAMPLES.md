# 宠物寄养喂药 API - 调用示例

## 基础信息
- 服务地址: http://localhost:3000
- API 前缀: /api
- 健康检查: GET /health

---

## 1. 宠物档案管理

### 创建宠物档案
```bash
POST /api/pets
Content-Type: application/json

{
  "name": "旺财",
  "species": "狗",
  "breed": "金毛",
  "age": 3,
  "weight": 25.5,
  "owner_name": "张三",
  "owner_phone": "13800138001",
  "notes": "性格温顺，喜欢玩耍"
}
```

### 查询宠物列表
```bash
GET /api/pets?page=1&limit=10&species=狗
```

### 查询单个宠物
```bash
GET /api/pets/{pet_id}
```

### 更新宠物档案
```bash
PUT /api/pets/{pet_id}
Content-Type: application/json

{
  "name": "旺财",
  "species": "狗",
  "breed": "金毛",
  "age": 3,
  "weight": 26.0,
  "owner_name": "张三",
  "owner_phone": "13800138001",
  "notes": "最近食欲很好"
}
```

---

## 2. 寄养订单管理

### 创建寄养订单
```bash
POST /api/orders
Content-Type: application/json

{
  "pet_id": "{pet_id}",
  "check_in_date": "2024-01-15",
  "check_out_date": "2024-01-22",
  "room_number": "A101",
  "notes": "需要每天遛弯两次"
}
```

### 查询订单列表
```bash
GET /api/orders?status=active&page=1&limit=10
```

---

## 3. 喂药计划管理（核心功能）

### 创建喂药计划（自动生成班次）
```bash
POST /api/medication-plans
Content-Type: application/json

{
  "order_id": "{order_id}",
  "pet_id": "{pet_id}",
  "medication_name": "消炎药",
  "dosage": "1",
  "dosage_unit": "片",
  "frequency": "每日2次",
  "start_date": "2024-01-15",
  "end_date": "2024-01-22",
  "administration_method": "餐后服用",
  "created_by": "护理员A",
  "notes": "注意观察过敏反应"
}
```

**响应示例（成功）：**
```json
{
  "success": true,
  "status": "completed",
  "message": "喂药计划创建成功",
  "data": {
    "plan": {...},
    "executions": [...]
  }
}
```

### 提交剂量变更请求（幂等性）
```bash
POST /api/medication-plans/{plan_id}/change-request
Content-Type: application/json
X-Request-Id: req-20240115-001

{
  "request_id": "req-20240115-001",
  "dosage": "0.5",
  "dosage_unit": "片",
  "notes": "主人临时要求减少剂量",
  "requested_by": "白班护理员"
}
```

**响应示例（待复核）：**
```json
{
  "success": true,
  "status": "pending_review",
  "message": "剂量变更请求已提交，待复核",
  "data": {...}
}
```

### 查询喂药计划历史版本
```bash
GET /api/medication-plans/{plan_id}/history
```

---

## 4. 班次执行管理

### 查询待执行班次
```bash
GET /api/shift-executions/pending
```

### 确认喂药执行
```bash
PATCH /api/shift-executions/{execution_id}/execute
Content-Type: application/json

{
  "administered_by": "护理员A",
  "actual_dosage": "1片",
  "notes": "宠物配合，顺利服用"
}
```

### 标记漏喂（触发告警）
```bash
PATCH /api/shift-executions/{execution_id}/missed
Content-Type: application/json

{
  "administered_by": "护理员B",
  "notes": "宠物抗拒，无法喂药"
}
```

### 确认告警
```bash
PATCH /api/shift-executions/{execution_id}/alarm/acknowledge
Content-Type: application/json

{
  "acknowledged_by": "店长",
  "notes": "已联系主人，稍后补喂"
}
```

### 人工修正记录（补偿状态）
```bash
PATCH /api/shift-executions/{execution_id}/correct
Content-Type: application/json

{
  "administered_by": "护理员C",
  "actual_dosage": "1片",
  "notes": "已补喂，宠物状态正常",
  "compensation_notes": "漏喂后1小时内补喂完成"
}
```

**响应示例（已补偿）：**
```json
{
  "success": true,
  "status": "compensated",
  "message": "喂药记录已人工修正",
  "data": {
    "execution": {...},
    "compensation_notes": "漏喂后1小时内补喂完成"
  }
}
```

### 查询活动告警
```bash
GET /api/shift-executions/alarms/active
```

---

## 5. 变更确认管理

### 查询待复核变更
```bash
GET /api/change-confirmations?status=pending_review
```

### 批准变更
```bash
PATCH /api/change-confirmations/{confirmation_id}/approve
Content-Type: application/json

{
  "reviewed_by": "店长",
  "review_notes": "已与主人确认，同意变更",
  "compensation_notes": "后续班次已自动更新为新剂量"
}
```

### 驳回变更
```bash
PATCH /api/change-confirmations/{confirmation_id}/reject
Content-Type: application/json

{
  "reviewed_by": "店长",
  "review_notes": "剂量调整不符合医嘱，驳回请求"
}
```

**响应示例（已驳回）：**
```json
{
  "success": false,
  "status": "rejected",
  "message": "变更请求已驳回",
  "data": {...}
}
```

---

## 6. 护理报告管理

### 自动生成护理报告
```bash
POST /api/care-reports/generate
Content-Type: application/json

{
  "order_id": "{order_id}",
  "pet_id": "{pet_id}",
  "start_date": "2024-01-15",
  "end_date": "2024-01-17",
  "generated_by": "系统管理员"
}
```

### 导出CSV报告
```bash
GET /api/care-reports/export/csv?order_id={order_id}&start_date=2024-01-15&end_date=2024-01-22
```

---

## 异常处理说明

所有异常请求都会被记录到 exception_logs 表中，包含：
- 原始请求参数
- 错误信息
- 处理结果
- 请求ID（用于追踪）

**错误响应示例：**
```json
{
  "success": false,
  "request_id": "uuid-string",
  "status": "invalid_input",
  "message": "参数验证失败",
  "data": null
}
```

---

## 工作流程示例

### 白班到晚班交接场景：
1. 白班护理员执行喂药 → `PATCH /api/shift-executions/{id}/execute`
2. 主人来电要求改剂量 → `POST /api/medication-plans/{id}/change-request`
3. 店长复核变更 → `PATCH /api/change-confirmations/{id}/approve`
4. 晚班护理员看到新版本计划 → `GET /api/shift-executions/pending`
5. 漏喂触发告警 → `PATCH /api/shift-executions/{id}/missed`
6. 告警确认并补喂 → `PATCH /api/shift-executions/{id}/correct`
7. 导出护理报告 → `GET /api/care-reports/export/csv`
