# 预制菜留样抽检销毁确认系统

中央厨房预制菜留样追溯管理系统后端API。

## 技术栈
- FastAPI
- SQLite
- SQLAlchemy ORM
- Pydantic
- pytest

## 核心功能
- ✅ **批次管理**: 创建、查询、关闭、修正
- ✅ **留样管理**: 留样盒登记、冷藏位置分配、状态跟踪
- ✅ **抽检管理**: 抽检记录、复核流程、异常处理
- ✅ **销毁管理**: 销毁申请、审核、执行、撤回（状态机驱动）
- ✅ **异常处理**: 全流程审计追踪、原始输入保存
- ✅ **报告导出**: 追溯报告查询、Excel导出

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务启动在 http://localhost:8000
API文档: http://localhost:8000/docs

### 3. 造测试数据
```bash
python seed_data.py
```

## 主流程示例 (curl)

### 1. 创建批次
```bash
curl -X POST http://localhost:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240101-001",
    "dish_name": "红烧肉",
    "production_date": "2024-01-01T10:00:00",
    "quantity": 100,
    "operator": "张三"
  }'
```

### 2. 创建冷藏位置
```bash
curl -X POST http://localhost:8000/api/storage-locations \
  -H "Content-Type: application/json" \
  -d '{
    "location_code": "LOC-001",
    "location_name": "冷藏柜A-01层",
    "refrigerator_no": "A01",
    "shelf_no": "1层",
    "temperature": -18
  }'
```

### 3. 创建留样盒（批次绑定）
```bash
curl -X POST http://localhost:8000/api/sample-boxes \
  -H "Content-Type: application/json" \
  -d '{
    "box_no": "BOX-001",
    "batch_id": 1,
    "storage_location_id": 1,
    "sample_date": "2024-01-01T10:30:00",
    "retention_days": 48,
    "operator": "张三"
  }'
```

### 4. 抽检记录
```bash
curl -X POST http://localhost:8000/api/inspections \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_no": "INS-001",
    "batch_id": 1,
    "sample_box_id": 1,
    "inspection_date": "2024-01-01T14:00:00",
    "inspector": "赵六",
    "appearance": "色泽正常",
    "smell": "无异味",
    "taste": "口感正常",
    "result": "合格",
    "conclusion": "留样合格，可继续保存"
  }'
```

### 5. 抽检复核
```bash
curl -X POST http://localhost:8000/api/inspections/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "钱七",
    "review_result": "approved",
    "review_remark": "复核通过"
  }'
```

### 6. 销毁申请
```bash
curl -X POST http://localhost:8000/api/destructions \
  -H "Content-Type: application/json" \
  -d '{
    "destruction_no": "DEST-001",
    "sample_box_id": 1,
    "application_date": "2024-01-03T10:00:00",
    "applicant": "张三",
    "reason": "留样到期",
    "remark": "48小时留样期满"
  }'
```

### 7. 销毁审核
```bash
curl -X POST http://localhost:8000/api/destructions/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "领导",
    "review_result": "approved",
    "review_remark": "同意销毁"
  }'
```

### 8. 执行销毁
```bash
curl -X POST http://localhost:8000/api/destructions/1/execute \
  -H "Content-Type: application/json" \
  -d '{
    "destructor": "销毁员",
    "destruction_method": "高温销毁",
    "witness": "见证人"
  }'
```

## 冲突/异常路径示例

### 1. 冷藏位置被占用（异常自动记录）
```bash
curl -X POST http://localhost:8000/api/sample-boxes \
  -H "Content-Type: application/json" \
  -d '{
    "box_no": "BOX-002",
    "batch_id": 1,
    "storage_location_id": 1,
    "sample_date": "2024-01-01T10:30:00",
    "retention_days": 48,
    "operator": "张三"
  }'
# 返回 400: 冷藏位置已被占用
# 异常记录自动保存到 /api/exceptions
```

### 2. 查询异常记录
```bash
curl http://localhost:8000/api/exceptions
```

### 3. 撤回销毁申请
```bash
curl -X POST "http://localhost:8000/api/destructions/1/cancel?operator=张三"
```

### 4. 关闭留样盒
```bash
curl -X POST "http://localhost:8000/api/sample-boxes/1/close?operator=管理员"
```

### 5. 人工修正批次信息
```bash
curl -X PUT http://localhost:8000/api/batches/1 \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 120,
    "remark": "数量修正"
  }'
```

## 查询接口

### 查询批次列表
```bash
curl http://localhost:8000/api/batches
```

### 查询留样盒列表
```bash
curl http://localhost:8000/api/sample-boxes
curl "http://localhost:8000/api/sample-boxes?batch_id=1&status=stored"
```

### 查询抽检记录
```bash
curl http://localhost:8000/api/inspections
```

### 查询销毁申请
```bash
curl http://localhost:8000/api/destructions
```

## 报告导出

### 查询追溯报告
```bash
curl -X POST http://localhost:8000/api/reports/trace \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240101-001"
  }'
```

### 导出Excel报告
```bash
curl -X POST http://localhost:8000/api/reports/trace/export \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o report.xlsx
```

## 运行测试
```bash
pytest -v
```

### 测试覆盖范围
- ✅ 批次创建、重复创建、列表查询
- ✅ 冷藏位置创建
- ✅ 留样盒创建、位置冲突异常
- ✅ 抽检流程（创建）
- ✅ 销毁全流程（申请→审核→执行）
- ✅ 销毁撤回
- ✅ 异常记录自动保存
- ✅ 追溯报告生成

## 状态机说明

### 留样盒状态
- `stored`: 已入库（初始状态）
- `inspected`: 已抽检
- `destroy_pending`: 待销毁
- `destroyed`: 已销毁（终态）
- `expired`: 已过期
- `closed`: 已关闭（终态）

### 销毁申请状态
- `pending_review`: 待审核（初始状态）
- `review_approved`: 审核通过
- `review_rejected`: 审核拒绝
- `destroyed`: 已销毁（终态）
- `cancelled`: 已撤回（终态）

### 抽检记录状态
- `pending_review`: 待复核（初始状态）
- `review_approved`: 复核通过（终态）
- `review_rejected`: 复核拒绝（终态）

## 项目结构
```
.
├── main.py              # FastAPI主程序
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic数据结构
├── services.py          # 业务逻辑和状态机
├── seed_data.py         # 测试数据生成
├── test_main.py         # pytest测试用例
├── requirements.txt     # 依赖清单
├── README.md           # 项目说明
└── food_sample.db      # SQLite数据库（自动生成）
```
