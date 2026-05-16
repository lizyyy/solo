# 权限租约 API 文档

## 服务信息
- **服务地址**: http://localhost:3000
- **API前缀**: /api
- **健康检查**: GET /health

## 状态枚举

### LeaseStatus (租约状态)
- `pending` - 待处理
- `confirmed` - 已确认
- `blocked` - 被拦截
- `revoked` - 已撤销
- `compensated` - 已补偿
- `expired` - 已过期
- `recycled` - 已回收

## API 接口

### 1. 创建权限租约
**POST** `/api/leases`

**请求体**:
```json
{
  "accountName": "service-account-001",
  "permissionItem": "database:read:prod",
  "leaseDurationHours": 24,
  "applicationReason": "临时数据同步任务",
  "applicant": "user@example.com",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**:
- 201 创建成功
- 幂等请求返回已存在的租约

---

### 2. 查询租约列表
**GET** `/api/leases`

**查询参数**:
- `accountName` (可选) - 账号名称过滤
- `status` (可选) - 状态过滤
- `startTime` (可选) - 开始时间戳
- `endTime` (可选) - 结束时间戳
- `page` (可选) - 页码，默认1
- `pageSize` (可选) - 每页数量，默认20，最大100

**响应**:
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

### 3. 获取租约详情
**GET** `/api/leases/:id`

**响应**:
包含租约信息、续租记录、审计日志

---

### 4. 状态推进
**POST** `/api/leases/advance-status`

**请求体**:
```json
{
  "leaseId": "lease-uuid",
  "targetStatus": "confirmed",
  "operator": "admin@example.com",
  "reason": "审批通过"
}
```

**状态转换规则**:
- pending → confirmed, blocked, revoked
- confirmed → expired, recycled, blocked, revoked
- blocked → compensated, revoked
- expired → recycled, compensated

---

### 5. 申请续租
**POST** `/api/leases/renewal`

**请求体**:
```json
{
  "leaseId": "lease-uuid",
  "additionalHours": 24,
  "renewalReason": "任务延期",
  "applicant": "user@example.com"
}
```

---

### 6. 续租审批
**POST** `/api/leases/renewal/approve`

**请求体**:
```json
{
  "renewalId": "renewal-uuid",
  "approver": "admin@example.com",
  "approved": true
}
```

---

### 7. 手动处理过期租约
**POST** `/api/leases/handle-expired`

系统每5分钟自动执行一次，此接口供手动触发

---

### 8. 人工修正
**POST** `/api/leases/manual-correction`

**请求体**:
```json
{
  "leaseId": "lease-uuid",
  "updates": {
    "status": "compensated",
    "leaseEndTime": 1735689600000
  },
  "operator": "admin@example.com",
  "correctionReason": "特殊情况补偿"
}
```

⚠️ **注意**: 此操作会记录审计日志，请谨慎使用

---

### 9. 导出租约数据
**GET** `/api/leases/export`

**查询参数**:
- `accountName` (可选)
- `status` (可选)
- `startTime` (可选)
- `endTime` (可选)
- `format` (可选) - json 或 csv，默认json

**响应**:
- JSON格式返回数据
- CSV格式触发文件下载

---

## 异常追溯机制

每个操作都会记录审计日志，包含:
- 原始输入
- 处理依据
- 最终结论
- 状态变更前后对比
- 操作人、时间戳

可通过`GET /api/leases/:id`查看完整审计轨迹。

## 幂等性说明

创建租约接口使用`idempotencyKey`保证幂等性，相同的幂等键重复请求不会重复创建租约。
