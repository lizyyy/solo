# Pool Diagnostic Service

数据库连接池监控与诊断服务，用于分析连接池的借出、归还、等待、超时和疑似泄漏等问题。

## 功能特性

- **数据导入**：支持导入 pool-events.jsonl、queries.csv、transactions.json、tenants.csv、pool-config.yaml
- **状态查询**：实时查看连接池状态、活跃连接、等待队列、租户信息
- **时间线分析**：查看某个连接或请求的完整时间线
- **诊断分析**：自动检测 8 种常见问题：
  - 连接未归还（泄漏）
  - 长事务
  - 慢 SQL 占用
  - 等待队列饥饿
  - 配置不合理
  - 租户争抢
  - 连接抖动
  - 超时重试放大
- **配置模拟**：模拟 maxOpen/maxIdle/idleTimeout/租户配额等配置变化
- **告警管理**：确认告警、标记误报
- **报告导出**：支持 Markdown、JSON、CSV 格式

## 快速开始

### 环境要求

- Go 1.21+

### 安装依赖

```bash
go mod download
```

### 运行测试

```bash
go test ./... -v
```

### 启动服务

```bash
go run main.go
```

服务默认运行在 `http://localhost:8080`

## API 接口

### 基础路径

`http://localhost:8080/api/v1`

### 导入数据

#### 导入连接池事件 (JSONL)

```bash
curl -X POST http://localhost:8080/api/v1/import/pool-events \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/pool-events.jsonl"}'
```

#### 导入 SQL 查询 (CSV)

```bash
curl -X POST http://localhost:8080/api/v1/import/queries \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/queries.csv"}'
```

#### 导入事务 (JSON)

```bash
curl -X POST http://localhost:8080/api/v1/import/transactions \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/transactions.json"}'
```

#### 导入租户配置 (CSV)

```bash
curl -X POST http://localhost:8080/api/v1/import/tenants \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/tenants.csv"}'
```

#### 导入连接池配置 (YAML)

```bash
curl -X POST http://localhost:8080/api/v1/import/config \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/pool-config.yaml"}'
```

### 查询状态

#### 获取连接池状态

```bash
curl http://localhost:8080/api/v1/pool/status
```

#### 获取活跃连接

```bash
curl http://localhost:8080/api/v1/pool/leases/active
```

#### 获取等待队列

```bash
curl http://localhost:8080/api/v1/pool/queue/waiting
```

#### 获取租户列表

```bash
curl http://localhost:8080/api/v1/pool/tenants
```

### 时间线分析

#### 查看连接时间线

```bash
curl http://localhost:8080/api/v1/timeline/connection/conn-001
```

#### 查看请求时间线

```bash
curl http://localhost:8080/api/v1/timeline/request/req-001
```

### 诊断分析

#### 运行完整诊断

```bash
curl -X POST http://localhost:8080/api/v1/diagnostics/run
```

#### 获取告警列表

```bash
# 获取所有开放告警
curl http://localhost:8080/api/v1/diagnostics/alerts

# 获取所有告警（包括已解决）
curl "http://localhost:8080/api/v1/diagnostics/alerts?status=all"
```

#### 更新告警状态

```bash
curl -X PUT http://localhost:8080/api/v1/diagnostics/alerts/{alert_id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "acknowledged"}'
```

有效状态值：`open`, `acknowledged`, `resolved`

#### 标记为误报

```bash
curl -X POST http://localhost:8080/api/v1/diagnostics/alerts/{alert_id}/false-positive
```

### 配置模拟

#### 模拟配置变更

```bash
curl -X POST http://localhost:8080/api/v1/simulate/config \
  -H "Content-Type: application/json" \
  -d '{
    "max_open": 30,
    "max_idle": 15,
    "idle_timeout": 300000000000,
    "tenant_quota": 6
  }'
```

- `idle_timeout` 单位：纳秒 (5分钟 = 300000000000 ns)

### 报告导出

#### 导出诊断报告

```bash
# Markdown 格式
curl "http://localhost:8080/api/v1/export/report?format=markdown"

# JSON 格式
curl "http://localhost:8080/api/v1/export/report?format=json"

# CSV 格式
curl "http://localhost:8080/api/v1/export/report?format=csv"
```

### 数据管理

#### 清空所有数据

```bash
curl -X DELETE http://localhost:8080/api/v1/data/clear
```

## 完整使用示例

### 1. 启动服务

```bash
go run main.go
```

### 2. 导入所有示例数据

```bash
# 导入配置
curl -X POST http://localhost:8080/api/v1/import/config \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/pool-config.yaml"}'

# 导入租户
curl -X POST http://localhost:8080/api/v1/import/tenants \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/tenants.csv"}'

# 导入连接池事件
curl -X POST http://localhost:8080/api/v1/import/pool-events \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/pool-events.jsonl"}'

# 导入 SQL 查询
curl -X POST http://localhost:8080/api/v1/import/queries \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/queries.csv"}'

# 导入事务
curl -X POST http://localhost:8080/api/v1/import/transactions \
  -H "Content-Type: application/json" \
  -d '{"file_path": "./data/transactions.json"}'
```

### 3. 查看当前状态

```bash
curl http://localhost:8080/api/v1/pool/status
```

### 4. 运行诊断分析

```bash
curl -X POST http://localhost:8080/api/v1/diagnostics/run
```

### 5. 查看告警

```bash
curl http://localhost:8080/api/v1/diagnostics/alerts
```

### 6. 模拟新配置

```bash
curl -X POST http://localhost:8080/api/v1/simulate/config \
  -H "Content-Type: application/json" \
  -d '{
    "max_open": 30,
    "max_idle": 15,
    "idle_timeout": 300000000000,
    "tenant_quota": 6
  }'
```

### 7. 导出诊断报告

```bash
curl "http://localhost:8080/api/v1/export/report?format=markdown"
```

## 数据格式说明

### pool-events.jsonl

每行一个 JSON 对象：

```json
{
  "event_type": "connection_borrow",
  "timestamp": "2026-05-04T10:00:00Z",
  "connection_id": "conn-001",
  "request_id": "req-001",
  "tenant_id": "tenant-001",
  "wait_duration": 50000000
}
```

事件类型：
- `connection_borrow` - 连接借出
- `connection_return` - 连接归还
- `wait_enqueue` - 进入等待队列
- `wait_timeout` - 等待超时
- `transaction_begin` - 事务开始
- `transaction_end` - 事务结束
- `sql_execute` - SQL 执行

### queries.csv

| 字段 | 说明 |
|------|------|
| connection_id | 连接 ID |
| request_id | 请求 ID |
| tenant_id | 租户 ID |
| start_time | 开始时间 (RFC3339) |
| end_time | 结束时间 (RFC3339) |
| duration_ms | 执行耗时 (毫秒) |
| sql_text | SQL 语句 |
| sql_type | SQL 类型 (SELECT/INSERT/UPDATE/DELETE/DDL/OTHER) |
| is_slow | 是否慢查询 (true/false) |
| error | 错误信息 |
| transaction_id | 事务 ID |

### transactions.json

```json
[
  {
    "id": "tx-001",
    "connection_id": "conn-004",
    "request_id": "req-004",
    "tenant_id": "tenant-003",
    "begin_time": "2026-05-04T10:05:01Z",
    "end_time": null,
    "status": "active",
    "commit_or_rollback": "",
    "sql_count": 2,
    "is_long_running": true
  }
]
```

状态值：
- `active` - 活跃
- `committed` - 已提交
- `