# 数据同步水位 API

一个 Python 单体后端服务，用于管理数据同步通道、水位推进、批次确认、回退重放和差异扫描。

## 核心功能

### 数据对象
- **同步通道**: 管理从源系统到目标系统的同步通道
- **水位标记**: 记录同步进度的水位点
- **源端批次**: 按批次划分的源端数据范围
- **消费确认**: 下游消费完成后的确认记录
- **回退点**: 用于数据重放的安全快照点
- **差异摘要**: 源端与目标端的数据差异统计

### 核心规则
- **水位推进**: 安全、有序地推进同步水位，支持幂等
- **幂等消费**: 重复提交不会产生脏数据
- **回退重放**: 支持回退到历史快照点重新处理数据
- **差异扫描**: 记录源端与目标端的数据差异
- **状态审计**: 所有操作记录操作人、时间和备注

## 技术栈

- **Web 框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite（可扩展为 PostgreSQL/MySQL）
- **接口文档**: Swagger UI / ReDoc

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python -m app.main
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问接口文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 运行示例测试

```bash
# 运行所有测试
python test_examples.py

# 只运行成功流程测试
python test_examples.py success

# 只运行问题流程测试（异常处理、幂等、回退）
python test_examples.py problem

# 验证重启后的数据持久化
python test_examples.py restart
```

## API 接口概览

### 通道管理
- `POST /api/channels` - 创建同步通道
- `GET /api/channels` - 获取通道列表
- `GET /api/channels/{channel_code}` - 获取通道详情
- `PUT /api/channels/{channel_code}` - 更新通道信息

### 水位管理
- `POST /api/watermarks/advance` - 推进水位（幂等）
- `GET /api/watermarks/{channel_code}/history` - 获取水位历史

### 批次管理
- `POST /api/batches` - 创建批次
- `GET /api/batches` - 获取批次列表
- `GET /api/batches/{batch_id}` - 获取批次详情
- `PUT /api/batches/{batch_id}/status` - 更新批次状态

### 消费确认
- `POST /api/confirmations` - 消费确认（幂等）

### 回退管理
- `POST /api/rollback-points` - 创建回退点
- `POST /api/rollback/execute` - 执行回退
- `GET /api/rollback-points/{channel_code}` - 获取回退点列表

### 差异扫描
- `POST /api/diff-summaries` - 记录差异摘要
- `GET /api/diff-summaries` - 获取差异历史

## 使用示例

### 1. 创建同步通道

```python
import requests

channel_data = {
    "channel_code": "ORDERS_SYNC",
    "channel_name": "订单数据同步",
    "source_system": "MySQL-订单库",
    "target_system": "Elasticsearch-订单索引",
    "description": "订单表全量+增量同步通道",
    "initial_watermark": "0",
    "created_by": "admin"
}

response = requests.post("http://localhost:8000/api/channels", json=channel_data)
```

### 2. 推进水位

```python
watermark_data = {
    "channel_code": "ORDERS_SYNC",
    "watermark_value": "10000",
    "watermark_time": "2024-01-15T10:30:00",
    "created_by": "sync_job",
    "remark": "增量同步推进"
}

response = requests.post("http://localhost:8000/api/watermarks/advance", json=watermark_data)
```

### 3. 创建回退点

```python
rollback_data = {
    "channel_code": "ORDERS_SYNC",
    "point_name": "每日快照-2024-01-15",
    "watermark_value": "5000",
    "watermark_time": "2024-01-15T00:00:00",
    "created_by": "scheduler",
    "remark": "每日自动快照"
}

response = requests.post("http://localhost:8000/api/rollback-points", json=rollback_data)
```

### 4. 执行回退

```python
rollback_execute = {
    "channel_code": "ORDERS_SYNC",
    "rollback_point_id": 1,
    "executed_by": "operator_001",
    "remark": "消费异常，回退后重放"
}

response = requests.post("http://localhost:8000/api/rollback/execute", json=rollback_execute)
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py     # 数据库连接配置
│   ├── models.py       # 数据模型定义
│   ├── schemas.py      # Pydantic 模式定义
│   ├── services.py     # 业务逻辑层
│   └── main.py         # FastAPI 应用入口
├── requirements.txt    # 依赖列表
├── test_examples.py    # 示例与测试脚本
├── README.md
└── .gitignore
```

## 核心特性说明

### 幂等性保证
- 重复推进同一水位不会创建重复记录
- 同一消费者对同一批次的重复确认不会产生脏数据
- API 响应中包含 `is_idempotent` 标记

### 状态流转
批次状态流转:
- `pending` → `processing` → `confirmed` (成功)
- `pending` → `processing` → `error` (失败) → `rolled_back` (回退后)

### 数据持久化
- 所有状态变更持久化到 SQLite 数据库
- 重启服务后数据不丢失
- 支持切换到 PostgreSQL/MySQL 等生产级数据库

### 审计追踪
- 所有操作记录创建人/操作人
- 所有时间点都有时间戳
- 支持备注说明操作原因

## 扩展建议

1. **数据库切换**: 修改 `database.py` 中的连接字符串，使用 PostgreSQL 或 MySQL
2. **认证授权**: 添加 API Key 或 OAuth2 认证
3. **分页查询**: 为列表接口添加分页支持
4. **告警通知**: 集成邮件、钉钉、企业微信等告警渠道
5. **数据报表**: 添加同步进度、差异趋势等报表接口
