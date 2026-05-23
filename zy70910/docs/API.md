# 新能源对账服务 API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

---

## 目录

1. [数据导入接口](#1-数据导入接口)
2. [对账任务接口](#2-对账任务接口)
3. [差异管理接口](#3-差异管理接口)
4. [复核操作接口](#4-复核操作接口)
5. [报告生成接口](#5-报告生成接口)
6. [错误码说明](#6-错误码说明)

---

## 1. 数据导入接口

### 1.1 导入订单CSV

**接口地址**: `POST /import/orders`

**请求方式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | CSV格式的订单文件 |

**CSV文件格式要求**:

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| order_id | String | 是 | 订单唯一标识 |
| user_id | String | 是 | 用户ID |
| charger_id | String | 是 | 充电桩ID |
| start_time | String | 是 | 充电开始时间 (ISO格式) |
| end_time | String | 是 | 充电结束时间 (ISO格式) |
| charge_amount | Number | 是 | 充电量(kWh) |
| amount | Number | 是 | 订单金额(元) |
| status | String | 是 | 订单状态 |
| platform_source | String | 是 | 平台来源 |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/import/orders \
  -F "file=@sample-orders.csv"
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "TRACE_1735718400000_abc123",
    "successCount": 100,
    "results": [
      {
        "status": "success",
        "validation": {
          "valid": true,
          "errors": [],
          "cleaned": {}
        }
      }
    ]
  }
}
```

**响应字段说明**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| traceId | String | 导入追踪ID |
| successCount | Number | 成功导入数量 |
| results | Array | 每条记录的导入结果 |

---

### 1.2 导入桩端日志JSON

**接口地址**: `POST /import/charger-logs`

**请求方式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | JSON格式的桩端日志文件 |

**JSON文件格式要求**:
```json
[
  {
    "log_id": "LOG_001",
    "charger_id": "CHG_001",
    "order_id": "ORD_001",
    "event_time": "2024-01-01T10:00:00Z",
    "realtime_charge": 10.5,
    "status": "completed",
    "event_type": "CHARGE_END"
  }
]
```

**字段说明**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| log_id | String | 是 | 日志唯一标识 |
| charger_id | String | 是 | 充电桩ID |
| order_id | String | 否 | 关联订单ID |
| event_time | String | 是 | 事件时间 |
| realtime_charge | Number | 是 | 实时充电量 |
| status | String | 是 | 状态 |
| event_type | String | 是 | 事件类型: CHARGE_START/CHARGE_END |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/import/charger-logs \
  -F "file=@sample-charger-logs.json"
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "TRACE_1735718400000_def456",
    "successCount": 50
  }
}
```

---

### 1.3 导入支付记录

**接口地址**: `POST /import/payments`

**请求方式**: `multipart/form-data`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | 支付记录文件 (CSV/JSON) |

**CSV文件格式**:

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| payment_id | String | 是 | 支付唯一标识 |
| order_id | String | 是 | 关联订单ID |
| payment_time | String | 是 | 支付时间 |
| amount | Number | 是 | 支付金额 |
| payment_status | String | 是 | 支付状态 |
| refund_status | String | 是 | 退款状态 |
| refund_amount | Number | 是 | 退款金额 |
| payment_channel | String | 是 | 支付渠道 |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/payments \
  -F "file=@sample-payments.csv"
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "TRACE_1735718400000_ghi789",
    "successCount": 80
  }
}
```

---

## 2. 对账任务接口

### 2.1 创建对账任务

**接口地址**: `POST /reconciliation/tasks`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | String | 是 | 任务名称 |
| startDate | String | 是 | 开始日期 (YYYY-MM-DD) |
| endDate | String | 是 | 结束日期 (YYYY-MM-DD) |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年1月对账",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "TASK_1735718400000_abc123",
    "task": {
      "task_id": "TASK_1735718400000_abc123",
      "name": "2024年1月对账",
      "status": "PENDING",
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": null,
      "statistics": "{}"
    },
    "traceId": "TRACE_1735718400000_jkl012"
  }
}
```

---

### 2.2 获取对账任务列表

**接口地址**: `GET /reconciliation/tasks`

**请求参数**: 无

**示例请求**:
```bash
curl http://localhost:3000/api/reconciliation/tasks
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "task_id": "TASK_1735718400000_abc123",
      "name": "2024年1月对账",
      "status": "COMPLETED",
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-02T00:00:00Z",
      "statistics": "{...}"
    }
  ]
}
```

---

### 2.3 执行对账任务

**接口地址**: `POST /reconciliation/tasks/:taskId/execute`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | String | 是 | 任务ID |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/reconciliation/tasks/TASK_1735718400000_abc123/execute
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "TASK_1735718400000_abc123",
    "status": "PROCESSING",
    "discrepanciesDetected": 15
  }
}
```

---

### 2.4 获取对账任务详情

**接口地址**: `GET /reconciliation/tasks/:taskId`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | String | 是 | 任务ID |

**示例请求**:
```bash
curl http://localhost:3000/api/reconciliation/tasks/TASK_1735718400000_abc123
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "TASK_1735718400000_abc123",
    "name": "2024年1月对账",
    "status": "COMPLETED",
    "created_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-02T00:00:00Z",
    "statistics": {
      "total": 15,
      "pending": 5,
      "approved": 8,
      "rejected": 2,
      "infoRequested": 0,
      "byType": {
        "UNDEDUCTED": { "total": 3, "pending": 1, "approved": 2, "rejected": 0 },
        "DUPLICATE_REFUND": { "total": 2, "pending": 1, "approved": 0, "rejected": 1 }
      }
    }
  }
}
```

---

## 3. 差异管理接口

### 3.1 获取差异列表

**接口地址**: `GET /discrepancies`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | String | 否 | 任务ID筛选 |
| status | String | 否 | 状态筛选 |
| type | String | 否 | 类型筛选 |

**示例请求**:
```bash
curl "http://localhost:3000/api/discrepancies?taskId=TASK_1735718400000_abc123&status=PENDING"
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "discrepancy_id": "DISCR_abc123def456",
      "task_id": "TASK_1735718400000_abc123",
      "order_id": "ORD_001",
      "discrepancy_type": "UNDEDUCTED",
      "description": "{\"order\": 50.00, \"logs\": 3}",
      "status": "PENDING",
      "result": null
    }
  ]
}
```

---

### 3.2 获取差异详情

**接口地址**: `GET /discrepancies/:discrepancyId`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| discrepancyId | String | 是 | 差异ID |

**示例请求**:
```bash
curl http://localhost:3000/api/discrepancies/DISCR_abc123def456
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "discrepancyId": "DISCR_abc123def456",
    "orderId": "ORD_001",
    "type": "UNDEDUCTED",
    "typeName": "未扣费异常",
    "severity": "高",
    "explanation": "该订单存在已完成的充电记录，但系统中没有对应的支付记录。",
    "recommendedAction": "请核查支付状态，如确实未扣费，建议联系用户补扣或走坏账处理流程。",
    "status": "PENDING"
  }
}
```

**差异类型说明**:

| 类型 | 名称 | 严重程度 | 说明 |
|------|------|----------|------|
| UNDEDUCTED | 未扣费异常 | 高 | 有充电记录但无支付记录 |
| DUPLICATE_REFUND | 重复退款异常 | 极高 | 存在多次退款记录 |
| CROSS_PLATFORM | 跨平台订单异常 | 中 | 订单来源与支付渠道不一致 |
| AMOUNT_MISMATCH | 金额不匹配异常 | 高 | 订单金额与支付金额不符 |
| TIME_MISMATCH | 时间不匹配异常 | 低 | 充电结束与支付时间差异大 |
| STATUS_MISMATCH | 状态不匹配异常 | 中 | 订单状态与支付状态不一致 |

---

## 4. 复核操作接口

### 4.1 通过差异

**接口地址**: `POST /review/discrepancies/:discrepancyId/approve`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| discrepancyId | String | 是 | 差异ID |

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| operator | String | 是 | 操作人 |
| remark | String | 否 | 备注说明 |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/review/discrepancies/DISCR_abc123def456/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小张",
    "remark": "已联系用户，确认未扣费，将进行补扣处理"
  }'
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "discrepancyId": "DISCR_abc123def456",
    "status": "APPROVED",
    "operator": "客服小张",
    "timestamp": "2024-01-01T12:00:00Z",
    "auditLogged": true
  }
}
```

---

### 4.2 驳回差异

**接口地址**: `POST /review/discrepancies/:discrepancyId/reject`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| discrepancyId | String | 是 | 差异ID |

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| operator | String | 是 | 操作人 |
| remark | String | 是 | 驳回原因 |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/review/discrepancies/DISCR_abc123def456/reject \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小李",
    "remark": "经查实为支付延迟，款项已于次日到账"
  }'
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "discrepancyId": "DISCR_abc123def456",
    "status": "REJECTED",
    "operator": "客服小李",
    "timestamp": "2024-01-01T12:00:00Z",
    "auditLogged": true
  }
}
```

---

### 4.3 请求补充信息

**接口地址**: `POST /review/discrepancies/:discrepancyId/request-info`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| discrepancyId | String | 是 | 差异ID |

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| operator | String | 是 | 操作人 |
| remark | String | 是 | 需要补充的信息说明 |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/review/discrepancies/DISCR_abc123def456/request-info \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小王",
    "remark": "请提供该订单的支付截图和充电桩现场照片"
  }'
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "discrepancyId": "DISCR_abc123def456",
    "status": "INFO_REQUESTED",
    "operator": "客服小王",
    "timestamp": "2024-01-01T12:00:00Z",
    "auditLogged": true
  }
}
```

---

### 4.4 获取复核历史

**接口地址**: `GET /review/discrepancies/:discrepancyId/history`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| discrepancyId | String | 是 | 差异ID |

**示例请求**:
```bash
curl http://localhost:3000/api/review/discrepancies/DISCR_abc123def456/history
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "discrepancyId": "DISCR_abc123def456",
    "orderId": "ORD_001",
    "type": "UNDEDUCTED",
    "currentStatus": "APPROVED",
    "result": "APPROVED",
    "auditTrail": [
      {
        "logId": "LOG_1735718400000_abc123",
        "operation": "APPROVE",
        "operator": "客服小张",
        "previousStatus": "PENDING",
        "nextStatus": "APPROVED",
        "remark": "已联系用户补扣",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ],
    "totalOperations": 1
  }
}
```

---

## 5. 报告生成接口

### 5.1 生成对账报告

**接口地址**: `POST /reports/:taskId/generate`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | String | 是 | 任务ID |

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| format | String | 否 | 报告格式: excel/pdf, 默认excel |

**示例请求**:
```bash
curl -X POST http://localhost:3000/api/reports/TASK_1735718400000_abc123/generate \
  -H "Content-Type: application/json" \
  -d '{
    "format": "excel"
  }'
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reportId": "REPORT_1735718400000_abc123",
    "taskId": "TASK_1735718400000_abc123",
    "format": "excel",
    "downloadUrl": "/api/reports/REPORT_1735718400000_abc123/download",
    "generatedAt": "2024-01-01T12:00:00Z"
  }
}
```

---

### 5.2 下载支付报告

**接口地址**: `GET /reports/:reportId/download`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| reportId | String | 是 | 报告ID |

**示例请求**:
```bash
curl -O http://localhost:3000/api/reports/REPORT_1735718400000_abc123/download
```

**成功响应**: 返回文件流

---

## 6. 错误码说明

| 错误码 | HTTP状态码 | 说明 | 解决方案 |
|--------|------------|------|----------|
| 0 | 200 | 成功 | - |
| 10001 | 400 | 参数校验失败 | 检查请求参数是否完整、格式是否正确 |
| 10002 | 400 | 文件格式错误 | 确保上传的是CSV或JSON格式文件 |
| 10003 | 400 | 文件内容为空 | 检查文件是否有数据 |
| 10004 | 400 | 缺少必填字段 | 检查CSV列名或JSON字段是否完整 |
| 10005 | 404 | 任务不存在 | 检查taskId是否正确 |
| 10006 | 404 | 差异记录不存在 | 检查discrepancyId是否正确 |
| 10007 | 409 | 任务状态冲突 | 任务正在执行中，请稍后再试 |
| 10008 | 400 | 操作人不能为空 | 复核操作必须指定操作人 |
| 10009 | 400 | 日期范围无效 | 开始日期不能大于结束日期 |
| 10010 | 500 | 数据库操作失败 | 请联系技术支持 |
| 10011 | 500 | 文件处理失败 | 检查文件编码和格式 |
| 10012 | 500 | 报告生成失败 | 请重试或联系技术支持 |
| 99999 | 500 | 系统内部错误 | 请联系技术支持 |

**错误响应格式**:
```json
{
  "code": 10001,
  "message": "参数校验失败: 缺少name字段",
  "data": null
}
```
