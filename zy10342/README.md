# 接口故障声明 API

用于管理和追踪接口故障事件，支持影响范围计算、版本管理、客户通知等功能的后端服务。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置文件
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic 模式
│   ├── services.py        # 业务逻辑
│   ├── api.py             # API 路由
│   └── exceptions.py      # 异常处理
├── main.py                # 应用入口
├── requirements.txt       # 依赖
├── test_data.py           # 测试数据脚本
└── README.md
```

## 数据模型

### 核心对象

1. **FaultEvent (故障事件)**: 故障的主记录，包含状态、影响级别等
2. **ImpactedInterface (影响接口)**: 受故障影响的 API 接口
3. **CustomerScope (客户范围)**: 受影响的客户信息
4. **DeclarationVersion (声明版本)**: 故障声明的版本历史
5. **UpdateRecord (更新记录)**: 状态变更等操作记录
6. **ResolutionNotification (解除通知)**: 故障解除时的客户通知

### 状态流转图

```
draft (草稿)
  │
  ├─→ published (已发布)
  │     │
  │     ├─→ in_progress (处理中)
  │     │     │
  │     │     └─→ resolving (待确认解除)
  │     │           │
  │     │           └─→ resolved (已解除)
  │     │
  │     └─→ cancelled (已取消)
  │
  └─→ cancelled (已取消)
```

**会被拦截的路径**: 任何不符合上述状态流转的操作都会被拦截，例如:
- 草稿 (draft) 直接变为 已解除 (resolved) → 400 错误
- 已发布 (published) 直接变为 已解除 (resolved) → 400 错误
- 已解除 (resolved) 的事件再进行任何修改 → 400 错误
- 已取消 (cancelled) 的事件再进行任何修改 → 400 错误

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试

```bash
# 先启动服务
python main.py

# 新开终端运行测试脚本
python test_data.py
```

## 核心接口

### 故障事件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/events` | 创建故障事件 |
| GET | `/api/v1/events` | 查询事件列表 |
| GET | `/api/v1/events/{event_id}` | 查询单个事件详情 |
| GET | `/api/v1/events/{event_id}/impact` | 计算影响范围 |
| POST | `/api/v1/events/{event_id}/publish` | 发布故障声明 |
| PATCH | `/api/v1/events/{event_id}/status` | 更新状态 |
| POST | `/api/v1/events/{event_id}/resolve` | 确认解除故障 |
| GET | `/api/v1/events/{event_id}/history` | 查询历史记录 |

### 影响范围管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/events/{event_id}/interfaces` | 添加受影响接口 |
| POST | `/api/v1/events/{event_id}/customers` | 添加受影响客户 |

### 版本管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/events/{event_id}/versions` | 创建新版本 |

## 关键特性

### 1. 幂等性保证

创建事件时，通过 `x-idempotency-key` 请求头支持幂等性:

```bash
# 第一次请求 - 创建事件
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: unique-key-123" \
  -d '{...}'

# 第二次请求 - 返回相同结果，不重复创建
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: unique-key-123" \
  -d '{...}'
```

**幂等键有效期**: 24小时

### 2. 状态机校验

严格的状态流转校验，无效的状态变更会被拦截并返回 400 错误。

### 3. 影响范围计算

自动计算影响严重程度，基于:
- 影响级别配置 (low/medium/high/critical)
- 受影响接口数量
- 受影响客户数量

### 4. 版本历史

故障声明的每次重大修改都记录版本历史，支持追溯。

## 异常返回格式

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid status transition from draft to resolved",
    "details": {},
    "timestamp": "2024-01-01T12:00:00.000000"
  }
}
```

常见错误码:
- `NOT_FOUND`: 资源不存在
- `BAD_REQUEST`: 请求参数错误或状态不合法
- `INTERNAL_SERVER_ERROR`: 服务器内部错误

## 使用示例

### 完整工作流示例

```bash
# 1. 创建故障事件
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "FAULT-20240101-001",
    "title": "支付接口超时",
    "description": "用户支付成功率下降",
    "impact_level": "high",
    "created_by": "admin@example.com",
    "interfaces": [
      {
        "api_path": "/api/v1/payment",
        "api_method": "POST",
        "service_name": "payment-service"
      }
    ],
    "customers": [
      {
        "customer_id": "CUST001",
        "customer_name": "电商平台A"
      }
    ]
  }'

# 2. 发布故障声明
curl -X POST http://localhost:8000/api/v1/events/FAULT-20240101-001/publish \
  -H "Content-Type: application/json" \
  -d '{
    "published_by": "admin@example.com",
    "change_log": "首次发布"
  }'

# 3. 推进状态至处理中
curl -X PATCH http://localhost:8000/api/v1/events/FAULT-20240101-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "updated_by": "engineer@example.com",
    "comment": "正在定位问题"
  }'

# 4. 推进状态至待确认解除
curl -X PATCH http://localhost:8000/api/v1/events/FAULT-20240101-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolving",
    "updated_by": "engineer@example.com",
    "comment": "修复已上线"
  }'

# 5. 确认解除
curl -X POST http://localhost:8000/api/v1/events/FAULT-20240101-001/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_by": "admin@example.com",
    "resolution_note": "已完全恢复"
  }'

# 6. 查看历史记录
curl http://localhost:8000/api/v1/events/FAULT-20240101-001/history
```

### 查询示例

```bash
# 查询某个客户相关的所有故障
curl "http://localhost:8000/api/v1/events?customer_id=CUST001"

# 查询所有已发布的故障
curl "http://localhost:8000/api/v1/events?status=published"

# 查询所有已解除的故障
curl "http://localhost:8000/api/v1/events?status=resolved"
```

## 技术栈

- **框架**: FastAPI 0.109.0
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite (可扩展支持 PostgreSQL/MySQL)
- **服务**: Uvicorn

## 健康检查

```bash
curl http://localhost:8000/health
```
