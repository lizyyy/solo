# 依赖调用画像 API

提供入口接口调用画像的创建、查询、状态推进、撤销和导出功能，围绕下游服务、缓存键、调用样本、耗时分布、风险说明展开。

## 项目简介

依赖调用画像 API 是一个偏技术/API类型的服务，主要用于分析和记录接口调用的依赖关系、性能表现和风险情况。核心数据对象包括：

- **入口接口**：被分析的API接口
- **下游服务**：入口接口调用的依赖服务（数据库、缓存、外部API等）
- **缓存键**：下游服务使用的缓存配置
- **调用样本**：具体的调用记录
- **耗时分布**：调用延迟的统计分布
- **风险说明**：基于故障率、延迟等指标的风险评估

## 核心功能

### 画像聚合
- 自动聚合多个调用样本数据
- 统计下游服务调用次数和成功率
- 计算平均耗时和百分位耗时（P50、P95、P99）

### 样本归类
- 自动对调用样本进行分类（快速成功、正常成功、慢成功、超时错误、未知错误等）
- 支持按状态和分类筛选样本

### 耗时统计
- 生成耗时分布桶（0-50ms、50-100ms、100-200ms、200-500ms、500-1000ms、1000ms+）
- 计算各区间调用占比

### 风险标注
- 基于故障率、延迟、缓存配置等多维度评估风险等级（LOW/MEDIUM/HIGH/CRITICAL）
- 生成详细的风险描述说明
- 整体风险聚合评估

### 导出功能
- 支持 JSON 格式导出完整画像数据
- 支持 Excel 格式导出（包含概要、下游服务、调用样本、历史记录等sheet）

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API文档（Swagger UI）: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/

## 关键接口

### 1. 创建调用画像

**POST** `/api/v1/profiles`

创建一个新的调用画像任务。

**请求体示例**：
```json
{
    "name": "用户信息查询接口",
    "method": "GET",
    "path": "/api/v1/users/{user_id}",
    "description": "根据用户ID查询用户详细信息",
    "downstream_services": [
        {
            "service_name": "user_db",
            "service_type": "database",
            "endpoint": "mysql://user-db:3306/user_db",
            "method": "SELECT",
            "cache_key": "user:info:{user_id}",
            "cache_ttl": 3600
        }
    ],
    "call_samples": [
        {
            "trace_id": "trace-001-normal",
            "request_id": "req-001",
            "user_id": "user-1001",
            "timestamp": "2024-01-01T12:00:00Z",
            "status": "SUCCESS",
            "total_latency": 85.5,
            "request_data": {"user_id": "user-1001"},
            "response_data": {"user_id": "user-1001", "name": "张三"},
            "downstream_calls": [
                {"service_name": "user_db", "latency": 25.3, "status": "SUCCESS"}
            ]
        }
    ]
}
```

**注意**：重复请求（24小时内相同内容）会被拦截，返回 409 状态码。

### 2. 查询调用画像列表

**GET** `/api/v1/profiles?status=CREATED&risk_level=HIGH&skip=0&limit=100`

支持按状态和风险等级筛选。

### 3. 查询单个调用画像详情

**GET** `/api/v1/profiles/{profile_id}`

返回完整的画像信息，包括下游服务、调用样本和历史记录。

### 4. 推进状态

**PATCH** `/api/v1/profiles/{profile_id}/status`

推进画像的处理状态，支持有限状态机流转。

**请求体示例**：
```json
{
    "status": "AGGREGATING",
    "reason": "开始聚合数据",
    "operator": "admin"
}
```

**状态流转规则**：
```
CREATED → VALIDATING | REVOKED
VALIDATING → PROCESSING | FAILED | REVOKED
PROCESSING → AGGREGATING | FAILED | REVOKED
AGGREGATING → COMPLETED | FAILED | REVOKED
COMPLETED/FAILED/REVOKED: 终态，不可变更
```

当状态推进到 AGGREGATING 时，系统会自动执行样本分类、耗时统计和风险评估，并自动流转到 COMPLETED 状态。

### 5. 撤销画像

**POST** `/api/v1/profiles/{profile_id}/revoke?reason=人工撤销&operator=admin`

将画像状态设置为 REVOKED。

### 6. 获取画像摘要

**GET** `/api/v1/profiles/{profile_id}/summary`

返回统计摘要信息：
- 总样本数
- 成功/失败样本数
- 平均总耗时
- 下游服务数量
- 整体风险等级
- 当前状态

### 7. 导出画像

**POST** `/api/v1/profiles/{profile_id}/export`

**请求体示例**：
```json
{
    "format": "json",
    "include_samples": true,
    "include_history": true
}
```

支持格式：`json` 或 `excel`

### 8. 查询历史记录

**GET** `/api/v1/profiles/{profile_id}/history`

查询画像的所有状态变更和操作历史。

### 9. 查询调用样本

**GET** `/api/v1/profiles/{profile_id}/samples?category=FAST_SUCCESS&status=SUCCESS`

支持按分类和状态筛选样本。

## 测试数据

项目提供了四类测试数据，位于 `tests/test_data.py`：

### 1. 正常场景（正常）
- 接口：用户信息查询
- 特点：全部调用成功，延迟正常，有缓存策略
- 预期风险等级：LOW

### 2. 异常场景（异常）
- 接口：订单创建
- 特点：包含支付超时、数据库连接失败等错误样本
- 预期风险等级：MEDIUM / HIGH

### 3. 高风险场景
- 接口：推荐商品
- 特点：50%故障率，P99延迟超过3秒，无缓存策略
- 预期风险等级：CRITICAL

### 4. 拦截路径示例（会被拦截的路径）
- **接口**：用户数据删除 (`DELETE /api/v1/users/{user_id}/data`)
- **拦截原因**：此接口涉及用户数据删除，属于高风险敏感操作
- **拦截策略**：需要人工审批才能执行

查看测试数据：
```bash
python tests/test_data.py
```

## 重复请求拦截机制

系统内置了基于请求内容哈希的去重机制：
- 对请求体进行 SHA256 哈希计算
- 24小时内相同哈希的请求会被拦截
- 返回 409 Conflict 状态码和详细提示
- 有效防止重复提交导致的脏数据

## 风险评估规则

| 风险因素 | 触发条件 | 风险等级 |
|---------|---------|---------|
| 故障率 > 50% | 失败调用数/总调用数 > 0.5 | CRITICAL |
| 故障率 > 20% | 失败调用数/总调用数 > 0.2 | HIGH |
| 故障率 > 5% | 失败调用数/总调用数 > 0.05 | MEDIUM |
| P99延迟 > 3000ms | 99%的调用耗时超过3秒 | HIGH |
| P99延迟 > 1000ms | 99%的调用耗时超过1秒 | MEDIUM |
| 无缓存策略 | cache_key 为 None 或空 | MEDIUM |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py          # 数据库连接和基础配置
│   │   ├── schema.py        # 数据库模型定义
│   │   └── schemas.py       # Pydantic数据模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── profile_service.py  # 核心业务逻辑
│   │   └── export_service.py   # 导出功能
│   └── api/
│       ├── __init__.py
│       └── routes.py        # API路由定义
├── tests/
│   ├── __init__.py
│   └── test_data.py         # 测试数据
├── data/                    # SQLite数据库文件目录
├── main.py                  # 应用入口
├── requirements.txt         # 依赖列表
└── README.md               # 本文档
```

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
    "error_code": "PROFILE_NOT_FOUND",
    "error_message": "调用画像 xxx 不存在",
    "details": "可选的详细信息",
    "suggestion": "请检查profile_id是否正确"
}
```

常见错误码：
- `DUPLICATE_REQUEST`: 重复请求被拦截
- `PROFILE_NOT_FOUND`: 画像不存在
- `INVALID_STATE_TRANSITION`: 非法状态流转
- `INTERNAL_SERVER_ERROR`: 服务器内部错误

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（默认，可配置）
- **Excel导出**: pandas + openpyxl

## 配置说明

默认使用 SQLite 数据库，文件位于 `./data/call_profile.db`。如需使用其他数据库，请设置环境变量：

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

## 注意事项

1. 数据存储：默认使用SQLite，生产环境建议切换到PostgreSQL或MySQL
2. 重复请求拦截：默认24小时，可在代码中调整TTL
3. 状态流转：请严格遵循状态机规则，避免非法操作
4. 大文件导出：Excel导出可能消耗较多内存，注意数据量控制
