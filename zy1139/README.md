# CapGate - 容量闸门工具

一个用于上线前接口压测"容量闸门"和降级预演的 Go 命令行工具。

## 功能特性

- **容量预算检查**: 验证每个接口在不同并发/RPS 下的 p95/p99 延迟、错误率、CPU 使用是否超过预算
- **场景模拟**: 支持缓存未命中、下游变慢、熔断打开、限流策略变更等场景
- **基线对比**: 将本次压测结果与历史基线对比，识别退化接口
- **降级建议**: 根据容量瓶颈自动给出降级策略建议
- **多格式报告**: 支持导出 Markdown/JSON/CSV 格式报告
- **本地 API 服务**: 提供轻量 HTTP 服务查看和导出结果

## 快速开始

### 1. 编译安装

```bash
# 安装依赖
go mod tidy

# 编译
go build -o capgate .

# 或直接运行
go run . init
```

### 2. 初始化项目

```bash
# 在当前目录生成样例配置文件
./capgate init

# 或指定输出目录
./capgate init -o ./my-project
```

生成的文件：
- `routes.yaml` - 路由定义和容量预算
- `traffic-plan.json` - 压测流量计划和场景配置
- `baseline.csv` - 基线性能数据
- `dependency-limits.yaml` - 下游依赖限额配置

### 3. 验证配置

```bash
# 验证所有配置文件
./capgate validate

# 或指定文件路径
./capgate validate \
  -r routes.yaml \
  -t traffic-plan.json \
  -b baseline.csv \
  -d dependency-limits.yaml
```

验证内容：
- 字段是否缺失
- 数值范围是否有效
- 路由引用是否存在
- 依赖引用是否存在

### 4. 执行压测计划

```bash
# 使用默认配置执行
./capgate run

# 或指定参数
./capgate run \
  -r routes.yaml \
  -t traffic-plan.json \
  -b baseline.csv \
  -d dependency-limits.yaml \
  -o ./results \
  -n my-test-run

# 跳过某些场景
./capgate run -s cache-miss-simulation -s downstream-slow
```

输出：
- 每个路由的 p50/p95/p99 延迟
- 实际 RPS vs 目标 RPS
- 错误率统计
- CPU/内存使用
- 依赖调用量
- 预算闸门结论 (PASS/WARNING/FAIL)

### 5. 对比基线

```bash
# 对比压测结果与基线
./capgate compare \
  -b baseline.csv \
  -r ./results/run-20240101-120000-result.json
```

输出：
- 退化接口列表
- 改进接口列表
- 容量瓶颈识别
- 降级策略建议

### 6. 导出报告

```bash
# 导出 Markdown 格式
./capgate export \
  -r ./results/run-20240101-120000-result.json \
  -f md

# 导出 JSON 格式
./capgate export \
  -r ./results/run-20240101-120000-result.json \
  -f json

# 导出 CSV 格式
./capgate export \
  -r ./results/run-20240101-120000-result.json \
  -f csv

# 同时包含对比结果
./capgate export \
  -r ./results/run-20240101-120000-result.json \
  -c ./results/compare-20240101-120000-comparison.json \
  -f md
```

### 7. 启动 API 服务

```bash
# 启动服务
./capgate serve

# 或指定端口和结果目录
./capgate serve -p 8080 -r ./results
```

API 端点：
| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 主页 |
| `/api/health` | GET | 健康检查 |
| `/api/results` | GET | 结果列表 |
| `/api/results/{id}` | GET | 结果详情 |
| `/api/comparisons` | GET | 对比列表 |
| `/api/comparisons/{id}` | GET | 对比详情 |
| `/api/export/{id}?format=md` | GET | 导出报告 |

## 配置文件说明

### routes.yaml

定义每个接口的路由信息和容量预算：

```yaml
routes:
  - name: "get-user-profile"
    path: "/api/v1/users/{id}"
    method: "GET"
    description: "获取用户详情接口"
    tags: ["user", "read"]
    budget:
      p95_latency_ms: 200.0      # P95 延迟预算 (ms)
      p99_latency_ms: 500.0      # P99 延迟预算 (ms)
      max_error_rate: 0.01       # 最大错误率 (0-1)
      max_rps: 1000              # 最大 RPS
      max_concurrent: 200        # 最大并发数
      cpu_budget_percent: 30.0   # CPU 预算 (%)
      memory_budget_mb: 256      # 内存预算 (MB)
    dependencies:
      - name: "user-db"           # 依赖名称
        factor: 1.0               # 调用系数 (每次请求调用次数)
```

### traffic-plan.json

定义压测流量计划和模拟场景：

```json
{
  "version": "1.0",
  "plan_name": "release-capacity-test",
  "routes": [
    {
      "name": "get-user-profile",
      "weight": 0.4,
      "steps": [
        {
          "duration_sec": 60,
          "target_rps": 500,
          "concurrent_users": 100
        },
        {
          "duration_sec": 120,
          "target_rps": 800,
          "concurrent_users": 160
        }
      ]
    }
  ],
  "scenarios": [
    {
      "name": "cache-miss-simulation",
      "type": "cache_miss",
      "params": {
        "hit_rate_start": 0.9,
        "hit_rate_end": 0.1
      },
      "apply_routes": ["get-user-profile"]
    }
  ]
}
```

**支持的场景类型**：
| 类型 | 说明 |
|------|------|
| `cache_miss` | 缓存未命中 |
| `downstream_slow` | 下游变慢 |
| `circuit_open` | 熔断打开 |
| `rate_limit` | 限流 |
| `high_latency` | 高延迟 |
| `resource_stress` | 资源压力 |

### baseline.csv

基线性能数据，用于对比分析：

```csv
route_name,p50_latency_ms,p95_latency_ms,p99_latency_ms,avg_latency_ms,throughput_rps,error_rate,max_concurrent,cpu_peak_percent,memory_peak_mb
get-user-profile,45.0,120.0,180.0,55.0,950.0,0.005,180,28.5,220
create-order,80.0,200.0,350.0,95.0,480.0,0.002,95,42.0,480
```

### dependency-limits.yaml

下游依赖限额配置：

```yaml
dependencies:
  - name: "user-db"
    type: "database"
    max_qps: 5000
    max_concurrent: 100
    max_latency_ms: 100.0
    timeout_ms: 3000.0
    connection_pool:
      max_connections: 100
      max_idle_connections: 20
```

**支持的依赖类型**：
| 类型 | 说明 |
|------|------|
| `database` | 数据库 |
| `cache` | 缓存 |
| `http` | HTTP 服务 |
| `grpc` | gRPC 服务 |
| `mq` | 消息队列 |

## 报告内容

生成的报告包含以下信息：

### 执行摘要
- 计划名称
- 执行时间
- 总体状态 (PASS/WARNING/FAIL)
- 应用的场景

### 路由结果汇总
| 路由 | 状态 | P50(ms) | P95(ms) | P99(ms) | RPS | 错误率 | CPU峰值 |
|------|------|---------|---------|---------|-----|--------|---------|

### 预算闸门检查详情
- 检查项名称
- 阈值 vs 实际值
- 状态 (PASS/WARN/FAIL)
- 风险级别
- 详细说明

### 对比分析
- 退化接口列表
- 改进接口列表
- 容量瓶颈识别
- 降级策略建议

## 降级策略

工具会根据检测到的瓶颈自动建议以下降级动作：

| 动作 | 说明 | 触发条件 |
|------|------|----------|
| `ROLLBACK` | 回滚 | 严重退化 |
| `LIMIT_TRAFFIC` | 限流 | 流量超过预算 |
| `ENABLE_CIRCUIT` | 熔断 | 错误率过高 |
| `SWITCH_TO_FALLBACK` | 降级返回 | 延迟过高 |
| `INCREASE_RESOURCES` | 扩容 | CPU 资源瓶颈 |
| `INVESTIGATE` | 调查 | 轻微退化 |
| `PROCEED` | 继续上线 | 无问题 |

## 目录结构

```
.
├── main.go                    # 程序入口
├── go.mod                     # Go 模块定义
├── README.md                  # 本文档
├── internal/
│   ├── cmd/                   # 命令实现
│   │   ├── root.go           # 根命令
│   │   ├── init.go           # init 命令
│   │   ├── validate.go       # validate 命令
│   │   ├── run.go            # run 命令
│   │   ├── compare.go        # compare 命令
│   │   ├── export.go         # export 命令
│   │   └── serve.go          # serve 命令
│   ├── models/                # 数据模型
│   │   ├── routes.go         # 路由模型
│   │   ├── traffic.go        # 流量计划模型
│   │   ├── baseline.go       # 基线模型
│   │   ├── dependency.go     # 依赖模型
│   │   ├── result.go         # 运行结果模型
│   │   └── comparison.go     # 对比结果模型
│   ├── config/                # 配置加载/验证
│   │   ├── loader.go         # 配置加载器
│   │   └── validator.go      # 配置验证器
│   ├── engine/                # 核心引擎
│   │   ├── simulator.go      # 压测模拟器
│   │   └── comparator.go     # 对比分析器
│   ├── reporter/              # 报告生成
│   │   └── generator.go      # 报告生成器
│   ├── server/                # API 服务
│   │   └── api.go            # HTTP 服务
│   └── utils/                 # 工具函数
│       └── utils.go          # 通用工具
└── results/                   # 结果输出目录 (运行时生成)
```

## 完整示例流程

```bash
# 1. 初始化项目
./capgate init

# 2. 验证配置
./capgate validate

# 3. 执行压测
./capgate run

# 4. 对比基线
./capgate compare -r ./results/run-*-result.json

# 5. 导出报告
./capgate export \
  -r ./results/run-*-result.json \
  -c ./results/compare-*-comparison.json \
  -f md

# 6. 启动 API 服务查看结果
./capgate serve
```

## 许可证

MIT License
