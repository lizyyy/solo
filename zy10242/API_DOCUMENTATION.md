# 保险理赔材料补齐 API 文档

## 概述

本 API 提供保险理赔案件材料管理的完整功能，包括案件创建、材料定义、上传补交、审核驳回、缺件查询和超期提醒等。

## 服务信息

- **服务地址**: http://localhost:3000
- **基础路径**: /api
- **健康检查**: GET /api/health

---

## 1. 案件管理接口

### 1.1 创建案件

**POST** `/api/claims`

请求体:
```json
{
  "policy_number": "POL20240001",
  "customer_name": "张三",
  "customer_id": "CUST001",
  "accident_type": "车辆事故",
  "accident_date": "2024-01-15",
  "deadline": "2024-02-15T23:59:59.999Z",
  "operator": "理赔员A"
}
```

响应:
```json
{
  "success": true,
  "message": "案件创建成功",
  "data": {
    "claim_id": "CLM1705380000000",
    "policy_number": "POL20240001",
    "customer_name": "张三",
    "customer_id": "CUST001",
    "accident_type": "车辆事故",
    "accident_date": "2024-01-15",
    "status": "pending",
    "deadline": "2024-02-15T23:59:59.999Z",
    "created_at": "2024-01-15T...",
    "updated_at": "2024-01-15T..."
  }
}
```

### 1.2 查询案件列表

**GET** `/api/claims`

查询参数:
- `status`: 案件状态 (pending/completed/rejected)
- `customer_id`: 客户ID

### 1.3 查询超期案件

**GET** `/api/claims/overdue`

### 1.4 查询单个案件详情

**GET** `/api/claims/:claimId`

### 1.5 更新案件状态

**PATCH** `/api/claims/:claimId/status`

请求体:
```json
{
  "status": "completed",
  "operator": "理赔员A",
  "remark": "材料齐全"
}
```

---

## 2. 材料管理接口

### 2.1 添加材料定义

**POST** `/api/claims/:claimId/materials`

请求体:
```json
{
  "material_code": "ID_CARD",
  "material_name": "身份证复印件",
  "description": "需正反面",
  "is_required": true,
  "operator": "理赔员A"
}
```

### 2.2 查询案件最新材料列表

**GET** `/api/claims/:claimId/materials`

### 2.3 查询案件所有材料（含历史版本）

**GET** `/api/claims/:claimId/materials/all`

### 2.4 查询缺件列表

**GET** `/api/claims/:claimId/materials/missing`

### 2.5 查询材料版本历史

**GET** `/api/claims/:claimId/materials/:materialCode/history`

### 2.6 上传材料

**POST** `/api/materials/:materialId/upload`

Content-Type: `multipart/form-data`

表单字段:
- `file`: 上传的文件
- `operator`: 操作人

### 2.7 重新上传材料（创建新版本）

**POST** `/api/materials/:materialId/reupload`

Content-Type: `multipart/form-data`

表单字段:
- `file`: 上传的文件
- `operator`: 操作人
- `reason`: 重新上传原因

### 2.8 审核材料

**PATCH** `/api/materials/:materialId/audit`

请求体:
```json
{
  "status": "approved",
  "operator": "审核员B",
  "remark": "材料清晰有效"
}
```

状态说明:
- `approved`: 审核通过
- `rejected`: 审核驳回

### 2.9 删除材料

**DELETE** `/api/materials/:materialId`

请求体:
```json
{
  "operator": "理赔员A",
  "reason": "材料重复"
}
```

注意: 必填材料不能直接删除，需先取消必填属性。

---

## 3. 提醒管理接口

### 3.1 查询案件提醒列表

**GET** `/api/claims/:claimId/reminders`

### 3.2 创建缺件提醒

**POST** `/api/claims/:claimId/reminders/missing`

请求体:
```json
{
  "operator": "系统"
}
```

### 3.3 查询所有提醒

**GET** `/api/reminders`

查询参数:
- `reminder_type`: 提醒类型 (missing/overdue)

### 3.4 检查并创建超期提醒

**POST** `/api/reminders/check-overdue`

请求体:
```json
{
  "operator": "系统"
}
```

---

## 4. 审核日志接口

### 4.1 查询案件审核日志

**GET** `/api/claims/:claimId/audit-logs`

---

## 状态说明

### 案件状态
- `pending`: 处理中
- `completed`: 已完成
- `rejected`: 已驳回

### 材料状态
- `pending`: 待上传
- `submitted`: 已提交
- `approved`: 审核通过
- `rejected`: 审核驳回

### 提醒类型
- `missing`: 缺件提醒
- `overdue`: 超期提醒

---

## 关键业务规则

1. **材料版本控制**: 重新上传会创建新版本，保留历史记录
2. **必填材料保护**: 必填材料不能直接删除，需先取消必填属性
3. **重复提醒防重**: 相同原因的提醒会自动累加计数，不会重复创建
4. **审核通过保护**: 已审核通过的材料不能直接上传，需使用重新上传接口
5. **案件自动完成**: 所有必填材料审核通过后，案件自动标记为完成
6. **旧版本保留**: 材料历史版本完整保留，可追溯审计

---

## 错误响应格式

```json
{
  "success": false,
  "error": "错误信息",
  "code": 400
}
```
