# Performance Tracker - 性能排查服务

一个偏技术向的本地 Go 后端服务，专门用来帮小团队排查"接口功能没坏，但最近变慢了"的问题。

## 功能特性

- **项目管理**: 创建性能排查项目，登记服务名、路由、性能预算
- **文件导入**: 支持导入 routes.yaml、samples.jsonl、baseline.json、profile-events.json
- **回放任务**: 发起本地压测/回放任务，设置并发数、目标 RPS、超时、持续时间
- **性能指标**: 记录 p50/p95/p99、吞吐、错误率、超时数等指标
- **基线对比**: 与基线数据对比，识别性能回退
- **慢路径归因**: 基于规则的问题识别，包括 SQL 慢、缓存命中率低、连接池等待等
- **报告导出**: 支持 Markdown、JSON、CSV 三种格式的报告导出

## 项目结构

```
zy1126/
├── cmd/api/
│   └── main.go              # 主入口文件
├── internal/
│   ├── config/
│   │   └── config.go        # 配置管理
│   ├── handlers/
│   │   ├── project_handler.go   # 项目管理 API
│   │   ├── route_handler.go     # 路由管理 API
│   │   ├── import_handler.go    # 文件导入 API
│   │   ├── run_handler.go       # 运行任务 API
│   │   ├── analysis_handler.go  # 分析 API
│   │   └── report_handler.go    # 报告导出 API
│   ├── middleware/
│   │   └── middleware.go        # 中间件
│   ├── models/
│   │   └── models.go            # 数据模型
│   ├── repository/
│   │   └── repository.go        # 数据库访问层
│   └── services/
│       ├── project_service.go   # 项目服务
│       ├── route_service.go     # 路由服务
│       ├── import_service.go    # 导入服务
│       ├── run_service.go       # 运行服务
│       ├── comparison_service.go # 对比服务
│       ├── attribution_service.go # 归因服务
│       └── report_service.go    # 报告服务
├── pkg/
│   ├── logger/
│   │   └── logger.go            # 日志工具
│   └── utils/
│       └── utils.go             # 工具函数
├── testdata/
│   ├── routes.yaml              # 路由配置样例
│   ├── samples.jsonl            # 请求样例
│   ├── baseline.json            # 基线数据
│   └── profile-events.json      # 性能事件
└── go.mod
```

## 快速开始

### 前置条件

- Go 1.19 或更高版本
- SQLite（可选，因为 Go 驱动内置了）

### 安装步骤

1. 克隆项目并进入目录：

```bash
cd zy1126
```

2. 下载依赖：

```bash
go mod tidy
```

3. 运行服务：

```bash
go run cmd/api/main.go
```

服务默认运行在 `http://localhost:8080`

### 配置

可以通过配置文件修改默认设置，创建 `config.yaml` 文件：

```yaml
server:
  host: "0.0.0.0"
  port: "8080"

database:
  path: "./data/perf-tracker.db"

logging:
  level: "info"
  format: "text"
```

然后运行：

```bash
go run cmd/api/main.go --config=config.yaml
```

## API 文档

### 健康检查

```bash
curl http://localhost:8080/health
```

### 项目管理

#### 创建项目

```bash
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-service-2024-q4",
    "description": "用户服务 Q4 性能排查项目",
    "service_name": "user-service",
    "version": "v2.1.0"
  }'
```

#### 获取项目列表

```bash
curl http://localhost:8080/api/v1/projects
```

#### 获取项目详情

```bash
curl http://localhost:8080/api/v1/projects/1
```

#### 删除项目

```bash
curl -X DELETE http://localhost:8080/api/v1/projects/1
```

### 路由管理

#### 添加路由

```bash
curl -X POST http://localhost:8080/api/v1/projects/1/routes \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "path": "/api/users",
    "description": "获取用户列表",
    "p95_max_ms": 200,
    "p99_max_ms": 500,
    "error_rate_max": 0.01
  }'
```

#### 获取项目路由列表

```bash
curl http://localhost:8080/api/v1/projects/1/routes
```

### 文件导入

#### 导入 routes.yaml

```bash
curl -X POST http://localhost:8080/api/v1/import/routes \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=1" \
  -F "file=@testdata/routes.yaml"
```

#### 导入 samples.jsonl

```bash
curl -X POST http://localhost:8080/api/v1/import/samples \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=1" \
  -F "file=@testdata/samples.jsonl"
```

#### 导入 baseline.json

```bash
curl -X POST http://localhost:8080/api/v1/import/baseline \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=1" \
  -F "file=@testdata/baseline.json"
```

#### 导入 profile-events.json

```bash
curl -X POST http://localhost:8080/api/v1/import/profile-events \
  -H "Content-Type: multipart/form-data" \
  -F "run_id=1" \
  -F "file=@testdata/profile-events.json"
```

### 运行任务

#### 创建运行任务

```bash
curl -X POST http://localhost:8080/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "v2.1.0-rc1-回放测试",
    "description": "RC1 版本性能回归测试",
    "concurrency": 10,
    "target_rps": 50,
    "timeout_ms": 5000,
    "total_requests": 500
  }'
```

#### 启动运行任务

```bash
curl -X POST http://localhost:8080/api/v1/runs/1/start
```

#### 获取运行状态

```bash
curl http://localhost:8080/api/v1/runs/1
```

#### 获取项目所有运行

```bash
curl http://localhost:8080/api/v1/projects/1/runs
```

#### 停止运行任务

```bash
curl -X POST http://localhost:8080/api/v1/runs/1/stop
```

### 性能分析

#### 与基线对比

```bash
curl http://localhost:8080/api/v1/compare?run_id=1
```

#### 慢路径归因分析

```bash
curl http://localhost:8080/api/v1/analysis/attribution?run_id=1
```

### 报告导出

#### 导出 JSON 报告

```bash
curl http://localhost:8080/api/v1/reports/1/export?format=json
```

#### 导出 CSV 报告

```bash
curl http://localhost:8080/api/v1/reports/1/export?format=csv
```

#### 导出 Markdown 报告

```bash
curl http://localhost:8080/api/v1/reports/1/export?format=markdown
```

#### 获取所有报告

```bash
curl http://localhost:8080/api/v1/projects/1/reports
```

## 完整使用流程示例

以下是一个完整的使用流程，从创建项目到导出报告：

```bash
# 1. 检查服务是否启动
curl http://localhost:8080/health

# 2. 创建项目
PROJECT_ID=$(curl -s -X POST http://localhost:8080/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-service-2024-q4",
    "description": "用户服务 Q4 性能排查项目",
    "service_name": "user-service",
    "version": "v2.1.0"
  }' | jq -r '.id')

echo "Project ID: $PROJECT_ID"

# 3. 导入路由配置
curl -X POST http://localhost:8080/api/v1/import/routes \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=$PROJECT_ID" \
  -F "file=@testdata/routes.yaml"

# 4. 导入请求样本
curl -X POST http://localhost:8080/api/v1/import/samples \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=$PROJECT_ID" \
  -F "file=@testdata/samples.jsonl"

# 5. 导入基线数据
curl -X POST http://localhost:8080/api/v1/import/baseline \
  -H "Content-Type: multipart/form-data" \
  -F "project_id=$PROJECT_ID" \
  -F "file=@testdata/baseline.json"

# 6. 创建运行任务
RUN_ID=$(curl -s -X POST http://localhost:8080/api/v1/runs \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"name\": \"v2.1.0-rc1-回放测试\",
    \"description\": \"RC1 版本性能回归测试\",
    \"concurrency\": 5,
    \"target_rps\": 20,
    \"timeout_ms\": 5000,
    \"total_requests\": 100
  }" | jq -r '.id')

echo "Run ID: $RUN_ID"

# 7. 启动运行任务
curl -X POST http://localhost:8080/api/v1/runs/$RUN_ID/start

# 8. 等待运行完成（可选，轮询状态）
for i in {1..30}; do
  STATUS=$(curl -s http://localhost:8080/api/v1/runs/$RUN_ID | jq -r '.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 2
done

# 9. 导入性能事件（模拟真实场景中的慢事件）
curl -X POST http://localhost:8080/api/v1/import/profile-events \
  -H "Content-Type: multipart/form-data" \
  -F "run_id=$RUN_ID" \
  -F "file=@testdata/profile-events.json"

# 10. 查看与基线对比
curl http://localhost:8080/api/v1/compare?run_id=$RUN_ID

# 11. 查看慢路径归因
curl http://localhost:8080/api/v1/analysis/attribution?run_id=$RUN_ID

# 12. 导出 JSON 报告
curl http://localhost:8080/api/v1/reports/1/export?format=json > report.json

# 13. 导出 Markdown 报告
curl http://localhost:8080/api/v1/reports/1/export?format=markdown > report.md

# 14. 导出 CSV 报告
curl http://localhost:8080/api/v1/reports/1/export?format=csv > report.csv
```

## 错误处理示例

服务会对各种异常输入返回合适的错误响应：

### 无效的项目 ID

```bash
curl http://localhost:8080/api/v1/projects/9999
```

响应：
```json
{
  "error": "项目不存在",
  "error_code": "PROJECT_NOT_FOUND"
}
```

### 无效的并发参数

```bash
curl -X POST http://localhost:8080/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "test",
    "concurrency": 0
  }'
```

响应：
```json
{
  "error": "并发数必须大于0",
  "error_code": "INVALID_RUN_CONFIG"
}
```

### 无效的预算格式

```bash
curl -X POST http://localhost:8080/api/v1/projects/1/routes \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "path": "/api/test",
    "error_rate_max": 1.5
  }'
```

响应：
```json
{
  "error": "错误率预算无效，必须在 0-1 之间",
  "error_code": "INVALID_BUDGET"
}
```

## 性能归因规则

服务会根据以下规则进行慢路径归因分析：

### SQL 性能问题

- **规则**: SQL 事件平均耗时 > 100ms 或总耗时占比 > 30%
- **严重程度**: 
  - 平均耗时 > 300ms: `critical`
  - 平均耗时 > 200ms: `high`
  - 平均耗时 > 100ms: `medium`
- **建议**: 检查索引、优化查询、考虑缓存

### 缓存命中率低

- **规则**: 缓存命中率 < 70%
- **严重程度**:
  - 命中率 < 50%: `critical`
  - 命中率 < 60%: `high`
  - 命中率 < 70%: `medium`
- **建议**: 检查缓存过期策略、考虑增加缓存时间

### 下游服务问题

- **规则**: 存在超时事件或下游调用平均耗时 > 500ms
- **严重程度**:
  - 存在超时: `critical`
  - 平均耗时 > 1000ms: `high`
  - 平均耗时 > 500ms: `medium`
- **建议**: 检查下游服务状态、考虑设置合理的超时

### 序列化耗时异常

- **规则**: 序列化事件平均耗时 > 50ms 或总耗时占比 > 15%
- **严重程度**:
  - 平均耗时 > 150ms: `high`
  - 平均耗时 > 100ms: `medium`
- **建议**: 考虑使用更高效的序列化方式、减少响应数据量

### 响应体过大

- **规则**: 响应体平均大小 > 64KB 或最大响应体 > 256KB
- **严重程度**:
  - 平均大小 > 256KB: `high`
  - 平均大小 > 64KB: `medium`
- **建议**: 考虑分页、压缩响应、减少不必要的字段

### 连接池等待

- **规则**: 连接池等待事件平均耗时 > 50ms 或总耗时占比 > 10%
- **严重程度**:
  - 平均耗时 > 200ms: `high`
  - 平均耗时 > 100ms: `medium`
- **建议**: 增加连接池大小、检查连接泄漏

## 性能回退检测阈值

与基线对比时，以下情况会被标记为性能回退：

- **p95 延迟**: 增加 > 20% 或 100ms（取较大值）
- **p99 延迟**: 增加 > 30% 或 200ms（取较大值）
- **吞吐率**: 下降 > 10%
- **错误率**: 增加 > 0.05（5%）
- **超时率**: 增加 > 0.02（2%）

## 样例数据说明

`testdata/` 目录包含以下样例文件：

1. **routes.yaml**: 包含 10 个路由的性能预算配置
2. **samples.jsonl**: 包含 20 个请求样本，涵盖不同的 HTTP 方法和路径
3. **baseline.json**: 稳定版本的基线性能数据
4. **profile-events.json**: 包含各种类型的性能事件，用于测试归因分析

## 技术栈

- **语言**: Go 1.19+
- **Web 框架**: Gorilla Mux
- **ORM**: GORM
- **数据库**: SQLite
- **日志**: Logrus
- **配置**: Viper

## 许可证

MIT License
