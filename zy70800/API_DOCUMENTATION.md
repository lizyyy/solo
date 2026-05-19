# 检验科危急值追踪系统 API 文档

## 基础信息
- 基础URL: `http://localhost:3000/api`
- 健康检查: `GET /health`

## 1. 批次管理 (Batches)

### 创建批次
```
POST /batches
Content-Type: application/json

{
  "import_by": "检验师姓名",
  "shift_type": "night",
  "remark": "备注信息"
}
```

### 获取批次列表
```
GET /batches?status=pending&shift_type=night&start_date=2024-01-01&end_date=2024-01-31
```

### 获取批次详情
```
GET /batches/:id
```

### 更新批次状态
```
PUT /batches/:id/status
Content-Type: application/json

{
  "status": "completed",
  "operator": "操作人",
  "reason": "原因"
}
```

## 2. 危急值管理 (Critical Values)

### 导入CSV文件
```
POST /critical-values/import
Content-Type: multipart/form-data

file: [CSV文件]
batch_id: [批次ID]
```

CSV格式示例:
```csv
patient_id,patient_name,ward,bed_no,test_item,test_result,reference_range,critical_level,report_time
P001,张三,内科,101,血钾,2.3 mmol/L,3.5-5.5 mmol/L,high,2024-01-15T08:00:00
```

### 获取危急值列表
```
GET /critical-values?status=pending&patient_id=P001&has_multiple_records=1&timeout_flag=1
```

### 获取单条危急值详情
```
GET /critical-values/:id
```

### 处理危急值
```
POST /critical-values/:id/process
Content-Type: application/json

{
  "action": "confirm",
  "operator": "王医生",
  "operator_role": "doctor",
  "reason": "处理原因说明",
  "new_status": "confirmed"
}
```

### 标记交接缺口
```
POST /critical-values/:id/handover-gap
Content-Type: application/json

{
  "operator": "陈护士",
  "reason": "交接班时未完成确认"
}
```

## 3. 电话回告管理 (Callbacks)

### 导入JSON文件
```
POST /callbacks/import
Content-Type: multipart/form-data

file: [JSON文件]
```

JSON格式示例:
```json
[
  {
    "critical_value_id": 1,
    "call_time": "2024-01-15T08:30:00",
    "caller": "李护士",
    "receiver": "王医生",
    "receiver_role": "doctor",
    "callback_content": "已告知危急值"
  }
]
```

### 创建回告记录
```
POST /callbacks
Content-Type: application/json

{
  "critical_value_id": 1,
  "call_time": "2024-01-15T08:30:00",
  "caller": "李护士",
  "receiver": "王医生",
  "receiver_role": "doctor",
  "callback_content": "已告知危急值"
}
```

### 确认回告
```
PUT /callbacks/:id/confirm
Content-Type: application/json

{
  "confirmer": "王医生",
  "confirm_time": "2024-01-15T08:35:00"
}
```

## 4. 值班表管理 (Duty Schedule)

### 创建值班安排
```
POST /duty-schedule
Content-Type: application/json

{
  "duty_date": "2024-01-15",
  "shift_type": "night",
  "doctor_name": "王医生",
  "nurse_name": "李护士",
  "director_name": "刘主任"
}
```

### 获取值班列表
```
GET /duty-schedule?start_date=2024-01-01&end_date=2024-01-31
```

### 获取今日值班
```
GET /duty-schedule/today
```

## 5. 数据导出 (Export)

### 导出危急值
```
GET /export/critical-values?status=confirmed
```

### 导出处理记录
```
GET /export/processing-records
```

### 导出回告记录
```
GET /export/callbacks
```

## 6. 查询功能 (Query)

### 医生已确认列表
```
GET /query/doctor-confirmed?doctor_name=王医生
```

### 护士转达列表
```
GET /query/nurse-forwarded?nurse_name=李护士
```

### 值班主任复核列表
```
GET /query/director-reviewed?director_name=刘主任
```

### 审计追踪（单条记录完整历史）
```
GET /query/audit-trail/:critical_value_id
```

### 统计信息
```
GET /query/statistics?start_date=2024-01-01&end_date=2024-01-31
```

## 状态说明

### 危急值状态
- `pending`: 待处理
- `processing`: 处理中
- `confirmed`: 已确认
- `pending_correction`: 待修正
- `completed`: 已完成

### 特殊标记
- `has_multiple_records`: 同患者多次危急值
- `timeout_flag`: 未回告超时
- `handover_gap`: 夜班交接缺口

### 操作人角色
- `doctor`: 医生
- `nurse`: 护士
- `director`: 主任
- `lab_tech`: 检验师
