# 缓存风险分析服务 (Cache Risk Analyzer)

一个用于分析缓存穿透、击穿、雪崩风险的 Go 后端 API 服务，支持导入缓存访问事件和后端容量数据，模拟多种防护策略并导出分析报告。

## 功能特性

- **多维度风险识别**: 自动识别缓存穿透、热点 key 击穿、TTL 集中雪崩、负缓存缺失、预热缺口、布隆过滤器误判风险、互斥锁等待过长、stale-while-revalidate 生效情况
- **策略模拟**: 支持负缓存、布隆过滤器、TTL 随机抖动、热 key 预热、互斥锁回源、stale-while-revalidate 等多种防护策略的效果模拟
- **数据持久化**: 使用 SQLite 本地持久化，服务重启后数据不丢失
- **多格式报告导出**: 支持 JSON、CSV、Markdown 三种报告格式
- **完整审计**: 所有 API 操作自动记录审计日志

## 快速开始

### 环境要求

- Go 1.21+
- SQLite3 (通过 go-sqlite3 驱动)

### 安装

```bash
# 克隆项目后进入目录
cd zy1152

# 下载依赖
go mod tidy

# 编译
go build -o cache-risk-analyzer .
```

### 启动服务

```bash
# 使用默认配置启动 (端口 8080, 数据库 ./cache_risk.db)
./cache-risk-analyzer

# 或使用环境变量配置
PORT=8080 DB_PATH=./data/cache_risk.db ./cache-risk-analyzer
```

服务启动后访问: http://localhost:8080

## API 接口

### 数据导入接口

#### 1. 导入缓存事件 (cache-events.jsonl)

```bash
# 导入 JSONL 格式的缓存事件
curl -X POST http://localhost:8080/api/v1/import/cache-events \
  -H "Content-Type: application/json" \
  --data-binary @examples/cache-events.jsonl
```

**数据格式说明** (每行一个 JSON 对象):

```json
{
  "timestamp": "2026-05-04T10:00:00Z",
  "business_domain": "product",
  "cache_key": "product:detail:1001",
  "ttl_seconds": 3600,
  "is_hit": true,
  "backend_latency_ms": 0,
  "request_source": "app",
  "user_agent": "iOS/15.0",
  "ip_address": "192.168.1.100"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timestamp | string | 是 | 事件时间戳 (支持 RFC3339, "2006-01-02 15:04:05" 等格式) |
| business_domain | string | 是 | 业务域 (如 product, inventory, member, config) |
| cache_key | string | 是 | 缓存 key |
| ttl_seconds | int | 否 | TTL (秒), 不能为负数 |
| is_hit | bool | 是 | 是否命中缓存 |
| backend_latency_ms | float | 否 | 回源延迟 (毫秒), 未命中时有效 |
| request_source | string | 否 | 请求来源 (app, web, api 等) |

#### 2. 导入缓存 Key 元数据 (keys.csv)

```bash
# 导入 CSV 格式的缓存 key 元数据
curl -X POST http://localhost:8080/api/v1/import/keys \
  -H "Content-Type: text/csv" \
  --data-binary @examples/keys.csv

# 或通过表单上传
curl -X POST http://localhost:8080/api/v1/import/keys \
  -F "file=@examples/keys.csv"
```

**CSV 格式说明**:

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| business_domain | string | 是 | 业务域 |
| cache_key | string | 是 | 缓存 key (唯一) |
| ttl_seconds | int | 否 | TTL (秒), 默认 3600 |
| expire_at | string | 否 | 过期时间, 默认当前时间+TTL |
| is_hot | bool | 否 | 是否热点 key |
| access_count | int | 否 | 访问计数 |
| last_access_at | string | 否 | 最后访问时间 |
| data_type | string | 否 | 数据类型 (string, json, hash 等) |

#### 3. 导入后端容量指标 (backend-metrics.csv)

```bash
curl -X POST http://localhost:8080/api/v1/import/backend-metrics \
  -H "Content-Type: text/csv" \
  --data-binary @examples/backend-metrics.csv
```

**CSV 格式说明**:

| 列名 | 类型 | 说明 |
|------|------|------|
| business_domain | string | 业务域 |
| timestamp | string | 指标时间 |
| max_connections | int | 最大连接数 |
| current_connections | int | 当前连接数 |
| qps | float | 当前 QPS |
| max_qps | float | 最大 QPS 容量 |
| avg_latency_ms | float | 平均延迟 (ms) |
| p95_latency_ms | float | P95 延迟 (ms) |
| p99_latency_ms | float | P99 延迟 (ms) |
| error_rate | float | 错误率 (0-1) |
| cpu_usage | float | CPU 使用率 (0-100) |
| memory_usage | float | 内存使用率 (0-100) |

#### 4. 导入流量规划 (traffic-plan.json)

```bash
curl -X POST http://localhost:8080/api/v1/import/traffic-plan \
  -H "Content-Type: application/json" \
  -d @examples/traffic-plan.json
```

**JSON 格式说明**:

```json
{
  "plan_name": "2026_may_promotion",
  "business_domain": "product",
  "start_time": "2026-05-01T00:00:00Z",
  "end_time": "2026-05-10T23:59:59Z",
  "expected_qps": 5000,
  "peak_qps": 15000,
  "hot_key_ratio": 0.4,
  "cold_start_ratio": 0.1,
  "invalid_key_ratio": 0.15,
  "description": "五一促销活动流量规划"
}
```

#### 5. 导入防护策略 (strategy.yaml)

```bash
# YAML 格式
curl -X POST http://localhost:8080/api/v1/import/strategy \
  -H "Content-Type: application/yaml" \
  --data-binary @examples/strategy.yaml

# 或 JSON 格式包装
curl -X POST http://localhost:8080/api/v1/import/strategy \
  -H "Content-Type: application/json" \
  -d '{"yaml": "..."}'
```

**支持的策略类型**:

| 策略类型 | 说明 | 配置参数 |
|----------|------|----------|
| negative_cache | 负缓存 | ttl_seconds, max_size |
| bloom_filter | 布隆过滤器 | false_positive_rate, expected_inserts |
| ttl_jitter | TTL 随机抖动 | jitter_percent (0-100) |
| hot_key_prewarm | 热 key 预热 | prewarm_threshold, prewarm_count |
| mutex_lock | 互斥锁回源 | timeout_ms, max_wait_ms |
| stale_while_revalidate | 异步刷新 | stale_ratio, max_stale_seconds |

**YAML 示例**:

```yaml
- strategy_name: "负缓存策略"
  strategy_type: "negative_cache"
  business_domain: "product"
  is_enabled: true
  priority: 1
  config_json: '{"ttl_seconds": 60}'
  description: "对不存在的key设置60秒负缓存"
```

### 风险分析接口

#### 执行风险分析

```bash
curl http://localhost:8080/api/v1/analysis/risks
```

**响应示例**:

```json
{
  "total_risks": 5,
  "critical": 1,
  "high": 2,
  "medium": 1,
  "low": 1,
  "risks": [
    {
      "risk_type": "CACHE_PENETRATION",
      "severity": "HIGH",
      "business_domain": "product",
      "cache_key": "product:invalid:xxx",
      "evidence": {
        "invalid_key_count": 15,
        "affected_domains": ["product"],
        "threshold_miss_rate": 0.3
      },
      "impact_score": 150.5,
      "recommended_action": "Implement negative cache for invalid keys...",
      "detected_at": "2026-05-04T10:00:00Z"
    }
  ],
  "summary": {
    "top_risks": ["CACHE_PENETRATION", "TTL_AVALANCHE"],
    "affected_domains": ["product", "inventory"],
    "max_impact_score": 200.5
  }
}
```

**可识别的风险类型**:

| 风险类型 | 说明 | 检测条件 |
|----------|------|----------|
| CACHE_PENETRATION | 缓存穿透 | 同一 key 100% 未命中且访问频繁 |
| HOT_KEY_BREAKDOWN | 热点 key 击穿 | 热点 key 即将过期或未命中率高 |
| TTL_AVALANCHE | TTL 雪崩 | 大量 key 在同一时间窗口过期 |
| NEGATIVE_CACHE_MISSING | 负缓存缺失 | 高频未命中 key 缺少负缓存 |
| PREWARM_GAP | 预热缺口 | 标记为热点的 key 无近期访问 |
| BLOOM_FILTER_RECOMMENDED | 布隆过滤器建议 | 高未命中率域可受益于布隆过滤 |
| MUTEX_WAIT_RISK | 互斥锁等待风险 | 同一分钟内同一 key 多次未命中 |
| STALE_WHILE_REVALIDATE_BENEFIT | 异步刷新优化 | 高命中率 key 可受益于 stale 策略 |

#### 获取风险详情

```bash
curl http://localhost:8080/api/v1/analysis/risks/1
```

### 策略模拟接口

#### 运行单策略模拟

```bash
curl -X POST http://localhost:8080/api/v1/simulation/run \
  -H "Content-Type: application/json" \
  -d '{
    "strategies": [
      {
        "strategy_type": "negative_cache",
        "parameters": {
          "ttl_seconds": 60
        }
      },
      {
        "strategy_type": "ttl_jitter",
        "parameters": {
          "jitter_percent": 20
        }
      }
    ],
    "business_domain": "product"
  }'
```

**响应中的指标说明**:

| 指标 | 说明 |
|------|------|
| hit_rate | 命中率 |
| miss_rate | 未命中率 |
| backend_qps | 后端 QPS |
| backend_latency_avg_ms | 后端平均延迟 |
| blocked_requests | 被拦截请求数 |
| intercepted_requests | 有效拦截请求数 |
| avg_wait_time_ms | 平均等待时间 |
| avalanche_window_size | 雪崩窗口大小 (keys) |
| max_concurrent_misses | 最大并发未命中数 |
| hot_key_miss_rate | 热点 key 未命中率 |
| invalid_key_intercept_rate | 无效 key 拦截率 |

#### 对比所有策略

```bash
# 全业务域
curl http://localhost:8080/api/v1/simulation/compare

# 指定业务域
curl "http://localhost:8080/api/v1/simulation/compare?business_domain=product"
```

**响应示例**:

```json
{
  "baseline": {
    "hit_rate": 0.65,
    "miss_rate": 0.35,
    "backend_qps": 350
  },
  "strategies": {
    "bloom_filter": {...},
    "negative_cache": {...},
    "ttl_jitter": {...},
    ...
  },
  "rankings": [
    {
      "strategy_type": "bloom_filter",
      "score": 85.5,
      "rank": 1,
      "key_improvements": ["Bloom filter intercepts ~99% invalid requests"]
    }
  ],
  "recommendation": "Recommended strategy: bloom_filter (score: 85.5)..."
}
```

#### 获取模拟结果

```bash
curl http://localhost:8080/api/v1/simulation/results/1
```

### 报告导出接口

#### 导出 JSON 格式报告

```bash
curl http://localhost:8080/api/v1/report/json -o report.json
```

#### 导出 CSV 格式报告

```bash
curl http://localhost:8080/api/v1/report/csv -o report.csv
```

#### 导出 Markdown 格式报告

```bash
curl http://localhost:8080/api/v1/report/markdown -o report.md
```

**报告内容包含**:

1. **风险概览**: 风险统计、严重级别分布、最大影响分数
2. **当前指标**: 命中率、未命中率、延迟、雪崩窗口等
3. **风险详情**: 每个风险的类型、严重级别、证据、建议动作
4. **策略排名**: 各策略的综合得分和关键改进
5. **推荐方案**: 基于风险的优先级建议和行动项
6. **人工检查清单**: 数据验证、策略验证、监控、应急预案

### 数据查询接口

#### 查询缓存事件

```bash
# 分页查询
curl "http://localhost:8080/api/v1/query/events?page=1&page_size=50"

# 按业务域筛选
curl "http://localhost:8080/api/v1/query/events?business_domain=product"

# 按 key 模糊搜索
curl "http://localhost:8080/api/v1/query/events?cache_key=product:detail"

# 筛选命中/未命中
curl "http://localhost:8080/api/v1/query/events?is_hit=false"
```

#### 查询缓存 Key

```bash
curl "http://localhost:8080/api/v1/query/keys?is_hot=true"
```

#### 查询后端指标

```bash
curl "http://localhost:8080/api/v1/query/backend-metrics?business_domain=product"
```

#### 查询审计日志

```bash
curl "http://localhost:8080/api/v1/query/audits?operation=import_cache_events"
```

### 配置管理接口

#### 获取阈值配置

```bash
curl http://localhost:8080/api/v1/config/thresholds
```

#### 更新阈值配置

```bash
curl -X PUT http://localhost:8080/api/v1/config/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "penetration_miss_rate_threshold": 0.3,
    "hot_key_access_threshold": 1000,
    "ttl_cluster_threshold": 0.5,
    "backend_capacity_threshold": 0.8,
    "bloom_filter_false_positive_rate": 0.01,
    "mutex_wait_threshold_ms": 500,
    "stale_revalidate_ratio": 0.1
  }'
```

#### 重载配置

```bash
curl -X POST http://localhost:8080/api/v1/config/reload
```

## 完整操作示例流程

```bash
# 1. 启动服务
./cache-risk-analyzer &

# 2. 导入样例数据
curl -X POST http://localhost:8080/api/v1/import/cache-events \
  -H "Content-Type: application/json" \
  --data-binary @examples/cache-events.jsonl

curl -X POST http://localhost:8080/api/v1/import/keys \
  -H "Content-Type: text/csv" \
  --data-binary @examples/keys.csv

curl -X POST http://localhost:8080/api/v1/import/backend-metrics \
  -H "Content-Type: text/csv" \
  --data-binary @examples/backend-metrics.csv

# 3. 执行风险分析
curl http://localhost:8080/api/v1/analysis/risks

# 4. 对比所有防护策略
curl http://localhost:8080/api/v1/simulation/compare

# 5. 运行特定策略组合模拟
curl -X POST http://localhost:8080/api/v1/simulation/run \
  -H "Content-Type: application/json" \
  -d '{
    "strategies": [
      {"strategy_type": "bloom_filter", "parameters": {"false_positive_rate": 0.01}},
      {"strategy_type": "ttl_jitter", "parameters": {"jitter_percent": 20}}
    ]
  }'

# 6. 导出分析报告
curl http://localhost:8080/api/v1/report/markdown -o report.md
curl http://localhost:8080/api/v1/report/json -o report.json
curl http://localhost:8080/api/v1/report/csv -o report.csv

# 7. 查看审计日志
curl http://localhost:8080/api/v1/query/audits
```

## 样例数据说明

### 正常样例 (examples/)

| 文件 | 说明 |
|------|------|
| cache-events.jsonl | 正常缓存事件，包含命中/未命中、不同业务域 |
| keys.csv | 缓存 key 元数据，包含热点 key 标记 |
| backend-metrics.csv | 后端容量指标，展示不同负载情况 |
| traffic-plan.json | 流量规划示例，用于促销场景 |
| strategy.yaml | 多种防护策略配置示例 |

### 坏样例 (examples/bad/)

| 文件 | 触发的错误 |
|------|------------|
| bad-cache-events.jsonl | JSON 格式错误、时间格式错误、TTL 为负、缺失必填字段、is_hit 类型错误、延迟为负 |
| bad-keys.csv | TTL 为负、缺失 business_domain、缺失 cache_key、TTL 非数字、过期时间格式错误 |
| bad-strategy.yaml | 无效策略类型、配置参数类型错误 |

## 运行测试

```bash
# 运行所有测试
go test ./... -v

# 运行特定包测试
go test ./internal/service/... -v
```

## 项目结构

```
zy1152/
├── main.go                    # 程序入口
├── go.mod
├── go.sum
├── examples/                  # 样例数据
│   ├── cache-events.jsonl
│   ├── keys.csv
│   ├── backend-metrics.csv
│   ├── traffic-plan.json
│   ├── strategy.yaml
│   └── bad/                   # 坏样例数据
└── internal/
    ├── db/                    # 数据库层
    │   └── db.go              # SQLite 初始化、迁移
    ├── model/                 # 数据模型
    │   └── model.go           # 所有实体定义
    ├── service/               # 业务逻辑层
    │   ├── analysis_service.go    # 风险分析
    │   ├── import_service.go      # 数据导入
    │   ├── simulation_service.go  # 策略模拟
    │   ├── report_service.go      # 报告生成
    │   └── service_test.go        # 测试
    ├── handler/               # HTTP 处理器
    │   └── handler.go         # 所有 API handler
    └── middleware/            # 中间件
        └── audit.go           # 审计日志中间件
```

## 数据模型

### 核心数据表

| 表名 | 说明 |
|------|------|
| cache_events | 缓存访问事件 |
| cache_keys | 缓存 key 元数据 |
| backend_metrics | 后端容量指标 |
| traffic_plans | 流量规划 |
| strategies | 防护策略配置 |
| risk_events | 检测到的风险事件 |
| simulation_results | 策略模拟结果 |
| audit_logs | 审计日志 |
| threshold_configs | 阈值配置 |

### 阈值配置默认值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| penetration_miss_rate_threshold | 0.3 | 穿透未命中率阈值 |
| hot_key_access_threshold | 1000 | 热 key 访问量阈值 |
| ttl_cluster_threshold | 0.5 | TTL 聚集度阈值 |
| backend_capacity_threshold | 0.8 | 后端容量阈值 |
| bloom_filter_false_positive_rate | 0.01 | 布隆过滤器误判率目标 |
| mutex_wait_threshold_ms | 500 | 互斥锁等待阈值 (ms) |
| stale_revalidate_ratio | 0.1 | Stale-while-revalidate 比例 |

## License

Internal use only.
