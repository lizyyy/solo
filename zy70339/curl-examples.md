# 变更冻结日历 API - Curl 示例

## 1. 创建冻结窗口

### 1.1 创建大促全局冻结（高风险，不豁免只读）

```bash
curl -X POST http://localhost:3000/api/v1/freeze-windows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "双十一前大促冻结",
    "description": "2026年双十一促销活动前的全平台变更冻结",
    "start_time": "2026-11-10T00:00:00.000Z",
    "end_time": "2026-11-12T23:59:59.999Z",
    "scope": "global",
    "risk_level": "high",
    "allow_readonly": false
  }'
```

### 1.2 创建订单服务级冻结（豁免只读变更）

```bash
curl -X POST http://localhost:3000/api/v1/freeze-windows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单服务专项冻结",
    "description": "订单服务数据库升级期间的专项冻结",
    "start_time": "2026-11-15T08:00:00.000Z",
    "end_time": "2026-11-15T20:00:00.000Z",
    "scope": "service",
    "affected_services": ["order-service", "payment-service"],
    "risk_level": "medium",
    "allow_readonly": true
  }'
```

## 2. 评估变更（不创建申请，仅查询）

### 2.1 普通发布被拒（大促冻结期间）

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-001",
    "service": "user-service",
    "change_type": "normal",
    "risk_level": "medium",
    "planned_start": "2026-11-10T14:00:00.000Z",
    "planned_end": "2026-11-10T15:00:00.000Z"
  }'
```

**预期返回：**
- `status: "blocked"`
- `can_publish: false`
- 拒绝原因：命中"双十一前大促冻结"窗口
- 返回命中的冻结窗口详情
- 返回未来一周可发布窗口

### 2.2 低风险只读通过（在豁免只读的窗口中）

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-002",
    "service": "order-service",
    "change_type": "readonly",
    "risk_level": "low",
    "planned_start": "2026-11-15T12:00:00.000Z",
    "planned_end": "2026-11-15T12:30:00.000Z"
  }'
```

**预期返回：**
- `status: "allowed"`
- `can_publish: true`
- 原因：只读变更在所有命中的冻结窗口中被豁免

### 2.3 紧急修复需要例外审批

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-003",
    "service": "payment-service",
    "change_type": "emergency",
    "risk_level": "high",
    "planned_start": "2026-11-10T10:00:00.000Z",
    "planned_end": "2026-11-10T11:00:00.000Z"
  }'
```

**预期返回：**
- `status: "requires_exception"`
- `can_publish: false`
- `requires_exception: true`
- 原因：紧急修复需要例外审批

### 2.4 冻结结束后可发布

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-004",
    "service": "user-service",
    "change_type": "normal",
    "risk_level": "medium",
    "planned_start": "2026-11-13T10:00:00.000Z",
    "planned_end": "2026-11-13T12:00:00.000Z"
  }'
```

**预期返回：**
- `status: "allowed"`
- `can_publish: true`
- 无冻结窗口命中

### 2.5 申请时间跨多个冻结窗口

```bash
curl -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-005",
    "service": "order-service",
    "change_type": "normal",
    "risk_level": "high",
    "planned_start": "2026-11-09T20:00:00.000Z",
    "planned_end": "2026-11-16T10:00:00.000Z"
  }'
```

**预期返回：**
- `status: "blocked"`
- 命中多个冻结窗口（双十一冻结 + 订单服务冻结）
- 显示所有命中的窗口列表

## 3. 创建变更申请

```bash
curl -X POST http://localhost:3000/api/v1/change-requests \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-006",
    "service": "payment-service",
    "change_type": "emergency",
    "risk_level": "high",
    "planned_start": "2026-11-10T10:00:00.000Z",
    "planned_end": "2026-11-10T11:00:00.000Z",
    "description": "紧急修复支付超时问题"
  }'
```

## 4. 例外审批

### 4.1 审批通过（带有效期和适用服务）

```bash
curl -X POST http://localhost:3000/api/v1/change-requests/<request_id>/approve-exception \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "release-manager@example.com",
    "reason": "支付超时问题影响用户体验，批准紧急发布",
    "valid_from": "2026-11-10T09:00:00.000Z",
    "valid_until": "2026-11-10T12:00:00.000Z",
    "applicable_services": ["payment-service"]
  }'
```

**审批通过后，再次评估该变更时：**
- 返回 `existing_approval` 字段，包含审批有效期和适用服务

### 4.2 审批拒绝

```bash
curl -X POST http://localhost:3000/api/v1/change-requests/<request_id>/reject-exception \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "release-manager@example.com",
    "reason": "风险太高，建议冻结结束后发布"
  }'
```

## 5. 重复提交同一变更

```bash
# 第一次提交（成功）
curl -X POST http://localhost:3000/api/v1/change-requests \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-DUP-001",
    "service": "user-service",
    "change_type": "normal",
    "risk_level": "low",
    "planned_start": "2026-11-20T10:00:00.000Z",
    "planned_end": "2026-11-20T11:00:00.000Z"
  }'

# 第二次提交（失败，409 Conflict）
curl -X POST http://localhost:3000/api/v1/change-requests \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHANGE-DUP-001",
    "service": "user-service",
    "change_type": "normal",
    "risk_level": "low",
    "planned_start": "2026-11-20T10:00:00.000Z",
    "planned_end": "2026-11-20T11:00:00.000Z"
  }'
```

**预期返回（第二次）：**
- 409 Conflict
- `error: "DUPLICATE_CHANGE_ID"`
- 包含现有申请的详情和状态

## 6. 查询和列表

### 6.1 列表所有冻结窗口

```bash
curl http://localhost:3000/api/v1/freeze-windows
```

### 6.2 列表所有变更申请

```bash
curl http://localhost:3000/api/v1/change-requests
```

### 6.3 获取单个变更申请（含审批历史）

```bash
curl http://localhost:3000/api/v1/change-requests/<request_id>
```

**返回包含：**
- 变更详情
- `approvals` 数组：审批历史记录
- 审批决策、审批人、理由、有效期等

## 7. 导出日历

```bash
curl -o freeze-calendar.ics http://localhost:3000/api/v1/calendar.ics
```

生成的 ICS 文件可导入到 Outlook、Google Calendar、Apple Calendar 等日历应用中。
