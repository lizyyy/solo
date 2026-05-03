# Canary Replay CLI

TypeScript CLI 工具，用于在发布网关灰度规则前进行离线回放测试。帮助运维同学在真实流量上线前验证灰度策略的正确性。

## 功能特性

- **路由匹配**: 按请求路径、HTTP 方法、Header 重建路由命中链
- **灰度策略评估**: 按 Header 匹配、用户分桶、路径匹配评估灰度命中
- **健康检查集成**: 结合服务健康状态检测潜在风险
- **问题检测**:
  - 请求误打到旧服务 (WRONG_SERVICE)
  - 健康探针失败仍被分流 (UNHEALTHY_STILL_SHUNT)
  - 权重超过预算 (WEIGHT_EXCEEDS_BUDGET)
  - 缺失健康数据 (MISSING_HEALTH_DATA)
  - 路由通配符重叠 (ROUTE_OVERLAP)
- **可视化输出**: 生成报告文件和交互式 HTML 矩阵

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行回放分析

```bash
# 使用默认配置路径 (./data/ 目录)
npm run dev -- replay

# 或指定自定义路径
npm run dev -- replay \
  --routes ./data/routes.yaml \
  --traffic ./data/traffic_samples.jsonl \
  --canary ./data/canary_policy.yaml \
  --health ./data/service_health.csv \
  --output ./output \
  --verbose
```

### 查看输出

运行后会在 `./output/` 目录生成以下文件：

| 文件 | 说明 |
|------|------|
| `report.md` | Markdown 格式的详细分析报告 |
| `issues.csv` | 检测到的问题列表 (CSV 格式) |
| `hit_matrix.html` | 交互式命中矩阵 HTML (带筛选功能) |

## 输入文件格式

### 1. routes.yaml - 路由配置

```yaml
routes:
  - path: /api/v1/users/:id
    method: GET
    service: user-service
    priority: 100
    headers:  # 可选，Header 匹配条件
      X-API-Version: "v1"
```

**字段说明**:
- `path`: 路由路径 (支持 Express 风格的参数，如 `:id`)
- `method`: HTTP 方法 (可选)
- `service`: 目标服务名
- `priority`: 优先级 (数字越大优先级越高)
- `headers`: Header 匹配条件 (可选)

### 2. traffic_samples.jsonl - 流量样本

每行一个 JSON 对象 (JSON Lines 格式):

```json
{
  "requestId": "req-001",
  "timestamp": "2026-05-03T10:00:00.000Z",
  "path": "/api/v1/users/123",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json",
    "X-User-Type": "premium"
  },
  "userId": "user-1001",
  "expectedService": "user-service"
}
```

**字段说明**:
- `requestId`: 请求唯一标识
- `path`: 请求路径
- `method`: HTTP 方法
- `headers`: 请求头
- `userId`: 用户 ID (用于用户分桶)
- `expectedService`: 期望目标服务 (可选，用于检测错误路由)

### 3. canary_policy.yaml - 灰度策略

```yaml
name: "Q2 Feature Release"
description: "Canary release policy description"

rules:
  - service: user-service
    condition:
      headerMatch:
        name: "X-User-Type"
        value: "premium"
        regex: false  # 可选，是否正则匹配
      userBucket:
        percentage: 50
        seed: "canary-v2"  # 可选，一致性哈希种子
      pathMatch: "/api/v1/*"  # 可选，路径匹配
    weight: 30  # 命中条件后，实际分流到 canary 的比例
    version: "v2.0"

defaultWeight: 0
```

**规则匹配逻辑**:
- 条件之间是 **AND** 关系
- 同一服务按规则顺序匹配，第一个匹配的规则生效
- `weight` 是命中条件后，实际分流到 canary 的概率 (0-100)

### 4. service_health.csv - 服务健康状态

```csv
service,version,healthy,lastCheck,errorRate,latencyP99
user-service,stable,true,2026-05-03T09:55:00.000Z,0.1,120
user-service,v2.0,false,2026-05-03T09:55:00.000Z,15.2,850
```

**字段说明**:
- `service`: 服务名
- `version`: 版本 (stable 为稳定版，其他为 canary 版本)
- `healthy`: 是否健康 (true/false)
- `lastCheck`: 最后检查时间
- `errorRate`: 错误率 (%)
- `latencyP99`: P99 延迟 (ms)

## 问题类型说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `WRONG_SERVICE` | critical | 请求被路由到错误的服务 |
| `UNHEALTHY_STILL_SHUNT` | critical | 不健康的 canary 版本仍会接收流量 |
| `WEIGHT_EXCEEDS_BUDGET` | high | 实际分流比例超过设置的权重预算 |
| `MISSING_HEALTH_DATA` | high | 某个服务版本缺少健康检查数据 |
| `HEALTHY_SHOULD_HIT_CANARY` | medium | 健康用户符合 canary 条件但未命中 (权重随机) |
| `ROUTE_OVERLAP` | varies | 路由路径存在重叠，可能导致意外行为 |

## 边界情况覆盖

示例数据已包含以下边界测试场景：

### 1. 路由通配符重叠

**routes.yaml**:
```yaml
- path: /api/internal/*       # priority: 50
  service: internal-service

- path: /api/internal/health  # priority: 100
  service: health-service
```

**说明**:
- `/api/internal/*` 通配符路由会匹配所有 `/api/internal/` 开头的路径
- `/api/internal/health` 是更具体的路由，优先级更高 (100 > 50)
- 工具会检测这类重叠并报告

### 2. 缺失健康数据

**canary_policy.yaml**:
```yaml
- service: payment-service
  condition:
    headerMatch:
      name: "X-User-Type"
      value: "beta"
  weight: 20
  version: "v3.0"  # 这个版本在 service_health.csv 中不存在
```

**service_health.csv** 中只有:
```
payment-service,stable,true,...
```

**说明**:
- `payment-service:v3.0` 在灰度策略中定义
- 但健康数据中只存在 `payment-service:stable`
- 工具会检测到 `MISSING_HEALTH_DATA` 问题

### 3. 健康探针失败仍被分流

**service_health.csv**:
```csv
user-service,v2.0,false,2026-05-03T09:55:00.000Z,15.2,850
```

**说明**:
- `user-service:v2.0` 标记为不健康 (healthy=false, errorRate=15.2%)
- 但灰度策略中仍会将符合条件的请求分流到这个版本
- 工具会检测到 `UNHEALTHY_STILL_SHUNT` 问题

## 项目结构

```
.
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── utils/
│   │   ├── logger.ts         # 日志工具
│   │   └── hash.ts           # 一致性哈希
│   ├── readers/
│   │   └── configReader.ts   # 配置文件读取
│   ├── matchers/
│   │   └── routeMatcher.ts   # 路由匹配
│   ├── evaluators/
│   │   ├── canaryEvaluator.ts # 灰度策略评估
│   │   └── healthChecker.ts  # 健康检查
│   ├── detectors/
│   │   └── issueDetector.ts  # 问题检测
│   ├── generators/
│   │   └── outputGenerator.ts # 输出生成
│   └── analyzer/
│       └── replayAnalyzer.ts # 主分析流程
├── data/                     # 示例数据
│   ├── routes.yaml
│   ├── traffic_samples.jsonl
│   ├── canary_policy.yaml
│   └── service_health.csv
├── output/                   # 输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## CLI 命令

### replay

运行灰度策略回放分析。

```bash
npm run dev -- replay [options]
```

**选项**:

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--routes <path>` | `-r` | `./data/routes.yaml` | 路由配置文件路径 |
| `--traffic <path>` | `-t` | `./data/traffic_samples.jsonl` | 流量样本文件路径 |
| `--canary <path>` | `-c` | `./data/canary_policy.yaml` | 灰度策略文件路径 |
| `--health <path>` | `-H` | `./data/service_health.csv` | 健康数据文件路径 |
| `--output <path>` | `-o` | `./output` | 输出目录 |
| `--verbose` | `-v` | `false` | 启用详细输出 |

### init

初始化示例数据文件 (预留功能)。

```bash
npm run dev -- init [options]
```

## 开发

### 构建

```bash
npm run build
```

### 使用 TypeScript 直接运行

```bash
npm run dev -- replay
```

### 运行构建后的版本

```bash
npm run build
npm start -- replay
```

## License

MIT
