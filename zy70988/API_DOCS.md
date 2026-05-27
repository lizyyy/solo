# 短租运营后端服务 API 文档

## 概述

本系统提供短租房水电押金结算的后端服务，支持批次管理、记录处理、文件上传、查询导出等功能。

## 基础信息

- 基础URL: `http://localhost:5001/api`
- 数据格式: JSON
- 编码: UTF-8

## 一、批次管理接口

### 1. 创建批次

**POST** `/batches`

请求体:
```json
{
  "name": "2024年1月结算批次",
  "operator": "admin",
  "remark": "1月短租房水电押金结算"
}
```

响应:
```json
{
  "code": 0,
  "message": "创建成功",
  "data": {
    "id": 1,
    "batch_no": "B20240101120000ABCDEF",
    "name": "2024年1月结算批次",
    "status": "pending",
    "created_at": "2024-01-01T12:00:00"
  }
}
```

### 2. 获取批次列表

**GET** `/batches`

查询参数:
- `page`: 页码，默认1
- `per_page`: 每页数量，默认20
- `status`: 状态筛选 (pending/processing/completed)

### 3. 获取批次详情

**GET** `/batches/{batch_id}`

### 4. 开始处理批次

**POST** `/batches/{batch_id}/process`

请求体:
```json
{
  "operator": "admin"
}
```

### 5. 完成批次

**POST** `/batches/{batch_id}/complete`

请求体:
```json
{
  "operator": "admin",
  "reason": "全部审核完成"
}
```

## 二、记录管理接口

### 1. 获取记录列表

**GET** `/records`

查询参数:
- `page`: 页码
- `per_page`: 每页数量
- `property_id`: 房源编号
- `deposit_receipt_no`: 押金单号
- `checkout_start`: 退房开始日期 (YYYY-MM-DD)
- `checkout_end`: 退房结束日期 (YYYY-MM-DD)
- `status`: 状态筛选
- `batch_id`: 批次ID

### 2. 获取记录详情

**GET** `/records/{record_id}`

返回完整的记录信息，包括阶梯电价明细、证据列表和操作日志。

### 3. 审核通过

**POST** `/records/{record_id}/approve`

请求体:
```json
{
  "operator": "manager",
  "reason": "数据核对无误"
}
```

### 4. 退回修改

**POST** `/records/{record_id}/reject`

请求体:
```json
{
  "operator": "manager",
  "reason": "电表读数异常，需要重新核对"
}
```

### 5. 要求补材料

**POST** `/records/{record_id}/request_material`

请求体:
```json
{
  "operator": "manager",
  "reason": "缺少退房验房照片"
}
```

### 6. 重新提交

**POST** `/records/{record_id}/resubmit`

请求体:
```json
{
  "operator": "operator",
  "reason": "已修正数据，重新提交"
}
```

### 7. 退款冲正

**POST** `/records/{record_id}/refund_reversal`

请求体:
```json
{
  "operator": "finance",
  "reversed_amount": 100,
  "reason": "发现损坏赔偿少计，补扣100元"
}
```

### 8. 更新损坏赔偿

**POST** `/records/{record_id}/update_damage`

请求体:
```json
{
  "operator": "checker",
  "damage_amount": 150,
  "reason": "墙面污渍+沙发破损"
}
```

## 三、文件上传接口

### 1. 上传CSV抄表数据

**POST** `/files/upload/csv`

请求类型: `multipart/form-data`

字段:
- `file`: CSV文件
- `batch_id`: 批次ID
- `operator`: 操作人

CSV字段说明:
```
property_id,room_no,tenant_name,checkin_date,checkout_date,deposit_receipt_no,deposit_amount,water_start,water_end,electricity_start,electricity_end,damage_amount,cleaning_fee,other_fees
```

### 2. 上传订单JSON数据

**POST** `/files/upload/json`

请求类型: `multipart/form-data`

字段:
- `file`: JSON文件
- `batch_id`: 批次ID
- `operator`: 操作人

### 3. 上传扣款照片/证据

**POST** `/files/upload/evidence`

请求类型: `multipart/form-data`

字段:
- `file`: 图片文件 (jpg/jpeg/png/pdf)
- `record_id`: 记录ID
- `evidence_type`: 证据类型 (damage/meter/other)
- `operator`: 操作人
- `description`: 描述

## 四、导出接口

### 1. 导出明细

**GET** `/exports/records`

查询参数:
- `property_id`: 房源编号
- `deposit_receipt_no`: 押金单号
- `checkout_start`: 退房开始日期
- `checkout_end`: 退房结束日期
- `status`: 状态
- `batch_id`: 批次ID
- `format`: 导出格式 (xlsx/csv)，默认xlsx
- `operator`: 操作人

### 2. 导出单条记录报告

**GET** `/exports/record/{record_id}/report`

查询参数:
- `operator`: 操作人

导出Excel包含多个sheet:
- 结算报告: 基本信息和费用明细
- 操作日志: 完整的操作历史
- 电价明细: 阶梯电价计算详情
- 证据列表: 关联的所有证据

## 数据字典

### 记录状态 (status)

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| processing | 处理中 |
| approved | 已通过 |
| rejected | 已退回 |
| need_material | 待补材料 |
| completed | 已完成 |

### 批次状态 (status)

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| processing | 处理中 |
| completed | 已完成 |

### 证据类型 (evidence_type)

| 类型 | 说明 |
|------|------|
| damage | 损坏照片 |
| meter | 抄表照片 |
| cleaning | 清洁照片 |
| other | 其他 |

## 审计追踪

所有操作都会记录操作日志，包含:
- 操作类型
- 操作人
- 操作时间
- 原因/备注
- 状态变更前后
- IP地址

## 快速开始

1. 安装依赖:
```bash
pip install -r requirements.txt
```

2. 启动服务:
```bash
python run.py
```

3. 运行测试:
```bash
python test_api.py
```
