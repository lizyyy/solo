# 药房库存管理系统 API 文档

## 基础信息
- 基础URL: `http://localhost:8080/api/v1`
- 数据格式: JSON
- 字符编码: UTF-8

## 健康检查

### GET /health
检查服务状态

**响应示例:**
```json
{
  "status": "ok",
  "message": "Pharmacy Inventory API is running"
}
```

## 到货单管理

### POST /import/delivery
导入CSV格式的到货单

**请求:**
- Content-Type: multipart/form-data
- 参数: file (CSV文件)

**CSV文件格式:**
```
batch_no,product_type,product_name,quantity,arrival_date,receiver_name,receiver_phone,supplier
VAC-2024-001,疫苗,乙肝疫苗,100,2024-01-15,张三,13800138000,疫苗供应商A
INS-2024-001,胰岛素,甘精胰岛素,50,2024-01-16,李四,13900139000,胰岛素供应商B
```

**响应示例:**
```json
{
  "result": {
    "session_id": "uuid",
    "total_records": 2,
    "success_count": 2,
    "error_count": 0
  }
}
```

### GET /deliveries
获取到货单列表（分页）

**参数:**
- page (可选): 页码，默认1
- page_size (可选): 每页数量，默认20，最大100

**响应示例:**
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_page": 5
}
```

### GET /deliveries/:id
获取单条到货单详情

**响应示例:**
```json
{
  "data": {
    "id": "uuid",
    "batch_no": "VAC-2024-001",
    "product_type": "疫苗",
    "product_name": "乙肝疫苗",
    "quantity": 100,
    "arrival_date": "2024-01-15T00:00:00Z",
    "receiver_name": "张*",
    "receiver_phone": "138****8000",
    "supplier": "疫苗供应商A",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### GET /deliveries/export
导出货单CSV（脱敏）

## 温度记录管理

### POST /import/temperature
导入JSON格式的温度记录

**请求:**
- Content-Type: multipart/form-data
- 参数: file (JSON文件)

**JSON文件格式:**
```json
[
  {
    "batch_no": "VAC-2024-001",
    "temperature": 2.5,
    "record_time": "2024-01-15 08:00:00",
    "recorder_name": "王五",
    "recorder_phone": "13700137000",
    "thermometer_id": "TH-001"
  }
]
```

### GET /temperature
获取温度记录

**参数:**
- batch_no (必需): 批次号

## 破损记录管理

### POST /damage
创建破损记录

**请求体:**
```json
{
  "batch_no": "VAC-2024-001",
  "damage_type": "破损",
  "description": "包装破损",
  "quantity": 5,
  "reporter_name": "赵六",
  "report_time": "2024-01-15T10:00:00Z"
}
```

### GET /damage
获取破损记录

**参数:**
- batch_no (必需): 批次号

## 照片上传

### POST /import/photos
上传破损照片

**请求:**
- Content-Type: multipart/form-data
- 参数: 
  - photos (文件数组)
  - batch_no (字符串)
  - uploaded_by (字符串，可选)

## 导入错误管理

### GET /import/sessions
获取导入会话列表

### GET /import/errors
获取导入错误列表

**参数:**
- session_id (可选): 导入会话ID
- status (可选): 状态筛选 (pending/resolved)
- page (可选): 页码
- page_size (可选): 每页数量

### PUT /import/errors/:id/resolve
标记错误为已解决

**参数:**
- resolved_by (可选): 处理人

### GET /import/errors/export
导出错误记录CSV

## 审计日志

### GET /audit
获取审计日志

**参数:**
- entity_type (可选): 实体类型 (delivery/temperature/damage/import_error)
- entity_id (可选): 实体ID
- page (可选): 页码
- page_size (可选): 每页数量

## 敏感字段脱敏说明

系统自动对以下敏感字段进行脱敏处理（包括API响应、导出文件和日志）：

1. **姓名**: 显示第一个字，其余用 `*` 代替
   - 示例: `张三` → `张*`

2. **手机号**: 显示前3位和后4位，中间用 `****` 代替
   - 示例: `13800138000` → `138****8000`

## 错误类型说明

| 错误类型 | 说明 |
|---------|------|
| column_mismatch | CSV列数不匹配 |
| validation_error | 数据验证失败 |
| duplicate_record | 记录已存在（批次号+产品名唯一） |
| database_error | 数据库操作错误 |
| temperature_out_of_range | 温度超出有效范围（-80°C ~ 40°C） |
| save_error | 文件保存失败 |

## 数据持久化说明

- 数据库文件: `./data/pharmacy.db` (SQLite)
- 照片存储: `./uploads/photos/`
- 重启服务后，所有历史数据均可查询
