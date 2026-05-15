# 事件重放审批后端服务

基于 FastAPI + SQLAlchemy 构建的事件重放审批系统，用于网关错误摘录的重放校验和审批流程管理。

## 核心功能

### 1. 网关错误摘录管理
- 支持批量导入网关错误记录
- 保留所有原始字段数据
- 支持按批次、Trace ID、错误码查询

### 2. 事件重放引擎
- **审批意见缺失拦截**：重点校验 `approval_opinion` 字段，为空时自动拦截并说明原因
- 可配置规则引擎：支持自定义校验规则和版本管理
- 逐条记录处理结果，不整批标记
- 支持部分成功状态（`partial_success`）

### 3. 统一查询入口
- 同一查询接口可查看成功、失败、被拦截的所有记录
- 支持按批次ID、状态、Trace ID、错误码筛选
- 分页查询，关联原始错误摘录详情

### 4. 报告生成
- **处理前后对比**：处理前和处理后的字段分布统计
- **执行时间统计**：总执行时间和单条平均耗时
- **下一步建议**：根据拦截原因自动生成优先级建议

### 5. 规则版本管理
- 规则变更自动版本化
- 旧批次可追溯当时使用的规则口径
- 支持指定规则版本进行重放

### 6. 审批审计追踪
- 人工审批不直接覆盖结论，保留完整变更记录
- 支持关联责任团队的仓库交接单
- 可追溯原始审批凭证和交接记录

## 项目结构

```
.
├── main.py                 # 应用入口
├── database.py             # 数据库配置
├── models.py               # 数据模型定义
├── schemas.py              # Pydantic Schemas
├── replay_engine.py        # 重放核心引擎
├── requirements.txt        # 依赖配置
├── api/
│   ├── __init__.py
│   ├── gateway.py          # 网关错误摘录API
│   ├── replay.py           # 重放和批次API
│   ├── approval.py         # 审批和交接单API
│   └── reports.py          # 报告生成API
└── event_replay.db         # SQLite数据库（自动生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 使用流程

### 完整工作流示例

#### 1. 创建批次并导入错误摘录

```bash
POST /api/replay/batches
{
  "batch_number": "BATCH-2024-001",
  "created_by": "admin",
  "error_extracts": [
    {
      "trace_id": "trace-001",
      "request_id": "req-001",
      "error_code": "E500",
      "error_message": "Internal Server Error",
      "request_path": "/api/data",
      "request_method": "POST",
      "request_headers": {"Content-Type": "application/json"},
      "request_body": {"data": "test"},
      "response_status": 500,
      "response_body": {"error": "server error"},
      "timestamp": "2024-01-15T10:00:00",
      "service_name": "order-service",
      "upstream_service": "gateway",
      "approval_opinion": "",
      "approval_status": "pending",
      "raw_data": {"original": "data"}
    }
  ]
}
```

#### 2. 执行事件重放

```bash
POST /api/replay/replay
{
  "batch_id": 1
}
```

#### 3. 查询批次详情（含所有路径结果）

```bash
GET /api/replay/batches/1
```

返回内容包含：
- 成功通过的记录列表
- 被拦截的记录列表（含拦截原因）
- 失败的记录列表
- 关联的审批记录

#### 4. 生成处理报告

```bash
POST /api/reports
{
  "batch_id": 1,
  "report_type": "replay_summary"
}
```

查看处理对比和下一步建议：
```bash
GET /api/reports/1/comparison
GET /api/reports/1/next-steps
```

#### 5. 创建仓库交接单并审批

```bash
# 创建仓库交接单
POST /api/approvals/warehouse-handovers
{
  "handover_number": "HANDOVER-001",
  "responsibility_team": "team-a",
  "original_records": {"source": "git", "commit": "abc123"},
  "handover_note": "补充审批意见的原始记录",
  "handed_by": "user1",
  "received_by": "user2",
  "handed_at": "2024-01-15T14:00:00"
}

# 执行审批（关联交接单）
POST /api/approval/
{
  "replay_result_id": 1,
  "action": "approve",
  "comment": "已核实原始记录，审批通过",
  "approved_by": "admin",
  "responsibility_team": "team-a",
  "warehouse_handover_id": 1
}
```

## 核心数据模型

### Batch（批次）
- `batch_number`: 批次编号
- `status`: 状态（pending/processing/partial_success/success/failed/approval_required）
- `rule_version_id`: 使用的规则版本ID
- 统计字段：总数、成功数、失败数、拦截数、执行时间

### ReplayResult（重放结果）
- `status`: 处理状态（success/failed/blocked/approved/rejected）
- `before_data`: 处理前数据快照
- `after_data`: 处理后数据快照
- `block_reason`: 拦截原因说明
- `approval_opinion_missing`: 是否因审批意见缺失被拦截
- `matched_rules`: 匹配的规则列表

### RuleVersion（规则版本）
- `version`: 版本号
- `rules`: 规则配置JSON
- `effective_from`/`effective_to`: 生效时间范围
- `is_active`: 是否当前激活版本

## 拦截代码说明

| 拦截代码 | 说明 | 优先级 |
|---------|------|--------|
| APPR_OPINION_001 | 审批意见字段为空或缺失 | 高 |
| ERR_CODE_001 | 错误码字段缺失 | 中 |
| TRACE_ID_001 | Trace ID缺失（警告，不拦截） | 低 |

## 数据库初始化

首次启动应用时，SQLAlchemy 会自动创建所有数据表。

如需手动初始化：
```python
from database import engine, Base
from models import *
Base.metadata.create_all(bind=engine)
```
