# 任务重跑预算 API

管理任务重跑预算，按失败原因和时间窗口限制重跑次数，防止同一批次无限重跑拖垮队列。

## 核心特性

- **重跑预算控制**: 按失败原因和时间窗口限制最大重跑次数
- **原因分组**: 同一批次不同失败原因独立计算预算
- **窗口扣减**: 时间窗口自动重置已使用预算
- **拒绝归因**: 保留完整拒绝记录，包含原始请求和处理上下文
- **摘要导出**: 导出完整重跑历史数据
- **人工修正**: 支持管理员手动调整预算和状态
- **防重复提交**: 同一进行中重跑不会被重复批准

## 数据模型

### TaskBatch (任务批次)
- batch_id: 批次唯一标识
- task_type: 任务类型
- total_tasks: 总任务数
- failed_count: 失败任务数
- status: 批次状态 (pending, rerunning, completed, failed)
- metadata: 扩展元数据

### FailureReason (失败原因)
- reason_code: 原因代码
- reason_message: 原因描述
- count: 失败数量
- task_ids: 相关任务ID列表
- first_failed_at: 首次失败时间
- last_failed_at: 最后失败时间

### RerunBudget (重跑预算)
- reason_code: 关联失败原因
- budget_window_hours: 预算窗口时长（小时）
- max_reruns: 最大重跑次数
- used_reruns: 已使用次数
- window_start: 窗口开始时间
- window_end: 窗口结束时间
- is_active: 是否激活

### RejectionRecord (拒绝记录)
- reason_code: 关联失败原因
- rejection_reason: 拒绝原因描述
- original_request: 原始请求数据
- processing_context: 处理上下文
- rejected_at: 拒绝时间
- rejected_by: 拒绝操作者

### RerunSummary (重跑摘要)
- reason_code: 关联失败原因
- rerun_number: 第几次重跑
- status: 重跑状态 (initiated, in_progress, completed, failed)
- tasks_submitted: 提交重跑的任务数
- tasks_succeeded: 成功任务数
- tasks_failed: 失败任务数
- result_metadata: 结果元数据

## API 接口

### 基础路径: `/api/v1/rerun-budget`

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/batches` | 创建任务批次 |
| GET | `/batches` | 列出批次列表 |
| GET | `/batches/{batch_id}` | 获取批次详情 |
| PATCH | `/batches/{batch_id}` | 更新批次信息 |
| POST | `/batches/{batch_id}/failure-reasons` | 添加失败原因 |
| POST | `/batches/{batch_id}/budgets` | 创建重跑预算 |
| GET | `/budgets/check/{batch_id}/{reason_code}` | 检查预算状态 |
| POST | `/request` | 请求重跑 |
| POST | `/status` | 更新重跑状态 |
| POST | `/manual-correction` | 人工修正 |
| POST | `/export` | 导出数据 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务启动后访问:
- API 文档 (Swagger UI): http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

### 3. 运行集成测试

```bash
python test_api.py
```

## 使用示例

### 创建任务批次

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "import_20240517_001",
    "task_type": "data_import",
    "total_tasks": 1000,
    "metadata": {"source": "s3://bucket/data"}
  }'
```

### 添加失败原因

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/batches/import_20240517_001/failure-reasons" \
  -H "Content-Type: application/json" \
  -d '{
    "reason_code": "network_timeout",
    "reason_message": "连接超时，无法连接到数据源",
    "count": 15,
    "task_ids": ["task_001", "task_002", "..."]
  }'
```

### 创建重跑预算

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/batches/import_20240517_001/budgets" \
  -H "Content-Type: application/json" \
  -d '{
    "reason_code": "network_timeout",
    "budget_window_hours": 24,
    "max_reruns": 3
  }'
```

### 请求重跑

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/request" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "import_20240517_001",
    "reason_code": "network_timeout",
    "task_ids": ["task_001", "task_002", "task_003"],
    "requested_by": "automation_system"
  }'
```

### 更新重跑状态

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/status" \
  -H "Content-Type: application/json" \
  -d '{
    "summary_id": 1,
    "status": "completed",
    "tasks_succeeded": 15,
    "tasks_failed": 0,
    "result_metadata": {"duration": "300s", "retries": 2}
  }'
```

### 人工修正（重置预算）

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "import_20240517_001",
    "reason_code": "network_timeout",
    "adjustment_type": "reset_budget",
    "adjustment_value": 0,
    "corrected_by": "admin",
    "comment": "紧急业务需求，需要额外重跑机会"
  }'
```

支持的调整类型:
- `reset_budget`: 重置已使用预算为0
- `increase_budget`: 增加最大重跑次数
- `set_batch_status`: 设置批次状态
- `force_approve_rerun`: 强制批准重跑（回滚预算计数）

### 导出数据

```bash
curl -X POST "http://localhost:8000/api/v1/rerun-budget/export" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_ids": ["import_20240517_001"],
    "reason_codes": ["network_timeout"],
    "status": "completed"
  }'
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── core/
│   │   └── database.py      # 数据库配置
│   ├── models/              # SQLAlchemy 数据模型
│   ├── schemas/             # Pydantic 数据验证
│   ├── services/            # 业务逻辑服务
│   └── api/                 # API 路由
├── requirements.txt         # Python 依赖
├── test_api.py              # 集成测试脚本
└── rerun_budget.db          # SQLite 数据库（自动生成）
```

## 核心业务规则

1. **预算控制**: 同一批次+同一原因，在预算窗口内最多重跑N次
2. **窗口重置**: 预算窗口结束后自动重置已使用次数
3. **防重复**: 同一重跑进行中时，重复请求会被拒绝
4. **审计追踪**: 所有拒绝记录保留原始请求和处理上下文
5. **原因隔离**: 不同失败原因的预算独立计算
6. **人工干预**: 支持管理员手动调整预算，支持备注说明
