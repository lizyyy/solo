# Go 微服务练习框架

一个用于新人学习微服务架构的本地可运行的 Go 微服务小框架。

## 功能特性

### 核心组件
- **网关 (Gateway)**: 统一入口，请求路由，负载均衡
- **服务注册表 (Registry)**: 服务注册与发现，健康检查
- **配置管理**: 配置热加载，版本历史
- **中间件链**: 统一中间件管理，可插拔设计

### 高级特性
- **限流 (Rate Limiting)**: 基于滑动窗口的限流策略
- **熔断 (Circuit Breaker)**: 自动熔断与恢复机制
- **链路追踪**: Trace ID 透传，分布式追踪
- **持久化**: 注册表、配置版本、请求日志、熔断状态持久化

### 内置示例服务
- **User Service**: 用户管理服务 (端口 8091)
- **Order Service**: 订单管理服务 (端口 8092)

## 项目结构

```
.
├── cmd/                    # 命令行入口
│   ├── gateway/           # 网关服务入口
│   ├── registry/          # 注册表服务入口
│   ├── user/              # 用户服务入口
│   ├── order/             # 订单服务入口
│   └── report/            # 报告生成工具入口
├── internal/              # 内部包
│   ├── api/              # API 层
│   ├── config/           # 配置管理
│   ├── gateway/          # 网关核心
│   ├── middleware/       # 中间件链
│   ├── model/            # 数据模型
│   ├── persistence/      # 持久化层
│   └── registry/         # 注册表核心
├── pkg/                  # 公共包
│   ├── circuitbreaker/   # 熔断器
│   ├── ratelimit/        # 限流器
│   └── tracing/          # 链路追踪
├── services/             # 示例服务
│   ├── user/             # 用户服务
│   └── order/            # 订单服务
├── configs/              # 配置文件
├── data/                 # 持久化数据
├── tests/                # 测试文件
└── examples/             # 示例脚本
```

## 快速开始

### 环境要求
- Go 1.21+
- 确保 `GOPATH` 已正确配置

### 安装依赖

```bash
go mod download
```

### 启动服务

**方式一: 分别启动 (推荐用于学习)**

```bash
# 终端 1: 启动注册表服务
go run cmd/registry/main.go

# 终端 2: 启动网关服务
go run cmd/gateway/main.go

# 终端 3: 启动用户服务
go run cmd/user/main.go

# 终端 4: 启动订单服务
go run cmd/order/main.go
```

**方式二: 使用不同端口**

```bash
# 注册表 (默认 8081)
go run cmd/registry/main.go --port 8081

# 网关 (默认 8080)
go run cmd/gateway/main.go --port 8080

# 用户服务
go run cmd/user/main.go --port 8091

# 订单服务
go run cmd/order/main.go --port 8092
```

### 注册服务实例

服务启动后，需要向注册表注册实例，网关才能路由请求:

```bash
# 注册 user 服务
curl -X POST http://localhost:8081/api/registry/services \
  -H "Content-Type: application/json" \
  -d '{
    "service": "user",
    "address": "localhost",
    "port": 8091
  }'

# 注册 order 服务
curl -X POST http://localhost:8081/api/registry/services \
  -H "Content-Type: application/json" \
  -d '{
    "service": "order",
    "address": "localhost",
    "port": 8092
  }'
```

或者使用示例脚本:

```bash
chmod +x examples/curl_examples.sh
./examples/curl_examples.sh
```

## HTTP API 接口

### 服务注册与发现

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/registry/services` | 查看所有服务 |
| POST | `/api/registry/services` | 注册服务实例 |
| GET | `/api/registry/services/{service}` | 查看特定服务详情 |
| DELETE | `/api/registry/services/{service}/{instance_id}` | 下线服务实例 |
| PUT | `/api/registry/services/{service}/{instance_id}/health` | 更新实例健康状态 |

**注册实例示例:**
```bash
curl -X POST http://localhost:8081/api/registry/services \
  -H "Content-Type: application/json" \
  -d '{
    "service": "user",
    "address": "localhost",
    "port": 8091,
    "metadata": {
      "version": "1.0.0",
      "region": "local"
    }
  }'
```

### 配置管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/config` | 获取当前配置 |
| PUT | `/api/config` | 更新配置 (触发热加载) |
| GET | `/api/config/history` | 查看配置历史 |

**更新配置示例:**
```bash
curl -X PUT http://localhost:8081/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "ratelimit.limit": 200,
    "ratelimit.window": 120
  }'
```

### 网关管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/gateway/routes` | 查看路由配置 |
| GET | `/api/gateway/decisions` | 查看路由决策日志 |
| GET | `/api/gateway/circuit-breakers` | 查看熔断器状态 |
| POST | `/api/gateway/circuit-breakers/{service}/reset` | 重置熔断器 |

### 请求日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/logs/requests` | 查看请求日志 (支持 date 参数) |

## 通过网关访问服务

服务注册后，可以通过网关访问:

```bash
# 获取所有用户 (网关路由到 user 服务)
curl http://localhost:8080/api/users

# 获取用户 ID=1
curl http://localhost:8080/api/users/1

# 创建新用户
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_user",
    "email": "user@example.com",
    "name": "New User"
  }'

# 获取所有订单
curl http://localhost:8080/api/orders

# 获取用户的订单
curl http://localhost:8080/api/orders/user/1
```

## 链路追踪 (Trace ID)

框架支持 Trace ID 透传，便于分布式追踪:

```bash
# 手动指定 Trace ID
curl http://localhost:8080/api/users \
  -H "X-Trace-ID: my-custom-trace-001" \
  -i

# 响应头会包含 Trace ID
# X-Trace-ID: my-custom-trace-001
# X-Span-ID: ...
```

## 限流与熔断

### 限流配置

配置文件 `configs/config.yaml` 中的限流设置:

```yaml
ratelimit:
  limit: 100    # 每个时间窗口的最大请求数
  window: 60    # 时间窗口 (秒)
```

### 熔断配置

```yaml
circuitbreaker:
  threshold: 3    # 熔断阈值 (连续失败次数)
  timeout: 30     # 熔断超时时间 (秒)
```

### 熔断器状态

熔断器有三种状态:
- **Closed (关闭)**: 正常状态，允许请求通过
- **Open (打开)**: 熔断状态，拒绝所有请求
- **Half-Open (半开)**: 尝试恢复状态，允许部分请求通过

## 配置热加载

修改 `configs/config.yaml` 文件后，框架会自动检测并加载新配置，无需重启服务。

也可以通过 API 动态更新配置:

```bash
# 动态更新限流配置
curl -X PUT http://localhost:8081/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "ratelimit.limit": 500
  }'
```

## 持久化

框架会自动持久化以下数据到 `./data` 目录:

| 数据类型 | 文件路径 | 描述 |
|----------|----------|------|
| 服务注册表 | `data/registry.json` | 所有已注册的服务实例 |
| 配置历史 | `data/configs.json` | 所有版本的配置 |
| 请求日志 | `data/logs/requests-YYYY-MM-DD.json` | 每日请求日志 |
| 路由决策 | `data/decisions/decisions-YYYY-MM-DD.json` | 每日路由决策 |
| 熔断器状态 | `data/circuitbreakers.json` | 各服务熔断器状态 |

## 报告导出

使用报告工具可以导出 Markdown 或 JSON 格式的运行报告:

```bash
# 导出 Markdown 报告
go run cmd/report/main.go --format markdown --output report.md

# 导出 JSON 报告
go run cmd/report/main.go --format json --output report.json

# 指定日期
go run cmd/report/main.go --date 2024-01-01
```

报告包含:
- 概览统计 (总请求数、成功率、平均响应时间)
- 服务调用统计
- 路由决策统计
- 详细请求日志
- 路由决策详情

## 运行测试

```bash
# 运行所有测试
go test ./tests/... -v

# 运行特定测试
go test ./tests/ -run TestRegistry_Register -v
go test ./tests/ -run TestCircuitBreaker -v
```

## 中间件链

框架使用统一的中间件链，可以灵活添加或移除中间件:

```go
chain := middleware.NewChain(
    middleware.RecoveryMiddleware,        // Panic 恢复
    middleware.TracingMiddleware,         // 链路追踪
    middleware.LoggingMiddleware,         // 请求日志
    middleware.CORSMiddleware,            // CORS 支持
    middleware.RequestContextMiddleware,  // 请求超时
)
```

中间件执行顺序: Recovery → Tracing → Logging → CORS → RequestContext → Handler

## 异常配置提示

### 常见问题

**1. 服务注册后无法访问**
- 检查实例地址和端口是否正确
- 确认服务是否正在运行
- 检查实例健康状态

**2. 限流触发 (429 Too Many Requests)**
- 调整 `ratelimit.limit` 配置
- 或者等待时间窗口重置

**3. 熔断触发 (503 Service Unavailable)**
- 检查后端服务是否正常
- 查看熔断器状态: `GET /api/gateway/circuit-breakers`
- 手动重置熔断器: `POST /api/gateway/circuit-breakers/{service}/reset`

**4. 配置热加载不生效**
- 确认配置文件路径正确
- 检查文件权限
- 查看日志确认配置变更是否被检测到

### 调试建议

1. **查看路由决策**: `GET /api/gateway/decisions`
2. **查看请求日志**: `GET /api/logs/requests`
3. **查看服务状态**: `GET /api/registry/services`
4. **查看熔断器**: `GET /api/gateway/circuit-breakers`

## 端口分配

| 服务 | 默认端口 | 描述 |
|------|----------|------|
| 网关 | 8080 | 请求入口 |
| 注册表 | 8081 | 服务注册与发现 |
| User Service | 8091 | 用户服务 |
| Order Service | 8092 | 订单服务 |

## 学习资源

### 核心概念

1. **服务注册与发现**: 服务启动时向注册表注册，消费者通过注册表发现服务地址
2. **API 网关**: 统一入口，处理路由、限流、熔断等横切关注点
3. **熔断器**: 防止级联失败，快速失败并提供降级机制
4. **限流**: 保护服务不被过多请求压垮
5. **链路追踪**: 通过 Trace ID 追踪请求在分布式系统中的完整路径

### 扩展练习

1. 实现更多负载均衡策略 (轮询、随机、加权)
2. 添加服务心跳检测
3. 实现配置加密
4. 添加指标收集 (Prometheus)
5. 实现服务间调用 (User → Order)

## 许可证

MIT License
