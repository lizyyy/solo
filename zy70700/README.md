# MCP工具权限声明后端API

MCP工具权限声明与实际调用比对后端服务，支持审批批次管理、异常复核、审计摘要导出。

## 技术栈

- **FastAPI** - Web框架
- **SQLAlchemy** - ORM
- **SQLite** - 数据库
- **pytest** - 测试框架

## 项目结构

```
mcp-permission-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── core/
│   │   ├── __init__.py
│   │   └── database.py      # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # 数据库模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic数据模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── permission_service.py  # 权限比对服务
│   │   ├── approval_service.py    # 审批服务
│   │   ├── exception_service.py   # 异常处理服务
│   │   ├── audit_service.py       # 审计服务
│   │   └── tool_service.py        # 工具服务
│   └── api/
│       ├── __init__.py
│       ├── tools.py         # 工具API
│       ├── permissions.py   # 权限声明API
│       ├── calls.py         # 实际调用API
│       ├── approvals.py     # 审批批次API
│       ├── exceptions.py    # 异常记录API
│       └── audit.py         # 审计摘要API
├── scripts/
│   └── seed_data.py         # 造数脚本
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # pytest配置
│   └── test_api.py          # API测试用例
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
# 或者使用poetry
poetry install
```

### 2. 启动服务

```bash
# 直接启动
python -m app.main

# 或使用uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- Redoc文档: http://localhost:8000/redoc

### 3. 造数

```bash
python scripts/seed_data.py
```

造数脚本会创建:
- 4个MCP工具
- 1个审批批次
- 4个权限声明
- 5个实际调用记录
- 2个异常记录

## 核心功能

### 1. 工具管理

- 创建/查询/更新工具
- 按MCP服务器筛选
- 工具停用

### 2. 权限声明

- 创建权限声明
- 关联审批批次
- 权限声明比对
- 声明状态管理

### 3. 实际调用

- 记录工具实际调用
- 调用范围归档
- 幂等性保证（call_id去重）

### 4. 审批批次

- 创建审批批次
- 批次审批/拒绝/撤回/关闭
- 批量关联权限声明
- 幂等审批保证

### 5. 异常处理

- 异常记录创建
- 人工复核
- 异常解决/驳回
- 保留原始输入和处理结论

### 6. 审计摘要

- 生成指定时间段审计摘要
- 统计工具、声明、调用、异常数量
- 审计摘要导出

## API使用示例 (curl)

### 基础检查

```bash
# 健康检查
curl http://localhost:8000/health

# 获取API信息
curl http://localhost:8000/
```

### 工具管理

```bash
# 创建工具
curl -X POST http://localhost:8000/api/v1/tools/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_tool",
    "mcp_server": "test_server",
    "description": "测试工具",
    "version": "1.0.0",
    "status": "active"
  }'

# 查询所有工具
curl http://localhost:8000/api/v1/tools/

# 查询单个工具
curl http://localhost:8000/api/v1/tools/1

# 更新工具
curl -X PUT http://localhost:8000/api/v1/tools/1 \
  -H "Content-Type: application/json" \
  -d '{"description": "更新后的描述"}'

# 停用工具
curl -X DELETE http://localhost:8000/api/v1/tools/1
```

### 权限声明

```bash
# 创建权限声明
curl -X POST http://localhost:8000/api/v1/permissions/ \
  -H "Content-Type: application/json" \
  -d '{
    "tool_id": 1,
    "batch_id": 1,
    "declared_scopes": ["read:local", "write:local"],
    "declared_resources": ["/data"],
    "declared_actions": ["read_file", "write_file"],
    "declared_description": "测试权限声明",
    "declared_by": "admin@example.com"
  }'

# 权限比对
curl -X POST http://localhost:8000/api/v1/permissions/1/compare
```

### 实际调用

```bash
# 记录调用
curl -X POST http://localhost:8000/api/v1/calls/ \
  -H "Content-Type: application/json" \
  -d '{
    "tool_id": 1,
    "call_id": "call_001",
    "actual_scopes": ["read:local"],
    "actual_resources": ["/data/file.txt"],
    "actual_actions": ["read_file"],
    "caller": "user@example.com"
  }'

# 归档调用
curl -X POST http://localhost:8000/api/v1/calls/call_001/archive
```

### 审批批次

```bash
# 创建审批批次
curl -X POST http://localhost:8000/api/v1/approvals/ \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "BATCH-001",
    "title": "第一季度权限审批",
    "description": "第一季度所有MCP工具权限审批",
    "submitter": "admin@example.com"
  }'

# 审批批次
curl -X POST http://localhost:8000/api/v1/approvals/approve \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "BATCH-001",
    "approver": "approver@example.com",
    "notes": "审批通过"
  }'

# 拒绝批次
curl -X POST http://localhost:8000/api/v1/approvals/1/reject \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "operator": "reviewer@example.com",
    "notes": "权限范围过大"
  }'

# 撤回批次
curl -X POST http://localhost:8000/api/v1/approvals/1/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "status": "revoked",
    "operator": "admin@example.com",
    "notes": "需要重新审核"
  }'

# 关闭批次
curl -X POST http://localhost:8000/api/v1/approvals/1/close \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed",
    "operator": "admin@example.com",
    "notes": "批次已关闭"
  }'
```

### 异常处理

```bash
# 创建异常记录
curl -X POST http://localhost:8000/api/v1/exceptions/ \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "tool_id": 1,
    "title": "权限范围不匹配",
    "description": "工具实际使用了未声明的权限",
    "exception_type": "scope_mismatch",
    "original_input": {"call_id": "call_001", "actual_scopes": ["extra:scope"]}
  }'

# 解决异常
curl -X POST http://localhost:8000/api/v1/exceptions/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "handler": "reviewer@example.com",
    "handling_conclusion": "已更新权限声明",
    "handling_notes": "添加了缺失的权限范围"
  }'

# 驳回异常
curl -X POST http://localhost:8000/api/v1/exceptions/1/dismiss \
  -H "Content-Type: application/json" \
  -d '{
    "status": "dismissed",
    "handler": "admin@example.com",
    "handling_conclusion": "误报",
    "handling_notes": "该范围在允许列表中"
  }'
```

### 审计摘要

```bash
# 生成审计摘要
curl -X POST http://localhost:8000/api/v1/audit/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "summary_id": "AUDIT-2024-Q1",
    "title": "2024年第一季度审计摘要",
    "audit_period_start": "2024-01-01T00:00:00",
    "audit_period_end": "2024-03-31T23:59:59",
    "generated_by": "admin@example.com"
  }'

# 导出审计摘要
curl -X POST http://localhost:8000/api/v1/audit/summaries/AUDIT-2024-Q1/export
```

## 冲突路径说明

### 1. 重复批次编号

**问题**: 创建审批批次时使用已存在的批次编号

**处理**: 系统会返回已存在的批次（幂等性保证），不会创建重复记录

```bash
# 第一次创建成功
curl -X POST http://localhost:8000/api/v1/approvals/ \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "TEST-001", "title": "测试批次", "submitter": "admin@example.com"}'

# 第二次创建返回相同记录，不会报错
curl -X POST http://localhost:8000/api/v1/approvals/ \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "TEST-001", "title": "另一个标题", "submitter": "admin@example.com"}'
```

### 2. 重复调用ID

**问题**: 记录实际调用时使用已存在的call_id

**处理**: 系统返回已存在的调用记录，不会创建重复记录

### 3. 重复审批操作

**问题**: 对已批准的批次再次调用批准接口

**处理**: 系统返回当前状态，不会重复执行审批逻辑

### 4. 权限比对无调用数据

**问题**: 比对权限时工具没有实际调用记录

**处理**: 返回match_status="unchecked"，score=0，原因说明"no_actual_calls"

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示详情
pytest -v

# 运行特定测试文件
pytest tests/test_api.py

# 运行特定测试类
pytest tests/test_api.py::TestTools

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

## 数据模型说明

### 核心实体关系

```
工具 (Tool)
  └── 权限声明 (PermissionDeclaration)
        └── 审批批次 (ApprovalBatch)
  └── 实际调用 (ActualCall)
  └── 异常记录 (ExceptionRecord)
        └── 审批批次 (ApprovalBatch)

审计摘要 (AuditSummary) - 独立统计实体
```

### 状态枚举

- **ToolStatus**: active/inactive/deprecated
- **ApprovalStatus**: pending/approved/rejected/revoked/closed
- **ExceptionStatus**: open/reviewing/resolved/dismissed
- **MatchStatus**: matched/mismatched/partial/unchecked

## 核心业务规则

1. **权限比对算法**: 基于集合相似度计算，匹配度=交集/并集 × 100
2. **幂等审批保证**: 同一批次编号多次审批只会生效一次
3. **异常审计追踪**: 所有异常操作保留处理人、处理时间、处理结论
4. **调用归档不可改**: 已归档的调用记录无法修改

## License

MIT
