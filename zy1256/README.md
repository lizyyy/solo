# Redis Structure Audit API

本地 Redis 数据结构选型体检 API 服务，用于评估 Redis 数据结构选型是否合适，检测内存问题、热 key、大 key 和迁移风险。

## 功能特性

### 核心功能
- **数据导入**：支持 keys.csv、usage-events.jsonl、structure-rules.yaml 三种文件格式
- **结构评估**：自动评估 String/Hash/List/Set/ZSet/Stream 在各场景的选型合理性
- **场景识别**：自动识别计数器、排行榜、队列、去重、时间线、缓存、会话、消息等业务场景
- **风险检测**：
  - 热 key 检测（高频访问）
  - 大 key 检测（内存占用过大）
  - TTL 风险（无过期时间或过期时间不合理）
  - 迁移风险（评估数据迁移复杂度）
- **内存估算**：基于数据结构类型估算内存占用
- **方案对比**：提供多种数据结构的优缺点对比和迁移复杂度评估
- **人工确认**：支持报告的人工确认审核流程
- **报告导出**：支持 JSON、HTML、Markdown 三种格式的报告导出

### 支持的场景与数据结构

| 场景 | 推荐结构 | 不推荐 |
|------|----------|--------|
| 计数器 | String | Hash, Set |
| 排行榜 | ZSet | List, Set |
| 队列 | List, Stream | Set, ZSet |
| 去重 | Set, Hash, ZSet | List |
| 时间线 | ZSet, List, Stream | Set |
| 缓存 | String, Hash | - |
| 会话 | Hash, String | - |
| 消息 | Stream, List | - |

## 项目结构

```
zy1256/
├── main.py                    # FastAPI 应用入口
├── config.py                  # 配置管理
├── database.py                # 数据库连接和初始化
├── models.py                  # SQLAlchemy ORM 模型
├── schemas.py                 # Pydantic 请求/响应模型
├── analyzer.py                # 核心分析引擎
├── import_service.py          # 数据导入服务
├── report_service.py          # 报告生成服务
├── requirements.txt           # Python 依赖
├── test_api.py                # 测试文件
├── curl_examples.txt          # CURL 示例
├── routers/
│   ├── __init__.py
│   ├── import_router.py       # 导入路由
│   ├── analysis_router.py     # 分析路由
│   ├── comparison_router.py   # 对比路由
│   ├── confirmation_router.py # 确认路由
│   └── report_router.py       # 报告路由
└── seed_data/
    ├── good_seeds/            # 正确选型的示例数据
    │   ├── keys.csv
    │   ├── usage-events.jsonl
    │   └── structure-rules.yaml
    └── bad_seeds/             # 错误选型的示例数据（用于测试检测）
        ├── keys.csv
        ├── usage-events.jsonl
        └── structure-rules.yaml
```

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
- API 文档：http://localhost:8000/docs
- OpenAPI 规范：http://localhost:8000/openapi.json
- 健康检查：http://localhost:8000/health

### 完整工作流示例

1. **创建会话**
```bash
curl -X POST "http://localhost:8000/api/v1/import/session" \
  -H "Content-Type: application/json" \
  -d '{"session_name": "My Audit Session", "description": "Redis structure check"}'
```

2. **导入数据**
```bash
# 导入 keys.csv
curl -X POST "http://localhost:8000/api/v1/import/keys/1" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./seed_data/good_seeds/keys.csv"

# 导入使用事件
curl -X POST "http://localhost:8000/api/v1/import/events/1" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./seed_data/good_seeds/usage-events.jsonl"

# 导入自定义规则（可选）
curl -X POST "http://localhost:8000/api/v1/import/rules/1" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./seed_data/good_seeds/structure-rules.yaml"
```

3. **运行分析**
```bash
curl -X POST "http://localhost:8000/api/v1/analysis/1"
```

4. **查看分析结果**
```bash
curl "http://localhost:8000/api/v1/analysis/1"
```

5. **生成结构对比**
```bash
curl -X POST "http://localhost:8000/api/v1/comparison/1"
```

6. **生成报告**
```bash
# JSON 格式
curl -X POST "http://localhost:8000/api/v1/report/generate" \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1, "report_type": "full", "format": "json"}'

# HTML 格式
curl -X POST "http://localhost:8000/api/v1/report/generate" \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1, "report_type": "full", "format": "html"}'

# Markdown 格式
curl -X POST "http://localhost:8000/api/v1/report/generate" \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1, "report_type": "summary", "format": "markdown"}'
```

7. **下载报告**
```bash
curl -O "http://localhost:8000/api/v1/report/download/1"
```

8. **人工确认**
```bash
curl -X POST "http://localhost:8000/api/v1/confirmation/" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "report_id": 1,
    "confirmed_by": "your@email.com",
    "notes": "Reviewed and approved"
  }'
```

更多 CURL 示例请参考 `curl_examples.txt`。

## 数据格式说明

### keys.csv 格式

必需字段：
- `key` 或 `key_name`：Redis 键名
- `type` 或 `data_type`：数据类型 (string, hash, list, set, zset, stream)

可选字段：
- `ttl`：过期时间（秒），-1 表示永不过期，-2 表示已过期
- `memory` 或 `memory_bytes`：内存占用（字节）
- `value_size`：String 类型的值大小
- `field_count`：Hash 的字段数量
- `list_length`：List 的长度
- `set_cardinality`：Set 的元素数量
- `zset_cardinality`：ZSet 的元素数量
- `stream_length`：Stream 的消息数量
- `tags`：标签（逗号分隔）
- `description`：描述

示例：
```csv
key,type,ttl,memory,value_size,field_count,list_length,tags
user:counter:1,string,3600,128,8,,,counter
leaderboard:daily,zset,-1,65536,,,,leaderboard
queue:tasks,list,86400,131072,,,1000,queue
```

### usage-events.jsonl 格式

每行一个 JSON 对象：

必需字段：
- `timestamp`：时间戳（ISO 格式或 Unix 时间戳）
- `key` 或 `key_name`：键名
- `command`：Redis 命令

可选字段：
- `read_write`：读写类型 (read, write, both)
- `latency_ms`：延迟（毫秒）
- `client_id`：客户端 ID
- `database`：Redis 数据库编号
- `tags`：标签

示例：
```jsonl
{"timestamp": "2026-05-05T10:00:01", "key": "user:counter:1", "command": "INCR", "read_write": "write", "latency_ms": 0.5}
{"timestamp": "2026-05-05T10:00:02", "key": "leaderboard:daily", "command": "ZADD", "read_write": "write", "latency_ms": 1.2}
```

### structure-rules.yaml 格式

自定义数据结构选型规则：

```yaml
scenarios:
  counter:
    recommended_types:
      - string
    anti_patterns:
      - hash
      - set
    memory_considerations: "String uses ~50 bytes overhead per key."
    performance_notes: "O(1) complexity for counter operations."
```

## 运行测试

```bash
pytest test_api.py -v
```

或运行带输出的测试：

```bash
pytest test_api.py -v -s
```

## 检测规则说明

### 大 key 检测阈值

| 数据类型 | 阈值 | 单位 |
|----------|------|------|
| String | 10KB | 字节 |
| Hash | 1000 | 字段数 |
| List | 10000 | 元素数 |
| Set | 1000 | 元素数 |
| ZSet | 1000 | 元素数 |
| Stream | 10000 | 消息数 |

### 热 key 检测阈值

- 每分钟访问次数 >= 1000 次判定为热 key

### TTL 风险等级

| 等级 | 说明 |
|------|------|
| high | 缓存/会话数据无 TTL；已过期的 key |
| medium | TTL 过短或过长（视场景而定） |
| low | TTL 设置合理 |

### 迁移风险等级

| 等级 | 条件 |
|------|------|
| high | 大 key + 热 key + Stream 类型 |
| medium | 大 key 或 热 key 或 复杂结构 |
| low | 常规数据结构 |

## 数据库模型

服务使用 SQLite 存储审计记录，主要表：

- `audit_sessions`：审计会话
- `redis_keys`：导入的 Redis key 信息
- `usage_events`：使用事件记录
- `analysis_results`：分析结果汇总
- `key_analyses`：单 key 分析详情
- `comparison_results`：结构对比结果
- `audit_reports`：生成的报告记录

## 配置

通过环境变量或 `.env` 文件配置：

```env
APP_NAME=Redis Structure Audit API
APP_VERSION=1.0.0
DEBUG=True
DATABASE_URL=sqlite+aiosqlite:///./redis_audit.db
UPLOAD_DIR=./uploads
REPORTS_DIR=./reports
MAX_UPLOAD_SIZE=10485760
```

## License

MIT
