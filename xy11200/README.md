# 社区药房库存管理系统

一个用于管理疫苗和胰岛素到货记录、温度监控、破损记录的后端系统。

## 功能特性

- ✅ **到货单管理**: CSV批量导入，支持批次号+产品名唯一约束
- ✅ **温度记录**: JSON批量导入，自动校验温度范围（-80°C ~ 40°C）
- ✅ **破损记录**: 手动创建破损报告，支持照片上传
- ✅ **错误处理**: 导入错误保留原始行号、原始数据、错误类型、修改建议
- ✅ **本地持久化**: SQLite数据库，重启服务数据不丢失
- ✅ **敏感字段脱敏**: 姓名、手机号自动脱敏（API响应、导出、日志）
- ✅ **审计日志**: 所有操作记录可追溯
- ✅ **数据导出**: 支持CSV导出（脱敏）
- ✅ **导入会话**: 每次导入有独立会话记录，便于追溯

## 技术栈

- Python 3.9+
- FastAPI
- SQLite 3
- Uvicorn

## 快速开始

### 1. 安装依赖

```bash
pip3 install fastapi uvicorn python-multipart
```

### 2. 启动服务

```bash
python3 app.py
```

服务将在 `http://localhost:8080` 启动

API文档地址: 
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

### 3. 测试导入

使用示例文件测试导入功能：

```bash
# 健康检查
curl http://localhost:8080/api/v1/health

# 测试到货单CSV导入
curl -X POST -F "file=@examples/delivery.csv" http://localhost:8080/api/v1/import/delivery

# 测试温度记录JSON导入
curl -X POST -F "file=@examples/temperature.json" http://localhost:8080/api/v1/import/temperature

# 查看到货单列表
curl "http://localhost:8080/api/v1/deliveries"

# 查看导入错误
curl "http://localhost:8080/api/v1/import/errors"
```

## 项目结构

```
.
├── app.py                  # 主程序入口（包含所有API路由和业务逻辑）
├── requirements.txt        # Python依赖
├── examples/
│   ├── delivery.csv        # 到货单示例（包含测试错误数据）
│   └── temperature.json    # 温度记录示例（包含测试错误数据）
├── data/                   # SQLite数据库文件目录（自动创建）
├── uploads/photos/         # 上传照片目录（自动创建）
├── API.md                  # API接口文档
└── README.md
```

## 数据模型

### 到货单 (DeliveryRecord)
- ID: UUID
- BatchNo: 批次号
- ProductType: 产品类型（疫苗/胰岛素）
- ProductName: 产品名称
- Quantity: 数量
- ArrivalDate: 到货日期
- ReceiverName: 接收人姓名（自动脱敏）
- ReceiverPhone: 接收人电话（自动脱敏）
- Supplier: 供应商
- CreatedAt: 创建时间
- UpdatedAt: 更新时间

### 温度记录 (TemperatureRecord)
- ID: UUID
- DeliveryID: 关联到货单ID
- BatchNo: 批次号
- Temperature: 温度值
- RecordTime: 记录时间
- RecorderName: 记录人姓名（自动脱敏）
- RecorderPhone: 记录人电话（自动脱敏）
- ThermometerID: 温度计ID
- CreatedAt: 创建时间

### 破损记录 (DamageRecord)
- ID: UUID
- DeliveryID: 关联到货单ID
- BatchNo: 批次号
- DamageType: 破损类型
- Description: 描述
- Quantity: 数量
- PhotoPaths: 照片路径
- ReporterName: 报告人姓名（自动脱敏）
- ReportTime: 报告时间
- CreatedAt: 创建时间

### 导入错误 (ImportError)
- ID: UUID
- ImportSession: 导入会话ID
- SourceType: 来源类型
- SourceFile: 源文件名
- OriginalRow: 原始行号
- OriginalData: 原始数据（完整保留）
- ErrorType: 错误类型
- ErrorMessage: 错误信息
- Suggestion: 修改建议
- Status: 状态 (pending/resolved)
- ResolvedBy: 处理人（自动脱敏）
- ResolvedAt: 处理时间
- CreatedAt: 创建时间

### 导入会话 (ImportSession)
- ID: UUID
- SourceType: 来源类型
- FileName: 文件名
- TotalRecords: 总记录数
- SuccessCount: 成功数
- ErrorCount: 失败数
- ImportedBy: 导入人（自动脱敏）
- ImportedAt: 导入时间

### 审计日志 (AuditLog)
- ID: UUID
- Operation: 操作类型
- EntityType: 实体类型
- EntityID: 实体ID
- Operator: 操作人（自动脱敏）
- OldValue: 旧值
- NewValue: 新值
- Timestamp: 时间戳

## 错误类型说明

| 错误类型 | 说明 |
|---------|------|
| validation_error | 数据验证失败（必填字段为空、格式错误等） |
| duplicate_record | 记录已存在（批次号+产品名重复） |
| temperature_out_of_range | 温度超出有效范围（-80°C ~ 40°C） |
| database_error | 数据库操作错误 |
| save_error | 文件保存失败 |

## 敏感字段脱敏规则

1. **姓名**: 只显示第一个字，其余用 `*` 代替
   - 示例: `张三` → `张*`, `李四` → `李*`

2. **手机号**: 显示前3位和后4位，中间用 `****` 代替
   - 示例: `13800138000` → `138****8000`

脱敏应用于所有API响应、CSV导出文件和审计日志。

## 使用说明

### 导入到货单
1. 准备CSV文件，格式参考 `examples/delivery.csv`
2. 调用 `POST /api/v1/import/delivery` 上传文件
3. 查看返回结果中的成功和失败计数
4. 如存在失败记录，调用 `GET /api/v1/import/errors` 查看详情
5. 修改错误数据后可重新导入，或标记为已解决

### 导入温度记录
1. 准备JSON文件，格式参考 `examples/temperature.json`
2. 调用 `POST /api/v1/import/temperature` 上传文件
3. 系统自动校验温度范围，异常温度会被拦截

### 查看导入历史
- 调用 `GET /api/v1/import/sessions` 查看所有导入会话
- 调用 `GET /api/v1/import/errors?session_id=xxx` 查看特定会话的错误

### 数据导出
- 导出货单: `GET /api/v1/deliveries/export`
- 导出错误: `GET /api/v1/import/errors/export`

## 注意事项

1. **数据持久化**: 数据库文件存储在 `./data/pharmacy.db`，请勿删除
2. **敏感数据**: 所有姓名和手机号在API响应、导出文件和日志中均已脱敏
3. **照片存储**: 上传的照片存储在 `./uploads/photos/` 目录
4. **错误处理**: 所有导入错误都会被完整记录，包含原始行号和修改建议，便于库管员追溯和解释

## 社区药房库管员使用场景

1. **到货后导入纸单**: 将纸质到货单录入为CSV文件导入系统，系统自动校验并记录错误
2. **查看错误记录**: 查看导入失败的记录，了解失败原因和修改建议
3. **解释拦截原因**: 当被问及为何某些记录被系统拦截时，可通过 `GET /api/v1/import/errors` 查询并展示详细原因和修改建议
4. **温度记录导入**: 定期导入温度记录仪的数据，确保冷链运输合规
5. **破损报告**: 发现破损货物时创建破损记录，可上传照片留证
6. **数据导出**: 导出到货单或错误记录用于汇报和存档

## 详细文档

- [API接口文档](./API.md)
- Swagger UI: http://localhost:8080/docs
