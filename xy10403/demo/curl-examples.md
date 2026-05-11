# 园区门禁访客 API - Curl 示例

## 基础信息
- **服务地址**: http://localhost:3000
- **健康检查**: GET http://localhost:3001/api/health

## 默认账号

| 账号 | 密码 | 角色 | 权限 |
|------|------|------|------|
| admin | 123456 | admin | 系统管理员，全部权限 |
| approver | 123456 | approver | 审批员，审批预约 |
| gate1 | 123456 | gate | 闸口操作员，核销入园/离园 |
| gate2 | 123456 | gate | 闸口操作员 |

## 1. 认证

### 1.1 登录获取 Token
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "123456"
  }'
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "name": "系统管理员"
    }
  }
}
```

> 后续请求需要在 Header 中添加: `Authorization: Bearer {token}`

---

## 2. 被访人（员工）管理

### 2.1 创建被访人
```bash
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "employee_no": "EMP004",
    "name": "赵六",
    "department": "财务部",
    "phone": "13800138004",
    "email": "zhaoliu@example.com"
  }'
```

### 2.2 查询被访人列表
```bash
curl -X GET "http://localhost:3001/api/employees?page=1&pageSize=10" \
  -H "Authorization: Bearer {token}"
```

### 2.3 查询单个被访人
```bash
curl -X GET http://localhost:3001/api/employees/1 \
  -H "Authorization: Bearer {token}"
```

### 2.4 更新被访人
```bash
curl -X PUT http://localhost:3001/api/employees/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "department": "技术研发部",
    "phone": "13800138999"
  }'
```

### 2.5 删除被访人
```bash
curl -X DELETE http://localhost:3001/api/employees/4 \
  -H "Authorization: Bearer {admin_token}"
```

---

## 3. 访客预约

### 3.1 创建预约
```bash
curl -X POST http://localhost:3001/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "visitor_name": "陈经理",
    "id_card": "110101199001011001",
    "phone": "13900139001",
    "company": "客户公司A",
    "visit_purpose": "商务洽谈",
    "visitor_count": 2,
    "employee_id": 1,
    "visit_start_time": "2024-05-11 10:00:00",
    "visit_end_time": "2024-05-11 14:00:00",
    "access_gates": ["GATE001", "GATE002"],
    "vehicles": [
      {"plate_number": "京A12345", "vehicle_type": "轿车", "color": "黑色"}
    ]
  }'
```

**预约校验规则**:
- 访问时间窗：结束时间不能早于开始时间，单次访问不超过24小时
- 被访人有效性：被访人必须是活跃状态
- 同一证件重复预约：同一身份证在时间重叠的时间段不能有多个有效预约
- 车牌占用：同一车牌在时间重叠的时间段不能被多个预约占用

### 3.2 查询预约列表
```bash
# 全部预约
curl -X GET "http://localhost:3001/api/appointments?page=1&pageSize=10" \
  -H "Authorization: Bearer {token}"

# 按状态筛选
curl -X GET "http://localhost:3001/api/appointments?status=approved&page=1&pageSize=10" \
  -H "Authorization: Bearer {token}"

# 按访客名筛选
curl -X GET "http://localhost:3001/api/appointments?visitor_name=陈&page=1&pageSize=10" \
  -H "Authorization: Bearer {token}"

# 按日期筛选
curl -X GET "http://localhost:3001/api/appointments?start_date=2024-05-11&end_date=2024-05-11&page=1&pageSize=10" \
  -H "Authorization: Bearer {token}"
```

### 3.3 查询预约详情
```bash
curl -X GET http://localhost:3001/api/appointments/{appointment_id} \
  -H "Authorization: Bearer {token}"
```

### 3.4 更新预约
```bash
curl -X PUT http://localhost:3001/api/appointments/{appointment_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {approver_token}" \
  -d '{
    "visit_end_time": "2024-05-11 16:00:00",
    "access_gates": ["GATE001", "GATE002", "GATE003"]
  }'
```

### 3.5 取消预约
```bash
curl -X POST http://localhost:3001/api/appointments/{appointment_id}/cancel \
  -H "Authorization: Bearer {token}"
```

---

## 4. 车辆管理

### 4.1 添加车辆
```bash
curl -X POST http://localhost:3001/api/vehicles/{appointment_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "vehicles": [
      {"plate_number": "京B88888", "vehicle_type": "SUV", "color": "白色"},
      {"plate_number": "京C99999", "vehicle_type": "商务车", "color": "银色"}
    ]
  }'
```

### 4.2 查询预约车辆
```bash
curl -X GET http://localhost:3001/api/vehicles/{appointment_id} \
  -H "Authorization: Bearer {token}"
```

### 4.3 移除车辆
```bash
curl -X DELETE http://localhost:3001/api/vehicles/{appointment_id}/{vehicle_id} \
  -H "Authorization: Bearer {token}"
```

---

## 5. 审批流程

### 5.1 审批通过
```bash
curl -X POST http://localhost:3001/api/approvals/{appointment_id}/approve \
  -H "Authorization: Bearer {approver_token}"
```

### 5.2 审批拒绝
```bash
curl -X POST http://localhost:3001/api/approvals/{appointment_id}/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {approver_token}" \
  -d '{
    "reason": "被访人不在公司"
  }'
```

---

## 6. 闸口管理

### 6.1 获取闸口列表
```bash
curl -X GET http://localhost:3001/api/gates \
  -H "Authorization: Bearer {token}"
```

### 6.2 入园核销
```bash
curl -X POST http://localhost:3001/api/gates/checkin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {gate_token}" \
  -d '{
    "visitor_code": "ABC123",
    "plate_number": "京A12345",
    "gate_id": "GATE001"
  }'
```

**入园校验规则**:
- 预约必须存在且状态为 `approved`
- 预约未过期（当前时间 <= 结束时间）
- 访客未入园（状态不是 `checkin`）
- 可提前30分钟入园
- 只能访问预约时指定的闸口

### 6.3 离园核销
```bash
curl -X POST http://localhost:3001/api/gates/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {gate_token}" \
  -d '{
    "visitor_code": "ABC123",
    "plate_number": "京A12345",
    "gate_id": "GATE001"
  }'
```

**离园校验规则**:
- 访客必须已入园（状态为 `checkin`）
- 未离园（状态不是 `checkout`）

---

## 7. 过期预约回收

### 7.1 手动执行回收
```bash
curl -X POST http://localhost:3001/api/recycle/execute \
  -H "Authorization: Bearer {admin_token}"
```

> 系统也会每小时自动执行一次回收任务

---

## 8. 查询和统计

### 8.1 查询通行记录
```bash
# 全部记录
curl -X GET "http://localhost:3001/api/queries/records?page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 按访客查询
curl -X GET "http://localhost:3001/api/queries/records?visitor_name=陈&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 按身份证查询
curl -X GET "http://localhost:3001/api/queries/records?id_card=110101199001011001&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 按车牌查询
curl -X GET "http://localhost:3001/api/queries/records?plate_number=京A12345&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 按闸口查询
curl -X GET "http://localhost:3001/api/queries/records?gate_id=GATE001&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 按日期查询
curl -X GET "http://localhost:3001/api/queries/records?start_date=2024-05-11&end_date=2024-05-11&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"

# 组合查询
curl -X GET "http://localhost:3001/api/queries/records?gate_id=GATE001&access_type=checkin&status=failed&page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"
```

### 8.2 当日统计
```bash
# 今日统计
curl -X GET http://localhost:3001/api/queries/statistics \
  -H "Authorization: Bearer {token}"

# 指定日期统计
curl -X GET "http://localhost:3001/api/queries/statistics?date=2024-05-11" \
  -H "Authorization: Bearer {token}"
```

### 8.3 导出异常通行汇总
```bash
# 今日异常汇总
curl -X GET http://localhost:3001/api/queries/exception-summary \
  -H "Authorization: Bearer {admin_token}"

# 指定日期异常汇总
curl -X GET "http://localhost:3001/api/queries/exception-summary?date=2024-05-11" \
  -H "Authorization: Bearer {admin_token}"
```

异常汇总包含:
- 失败的通行记录及原因分布
- 过期但未到访的预约
- 已入园但未离园的访客

---

## 预约状态流转

```
pending (待审批)
    ↓ approve
approved (已审批)
    ↓ checkin
checkin (已入园)
    ↓ checkout
checkout (已离园)

可中途流转:
pending/approved → cancelled (已取消)
pending/approved → expired (已过期，自动回收)
pending → rejected (已拒绝)
```
