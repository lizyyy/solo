# Redis Cluster Drill Platform

一个用于复盘 Redis Cluster 槽迁移和主从故障转移的本地后端 API 服务。

## 功能特性

### 数据导入
- 导入 `nodes.yaml` - 集群节点配置
- 导入 `slot-events.jsonl` - 槽位迁移事件
- 导入 `requests.jsonl` - 实际请求记录

### 模拟场景
- **MOVED 重定向** - 槽位迁移完成后的重定向
- **ASK 重定向** - 槽位迁移期间的询问重定向
- **读写请求路由** - 读请求路由到 slave，写请求路由到 master
- **复制延迟** - 模拟主从复制延迟对读请求的影响
- **Sentinel 选主** - 模拟 master 故障后的 slave 提升
- **客户端重试** - 模拟客户端遇到重定向时的重试逻辑
- **Lua/事务失败** - 模拟跨槽 Lua 脚本和事务在迁移期间的失败

### 分析与报告
- 风险分析查询
- 多任务策略对比
- Markdown/JSON 报告导出

## 快速开始

### 环境要求
- Python 3.9+
- pip

### 安装

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 启动服务

```bash
# 开发模式（自动重载）
python main.py

# 或使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- OpenAPI 规范: http://localhost:8000/openapi.json
- 健康检查: http://localhost:8000/health

## API 端点

### 数据导入 (`/api/v1/import`)

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/import/nodes-yaml` | 导入节点配置 YAML |
| POST | `/import/slot-events-jsonl` | 导入槽位事件 JSONL |
| POST | `/import/requests-jsonl` | 导入请求记录 JSONL |
| POST | `/import/clear` | 清空所有数据 |

### 演练任务 (`/api/v1/drills`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/drills/` | 列出所有演练任务 |
| POST | `/drills/` | 创建新演练任务 |
| GET | `/drills/{task_id}` | 获取任务详情 |
| POST | `/drills/{task_id}/run` | 运行演练任务 |
| GET | `/drills/{task_id}/results` | 获取任务执行结果 |
| DELETE | `/drills/{task_id}` | 删除任务 |

### 集群状态 (`/api/v1/cluster`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/cluster/stats` | 获取集群统计 |
| GET | `/cluster/nodes` | 列出所有节点 |
| GET | `/cluster/nodes/{node_id}` | 获取节点详情 |
| GET | `/cluster/slots` | 列出槽位状态 |
| GET | `/cluster/slots/{slot_number}` | 获取指定槽位信息 |
| GET | `/cluster/slots/key/{key}` | 计算 key 对应的槽位 |
| GET | `/cluster/requests` | 列出请求记录 |
| GET | `/cluster/requests/{request_id}` | 获取请求详情 |

### 分析与报告 (`/api/v1/analysis`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/analysis/risks/{task_id}` | 分析任务风险 |
| POST | `/analysis/compare?task_ids=1&task_ids=2` | 对比多个任务 |
| GET | `/analysis/report/{task_id}/json` | 导出 JSON 报告 |
| GET | `/analysis/report/{task_id}/markdown` | 导出 Markdown 报告 |

## 演练任务配置

创建演练任务时的配置参数：

```json
{
    "task_name": "场景名称",
    "description": "场景描述",
    
    "enable_moved_redirect": true,
    "enable_ask_redirect": true,
    "enable_read_write_routing": true,
    "enable_replication_lag": false,
    "enable_sentinel_failover": false,
    "enable_client_retry": true,
    "enable_lua_transaction_failure": false,
    
    "replication_lag_ms": 0,
    "max_retries": 3,
    "seed": 42
}
```

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enable_moved_redirect` | bool | true | 启用 MOVED 重定向模拟 |
| `enable_ask_redirect` | bool | true | 启用 ASK 重定向模拟 |
| `enable_read_write_routing` | bool | true | 启用读写分离路由 |
| `enable_replication_lag` | bool | false | 启用复制延迟模拟 |
| `enable_sentinel_failover` | bool | false | 启用 Sentinel 故障转移模拟 |
| `enable_client_retry` | bool | true | 启用客户端重试模拟 |
| `enable_lua_transaction_failure` | bool | false | 启用 Lua/事务失败模拟 |
| `replication_lag_ms` | int | 0 | 复制延迟毫秒数 |
| `max_retries` | int | 3 | 最大重试次数 |
| `seed` | int | 42 | 随机种子（用于可复现测试） |

## 数据格式

### nodes.yaml 格式

```yaml
nodes:
  - node_id: "a1b2c3d4e5f60001"
    host: "192.168.1.10"
    port: 7000
    role: "master"
    master_id: null
    state: "connected"
    is_alive: true
```

### slot-events.jsonl 格式

```json
{"type": "stable", "slot": 0, "from_node": null, "to_node": "node_id_1", "timestamp": "2026-05-01T00:00:00Z"}
{"type": "migrating", "slot": 1000, "from_node": "node_id_1", "to_node": "node_id_2", "timestamp": "2026-05-03T10:00:00Z"}
{"type": "importing", "slot": 1000, "from_node": "node_id_1", "to_node": "node_id_2", "timestamp": "2026-05-03T10:00:00Z"}
```

事件类型：
- `stable` - 槽位稳定状态
- `migrating` - 槽位正在从源节点迁出
- `importing` - 槽位正在被目标节点导入
- `migrated` - 槽位迁移完成

### requests.jsonl 格式

```json
{"request_id": "req-001", "command": "GET", "key": "user:1000", "timestamp": "2026-05-03T10:01:00Z"}
{"request_id": "req-002", "command": "SET", "key": "user:1000", "timestamp": "2026-05-03T10:01:01Z"}
{"request_id": "req-003", "command": "EVAL", "key": "counter:views", "timestamp": "2026-05-03T10:01:10Z", "keys": ["counter:views", "counter:unique"]}
```

## 使用示例

### 完整工作流

```bash
# 1. 启动服务
python main.py

# 2. 导入数据（在另一个终端）
curl -X POST -F "file=@data/nodes.yaml" http://localhost:8000/api/v1/import/nodes-yaml
curl -X POST -F "file=@data/slot-events.jsonl" http://localhost:8000/api/v1/import/slot-events-jsonl
curl -X POST -F "file=@data/requests.jsonl" http://localhost:8000/api/v1/import/requests-jsonl

# 3. 查看集群状态
curl http://localhost:8000/api/v1/cluster/stats
curl http://localhost:8000/api/v1/cluster/nodes
curl "http://localhost:8000/api/v1/cluster/slots?migrating_only=true"

# 4. 创建演练任务
curl -X POST -H "Content-Type: application/json" -d '{
    "task_name": "槽迁移场景测试",
    "description": "测试重定向和故障转移",
    "enable_moved_redirect": true,
    "enable_ask_redirect": true,
    "enable_read_write_routing": true,
    "enable_replication_lag": true,
    "enable_sentinel_failover": true,
    "enable_client_retry": true,
    "enable_lua_transaction_failure": true,
    "replication_lag_ms": 200,
    "max_retries": 3,
    "seed": 42
}' http://localhost:8000/api/v1/drills/

# 5. 运行演练
curl -X POST http://localhost:8000/api/v1/drills/1/run

# 6. 查看结果
curl http://localhost:8000/api/v1/drills/1
curl http://localhost:8000/api/v1/drills/1/results

# 7. 风险分析
curl http://localhost:8000/api/v1/analysis/risks/1

# 8. 导出报告
curl -o report.json http://localhost:8000/api/v1/analysis/report/1/json
curl -o report.md http://localhost:8000/api/v1/analysis/report/1/markdown
```

### 使用示例脚本

```bash
# 运行完整示例
chmod +x examples.sh
./examples.sh
```

## 诊断结论类型

演练完成后，系统会生成以下类型的诊断结论：

| 类型 | 严重程度 | 描述 |
|------|----------|------|
| `redirect_issue` | medium | 高重定向次数检测 |
| `replication_lag` | medium | 复制延迟影响检测 |
| `lua_transaction_failure` | critical | Lua/事务操作失败 |
| `failover` | high | 主从故障转移执行 |
| `availability` | info | 演练可用性统计 |

## 项目结构

```
.
├── main.py                    # 应用入口
├── requirements.txt           # 依赖列表
├── examples.sh                # API 示例脚本
├── README.md                  # 本文档
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库连接
│   ├── models.py              # SQLAlchemy 模型
│   ├── schemas.py             # Pydantic 模型
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── import_router.py    # 数据导入 API
│   │   ├── drill_router.py    # 演练任务 API
│   │   ├── analysis_router.py # 分析报告 API
│   │   └── cluster_router.py  # 集群状态 API
│   ├── services/
│   │   ├── __init__.py
│   │   ├── importer.py         # 数据导入服务
│   │   ├── drill_service.py   # 演练模拟引擎
│   │   └── analysis_service.py # 分析报告服务
│   └── utils/
│       ├── __init__.py
│       └── redis_slot.py      # Redis 槽位计算
├── data/
│   ├── nodes.yaml             # 示例节点配置
│   ├── slot-events.jsonl       # 示例槽位事件
│   └── requests.jsonl         # 示例请求记录
└── bad-samples/
    ├── invalid-nodes.yaml     # 无效 YAML（测试用）
    └── invalid-json.jsonl      # 无效 JSON（测试用）
```

## 数据库模型

### 系统使用 SQLite 存储以下数据：

- **nodes** - 集群节点信息
- **slots** - 槽位分配和状态
- **requests** - 请求记录
- **slot_events** - 槽位事件历史
- **failure_events** - 故障事件
- **drill_tasks** - 演练任务
- **drill_results** - 演练结果
- **diagnoses** - 诊断结论

## 测试建议

### 典型演练场景

1. **槽位迁移演练**
   - 配置: `enable_moved_redirect=true`, `enable_ask_redirect=true`
   - 目的: 测试客户端对重定向处理

2. **读写分离演练**
   - 配置: `enable_read_write_routing=true`, `enable_replication_lag=true`
   - 目的: 测试读请求路由到 slave 的延迟影响

3. **故障转移演练**
   - 配置: `enable_sentinel_failover=true`
   - 目的: 测试 master 故障后的可用性

4. **Lua/事务风险演练**
   - 配置: `enable_lua_transaction_failure=true`
   - 目的: 发现迁移期间的跨槽操作风险

### 对比分析

创建多个不同配置的演练任务，然后使用对比分析：

```bash
# 任务1: 启用重定向处理
# 任务2: 禁用重定向处理
# 对比两者的成功率和可用性
curl -X POST "http://localhost:8000/api/v1/analysis/compare?task_ids=1&task_ids=2"
```

## License

MIT License
