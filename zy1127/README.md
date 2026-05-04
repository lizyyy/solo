# Concurrency Detector - Go 并发问题诊断工具

一个本地 Go 后端小工具，专门用于排查项目中的 map 并发访问和 goroutine 卡住问题。

## 功能特性

- **项目管理**: 创建和管理多个观测项目
- **数据导入**: 支持导入 `map-events.jsonl`、`goroutines.txt`、`workers.json` 格式的样例数据
- **智能分析**: 内置 7 种分析规则，自动识别并发风险
- **可控复现**: 提供 replay 接口，用可控并发复现简化版风险，带超时和取消保护
- **多格式导出**: 支持 JSON、CSV、Markdown 三种报告格式
- **SQLite 持久化**: 本地文件存储，无需外部依赖

## 支持的风险类别

| 类别 | 严重级别 | 说明 |
|------|----------|------|
| `concurrent_map` | Critical | 并发 map 未加锁读写 - Go 运行时会 panic |
| `goroutine_leak` | Critical | Goroutine 泄漏/卡住 - 内存持续增长 |
| `hot_key_write` | High | 热点 Key 频繁写入 - 导致锁竞争 |
| `worker_backlog` | High | Worker 队列积压 - 上游阻塞风险 |
| `channel_blocked` | High | Channel 阻塞 - 死锁风险 |
| `coarse_lock` | Medium | 锁粒度过粗 - 降低并发性能 |
| `context_missing` | Medium | Context 未传递 - 无法优雅取消 |

## 快速开始

### 1. 构建项目

```bash
go build -o detector ./cmd/server
```

### 2. 启动服务

```bash
./detector --port 8080 --db ./detector.db
```

服务默认监听 `http://localhost:8080`

### 3. 健康检查

```bash
curl http://localhost:8080/health
```

## 完整使用流程

### 步骤 1: 创建项目

```bash
PROJECT_ID=$(curl -s -X POST http://localhost:8080/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "order-service", "description": "订单服务并发分析"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Project ID: $PROJECT_ID"
```

### 步骤 2: 导入数据

#### 导入 Map 事件数据

```bash
# 导入异常数据（会触发风险检测）
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=map-events" \
  -H "Content-Type: application/jsonl" \
  --data-binary @examples/anomalous-map-events.jsonl

# 或者导入正常数据（不会触发风险）
# curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=map-events" \
#   -H "Content-Type: application/jsonl" \
#   --data-binary @examples/normal-map-events.jsonl
```

#### 导入 Goroutine 快照数据

```bash
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=goroutines" \
  -H "Content-Type: application/json" \
  --data-binary @examples/anomalous-goroutines.json
```

#### 导入 Worker 队列数据

```bash
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=workers" \
  -H "Content-Type: application/json" \
  --data-binary @examples/anomalous-workers.json
```

### 步骤 3: 运行分析

```bash
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/analyze" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

### 步骤 4: 查看分析结果

```bash
curl -s "http://localhost:8080/projects/$PROJECT_ID/analysis" | python3 -m json.tool
```

### 步骤 5: 查看项目统计

```bash
curl -s "http://localhost:8080/projects/$PROJECT_ID/stats" | python3 -m json.tool
```

### 步骤 6: 复现风险（Replay）

Replay 接口会创建一个可控的并发环境来模拟检测到的风险，所有操作都带超时保护，不会让服务挂死。

#### 复现并发 Map 访问风险

```bash
TASK_ID=$(curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/replay" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "concurrent_map",
    "concurrency": 10,
    "duration_seconds": 3,
    "timeout_seconds": 30,
    "config": {
      "use_lock": false
    }
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['task_id'])")

echo "Task ID: $TASK_ID"
```

#### 查看复现任务状态

```bash
# 等待几秒让任务完成
sleep 5

curl -s "http://localhost:8080/projects/$PROJECT_ID/replay/$TASK_ID" | python3 -m json.tool
```

#### 其他可用的复现类别

| 类别 | 说明 | 配置参数 |
|------|------|----------|
| `concurrent_map` | 并发 map 访问 | `use_lock`: 是否使用锁 |
| `hot_key_write` | 热点 key 写入 | `hot_key_ratio`: 热点比例 |
| `goroutine_leak` | goroutine 泄漏 | `use_context`: 是否使用 context |
| `channel_blocked` | channel 阻塞 | `use_timeout`: 是否使用超时 |
| `worker_backlog` | worker 队列积压 | `task_count`, `worker_count` |

#### 示例：复现带锁的安全访问（用于对比）

```bash
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/replay" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "concurrent_map",
    "concurrency": 10,
    "duration_seconds": 3,
    "config": {
      "use_lock": true
    }
  }'
```

### 步骤 7: 导出报告

#### 导出 JSON 格式

```bash
curl -s "http://localhost:8080/projects/$PROJECT_ID/export/json" > report.json
```

#### 导出 CSV 格式

```bash
curl -s "http://localhost:8080/projects/$PROJECT_ID/export/csv" > report.csv
```

#### 导出 Markdown 格式

```bash
curl -s "http://localhost:8080/projects/$PROJECT_ID/export/markdown" > report.md
```

## API 接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/projects` | 列出所有项目 |
| POST | `/projects` | 创建新项目 |
| GET | `/projects/{id}` | 获取项目详情 |
| POST | `/projects/{id}/ingest` | 导入数据 |
| POST | `/projects/{id}/analyze` | 运行分析 |
| GET | `/projects/{id}/analysis` | 获取分析结果 |
| POST | `/projects/{id}/replay` | 创建复现任务 |
| GET | `/projects/{id}/replay/{taskId}` | 获取复现任务状态 |
| GET | `/projects/{id}/workers` | 获取 worker 队列和复现任务 |
| GET | `/projects/{id}/export/{format}` | 导出报告 |
| GET | `/projects/{id}/stats` | 获取项目统计 |

## 数据格式说明

### Map 事件格式 (map-events.jsonl)

每行一个 JSON 对象：

```json
{
  "map_name": "user_cache",
  "key": "user_123",
  "operation": "WRITE",
  "goroutine_id": 1,
  "has_lock": false,
  "lock_type": "Mutex",
  "timestamp": "2026-05-04T10:00:00.001Z",
  "stack_frame": "main.(*UserService).UpdateProfile"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `map_name` | string | map 名称 |
| `key` | string | 操作的 key |
| `operation` | string | `READ` 或 `WRITE` |
| `goroutine_id` | int | goroutine ID |
| `has_lock` | bool | 是否持有锁 |
| `lock_type` | string | 锁类型：`Mutex`, `RWMutex` 等 |
| `timestamp` | string | 时间戳 (RFC3339) |
| `stack_frame` | string | 调用栈帧 |

### Goroutine 快照格式 (goroutines.json)

```json
[
  {
    "snapshot_id": "snap_001",
    "goroutine_id": 100,
    "state": "blocked",
    "stack": "goroutine 100 [chan send]:\nmain.(*Worker).process",
    "blocked_reason": "channel send",
    "blocked_since": "2026-05-04T10:00:00Z",
    "timestamp": "2026-05-04T10:00:00Z"
  }
]
```

### Worker 队列格式 (workers.json)

```json
[
  {
    "queue_name": "api_request_queue",
    "worker_count": 2,
    "queue_capacity": 100,
    "queue_length": 95,
    "pending_tasks": 150,
    "failed_tasks": 23,
    "completed_tasks": 1250,
    "last_task_duration_ms": 500000000,
    "timestamp": "2026-05-04T10:00:00Z"
  }
]
```

## 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包测试
go test ./internal/analyzer/... -v

# 带 race 检测运行（推荐用于并发代码）
go test ./... -race
```

## 样例数据

`examples/` 目录包含以下样例数据：

| 文件 | 说明 |
|------|------|
| `anomalous-map-events.jsonl` | 异常 Map 事件（会触发并发风险检测） |
| `anomalous-goroutines.json` | 异常 Goroutine 快照（包含阻塞和泄漏迹象） |
| `anomalous-workers.json` | 异常 Worker 队列（积压严重） |
| `normal-map-events.jsonl` | 正常 Map 事件（正确使用锁） |
| `normal-workers.json` | 正常 Worker 队列（健康状态） |

## 错误响应示例

服务会返回结构化的错误响应：

```json
{
  "error": "Project not found",
  "code": 404,
  "success": false
}
```

```json
{
  "error": "Invalid request body",
  "code": 400,
  "success": false,
  "details": "unexpected EOF"
}
```

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 8080 | HTTP 服务端口 |
| `--db` | ./detector.db | SQLite 数据库路径 |
| `--addr` | localhost | 绑定地址 |

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 主入口
├── internal/
│   ├── api/
│   │   └── api.go           # HTTP API 处理器
│   ├── analyzer/
│   │   ├── analyzer.go      # 分析规则引擎
│   │   └── analyzer_test.go # 分析测试
│   ├── exporter/
│   │   └── exporter.go      # 报告导出器
│   ├── models/
│   │   └── models.go        # 数据模型
│   ├── replay/
│   │   └── replay.go        # 风险复现器
│   └── store/
│       └── store.go         # SQLite 存储层
├── examples/
│   ├── anomalous-map-events.jsonl
│   ├── anomalous-goroutines.json
│   ├── anomalous-workers.json
│   ├── normal-map-events.jsonl
│   └── normal-workers.json
├── go.mod
├── go.sum
└── README.md
```

## 一键脚本示例

```bash
#!/bin/bash

# 1. 启动服务（后台运行）
./detector --port 8080 &
SERVER_PID=$!
sleep 2

# 2. 创建项目
PROJECT_ID=$(curl -s -X POST http://localhost:8080/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "quick-test", "description": "快速测试"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Project: $PROJECT_ID"

# 3. 导入数据
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=map-events" \
  -H "Content-Type: application/jsonl" \
  --data-binary @examples/anomalous-map-events.jsonl

curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/ingest?type=goroutines" \
  -H "Content-Type: application/json" \
  --data-binary @examples/anomalous-goroutines.json

# 4. 分析
curl -s -X POST "http://localhost:8080/projects/$PROJECT_ID/analyze" | python3 -m json.tool

# 5. 导出报告
curl -s "http://localhost:8080/projects/$PROJECT_ID/export/markdown" > report.md
echo "报告已生成: report.md"

# 6. 停止服务
kill $SERVER_PID
```

## 许可证

MIT License
