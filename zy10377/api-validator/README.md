# API 文档示例验证服务

> 将关键规则放在后端，而不是放在文档里。验证 API 文档中示例请求的有效性，支持环境变量注入、定期验证、错误归类和修复追踪。

## 核心特性

### 🔧 核心规则（后端统一管理）

1. **示例提取** - 从 Markdown/代码块自动解析请求示例（curl、HTTP 格式）
2. **环境注入** - 自动替换 `{{variable}}` 占位符，支持敏感变量加密存储
3. **定期验证** - 支持定时批量验证，监控文档示例有效性
4. **错误归类** - 自动分类：网络错误、认证错误、状态码不匹配、超时、环境缺失
5. **修复追踪** - 记录修复操作、处理人和备注，支持状态流：pending → running → success/failed → fixing → fixed
6. **防重复提交** - 通过 `content_hash` 防止脏数据

### 📊 数据对象

- **DocumentPage** - 文档页面元信息
- **RequestExample** - 请求示例（含 content_hash 防重）
- **EnvironmentVariable** - 环境变量配置
- **ValidationResult** - 验证结果记录
- **ErrorCause** - 错误原因分类
- **FixTrace** - 修复操作追踪

## 快速开始

### 1. 安装依赖

```bash
cd api-validator
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 方式一
python main.py

# 方式二
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问:
- 管理首页: http://localhost:8000
- Swagger 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 初始化测试数据

```bash
# 确保服务已启动后执行
python seed_data.py
```

## 关键接口

### 环境变量管理

```bash
# 创建环境变量
curl -X POST http://localhost:8000/api/v1/environment \
  -H "Content-Type: application/json" \
  -d '{"key": "API_BASE_URL", "value": "https://api.example.com", "description": "API 基础地址"}'

# 查看环境变量
curl http://localhost:8000/api/v1/environment
```

### 请求示例管理

```bash
# 创建请求示例
curl -X POST http://localhost:8000/api/v1/examples \
  -H "Content-Type: application/json" \
  -d '{
    "name": "获取用户列表",
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/users",
    "headers": {"Content-Type": "application/json"},
    "expected_status": 200,
    "content_hash": "your-unique-hash-here"
  }'

# 从 Markdown 提取示例
curl -X POST "http://localhost:8000/api/v1/examples/extract?content=```bash%0Acurl%20https://example.com```"

# 获取示例列表
curl http://localhost:8000/api/v1/examples
```

### 执行验证

```bash
# 单示例验证
curl -X POST http://localhost:8000/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"example_id": 1}'

# 批量验证
curl -X POST http://localhost:8000/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"example_ids": [1, 2, 3]}'

# 带自定义环境变量
curl -X POST http://localhost:8000/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{"example_id": 1, "environment": {"CUSTOM_VAR": "value"}}'
```

### 验证结果与状态管理

```bash
# 查询验证历史
curl "http://localhost:8000/api/v1/results?status=failed&page=1&page_size=20"

# 查看单个验证结果详情
curl http://localhost:8000/api/v1/results/1

# 推进状态（人工处理）
curl -X PUT http://localhost:8000/api/v1/results/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "fixing", "operator": "admin", "remark": "正在排查问题"}'

# 标记为已修复
curl -X PUT http://localhost:8000/api/v1/results/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "fixed", "operator": "admin", "remark": "已更新 API 配置"}'
```

### 修复追踪

```bash
# 创建修复记录
curl -X POST http://localhost:8000/api/v1/fix-traces \
  -H "Content-Type: application/json" \
  -d '{
    "validation_result_id": 1,
    "action_taken": "更新认证令牌",
    "operator": "admin",
    "remark": "替换了过期的 JWT token"
  }'

# 查看修复历史
curl http://localhost:8000/api/v1/fix-traces
```

### 统计信息

```bash
curl http://localhost:8000/api/v1/stats
```

## 被拦截的路径示例

```bash
# 此路径会被安全规则拦截，返回 403
curl http://localhost:8000/blocked/path
```

返回示例：
```json
{
  "code": 403,
  "message": "此路径已被安全规则拦截。请通过 /api/v1/ 前缀访问合法接口",
  "details": null
}
```

## 错误分类说明

| 错误分类 | 说明 | 常见原因 |
|---------|------|---------|
| `network_error` | 网络连接错误 | DNS 解析失败、无法连接主机 |
| `auth_error` | 认证失败 | 401/403 状态码、token 过期 |
| `status_code_mismatch` | 状态码不匹配 | 期望 200 但返回其他状态码 |
| `response_schema_error` | 响应格式错误 | JSON 解析失败、字段缺失 |
| `timeout` | 请求超时 | 网络延迟、服务端响应慢 |
| `environment_missing` | 环境变量缺失 | 占位符无法解析 |
| `unknown` | 未知错误 | 需要人工排查 |

## 验证状态流转

```
pending → running → success
                  → failed → fixing → fixed
```

- `pending`: 等待验证
- `running`: 正在验证中
- `success`: 验证通过
- `failed`: 验证失败
- `fixing`: 正在修复中（人工处理）
- `fixed`: 已修复（人工标记）

## 防重复提交机制

1. **RequestExample** 通过 `content_hash` 唯一标识，相同内容的示例无法重复创建
2. **DocumentPage** 同样通过 `content_hash` 防重
3. **ValidationResult** 执行验证前检查是否已有 pending/running 状态的同示例验证

## 项目结构

```
api-validator/
├── main.py           # FastAPI 应用入口，API 路由
├── models.py         # SQLAlchemy 数据模型
├── schemas.py        # Pydantic 请求/响应 Schema
├── services.py       # 核心业务逻辑（验证、提取、环境注入等）
├── database.py       # 数据库连接配置
├── config.py         # 应用配置
├── requirements.txt  # Python 依赖
├── seed_data.py      # 测试数据初始化脚本
├── .env.example      # 环境变量示例
└── README.md         # 本文档
```

## 配置说明

复制 `.env.example` 为 `.env` 并按需修改：

```env
DATABASE_URL=sqlite:///./api_validator.db
VALIDATION_TIMEOUT=30
MAX_RETRIES=3
SCHEDULED_VALIDATION_ENABLED=true
SCHEDULED_VALIDATION_CRON=0 0 * * *
```

## 技术栈

- **FastAPI** - 现代化 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **Pydantic** - 数据验证
- **httpx** - 异步 HTTP 客户端
- **SQLite** - 默认数据库（可替换为 PostgreSQL/MySQL）

## 开发说明

```bash
# 启动开发服务器
uvicorn main:app --reload

# 运行测试数据初始化
python seed_data.py
```

## License

MIT
