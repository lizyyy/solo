# 灰度指标回填 API 文档

## 概述

灰度指标回填服务用于在灰度发布结束后，发现指标数据缺失时进行数据补全操作。系统提供完整的审核流程、去重保护、覆盖控制和数据导出功能。

**Base URL**: `http://localhost:8080/api/v1`

## 核心数据模型

### 1. GrayscaleBatch (灰度批次)
灰度发布的批次信息，用于组织多个相关的指标窗口。

| 字段 | 类型 | 说明 |
|------|------|------|
| batch_id | string | 批次唯一标识 |
| batch_name | string | 批次名称 |
| description | string | 批次描述 |
| created_at | datetime | 创建时间 |

### 2. MetricWindow (指标窗口)
指标数据的时间范围窗口，绑定到灰度批次。

| 字段 | 类型 | 说明 |
|------|------|------|
| window_id | string | 窗口唯一标识 |
| batch_id | string | 关联批次ID |
| start_time | datetime | 窗口开始时间 |
| end_time | datetime | 窗口结束时间 |
| metric_types | array | 指标类型列表 |
| granularity | string | 数据粒度(默认5m) |
| is_read_only | bool | 是否只读（保护真实观测数据） |

### 3. BackfillTask (回填任务)
核心回填任务实体，包含完整生命周期。

| 字段 | 类型 | 说明 |
|------|------|------|
| backfill_id | string | 任务唯一标识 |
| batch_id | string | 关联批次ID |
| window_id | string | 关联窗口ID |
| status | enum | 当前状态(见状态机) |
| title | string | 任务标题 |
| description | string | 任务描述 |
| creator | string | 创建人 |
| raw_input | JSON | 原始输入参数（保留完整记录） |
| processing_result | JSON | 处理结果数据 |
| failure_reason | string | 失败原因（异常路径） |
| error_details | JSON | 错误详情（异常路径） |
| allow_overwrite | bool | 是否允许覆盖已有数据 |
| deduplication_key | string | 去重键（SHA256） |
| processed_records | int | 已处理记录数 |
| total_records | int | 总记录数 |
| success_records | int | 成功记录数 |
| failed_records | int | 失败记录数 |
| start_time | datetime | 处理开始时间 |
| end_time | datetime | 处理结束时间 |

### 4. GapSegment (缺口片段)
数据缺口的具体时间段信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| segment_id | string | 片段ID |
| backfill_id | string | 关联任务ID |
| start_time | datetime | 缺口开始时间 |
| end_time | datetime | 缺口结束时间 |
| expected_count | int | 期望记录数 |
| actual_count | int | 实际记录数 |
| gap_percent | float | 缺口百分比 |

### 5. BackfillSource (回填来源)
回填数据的来源配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| source_id | string | 来源ID |
| backfill_id | string | 关联任务ID |
| source_type | enum | 来源类型: LOG_REPLAY, MANUAL, API_SYNC, BATCH_IMPORT |
| source_config | JSON | 来源配置参数 |
| connection_info | string | 连接信息 |
| is_available | bool | 是否可用 |

### 6. AuditRecord (审核记录)
完整的状态流转审计轨迹。

| 字段 | 类型 | 说明 |
|------|------|------|
| audit_id | string | 审核ID |
| backfill_id | string | 关联任务ID |
| operator | string | 操作人 |
| from_status | enum | 变更前状态 |
| to_status | enum | 变更后状态 |
| comment | string | 审核意见 |
| audit_time | datetime | 审核时间 |

### 7. ResultSnapshot (结果快照)
处理结果的快照，用于导出和存档。

| 字段 | 类型 | 说明 |
|------|------|------|
| snapshot_id | string | 快照ID |
| backfill_id | string | 关联任务ID |
| snapshot_type | string | 快照类型 |
| content | JSON | 快照内容 |
| record_count | int | 记录数 |
| file_hash | string | 内容哈希（SHA256） |
| exported_at | datetime | 导出时间 |

## 状态机设计

### 状态流转图
```
DRAFT
  ├─→ PENDING_REVIEW (submit)
  └─→ CANCELLED (cancel)

PENDING_REVIEW
  ├─→ APPROVED (approve)
  ├─→ REJECTED (reject)
  └─→ CANCELLED (cancel)

APPROVED
  ├─→ PROCESSING (start)
  └─→ CANCELLED (cancel)

PROCESSING
  ├─→ COMPLETED (complete)
  ├─→ FAILED (fail)
  └─→ CANCELLED (cancel)

FAILED → DRAFT (manual correction)

COMPLETED, REJECTED, CANCELLED → 终态（不可流转）
```

### 状态说明
| 状态 | 说明 | 可执行操作 |
|------|------|----------|
| DRAFT | 草稿状态 | 提交审核、取消 |
| PENDING_REVIEW | 待审核 | 审核通过、拒绝、取消 |
| APPROVED | 已审核通过 | 开始处理、取消 |
| PROCESSING | 处理中 | 完成、标记失败、取消 |
| COMPLETED | 已完成 | 导出、查看 |
| FAILED | 失败 | 人工修正后回退到DRAFT |
| REJECTED | 已拒绝 | 查看 |
| CANCELLED | 已取消 | 查看 |

## 核心业务规则

### 1. 去重机制
- 创建任务时基于 `batch_id + window_id + raw_input` 生成 SHA256 去重键
- 重复创建时返回冲突错误和现有任务信息
- 避免同一数据的重复回填请求

### 2. 覆盖保护
- 指标窗口可标记为 `is_read_only = true` 保护真实观测数据
- 只读窗口不允许覆盖（`allow_overwrite` 必须为 false）
- 覆盖操作需要显式授权（`allow_overwrite = true`）
- 所有覆盖操作记录完整审计日志

### 3. 窗口校验
- 创建窗口时检查时间范围是否与已有窗口重叠
- 回填任务必须关联有效的批次和窗口
- 回填时间范围必须在关联窗口范围内

### 4. 审计追踪
- 每一次状态变更都产生审核记录
- 包含操作人、变更前后状态、操作时间、意见
- 支持追溯完整决策链

## API 接口列表

### 健康检查
```
GET /health
```
**响应示例**:
```json
{
  "status": "ok",
  "time": "2024-02-10T10:00:00Z"
}
```

### 查看状态机规则
```
GET /status-transitions
```

---

### 灰度批次管理

#### 创建批次
```
POST /batches
Content-Type: application/json

{
  "batch_id": "grayscale-2024-q1",
  "batch_name": "2024 Q1 灰度发布批次",
  "description": "第一季度灰度发布"
}
```

---

### 指标窗口管理

#### 创建窗口
```
POST /windows
Content-Type: application/json

{
  "window_id": "window-2024-01",
  "batch_id": "grayscale-2024-q1",
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-01-31T23:59:59Z",
  "metric_types": ["QPS", "LATENCY", "ERROR_RATE"],
  "granularity": "5m"
}
```

---

### 回填任务管理

#### 创建回填任务
```
POST /backfills
Content-Type: application/json

{
  "batch_id": "grayscale-2024-q1",
  "window_id": "window-2024-01",
  "title": "修复日志缺失指标",
  "description": "因日志采集故障导致指标缺失",
  "creator": "engineering@example.com",
  "raw_input": {
    "time_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-05T23:59:59Z"
    },
    "affected_services": ["user-service"]
  },
  "allow_overwrite": false,
  "gap_segments": [
    {
      "start_time": "2024-01-01T00:00:00Z",
      "end_time": "2024-01-05T23:59:59Z",
      "expected_count": 1500000,
      "actual_count": 0,
      "gap_percent": 100.0
    }
  ],
  "sources": [
    {
      "source_type": "LOG_REPLAY",
      "source_config": {
        "bucket": "logs-archive",
        "prefix": "2024/01/"
      },
      "connection_info": "arn:aws:iam::123:role/log-reader"
    }
  ]
}
```

**响应**: 201 Created 或 409 Conflict（重复任务）

#### 查询任务列表
```
GET /backfills?batch_id={batch_id}&status={status}&offset={offset}&limit={limit}
```

**查询参数**:
- `batch_id`: 按批次过滤（可选）
- `status`: 按状态过滤（可选）
- `offset`: 分页偏移量，默认0
- `limit`: 每页数量，默认20

#### 查询任务详情
```
GET /backfills/{backfill_id}
```
**响应包含**: 任务基本信息 + 审核记录列表 + 缺口片段列表 + 数据源列表 + 快照列表

---

### 状态流转操作

#### 提交审核
```
POST /backfills/{backfill_id}/submit
Content-Type: application/json

{
  "operator": "user@example.com",
  "comment": "数据已确认，请审核"
}
```

#### 审核通过
```
POST /backfills/{backfill_id}/approve
Content-Type: application/json

{
  "operator": "manager@example.com",
  "comment": "审核通过，可以执行"
}
```

#### 拒绝任务
```
POST /backfills/{backfill_id}/reject
Content-Type: application/json

{
  "operator": "manager@example.com",
  "comment": "数据来源不合法，拒绝"
}
```

#### 开始处理
```
POST /backfills/{backfill_id}/start
Content-Type: application/json

{
  "operator": "sre@example.com"
}
```

#### 完成处理
```
POST /backfills/{backfill_id}/complete
Content-Type: application/json

{
  "success_records": 1485000,
  "failed_records": 15000,
  "result": {
    "summary": {
      "total_processed": 1500000,
      "success_rate": 99.0
    }
  }
}
```

#### 标记失败
```
POST /backfills/{backfill_id}/fail
Content-Type: application/json

{
  "failure_reason": "数据源连接超时",
  "error_details": {
    "error_code": "CONNECTION_TIMEOUT",
    "retry_count": 3,
    "last_error_at": "2024-02-10T10:30:00Z"
  }
}
```

#### 取消任务
```
POST /backfills/{backfill_id}/cancel
Content-Type: application/json

{
  "operator": "user@example.com",
  "comment": "不再需要此回填"
}
```

#### 人工修正（失败任务）
```
POST /backfills/{backfill_id}/correct
Content-Type: application/json

{
  "operator": "sre@example.com",
  "updates": {
    "title": "修正后的任务标题",
    "description": "修正后的描述",
    "allow_overwrite": true
  }
}
```

---

### 数据导出与快照

#### 导出任务数据
```
GET /backfills/{backfill_id}/export?format={json|csv}
```

**支持格式**:
- `json`: JSON格式完整导出（默认）
- `csv`: 扁平化CSV格式，便于导入报表

#### 创建结果快照
```
POST /backfills/{backfill_id}/snapshots
Content-Type: application/json

{
  "snapshot_type": "FINAL_RESULT",
  "content": {
    "version": "1.0",
    "data": { ... }
  },
  "record_count": 1500000
}
```

## 异常处理机制

### 错误响应格式
```json
{
  "error": "错误消息",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### 常见错误码
| HTTP 状态码 | 场景 | 说明 |
|------------|------|------|
| 400 | 无效参数、非法状态转换 | 请求格式错误 |
| 409 | 重复创建回填任务 | 去重机制触发 |
| 404 | 任务/批次/窗口不存在 | 资源未找到 |
| 500 | 数据库错误、系统异常 | 服务端错误 |

### 异常路径追踪
- 失败任务的 `failure_reason` 字段记录根本原因
- `error_details` 字段保留结构化错误上下文
- 审核记录完整追踪到每个决策点
- 原始输入 `raw_input` 永久保留不修改

## 使用说明

### 快速开始

1. **启动服务**
```bash
go run cmd/api/main.go
# 或
./bin/api
```

2. **创建样例数据**
```bash
./scripts/sample_data.sh
```

3. **查看数据库**
```bash
sqlite3 data/grayscale-backfill.db
.tables
SELECT * FROM backfill_tasks;
```

### 典型使用流程

**完整回填流程**:
1. 创建灰度批次
2. 创建指标时间窗口
3. 创建回填任务（DRAFT）
4. 提交审核（→ PENDING_REVIEW）
5. 审核通过（→ APPROVED）
6. 开始处理（→ PROCESSING）
7. 完成回填（→ COMPLETED）
8. 创建结果快照
9. 导出数据

**异常重试流程**:
1. 处理失败（→ FAILED）
2. 查看错误详情和失败原因
3. 人工修正任务参数
4. 重新提交审核

## 项目结构

```
grayscale-backfill/
├── cmd/
│   └── api/
│       └── main.go              # 服务入口
├── internal/
│   ├── config/
│   │   └── config.go            # 配置与数据库初始化
│   ├── model/
│   │   └── types.go             # 数据模型定义
│   ├── repository/
│   │   └── repository.go        # 数据访问层
│   ├── service/
│   │   └── service.go           # 业务逻辑层
│   └── handler/
│       └── handler.go           # HTTP 处理器
├── pkg/utils/                    # 工具函数
├── scripts/
│   └── sample_data.sh           # 样例数据脚本
├── docs/
│   └── API.md                   # API 文档
├── go.mod
├── go.sum
└── data/
    └── grayscale-backfill.db    # SQLite 数据库文件（自动创建）
```
