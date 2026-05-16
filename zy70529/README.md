# 队列消费补偿API

用于处理消费者升级失败后的消息补偿，避开已成功处理的业务单据。

## 技术栈

- Python 3.9+
- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 数据库
- Pandas + OpenPyXL - Excel导出

## 快速开始

### 1. 安装依赖

```bash
pip3 install fastapi uvicorn sqlalchemy pydantic python-multipart pandas openpyxl
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 补偿记录管理

#### 创建补偿记录

```http
POST /api/v1/compensation/records
```

请求体：
```json
{
    "queue_name": "order_queue",
    "message_id": "msg_001",
    "business_no": "ORD_20240101_001",
    "strategy": "retry_three",
    "original_input": {"order_id": "ORD_001", "amount": 100.0}
}
```

#### 批量创建补偿记录

```http
POST /api/v1/compensation/records/batch
```

#### 获取单个记录

```http
GET /api/v1/compensation/records/{record_id}
```

#### 根据业务单号获取记录

```http
GET /api/v1/compensation/records/business/{business_no}
```

#### 查询记录列表

```http
POST /api/v1/compensation/records/query
```

#### 获取记录历史变更

```http
GET /api/v1/compensation/records/{record_id}/history
```

### 状态管理

#### 开始处理记录

```http
POST /api/v1/compensation/records/{record_id}/process
```

#### 标记处理成功

```http
POST /api/v1/compensation/records/{record_id}/success?process_basis=xxx&final_conclusion=xxx
```

#### 标记处理失败

```http
POST /api/v1/compensation/records/{record_id}/failure?error_message=xxx&process_basis=xxx
```

#### 人工修正

```http
POST /api/v1/compensation/records/manual-fix
```

请求体：
```json
{
    "business_no": "ORD_001",
    "final_conclusion": "人工处理完成",
    "process_basis": "根据客服记录处理",
    "operator": "admin"
}
```

#### 跳过处理

```http
POST /api/v1/compensation/records/{record_id}/skip?operator=system&remark=xxx
```

### 批次管理

#### 获取批次信息

```http
GET /api/v1/compensation/batches/{batch_id}
```

### 导出功能

#### 导出补偿记录为Excel

```http
POST /api/v1/compensation/export
```

导出字段包含：ID、队列名称、消息编号、业务单据号、消费状态、补偿策略、重试次数、最大重试次数、原始输入、处理依据、最终结论、错误信息、批次ID、创建时间、更新时间、处理时间

### 报告管理

#### 生成补偿报告

```http
POST /api/v1/compensation/reports
```

#### 获取补偿报告

```http
GET /api/v1/compensation/reports/{report_id}
```

### 健康检查

#### 基本健康检查

```http
GET /api/v1/health/
```

#### 数据库连接检查

```http
GET /api/v1/health/db
```

#### 系统统计

```http
GET /api/v1/health/stats
```

#### 最小自检

```http
GET /api/v1/health/self-check
```

检查项目包括：
- 数据库连接状态
- 历史记录完整性
- 历史记录关联完整性
- 处理时间完整性

## 核心数据模型

### CompensationRecord（补偿记录）

- `id`: 记录ID
- `queue_name`: 队列名称
- `message_id`: 消息编号
- `business_no`: 业务单据号
- `status`: 消费状态（pending/processing/success/failed/skipped/manual_fixed）
- `strategy`: 补偿策略（retry_once/retry_three/manual/skip）
- `retry_count`: 重试次数
- `max_retry`: 最大重试次数
- `original_input`: 原始输入（JSON）
- `process_basis`: 处理依据
- `final_conclusion`: 最终结论
- `error_message`: 错误信息
- `batch_id`: 批次ID
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `processed_at`: 处理时间

### CompensationHistory（历史记录）

记录每次状态变更，确保数据可追溯。

### CompensationBatch（补偿批次）

批量操作的批次信息。

### CompensationReport（补偿报告）

统计报告，包含各状态的记录数量。

## 关键规则

1. **消费去重**: 同一队列名称、消息编号、业务单据号的记录不会重复创建
2. **单据校验**: 已成功处理（success）或人工修正（manual_fixed）的业务单据号不允许再次创建补偿记录
3. **失败留存**: 所有失败记录保留原始输入、错误信息、处理依据
4. **历史追溯**: 每次状态变更都会创建历史记录
5. **数据持久化**: 使用SQLite数据库，重启服务数据不丢失

## 运行测试

```bash
python3 -m pytest test_compensation.py -v
```

## 项目结构

```
.
├── main.py                 # 应用入口
├── app/
│   ├── database.py         # 数据库配置
│   ├── models/             # 数据模型
│   ├── schemas/            # Pydantic模式
│   ├── services/           # 业务逻辑
│   └── api/                # API路由
├── exports/                # 导出文件目录
├── test_compensation.py    # 测试文件
└── requirements.txt        # 依赖列表
```
