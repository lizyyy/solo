# 灰度指标缺口回填覆盖保护后端API

灰度发布结束后发现指标缺了一段，研发想补回数据又怕覆盖真实观测结果，本系统提供完整的解决方案。

## 核心功能

- **窗口校验**：确保指标时间窗口和缺口时间范围的有效性
- **回填去重**：基于数据哈希防止重复回填
- **覆盖保护**：三种策略（PROTECT保护 / MERGE合并 / FORCE强制）
- **审核状态机**：完整的状态流转（待审批 -> 审批中 -> 已批准 -> 处理中 -> 已完成）
- **快照导出**：所有操作结果生成可复查的快照数据
- **异常记录**：完整记录异常路径、原始输入、处理人、处理结论

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **测试**: pytest + httpx

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 初始化测试数据

```bash
python scripts/seed_data.py
```

## 主流程 curl 示例

### 1. 创建灰度批次

```bash
curl -X POST "http://localhost:8000/api/v1/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_code": "GRAY-2024-001",
    "batch_name": "灰度发布v2.0指标补全",
    "description": "2024年5月15日灰度发布期间部分监控指标缺失",
    "override_strategy": "protect",
    "created_by": "dev_ops_001"
  }'
```

### 2. 创建指标窗口

```bash
curl -X POST "http://localhost:8000/api/v1/metric-windows/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "metric_name": "request_latency_p99",
    "window_start": "2024-05-15T10:00:00",
    "window_end": "2024-05-15T12:00:00",
    "tags": "{\"service\": \"order-service\", \"env\": \"prod\"}"
  }'
```

### 3. 创建缺口片段

```bash
curl -X POST "http://localhost:8000/api/v1/gap-segments/" \
  -H "Content-Type: application/json" \
  -d '{
    "metric_window_id": 1,
    "gap_type": "missing",
    "gap_start": "2024-05-15T10:30:00",
    "gap_end": "2024-05-15T11:00:00",
    "expected_points": 180,
    "actual_points": 0
  }'
```

### 4. 添加回填来源

```bash
curl -X POST "http://localhost:8000/api/v1/backfill-sources/" \
  -H "Content-Type: application/json" \
  -d '{
    "gap_segment_id": 1,
    "source_type": "log_replay",
    "source_name": "nginx访问日志重放",
    "source_config": "{\"log_path\": \"/var/log/nginx/access.log\", \"time_range\": \"2024-05-15 10:30-11:00\"}",
    "data_hash": "a1b2c3d4e5f67890",
    "record_count": 180
  }'
```

### 5. 状态流转（提审 -> 审批通过 -> 执行）

```bash
# 提审
curl -X POST "http://localhost:8000/api/v1/batches/1/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "approving",
    "operator": "dev_ops_001",
    "comment": "申请审批，缺口数据已确认"
  }'

# 审批通过
curl -X POST "http://localhost:8000/api/v1/batches/1/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "approved",
    "operator": "tech_lead_001",
    "comment": "审批通过，策略合理"
  }'

# 执行回填
curl -X POST "http://localhost:8000/api/v1/batches/1/process?operator=dev_ops_001"
```

### 6. 查询结果与导出快照

```bash
# 查询批次详情
curl "http://localhost:8000/api/v1/batches/1"

# 列出快照
curl "http://localhost:8000/api/v1/snapshots/?batch_id=1"

# 导出快照
curl "http://localhost:8000/api/v1/snapshots/1/export"
```

## 冲突路径示例

### 1. 创建重叠的缺口（应该失败）

```bash
curl -X POST "http://localhost:8000/api/v1/gap-segments/" \
  -H "Content-Type: application/json" \
  -d '{
    "metric_window_id": 1,
    "gap_type": "missing",
    "gap_start": "2024-05-15T10:45:00",
    "gap_end": "2024-05-15T11:15:00",
    "expected_points": 90,
    "actual_points": 0
  }'

# 预期返回 400 Bad Request: 发现1个重叠的缺口片段
```

### 2. 非法状态转换（应该失败）

```bash
# 从 pending 直接跳到 completed 是不允许的
curl -X POST "http://localhost:8000/api/v1/batches/1/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "completed",
    "operator": "dev_ops_001",
    "comment": "跳过审批直接完成"
  }'

# 预期返回 400 Bad Request: 不允许从 pending 状态转换到 completed 状态
```

### 3. 重复回填相同哈希的数据（应该失败）

```bash
curl -X POST "http://localhost:8000/api/v1/backfill-sources/" \
  -H "Content-Type: application/json" \
  -d '{
    "gap_segment_id": 1,
    "source_type": "log_replay",
    "source_name": "重复尝试",
    "data_hash": "a1b2c3d4e5f67890",
    "record_count": 180
  }'

# 预期返回 400 Bad Request: 相同数据哈希的回填已存在，ID: 1
```

### 4. 无效的时间窗口（结束时间早于开始时间）

```bash
curl -X POST "http://localhost:8000/api/v1/metric-windows/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "metric_name": "test_metric",
    "window_start": "2024-05-15T12:00:00",
    "window_end": "2024-05-15T10:00:00"
  }'

# 预期返回 400 Bad Request: 窗口结束时间必须大于开始时间
```

### 5. 缺口超出指标窗口范围（应该失败）

```bash
curl -X POST "http://localhost:8000/api/v1/gap-segments/" \
  -H "Content-Type: application/json" \
  -d '{
    "metric_window_id": 1,
    "gap_type": "missing",
    "gap_start": "2024-05-15T09:00:00",
    "gap_end": "2024-05-15T10:30:00",
    "expected_points": 90,
    "actual_points": 0
  }'

# 预期返回 400 Bad Request: 缺口时间范围必须在指标窗口范围内
```

## 状态机说明

```
pending (待审批)
    ├──> approving (审批中)
    │       ├──> approved (已批准)
    │       │       ├──> processing (处理中)
    │       │       │       └──> completed (已完成)
    │       │       │               └──> rollbacked (已回滚)
    │       │       └──> cancelled (已取消)
    │       └──> rejected (已拒绝)
    └──> cancelled (已取消)
```

## 覆盖策略说明

| 策略 | 说明 | 场景 |
|------|------|------|
| PROTECT | 保护模式，不覆盖已有数据 | 高优先级业务，数据完整性优先 |
| MERGE | 合并模式，新旧数据合并 | 需要保留原始数据，同时补充缺失 |
| FORCE | 强制模式，覆盖已有数据 | 确认原始数据有误，需要替换 |

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_batch.py -v

# 生成覆盖率报告
pytest tests/ --cov=app --cov-report=html
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 主入口
│   ├── database.py             # 数据库配置
│   ├── models/                 # SQLAlchemy 数据模型
│   │   ├── __init__.py
│   │   └── models.py
│   ├── schemas/                # Pydantic 数据结构
│   │   ├── __init__.py
│   │   └── schemas.py
│   ├── services/               # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── batch_service.py
│   │   ├── window_service.py
│   │   ├── validation_service.py
│   │   ├── audit_service.py
│   │   ├── snapshot_service.py
│   │   └── exception_service.py
│   └── api/                    # API 路由
│       ├── __init__.py
│       └── v1.py
├── tests/                      # 测试用例
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_batch.py
│   ├── test_window.py
│   ├── test_validation.py
│   └── test_workflow.py
├── scripts/                    # 脚本工具
│   └── seed_data.py            # 测试数据生成
├── requirements.txt
├── README.md
└── .gitignore
```

## 核心 API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/batches/ | 创建灰度批次 |
| GET | /api/v1/batches/ | 查询批次列表 |
| GET | /api/v1/batches/{id} | 查询批次详情 |
| POST | /api/v1/batches/{id}/transition | 状态流转 |
| POST | /api/v1/batches/{id}/process | 执行回填处理 |
| POST | /api/v1/batches/{id}/cancel | 取消批次 |
| POST | /api/v1/batches/{id}/rollback | 回滚批次 |
| POST | /api/v1/metric-windows/ | 创建指标窗口 |
| POST | /api/v1/gap-segments/ | 创建缺口片段 |
| POST | /api/v1/backfill-sources/ | 创建回填来源 |
| GET | /api/v1/audit-records/ | 查询审核记录 |
| POST | /api/v1/manual-correction | 人工修正 |
| GET | /api/v1/snapshots/ | 查询快照列表 |
| GET | /api/v1/snapshots/{id}/export | 导出快照 |
| GET | /api/v1/exception-logs/ | 查询异常日志 |
| POST | /api/v1/exception-logs/{id}/handle | 处理异常 |

## 异常处理

所有异常操作都会被完整记录，包括：
- 操作类型
- 原始输入（JSON格式）
- 错误信息
- 关联批次ID
- 处理人
- 处理结论
- 处理时间

这确保了所有异常路径都可追溯和复查。
