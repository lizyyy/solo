# 物业催办外包派单完工复核后端API

小区物业报修管理系统，支持工单创建、催办、外包派单、完工复核等功能。

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **测试**: pytest

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 生成测试数据

```bash
python generate_test_data.py
```

### 4. 运行测试

```bash
pytest test_main.py -v
```

## 核心数据模型

| 模型 | 说明 |
|------|------|
| BuildingRoom | 楼栋房号信息 |
| Handler | 处理人/外包商 |
| RepairOrder | 报修工单 |
| Reminder | 催办记录 |
| OutsourceOrder | 外包派单 |
| CompletionProof | 完工证明 |
| StatusLog | 状态变更日志 |

## 工单状态流转

```
pending (待处理)
    ├─→ assign → assigned (已派单)
    │       ├─→ start → processing (处理中)
    │       │       ├─→ complete → completed (已完工)
    │       │       │       └─→ verify → verified (已复核)
    │       │       │               └─→ close → closed (已关闭)
    │       │       └─→ outsource → outsourced (已外包)
    │       │               ├─→ complete → completed
    │       │               └─→ take_back → processing
    │       └─→ outsource → outsourced
    └─→ cancel → cancelled (已取消)
```

## API 接口文档

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 系统信息 |
| GET | `/health` | 健康检查 |

### 处理人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/handlers/` | 创建处理人 |
| GET | `/api/handlers/` | 查询处理人列表 |

### 报修工单管理

#### 创建工单
```bash
curl -X POST "http://localhost:8000/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "building": "1号楼",
    "room_number": "101",
    "repair_type": "水电维修",
    "description": "卫生间水龙头漏水",
    "contact_name": "张三",
    "contact_phone": "13800138000",
    "priority": "normal",
    "sla_hours": 24
  }'
```

#### 查询工单
```bash
curl -X POST "http://localhost:8000/api/orders/query" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending",
    "is_overdue": true,
    "page": 1,
    "page_size": 20
  }'
```

#### 获取单个工单
```bash
curl "http://localhost:8000/api/orders/1"
```

#### 添加工单催办
```bash
curl -X POST "http://localhost:8000/api/orders/1/reminders" \
  -H "Content-Type: application/json" \
  -d '{
    "reminder_type": "urgent",
    "content": "漏水越来越严重了，请尽快处理",
    "reminded_by": "业主张三"
  }'
```

#### 状态推进 - 派单
```bash
curl -X POST "http://localhost:8000/api/orders/1/advance/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "物业管理员",
    "handler_id": 1,
    "notes": "请尽快上门维修",
    "original_request": "业主要求今天内必须修好",
    "conclusion": "已派单给张工，要求今天内完成"
  }'
```

#### 状态推进 - 开始处理
```bash
curl -X POST "http://localhost:8000/api/orders/1/advance/start" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "张工",
    "notes": "已到达现场，开始维修"
  }'
```

#### 状态推进 - 完工
```bash
curl -X POST "http://localhost:8000/api/orders/1/advance/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "张工",
    "notes": "水龙头已更换，维修完成"
  }'
```

#### 人工修正状态（异常路径）
```bash
curl -X POST "http://localhost:8000/api/orders/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "系统管理员",
    "new_status": "processing",
    "notes": "系统状态异常，人工修正",
    "original_request": "派单后处理人未收到通知",
    "conclusion": "已手动将状态改为处理中，并通知处理人"
  }'
```

#### 关闭/撤回工单
```bash
curl -X POST "http://localhost:8000/api/orders/1/close" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "物业管理员",
    "reason": "业主自行购买配件已修好",
    "original_request": "业主来电说不用来了",
    "conclusion": "工单关闭，无需上门"
  }'
```

### 外包管理

#### 转外包
```bash
curl -X POST "http://localhost:8000/api/orders/1/outsource?operated_by=物业管理员" \
  -H "Content-Type: application/json" \
  -d '{
    "outsource_company_id": 4,
    "estimated_cost": 250.0,
    "notes": "专业电路维修，需要持证电工"
  }'
```

### 完工复核

#### 提交完工证明
```bash
curl -X POST "http://localhost:8000/api/orders/1/completion-proof" \
  -H "Content-Type: application/json" \
  -d '{
    "proof_type": "photo",
    "proof_url": "http://example.com/photos/123.jpg",
    "description": "维修前后对比照片，业主签字确认"
  }'
```

#### 复核完工
```bash
curl -X POST "http://localhost:8000/api/orders/1/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "verified_by": "物业经理",
    "is_verified": true,
    "verification_notes": "照片齐全，已电话回访业主确认维修满意"
  }'
```

### 重复催办合并

#### 查询可合并的候选工单
```bash
curl "http://localhost:8000/api/orders/1/merge-candidates"
```

#### 合并工单
```bash
curl -X POST "http://localhost:8000/api/orders/2/merge" \
  -H "Content-Type: application/json" \
  -d '{
    "operated_by": "物业管理员",
    "merge_into_order_id": 1,
    "notes": "同一房号同一问题，合并处理"
  }'
```

### 超时批量检查
```bash
curl -X POST "http://localhost:8000/api/orders/batch-check-overdue"
```

### 数据导出
```bash
curl -X POST "http://localhost:8000/api/orders/export" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending",
    "is_overdue": true,
    "export_type": "excel"
  }'
```

## 核心业务规则

### 超时规则
- 工单创建时根据 SLA 时长自动计算预计完成时间
- 查询工单时自动检查是否超时并更新状态
- 支持批量检查所有活跃工单的超时状态
- 已完成/已关闭的工单不再计算超时

### 重复催办检测
- 30分钟内内容相似度超过70%的催办自动标记为重复
- 记录重复催办的关联关系
- 催办次数累加统计

### 工单合并规则
- 24小时内同一房号的相似工单可以合并
- 合并后源工单标记为已合并并关闭
- 催办次数累加到目标工单
- 所有状态变更都有日志记录

### 状态流转规则
- 严格的状态机控制
- 只有特定的状态转换是允许的
- 人工修正可以绕过状态机限制（需记录原因）

### 异常路径处理
- 所有状态变更都保留原始请求、操作人、处理结论
- 人工修正需注明原因
- 工单关闭需记录关闭理由

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI 应用入口
│   ├── database.py       # 数据库配置
│   ├── models.py         # SQLAlchemy 模型
│   ├── schemas.py        # Pydantic 数据模型
│   ├── crud.py           # 数据库操作
│   ├── rules.py          # 业务规则引擎
│   └── routers.py        # API 路由
├── generate_test_data.py # 测试数据生成
├── test_main.py          # pytest 测试用例
├── requirements.txt      # 依赖包
└── README.md             # 本文档
```

## 运行测试

```bash
# 运行所有测试
pytest test_main.py -v

# 运行特定测试
pytest test_main.py::test_create_repair_order -v

# 生成测试覆盖率报告
pytest test_main.py --cov=app --cov-report=html
```

## 常见问题

### Q: 如何修改 SLA 时间？
A: 创建工单时通过 `sla_hours` 参数指定，也可以通过人工修正功能调整。

### Q: 外包商和内部处理人有什么区别？
A: 通过 `is_outsource` 字段区分，转外包时必须选择外包商。

### Q: 催办的重复检测时间窗口可以调整吗？
A: 可以修改 `rules.py` 中 `check_duplicate_reminder` 函数的 `window_minutes` 参数。

### Q: 数据导出支持哪些格式？
A: 当前接口返回 JSON 格式数据，前端可根据需要转换为 Excel 等格式。

## License

MIT
