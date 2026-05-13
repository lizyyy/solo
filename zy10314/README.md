# 第三方 API 熔断仲裁服务

基于 Go + Gin + SQLite 实现的第三方 API 熔断仲裁服务，支持研发和支持团队按同一套记录排查问题。

## 核心特性

- **熔断状态机**：CLOSED → OPEN → HALF_OPEN 完整状态流转
- **半开探测**：熔断恢复期间的有限流量探测机制
- **调用方隔离**：按业务调用方独立统计和熔断
- **去重机制**：防止重复提交制造脏数据
- **仲裁日志**：完整的操作审计记录
- **人工干预**：支持强制熔断和手动重置

## 数据模型

1. **ExternalAPI** - 外部接口定义
2. **BusinessCaller** - 业务调用方
3. **CircuitThreshold** - 熔断阈值配置
4. **CircuitBreaker** - 熔断器实例
5. **ProbeResult** - 调用探测结果
6. **HalfOpenRequest** - 半开状态请求记录
7. **RecoveryConclusion** - 恢复结论记录
8. **ArbitrationLog** - 仲裁操作日志
9. **RequestDeduplication** - 请求去重记录

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run main.go
```

服务默认监听 `http://localhost:8080`

### 3. 健康检查

```bash
curl http://localhost:8080/health
```

## 关键接口

### 基础资源管理

#### 创建外部 API
```bash
curl -X POST http://localhost:8080/api/v1/external-apis \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Gateway API",
    "endpoint": "https://api.payment.example.com/v1/charge",
    "method": "POST",
    "description": "Third-party payment processing service"
  }'
```

#### 创建业务调用方
```bash
curl -X POST http://localhost:8080/api/v1/business-callers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Service",
    "system_code": "order-svc-001",
    "description": "E-commerce order processing service"
  }'
```

### 熔断核心接口

#### 检查熔断状态（调用前必调）
```bash
curl -X POST http://localhost:8080/api/v1/circuit/check \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-123456",
    "external_api_id": "api-uuid-here",
    "business_caller_id": "caller-uuid-here"
  }'
```

**响应示例：**
```json
{
  "code": 200,
  "message": "Circuit check completed",
  "data": {
    "allowed": true,
    "reason": "Circuit is CLOSED",
    "circuit_breaker_id": "cb-uuid-here",
    "state": "CLOSED",
    "is_duplicate": false
  }
}
```

#### 记录调用结果
```bash
curl -X POST http://localhost:8080/api/v1/circuit/record \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-123456",
    "circuit_breaker_id": "cb-uuid-here",
    "result": "SUCCESS",
    "duration_ms": 150,
    "error_message": "",
    "response_code": 200
  }'
```

**result 可选值：** `SUCCESS` | `FAILURE` | `TIMEOUT`

#### 手动重置熔断器
```bash
curl -X POST http://localhost:8080/api/v1/circuit/reset \
  -H "Content-Type: application/json" \
  -d '{
    "circuit_breaker_id": "cb-uuid-here",
    "operator": "admin@example.com"
  }'
```

#### 强制开启熔断
```bash
curl -X POST http://localhost:8080/api/v1/circuit/force-open \
  -H "Content-Type: application/json" \
  -d '{
    "circuit_breaker_id": "cb-uuid-here",
    "operator": "admin@example.com",
    "reason": "Emergency maintenance"
  }'
```

### 查询接口

#### 列出所有熔断器
```bash
curl http://localhost:8080/api/v1/circuit-breakers
```

#### 获取单个熔断器详情
```bash
curl http://localhost:8080/api/v1/circuit-breakers/{id}
```

#### 获取仲裁历史记录
```bash
curl http://localhost:8080/api/v1/circuit-breakers/{id}/history?limit=50
```

## 会被拦截的路径示例

### 场景 1：熔断器处于 OPEN 状态

当连续失败达到阈值（默认 5 次），熔断器自动打开：

```bash
# 连续 5 次失败调用后，检查状态
curl -X POST http://localhost:8080/api/v1/circuit/check \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-test-open",
    "external_api_id": "api-uuid",
    "business_caller_id": "caller-uuid"
  }'
```

**被拦截的响应：**
```json
{
  "code": 200,
  "message": "Circuit check completed",
  "data": {
    "allowed": false,
    "reason": "Circuit is OPEN",
    "circuit_breaker_id": "cb-uuid",
    "state": "OPEN",
    "is_duplicate": false
  }
}
```

### 场景 2：重复请求检测

相同 request_id 或相同内容的请求会被拦截：

```bash
# 第一次请求 - 通过
curl -X POST http://localhost:8080/api/v1/circuit/check \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-duplicate-001",
    "external_api_id": "api-uuid",
    "business_caller_id": "caller-uuid"
  }'

# 第二次相同 request_id - 被拦截
curl -X POST http://localhost:8080/api/v1/circuit/check \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-duplicate-001",
    "external_api_id": "api-uuid",
    "business_caller_id": "caller-uuid"
  }'
```

**被拦截的响应：**
```json
{
  "code": 409,
  "message": "request is being processed"
}
```

### 场景 3：半开状态达到最大探测次数

当熔断器从 OPEN 进入 HALF_OPEN 状态后，允许有限次数的探测请求：

```bash
# 第 4 次半开探测请求（默认阈值 3 次）
curl -X POST http://localhost:8080/api/v1/circuit/check \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-halfopen-test",
    "external_api_id": "api-uuid",
    "business_caller_id": "caller-uuid"
  }'
```

**被拦截的响应：**
```json
{
  "code": 200,
  "message": "Circuit check completed",
  "data": {
    "allowed": false,
    "reason": "Half-open max calls reached",
    "circuit_breaker_id": "cb-uuid",
    "state": "HALF_OPEN",
    "is_duplicate": false
  }
}
```

## 配置说明

`config.yaml` 配置项：

```yaml
server:
  port: 8080
  mode: debug  # debug | release | test

database:
  path: ./circuit_breaker.db

circuit_breaker:
  default_failure_threshold: 5       # 触发熔断的失败次数
  default_half_open_max_calls: 3     # 半开状态最大探测次数
  default_sleep_window_seconds: 30    # 熔断恢复等待时间（秒）
  default_minimum_requests: 10        # 统计最小请求数
```

## 状态流转图

```
          +------------------+
          |     CLOSED       |  <-- 正常状态，请求通过
          +------------------+
                   |
                   | 失败次数达到阈值
                   v
          +------------------+
          |      OPEN        |  <-- 熔断状态，请求被拦截
          +------------------+
                   |
                   | 睡眠窗口过期
                   v
          +------------------+
          |    HALF_OPEN     |  <-- 半开状态，有限探测
          +------------------+
              /         \
  连续成功  /           \  任何失败
            /             \
           v               v
    +-----------+     +-----------+
    |  CLOSED   |     |   OPEN    |
    +-----------+     +-----------+
```

## 项目结构

```
.
├── main.go                 # 程序入口
├── config.yaml             # 配置文件
├── go.mod                  # 依赖管理
├── config/                 # 配置加载
├── models/                 # 数据模型
├── services/               # 业务逻辑
│   ├── circuit_breaker.go  # 熔断核心服务
│   └── deduplication.go    # 去重服务
├── handlers/               # HTTP 处理器
│   ├── handlers.go         # 接口实现
│   └── dto.go              # 数据传输对象
├── utils/                  # 工具类
│   ├── database.go         # 数据库初始化
│   └── hash.go             # 哈希工具
└── data/
    └── test_data.json      # 测试数据
```
