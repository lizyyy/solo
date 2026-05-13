# 异步导入回滚服务

统一后端处理链路的批次导入与回滚服务，提供完整的 API 契约、错误处理和可重复调用机制。

## 技术栈

- Python 3.9+
- FastAPI - Web 框架
- SQLAlchemy 2.0 - ORM（异步模式）
- SQLite - 数据库
- Uvicorn - ASGI 服务器

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成示例数据

```bash
python3 scripts/sample_data.py
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 核心概念

### 数据对象

| 对象 | 说明 |
|------|------|
| ImportBatch | 导入批次，包含批次基本信息和状态 |
| ImportItem | 导入明细，单条数据记录 |
| WriteDetail | 写入明细，记录数据库实际写入操作 |
| StageRecord | 阶段记录，追踪每个处理阶段的状态 |
| RollbackPlan | 回滚计划，定义回滚范围和策略 |
| RollbackItem | 回滚明细，单条回滚操作记录 |
| RollbackReport | 回滚报告，执行结果汇总 |

### 处理阶段 (StageType)

1. `validation` - 数据校验阶段
2. `data_prepare` - 数据准备阶段
3. `write_main` - 主表写入阶段
4. `write_related` - 关联表写入阶段
5. `post_process` - 后处理阶段
6. `notify` - 通知阶段

### 批次状态 (BatchStatus)

- `pending` - 待处理
- `validating` - 校验中
- `validated` - 校验完成
- `processing` - 处理中
- `partial_success` - 部分成功
- `success` - 全部成功
- `failed` - 处理失败
- `rollback_planned` - 回滚计划已创建
- `rolling_back` - 回滚执行中
- `rolled_back` - 已回滚

## API 使用指南

### 1. 创建导入批次

```bash
POST /api/v1/batches/
```

请求体示例:
```json
{
  "batch": {
    "batch_no": "BATCH-TEST-001",
    "source_system": "ERP-SYSTEM",
    "import_type": "USER_IMPORT",
    "idempotent_key": "BATCH-TEST-001-IDEMP",
    "created_by": "admin",
    "extra_metadata": {"import_source": "api"}
  },
  "items": [
    {
      "item_no": "USER-001",
      "item_type": "USER",
      "source_data": {"name": "张三", "email": "zhangsan@example.com"}
    }
  ]
}
```

**幂等性保证**: 相同 `idempotent_key` 重复提交不会创建新数据，直接返回已存在批次。

### 2. 查询批次列表

```bash
GET /api/v1/batches/?source_system=ERP-SYSTEM&status=partial_success&page=1&page_size=20
```

### 3. 查询批次详情

```bash
GET /api/v1/batches/BATCH-2024-001
```

### 4. 推进处理阶段

```bash
# 开始阶段
POST /api/v1/batches/1/stages/write_main/start

# 完成阶段（成功）
POST /api/v1/batches/1/stages/write_main/complete?success=true

# 完成阶段（失败）
POST /api/v1/batches/1/stages/write_main/complete?success=false&error_message=数据格式错误
```

### 5. 更新批次状态

```bash
PATCH /api/v1/batches/1/status
```

请求体:
```json
{
  "status": "partial_success",
  "stage": "write_main",
  "error_message": "部分数据写入失败"
}
```

### 6. 创建回滚计划

```bash
POST /api/v1/batches/1/rollback/plan
```

请求体:
```json
{
  "reason": "用户数据导入错误需要撤销",
  "strategy": "reverse_order"
}
```

### 7. 执行回滚

```bash
POST /api/v1/batches/rollback/1/execute
```

### 8. 查看回滚报告

```bash
GET /api/v1/batches/1/rollback/report
```

## 测试场景

### 造数据

```bash
# 使用脚本生成示例数据
python3 scripts/sample_data.py
```

脚本会创建:
- **BATCH-2024-001**: 部分成功批次（3条数据，2成功1失败），包含写入明细，可用于回滚测试
- **BATCH-2024-002**: 完全成功批次（5条数据）

### 触发异常场景

#### 场景 1: 重复提交（幂等性测试）

```bash
# 第一次提交（正常创建）
curl -X POST http://localhost:8000/api/v1/batches/ \
  -H "Content-Type: application/json" \
  -d '{"batch": {"batch_no": "TEST-001", "source_system": "TEST", "import_type": "TEST", "idempotent_key": "TEST-IDEMP-001", "created_by": "admin"}, "items": []}'

# 第二次提交（相同 idempotent_key，不会重复创建）
curl -X POST http://localhost:8000/api/v1/batches/ \
  -H "Content-Type: application/json" \
  -d '{"batch": {"batch_no": "TEST-001", "source_system": "TEST", "import_type": "TEST", "idempotent_key": "TEST-IDEMP-001", "created_by": "admin"}, "items": []}'
```

#### 场景 2: 批次号冲突

```bash
# 相同 batch_no 但不同 idempotent_key，返回 409 冲突
curl -X POST http://localhost:8000/api/v1/batches/ \
  -H "Content-Type: application/json" \
  -d '{"batch": {"batch_no": "BATCH-2024-001", "source_system": "TEST", "import_type": "TEST", "idempotent_key": "DIFFERENT-KEY", "created_by": "admin"}, "items": []}'
```

#### 场景 3: 查询不存在的批次

```bash
curl http://localhost:8000/api/v1/batches/NONEXISTENT
# 返回 404: {"code": "BATCH_NOT_FOUND", "message": "Batch NONEXISTENT not found"}
```

### 查看处理记录

1. **查看批次阶段记录**: `GET /api/v1/batches/BATCH-2024-001`
   - 响应中包含 `stage_records` 数组，显示每个阶段的状态、时间、错误信息

2. **查看写入明细**: 同上，响应中 `items[].write_details` 包含每条数据的实际写入记录

3. **查看回滚历史**: `GET /api/v1/batches/1/rollback/report`
   - 显示回滚执行摘要和每条回滚明细

## 项目结构

```
async-import-rollback-service/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 应用入口
│   ├── api/
│   │   ├── __init__.py
│   │   └── batches.py          # 批次 API 路由
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py         # 数据库配置
│   │   └── models.py           # 数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic 模式
│   └── services/
│       ├── __init__.py
│       ├── batch_service.py    # 批次业务逻辑
│       └── rollback_service.py # 回滚业务逻辑
├── scripts/
│   ├── __init__.py
│   └── sample_data.py          # 示例数据生成脚本
├── requirements.txt
└── README.md
```

## 错误响应格式

所有 API 错误响应统一格式:

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述信息",
  "details": { /* 可选的详细信息 */ },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

常见错误码:
- `DUPLICATE_BATCH_NO` - 批次号已存在
- `BATCH_NOT_FOUND` - 批次不存在
- `STAGE_NOT_FOUND` - 阶段不存在
- `ROLLBACK_PLAN_NOT_FOUND` - 回滚计划不存在
- `REPORT_NOT_GENERATED` - 报告尚未生成

## 核心规则实现

1. **批次写入**: 通过 ImportBatch + ImportItem + WriteDetail 三层记录，确保每一步写入可追溯
2. **阶段记录**: 每个处理阶段独立记录开始/结束时间、状态、错误信息，支持重试
3. **依赖排序**: 回滚时按写入时间倒序执行，先撤销后写入的数据
4. **回滚执行**: RollbackPlan 统一管理，每条回滚操作独立记录状态
5. **撤销报告**: 执行完成后自动生成汇总报告，包含成功/失败明细
