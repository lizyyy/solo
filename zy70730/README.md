# 指标标签基数护栏人工放行后端API

用于监控指标标签基数控制和人工放行审核的后端服务。

## 项目简介

当业务方随手添加标签导致指标基数暴涨时，该服务提供基数估算、自动拦截和人工放行的完整流程。

## 技术栈

- **Web框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **语言**: Python 3.8+

## 核心功能

### 1. 基数估算
- 根据标签集合自动估算指标基数
- 超过阈值自动触发拦截

### 2. 标签白名单
- 支持按指标名管理标签白名单
- 支持指定允许的标签值
- 支持通配符模式（allowed_values = null）

### 3. 拦截记录管理
- 创建拦截申请
- 查询拦截记录列表
- 支持按指标名、状态筛选
- 支持分页查询

### 4. 人工审核
- 审核通过/拒绝
- 审核意见
- 防止重复审核

### 5. 护栏报告
- 每日统计报告
- CSV格式导出
- 热门指标排名

## 错误响应码

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| missing_field | 缺少必填字段 | 422 |
| invalid_status | 无效的审核状态 | 400 |
| needs_manual_review | 需要人工复核 | 403 |
| already_processed | 记录已处理 | 400 |
| invalid_operation | 无效操作 | 400/500 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行自检脚本

```bash
# 先启动服务
python main.py

# 新开终端运行测试
python test_self_check.py
```

## API接口说明

### 健康检查

```bash
GET /health
```

### 基数估算

```bash
POST /api/v1/cardinality/estimate
Content-Type: application/json

{
  "metric_name": "http_requests",
  "tag_set": {"status": "200", "method": "GET"}
}
```

### 拦截记录

```bash
# 创建申请
POST /api/v1/intercepts

# 查询列表
GET /api/v1/intercepts?metric_name=http_requests&status=pending

# 查询单条
GET /api/v1/intercepts/{id}

# 审核
POST /api/v1/intercepts/{id}/review
```

### 白名单管理

```bash
# 添加白名单
POST /api/v1/whitelist
{
  "metric_name": "http_requests",
  "tag_key": "status",
  "allowed_values": ["200", "400", "500"]
}

# 查询白名单
GET /api/v1/whitelist
```

### 报告管理

```bash
# 生成报告
POST /api/v1/reports/generate?report_date=2024-01-15

# 查询报告列表
GET /api/v1/reports

# 导出CSV
GET /api/v1/reports/{date}/export
```

## 数据库表结构

### intercept_records
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| metric_name | String | 指标名 |
| tag_set | JSON | 标签集合 |
| estimated_cardinality | Integer | 估算基数 |
| reason | String | 申请理由 |
| status | String | 状态: pending/approved/rejected |
| reviewer | String | 审核人 |
| review_comment | String | 审核意见 |
| created_at | DateTime | 创建时间 |
| reviewed_at | DateTime | 审核时间 |

### whitelist_tags
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| metric_name | String | 指标名 |
| tag_key | String | 标签键 |
| allowed_values | JSON | 允许的值列表 |
| created_at | DateTime | 创建时间 |

### guardrail_reports
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| report_date | String | 报告日期 |
| total_intercepted | Integer | 总拦截数 |
| total_approved | Integer | 审核通过数 |
| total_rejected | Integer | 审核拒绝数 |
| top_metrics | JSON | 热门指标 |
| created_at | DateTime | 创建时间 |

## 文件结构

```
.
├── main.py              # FastAPI主应用
├── models.py            # 数据模型和Pydantic模型
├── services.py          # 业务逻辑服务
├── test_self_check.py   # 自检脚本
├── requirements.txt     # 依赖文件
└── README.md            # 说明文档
```
