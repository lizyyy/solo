# 任务幂等收据API

批量任务幂等性追踪与收据管理系统，解决批量任务多次触发时难以识别哪次真正生效的问题。

## 功能特性

### 核心功能
- ✅ **幂等收据生成** - 每次任务触发生成唯一收据编号
- ✅ **重复触发归并** - 相同幂等键的请求自动识别并返回已有收据
- ✅ **明细追踪** - 支持每一项的独立状态追踪、结果记录、处理依据
- ✅ **结果快照** - 批次级结果快照保存
- ✅ **状态机管理** - PENDING -> PROCESSING -> SUCCESS/FAILED -> MERGED/MANUAL_FIXED
- ✅ **异常处理** - 失败路径保存原始输入、错误信息、处理依据
- ✅ **人工修正** - 支持运营人员对异常批次进行人工干预
- ✅ **导出查询** - 支持Excel导出，包含收据摘要和处理明细

### 数据模型
- **TaskBatch**: 任务批次，包含批次基本信息、幂等键、统计数据
- **ProcessDetail**: 处理明细，每项的状态、结果、错误、处理依据
- **Receipt**: 收据，最终的生效凭证，包含最终结论和结果摘要
- **MergeRecord**: 归并记录，记录重复请求的归并关系

## 快速开始

### 环境要求
- Python 3.8+

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```

服务将在 `http://127.0.0.1:8000` 启动

### 访问API文档
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

### 运行集成测试
```bash
python test_receipt_api.py
```

## API接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/receipts | 创建任务批次并生成收据 |
| GET | /api/v1/receipts/{receipt_no} | 根据收据编号查询 |
| GET | /api/v1/receipts/idempotent/{idempotent_key} | 根据幂等键查询 |
| POST | /api/v1/receipts/query | 分页查询任务批次列表 |
| PATCH | /api/v1/receipts/{batch_id}/details | 更新处理明细状态 |
| PATCH | /api/v1/receipts/{batch_id}/status | 推进批次状态 |
| POST | /api/v1/receipts/manual-fix | 人工修正收据 |
| GET | /api/v1/receipts/{batch_id}/details | 获取批次处理明细 |
| POST | /api/v1/receipts/export | 导出收据数据 |
| GET | /api/v1/stats | 获取统计数据 |

## 使用示例

### 1. 创建任务批次
```bash
curl -X POST http://127.0.0.1:8000/api/v1/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "用户批量导入",
    "trigger_source": "api",
    "idempotent_key": "import_20240115_001",
    "original_input": {"file": "users.xlsx"},
    "items": [
      {"item_key": "user_001", "name": "张三"},
      {"item_key": "user_002", "name": "李四"}
    ]
  }'
```

### 2. 重复请求（自动幂等）
```bash
# 使用相同的 idempotent_key 再次请求，会返回已有收据
# 返回结果中 is_duplicate = true
```

### 3. 更新处理明细
```bash
curl -X PATCH http://127.0.0.1:8000/api/v1/receipts/1/details \
  -H "Content-Type: application/json" \
  -d '[
    {
      "item_key": "user_001",
      "status": "success",
      "result_data": {"user_id": 1001},
      "processing_basis": {"rule": "auto_create"}
    }
  ]'
```

### 4. 推进批次状态
```bash
curl -X PATCH http://127.0.0.1:8000/api/v1/receipts/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "result_snapshot": {"total": 2, "success": 2, "failed": 0}
  }'
```

### 5. 人工修正
```bash
curl -X POST http://127.0.0.1:8000/api/v1/receipts/manual-fix \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_no": "RCP20240115103000XXXX",
    "final_conclusion": "经人工核查，数据有效，予以通过",
    "operator": "manager"
  }'
```

## 触发来源(TriggerSource)
- `api` - API接口调用
- `scheduler` - 定时任务触发
- `manual` - 人工操作
- `webhook` - 回调触发
- `batch` - 批处理系统

## 任务状态(TaskStatus)
- `pending` - 待处理
- `processing` - 处理中
- `success` - 处理成功
- `failed` - 处理失败
- `merged` - 已归并
- `manual_fixed` - 已人工修正

## 项目结构
```
.
├── main.py              # 应用入口
├── database.py          # 数据库配置
├── models.py            # 数据模型
├── schemas.py           # Pydantic schema
├── service.py           # 业务逻辑层
├── api.py               # API接口层
├── requirements.txt     # 依赖列表
├── test_receipt_api.py  # 集成测试
└── README.md            # 项目文档
```

## 验收标准

1. ✅ 正常创建和查询功能可用
2. ✅ 重复提交同一动作（相同幂等键）不会推进两次
3. ✅ 返回结果中明确标记 `is_duplicate`
4. ✅ 导出的Excel包含收据摘要和处理明细
5. ✅ 每条异常记录包含原始输入、处理依据和最终结论
6. ✅ 支持人工修正功能
7. ✅ 状态机流转正确
