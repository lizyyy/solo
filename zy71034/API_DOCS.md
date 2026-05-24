# 远程问诊处方时效 API 文档

## 基础信息
- Base URL: `http://localhost:8080/api/v1`
- Content-Type: `application/json`

## 处方管理接口

### 1. 创建处方
**POST** `/prescriptions`

请求体:
```json
{
  "patient": {
    "name": "张三",
    "id_card": "110101199001011234",
    "phone": "13800138000"
  },
  "consultation": {
    "doctor_id": "doc001",
    "doctor_name": "李医生",
    "department": "内科",
    "chief_complaint": "头痛发热",
    "diagnosis": "感冒",
    "consult_time": "2024-01-15T10:30:00Z"
  },
  "prescription": {
    "doctor_id": "doc001",
    "doctor_name": "李医生",
    "drug_list": "阿莫西林胶囊 0.5g*24粒",
    "dosage": "每日3次，每次1粒",
    "doctor_advice": "饭后服用，多喝水",
    "validity_hours": 48,
    "prescription_time": "2024-01-15 11:00:00"
  },
  "operator_id": "op001",
  "operator_name": "系统管理员"
}
```

### 2. 查询处方列表
**GET** `/prescriptions?status=pending`

### 3. 查询单个处方
**GET** `/prescriptions/{id}`

### 4. 校验处方时效
**GET** `/prescriptions/{id}/validate`

返回:
```json
{
  "is_valid": false,
  "prescription_id": "xxx",
  "timeout_check": {
    "passed": false,
    "message": "处方已超时...",
    "level": "error"
  },
  "patient_confirm_check": {...},
  "duplicate_check": {...},
  "suggestions": [...],
  "total_issues": 2
}
```

### 5. 药师审核处方
**POST** `/prescriptions/{id}/review`

请求体:
```json
{
  "pharmacist_id": "pharm001",
  "pharmacist_name": "王药师",
  "result": "pass",
  "opinion": "审核通过，用药合理"
}
```

`result` 可选值: `pass`(通过), `reject`(驳回)

### 6. 患者确认处方
**POST** `/prescriptions/{id}/confirm`

请求体:
```json
{
  "operator_id": "op001",
  "operator_name": "系统管理员"
}
```

### 7. 发药
**POST** `/prescriptions/{id}/dispense`

请求体:
```json
{
  "pharmacist_id": "pharm001",
  "pharmacist_name": "王药师",
  "drug_items": "阿莫西林胶囊 0.5g*24粒 x1",
  "manual_override": false,
  "override_reason": ""
}
```

- `manual_override`: 是否人工放行（用于拦截后强制发药）

### 8. 补录记录
**POST** `/prescriptions/{id}/supplement`

请求体:
```json
{
  "field_name": "patient_confirm_time",
  "before_value": "",
  "after_value": "2024-01-16 09:00:00",
  "operator_id": "op001",
  "operator_name": "系统管理员",
  "remark": "患者电话确认后补录"
}
```

### 9. 结案
**POST** `/prescriptions/{id}/close`

请求体:
```json
{
  "final_conclusion": "处方已完成，患者已取药，流程正常",
  "operator_id": "op001",
  "operator_name": "系统管理员"
}
```

### 10. 获取完整时间线
**GET** `/prescriptions/{id}/timeline`

返回处方的所有关联记录：处方信息、审核记录、发药记录、补录记录、操作日志、报告

### 11. 获取处理建议
**GET** `/prescriptions/{id}/suggestion`

### 12. 导出单条报告（JSON）
**GET** `/prescriptions/{id}/export/json`

## 报告管理接口

### 1. 查询报告列表
**GET** `/reports?closed_only=false`

### 2. 导出所有报告（CSV）
**GET** `/reports/export/csv?closed_only=true`

## 状态流转

```
pending (待处理)
    ↓
reviewed (已审核)
    ↓
confirmed (患者已确认)
    ↓
dispensed (已发药)
    ↓
closed (已结案)

rejected (已驳回) ──┘
timeout (已超时)  ──┘
```

## 核心特性

1. **时效校验**: 自动检查处方是否超时（默认48小时）
2. **患者确认**: 追踪患者确认状态，超时未确认自动标记
3. **发药拦截**: 超时、未确认、重复发药时自动拦截，支持人工放行
4. **补录留痕**: 所有补录操作保留前后差异
5. **完整追溯**: 单条处方可查询完整时间线
6. **报告导出**: 支持 JSON 和 CSV 格式导出
