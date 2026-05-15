# 客户环境探针 API (Customer Probe API)

基于 Go + SQLite 实现的客户环境探针诊断服务，支持幂等任务提交、网络探测、DNS解析、诊断结论生成和证据包导出。

## 技术栈

- **Go 1.21+** - 后端语言
- **SQLite** - 本地数据库
- **GORM** - ORM框架
- **标准库 net/http** - HTTP服务

## 核心功能

### 1. 客户环境管理
- 支持多客户、多区域环境配置
- 环境代理设置管理
- 环境维度的任务隔离

### 2. 探针任务生命周期
- **任务创建** - 支持幂等键防止重复提交
- **任务分配** - 分配给指定探针代理
- **任务执行** - 状态跟踪（pending/assigned/running/completed/failed/timeout）
- **结果提交** - 网络探测结果和DNS解析记录
- **重试机制** - 支持最大重试次数配置

### 3. 幂等性保证
- 每次任务提交必须携带幂等键（idempotency_key）
- 相同幂等键的重复请求不会创建新任务，直接返回已有任务
- 通过响应头 `X-Duplicate-Request: true` 标识重复请求

### 4. 诊断结论生成
- 任务完成后自动生成诊断结论
- 基于HTTP状态码、响应时间、DNS解析结果智能分析
- 区分严重等级（critical/high/medium/low）
- 包含根因分析和修复建议

### 5. 证据包导出
- 单任务证据包导出（ZIP格式）
- 环境历史批量导出
- 包含任务信息、网络结果、DNS记录、诊断结论
- 支持审计追溯

## 数据模型

```
CustomerEnvironment
├── id
├── customer_id
├── name
├── description
├── region
└── created_at / updated_at

ProbeTask
├── id
├── idempotency_key (唯一索引)
├── env_id
├── task_type
├── target_url
├── status
├── priority
├── timeout_seconds
├── retry_count
├── max_retries
├── assigned_agent
├── error_msg
└── 时间戳字段

NetworkResult
├── id
├── task_id
├── success
├── http_status_code
├── response_time_ms
├── response_size
├── error_message
├── request_headers
├── response_headers
├── raw_response
└── created_at

DNSRecord
├── id
├── task_id
├── domain
├── record_type
├── values
├── ttl
├── resolve_time_ms
├── error_msg
└── created_at

ProxySetting
├── id
├── env_id
├── type
├── host
├── port
├── username
├── password
├── is_enabled
└── 时间戳字段

DiagnosisConclusion
├── id
├── task_id (唯一索引)
├── conclusion
├── severity
├── root_cause
├── suggestions
├── affected_areas
├── generated_by
└── created_at
```

## API 接口

### 环境管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/environments` | 创建客户环境 |
| GET | `/api/environments` | 列出所有环境（支持按customer_id筛选） |
| GET | `/api/environments/{id}` | 获取环境详情 |
| PUT | `/api/environments/{id}` | 更新环境信息 |
| DELETE | `/api/environments/{id}` | 删除环境 |
| POST | `/api/environments/{id}/proxies` | 添加代理设置 |
| GET | `/api/environments/{id}/proxies` | 获取环境代理列表 |
| DELETE | `/api/proxies/{id}` | 删除代理设置 |

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks` | 创建探针任务（幂等） |
| GET | `/api/tasks` | 列出任务（支持按env_id/status筛选） |
| GET | `/api/tasks/{id}` | 获取任务详情 |
| GET | `/api/tasks/{id}/full` | 获取任务完整数据（含结果和结论） |
| POST | `/api/tasks/{id}/assign` | 分配任务 |
| POST | `/api/tasks/{id}/start` | 开始执行任务 |
| POST | `/api/tasks/{id}/complete` | 完成任务（提交结果） |
| POST | `/api/tasks/{id}/fail` | 标记任务失败 |
| POST | `/api/tasks/{id}/timeout` | 标记任务超时 |
| GET | `/api/tasks/idempotency?key={key}` | 通过幂等键查询任务 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/tasks/{id}/evidence` | 导出单任务证据包（ZIP） |
| GET | `/api/export/environments/{id}/history` | 导出环境历史记录（支持时间范围） |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |

## 快速开始

### 1. 启动服务

```bash
# 直接运行
go run cmd/api/main.go

# 或编译后运行
go build -o probe-api cmd/api/main.go
./probe-api
```

服务将在 `http://localhost:8080` 启动。

### 2. 运行完整测试

```bash
# 确保服务已启动后执行
./test_api.sh
```

### 3. 手动测试示例

#### 创建环境
```bash
curl -X POST http://localhost:8080/api/environments \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "name": "生产环境",
    "region": "cn-beijing"
  }'
```

#### 创建任务（带幂等键）
```bash
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "env_id": "your-env-id",
    "task_type": "network_probe",
    "target_url": "https://api.example.com",
    "idempotency_key": "probe_20240515_001"
  }'
```

#### 完成任务并提交结果
```bash
curl -X POST http://localhost:8080/api/tasks/{task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "network_result": {
      "success": true,
      "http_status_code": 200,
      "response_time_ms": 156
    },
    "dns_records": [
      {
        "domain": "api.example.com",
        "record_type": "A",
        "values": "10.0.0.1",
        "resolve_time_ms": 12
      }
    ]
  }'
```

#### 导出证据包
```bash
curl -o evidence.zip http://localhost:8080/api/export/tasks/{task_id}/evidence
```

## 关键设计要点

### 幂等性实现
```go
// 相同 idempotency_key 的请求只会创建一次任务
// 重复请求直接返回已存在的任务，并标记 X-Duplicate-Request: true
task, isDuplicate, err := taskService.CreateTask(req)
```

### 状态流转
```
pending → assigned → running → completed
                                 → failed
                                 → timeout
```

### 自动诊断逻辑
- HTTP 2xx → 正常，低严重级别
- HTTP 4xx → 客户端错误，中严重级别
- HTTP 5xx → 服务端错误，高严重级别
- 连接超时/DNS失败 → 关键故障，严重级别
- 响应时间过长 → 性能警告

### 证据包结构
```
probe_evidence_{task_id}.zip
├── task.json          # 任务基本信息
├── network_results.json  # 网络探测结果
├── dns_records.json   # DNS解析记录
├── conclusion.json    # 诊断结论
└── README.txt         # 说明文档
```

## 数据库文件

数据库文件默认存储在 `./data/probe.db`，包含所有环境、任务、结果数据。

## 项目结构

```
.
├── cmd/
│   └── api/
│       └── main.go          # 主程序入口
├── internal/
│   ├── models/
│   │   └── models.go        # 数据模型定义
│   ├── repository/          # 数据库访问层
│   │   ├── environment.go
│   │   ├── task.go
│   │   ├── network_result.go
│   │   ├── dns_record.go
│   │   ├── proxy_setting.go
│   │   └── conclusion.go
│   ├── service/             # 业务逻辑层
│   │   ├── environment_service.go
│   │   ├── task_service.go
│   │   └── export_service.go
│   └── handler/             # HTTP处理器
│       ├── handler.go
│       ├── environment_handler.go
│       ├── task_handler.go
│       └── export_handler.go
├── pkg/
│   ├── database/            # 数据库初始化
│   │   └── database.go
│   └── utils/               # 工具函数
│       └── utils.go
├── data/                    # 数据库文件目录 (运行时生成)
├── test_api.sh              # 完整API测试脚本
├── go.mod
├── go.sum
└── README.md
```

## 扩展建议

1. **增加认证中间件** - JWT/API Key认证
2. **增加任务队列** - 使用异步队列处理任务调度
3. **增加WebSocket推送** - 实时推送任务状态变更
4. **增加更多探测类型** - TCP/UDP/ICMP/Ping等
5. **增加告警规则** - 基于诊断结论触发告警
6. **增加统计看板** - 成功率、响应时间趋势等指标
7. **数据库迁移到PostgreSQL** - 支持更高并发场景
