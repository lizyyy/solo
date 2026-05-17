# 冷链温控证据签收复核赔付结论后端API

基于 FastAPI + SQLite 的冷链箱全流程管理系统，支持温度监控、门店签收、异常复核、赔付结论等核心功能。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── schemas.py       # Pydantic 数据校验
│   ├── services.py      # 业务逻辑层
│   └── main.py          # FastAPI 主入口
├── requirements.txt     # 依赖包
├── seed_data.py         # 测试数据初始化脚本
├── test_api.py          # pytest 测试用例
└── README.md
```

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

### 3. 初始化测试数据

```bash
python seed_data.py
```

## 核心数据模型

1. **ColdChainBox (冷链箱)**: 箱号、批次、产品名称、温度范围、状态等
2. **TemperatureSample (温度采样)**: 采样时间、温度、探头ID、是否异常
3. **StoreSignoff (门店签收)**: 门店信息、签收人、到货温度、是否有异常
4. **PhotoEvidence (照片凭证)**: 照片唯一键、类型、上传人、描述
5. **ExceptionReview (异常复核)**: 复核人、原始输入、温度违规、赔付资格
6. **CompensationConclusion (赔付结论)**: 赔付金额、原因、处理人、审批人

## 状态机说明

### 冷链箱状态流转

```
CREATED (创建)
    ↓
IN_TRANSIT (运输中) → ARRIVED (到货) → SIGNED_OFF (已签收) → UNDER_REVIEW (复核中)
    ↓                    ↓                                       ↓
EXCEPTION (异常) -------+                                       ↓
    ↓                                                            ↓
    +------------> UNDER_REVIEW (复核中) <----------------------+
                        ↓
             +----------+----------+
             ↓          ↓          ↓
      COMPENSATED  REJECTED  RESOLVED
             ↓          ↓          ↓
             +----------+----------+
                        ↓
                   CLOSED (关闭)
```

### 签收状态流转

```
DRAFT (草稿)
    ↓
SUBMITTED (提交)
    ↓
  +-+--+
  ↓    ↓
CONFIRMED (确认) → AMENDED (修改)
  ↓
REJECTED (退回) → DRAFT / DISCARDED (废弃)
```

## API 主流程 (curl 示例)

### 1. 创建冷链箱

```bash
curl -X POST "http://localhost:8000/api/boxes/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "batch_no": "BATCH-2024-001",
    "product_name": "进口冷冻牛肉",
    "temperature_min": -25.0,
    "temperature_max": -15.0
  }'
```

### 2. 状态推进 (创建 → 运输中)

```bash
curl -X POST "http://localhost:8000/api/boxes/BOX-DEMO-001/status" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "IN_TRANSIT",
    "operator": "物流员-张三",
    "comment": "开始运输"
  }'
```

### 3. 上传温度采样

```bash
curl -X POST "http://localhost:8000/api/temperature/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "sample_time": "2024-01-15T10:00:00",
    "temperature": -20.0,
    "probe_id": "PROBE-001"
  }'
```

### 4. 门店签收

```bash
curl -X POST "http://localhost:8000/api/signoffs/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "store_code": "STORE-001",
    "store_name": "北京朝阳门店",
    "signoff_person": "门店员工-李四",
    "signoff_time": "2024-01-15T14:30:00",
    "temperature_arrival": -18.0,
    "has_exception": false
  }'
```

### 5. 上传照片凭证

```bash
curl -X POST "http://localhost:8000/api/photos/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "photo_key": "PHOTO-BOX001-ARRV",
    "photo_type": "ARRIVAL",
    "uploader": "李四",
    "description": "冷链箱到货正面照"
  }'
```

### 6. 异常复核

```bash
curl -X POST "http://localhost:8000/api/reviews/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "signoff_id": 1,
    "reviewer": "质量主管-王五",
    "original_input": "现场照片：箱体外有水珠，温度计显示-5℃，产品部分解冻",
    "review_result": "确认冷链中断",
    "review_comment": "运输过程中制冷异常，温度超标4小时以上",
    "temperature_violation": true,
    "compensation_eligible": true
  }'
```

### 7. 赔付结论

```bash
curl -X POST "http://localhost:8000/api/compensations/" \
  -H "Content-Type: application/json" \
  -d '{
    "box_code": "BOX-DEMO-001",
    "review_id": 1,
    "compensation_amount": 2000.0,
    "compensation_reason": "冷链中断",
    "processor": "财务",
    "approved_by": "经理"
  }'
```

### 8. 查询详情

```bash
curl -X GET "http://localhost:8000/api/boxes/BOX-DEMO-001"
```

### 9. 人工修正

```bash
curl -X POST "http://localhost:8000/api/boxes/BOX-DEMO-001/correction" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "product_name",
    "old_value": "进口冷冻牛肉",
    "new_value": "进口精选和牛肉",
    "operator": "管理员",
    "reason": "产品名称录入错误"
  }'
```

### 10. 关闭案件

```bash
curl -X POST "http://localhost:8000/api/boxes/BOX-DEMO-001/close?operator=经理"
```

### 11. 数据导出

JSON 格式（完整字段）：
```bash
curl -X POST "http://localhost:8000/api/export/" \
  -H "Content-Type: application/json" \
  -d '{
    "status": ["EXCEPTION", "UNDER_REVIEW", "COMPENSATED"],
    "export_format": "json"
  }'
```

Excel 格式（包含3个Sheet）：
- 冷链箱信息：基本信息、温度范围
- 异常报告：签收信息、复核信息（含原始输入）、赔付信息
- 审计日志：全链路操作留痕

```bash
curl -X POST "http://localhost:8000/api/export/" \
  -H "Content-Type: application/json" \
  -d '{ "export_format": "xlsx" }' \
  -o "cold_chain_export.xlsx"
```

### 12. 审计日志查询

```bash
curl -X GET "http://localhost:8000/api/boxes/BOX-DEMO-001/audit-logs"
```

## 冲突路径 (异常场景)

### 1. 重复上传 - 幂等性

```bash
# 第一次成功
curl -X POST "http://localhost:8000/api/photos/" \
  -H "Content-Type: application/json" \
  -d '{"box_code": "BOX-TEST-001", "photo_key": "PHOTO-IDEMPOTENT"}'

# 第二次重复上传 - 返回 409 Conflict
curl -X POST "http://localhost:8000/api/photos/" \
  -H "Content-Type: application/json" \
  -d '{"box_code": "BOX-TEST-001", "photo_key": "PHOTO-IDEMPOTENT"}'
```

### 2. 非法状态转换

```bash
# 不能直接从 CREATED → CLOSED
curl -X POST "http://localhost:8000/api/boxes/BOX-TEST-001/status" \
  -H "Content-Type: application/json" \
  -d '{"target_status": "CLOSED", "operator": "测试员"}'
```

### 3. 温度异常自动触发状态变更

```bash
# 正常温度 → 状态不变
curl -X POST "http://localhost:8000/api/temperature/" \
  -H "Content-Type: application/json" \
  -d '{"box_code": "BOX-TEST-001", "temperature": -20.0}'

# 异常温度 → 自动转为 EXCEPTION 状态
curl -X POST "http://localhost:8000/api/temperature/" \
  -H "Content-Type: application/json" \
  -d '{"box_code": "BOX-TEST-001", "temperature": -5.0}'
```

### 4. 人工修正旧值不匹配

```bash
curl -X POST "http://localhost:8000/api/boxes/BOX-TEST-001/correction" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "product_name",
    "old_value": "错误的旧值",
    "new_value": "新名称",
    "operator": "管理员"
  }'
```

## Pytest 测试

### 运行所有测试

```bash
pytest test_api.py -v
```

### 运行指定测试类

```bash
pytest test_api.py::TestBoxApi -v
```

### 运行单个测试用例

```bash
pytest test_api.py::TestBoxApi::test_create_box -v
```

### 生成测试报告

```bash
pytest test_api.py -v --html=report.html
```

### 测试覆盖说明

- **TestBoxApi**: 箱号创建、列表查询、详情查询、重复创建
- **TestStatusTransition**: 合法状态流转、非法状态拦截
- **TemperatureSample**: 正常温度、异常温度自动标记
- **TestPhotoEvidence**: 照片上传、幂等性校验
- **TestSignoffAndReview**: 签收→复核→赔付 完整异常流程
- **TestManualCorrection**: 人工数据修正功能
- **TestExport**: 数据导出功能
- **TestHealthCheck**: 服务健康检查

## 核心业务规则

1. **状态机约束**: 所有状态变更必须遵循预定义流转规则，防止非法状态跳跃
2. **温度自动校验**: 温度采样自动校验是否在合规范围内，异常自动触发状态变更
3. **凭证留痕**: 所有异常复核保留原始输入，确保可追溯
4. **幂等性保证**: 照片凭证使用唯一键防重，避免重复计费
5. **人工修正审计**: 数据修正需验证旧值匹配，记录操作人和原因
6. **关闭前置校验**: 案件关闭前必须完成赔付或问题解决

## 技术栈

- **Web 框架**: FastAPI 0.109.0
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite
- **数据校验**: Pydantic 2.x
- **测试框架**: pytest + httpx
- **Excel 导出**: openpyxl
