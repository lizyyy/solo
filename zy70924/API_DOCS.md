# 培训运营后端服务 API 文档

## 基础地址
`http://localhost:3000/api`

---

## 1. 批次管理

### 1.1 创建批次
**POST** `/batches`

请求体:
```json
{
  "course_name": "企业内训课程",
  "course_code": "TRAIN-001",
  "batch_number": "2024-01",
  "start_date": "2024-01-15",
  "end_date": "2024-01-20",
  "created_by": "admin",
  "rules": {
    "min_attendance_rate": 0.8,
    "late_threshold_minutes": 30,
    "late_penalty_score": 2,
    "min_homework_score": 60,
    "require_all_homework": true
  }
}
```

### 1.2 查询批次列表
**GET** `/batches?course_code=XXX&status=pending`

### 1.3 获取单个批次
**GET** `/batches/:id`

### 1.4 更新批次状态
**PUT** `/batches/:id/status`
```json
{
  "status": "processing",
  "operator": "admin",
  "reason": "开始处理"
}
```

---

## 2. 数据导入

### 2.1 导入签到 CSV
**POST** `/batches/:id/import/attendance` (multipart/form-data)
- `file`: CSV 文件
- `operator`: 操作人

### 2.2 导入作业 JSON
**POST** `/batches/:id/import/homework`
```json
{
  "homework": [
    { "学员工号": "E001", "作业名称": "第一章作业", "分数": 85 }
  ],
  "operator": "admin"
}
```

---

## 3. 记录处理

### 3.1 处理签到记录
**POST** `/processing/attendance/:recordId`
```json
{
  "action": "approve",
  "reason": "情况属实，予以通过",
  "processedBy": "admin"
}
```
action 可选值: `approve`, `reject`, `makeup_approve`, `makeup_reject`

### 3.2 处理作业记录
**POST** `/processing/homework/:recordId`
```json
{
  "action": "approve",
  "reason": "作业已补交",
  "processedBy": "admin",
  "newScore": 75
}
```

### 3.3 退回批次修改
**POST** `/batches/:id/return`
```json
{
  "reason": "签到数据不完整，请补充",
  "operator": "admin"
}
```

### 3.4 查看记录处理历史
**GET** `/processing/:recordType/:recordId/history`
recordType: `attendance`, `homework`, `certificate`

---

## 4. 证书管理

### 4.1 批量生成证书
**POST** `/batches/:id/certificates/generate`
```json
{
  "operator": "admin"
}
```

### 4.2 查询证书
**GET** `/certificates/:certNumber`

### 4.3 撤销证书
**POST** `/certificates/:certId/revoke`
```json
{
  "reason": "发现作弊行为",
  "operator": "admin"
}
```

---

## 5. 查询与导出

### 5.1 多维度查询
**GET** `/query?batch_id=XXX&employee_id=E001&certificate_number=CERT-XXX`

支持查询参数:
- `batch_id`: 批次ID
- `employee_id`: 学员工号
- `certificate_number`: 证书编号
- `course_code`: 课程代码
- `status`: 证书状态

### 5.2 导出 CSV
**GET** `/query/export?batch_id=XXX`

### 5.3 验证导出数量一致性
**GET** `/query/verify-count?batch_id=XXX`

### 5.4 学员完整明细（含处理历史）
**GET** `/query/student/:batchId/:employeeId`

返回学员的签到记录、作业记录、证书信息和全部处理历史。

---

## 6. 审计日志

### 6.1 批次审计日志
**GET** `/batches/:id/audit-logs`

### 6.2 证书审计日志
**GET** `/certificates/:certId/audit-logs`

---

## 状态说明

### 批次状态
- `pending`: 待处理
- `processing`: 处理中
- `reviewing`: 审核中
- `completed`: 已完成
- `returned`: 已退回

### 签到状态
- `normal`: 正常
- `late`: 迟到
- `absent`: 缺勤
- `makeup_pending`: 补签待审批
- `makeup_approved`: 补签已通过
- `makeup_rejected`: 补签已拒绝

### 证书状态
- `pending`: 待生成
- `issued`: 已颁发
- `revoked`: 已撤销

---

## 数据追踪说明

每条操作记录都会保留:
1. **原因 (reason)**: 为什么这么处理
2. **处理人 (operator/processed_by)**: 谁处理的
3. **时间 (processed_at/operated_at)**: 什么时候处理的
4. **状态变更**: 变更前后的状态对比

从单条明细 → 处理历史 → 审计日志 → 最终报告，形成完整的可追溯链。
