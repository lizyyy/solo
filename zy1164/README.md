# 接口限流策略验证服务 (Rate Limit Validator)

一个本地后端服务，专门用于验证接口限流策略。支持固定窗口和滑动窗口两种算法，提供请求判定、并发模拟、时间线模拟等功能，所有操作都会落盘记录，并支持统计查询和 Markdown/JSON 报告导出。

---

## 功能特性

### 核心功能
- **双算法支持**: 固定窗口 (Fixed Window) 和滑动窗口 (Sliding Window) 限流算法
- **灵活配置**: 按路由 + AppKey 组合配置不同的限流策略
- **请求判定**: 实时判断请求是否应该被放行或拒绝
- **并发模拟**: 模拟任意数量的并发请求，测试限流准确性
- **时间线模拟**: 按自定义时间戳序列发送请求，测试窗口边界行为
- **日志落盘**: 每次请求的所有信息（命中、放行、拒绝）都会持久化存储
- **统计分析**: 查询任意时间范围内的限流统计数据
- **边界差异分析**: 对比固定窗口和滑动窗口在边界时刻的行为差异
- **报告导出**: 导出 Markdown 和 JSON 格式的对比分析报告

### 管理功能
- **AppKey 管理**: 创建、查看、更新、删除应用密钥
- **路由管理**: 管理需要限流的接口路由
- **限流配置管理**: 为 AppKey + 路由组合配置限流策略

---

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 初始化数据库（Seed 数据）
```bash
npm run seed
```

这会创建以下示例数据：
- **App Keys**:
  - `ak_test_001` - 测试应用 A（高配额）
  - `ak_test_002` - 测试应用 B（低配额，用于边界测试）
  - `ak_test_003` - 测试应用 C（已禁用）
  - `ak_prod_001` - 生产应用（模拟生产配置）

- **Routes**:
  - `GET /api/users` - 获取用户列表
  - `POST /api/users` - 创建用户
  - `GET /api/orders` - 获取订单列表
  - `POST /api/orders` - 创建订单
  - `POST /api/payments` - 支付接口（高频操作）

- **限流配置示例**:
  | App Key | 路由 | 算法 | 配额 | 窗口 |
  |---------|------|------|------|------|
  | ak_test_001 | GET /api/users | 固定窗口 | 100 | 60s |
  | ak_test_001 | GET /api/orders | 滑动窗口 | 200 | 60s |
  | ak_test_002 | GET /api/users | 固定窗口 | 10 | 60s |
  | ak_test_002 | POST /api/users | 滑动窗口 | 10 | 60s |

### 启动服务
```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问:
- 健康检查: http://localhost:3000/health
- API 基础路径: http://localhost:3000/api

---

## API 文档

### 1. 限流判定 API

#### POST /api/rate-limit/check
检查单个请求是否应该被限流。

**请求体**:
```json
{
  "appKey": "ak_test_001",
  "path": "/api/users",
  "method": "GET",
  "timestamp": 1700000000000
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| appKey | string | 是 | 应用密钥 |
| path | string | 是 | 接口路径 |
| method | string | 否 | HTTP 方法，默认 GET |
| timestamp | number | 否 | 请求时间戳（毫秒），默认当前时间 |

**响应示例** (放行):
```json
{
  "allowed": true,
  "action": "allowed",
  "requestId": "a1b2c3d4-1234-5678-90ab-cdef01234567",
  "algorithm": "fixed-window",
  "limit": 100,
  "windowSeconds": 60,
  "currentCount": 5,
  "remaining": 94,
  "windowStart": "2026-05-05T10:00:00.000Z",
  "windowEnd": "2026-05-05T10:01:00.000Z",
  "timestamp": "2026-05-05T10:00:30.000Z"
}
```

**响应示例** (拒绝):
```json
{
  "allowed": false,
  "action": "rejected",
  "requestId": "...",
  "algorithm": "fixed-window",
  "limit": 100,
  "windowSeconds": 60,
  "currentCount": 100,
  "remaining": 0,
  "windowStart": "...",
  "windowEnd": "...",
  "timestamp": "..."
}
```

---

### 2. 并发模拟 API

#### POST /api/rate-limit/simulate/concurrent
模拟多个并发请求在同一时间点发送，测试限流准确性。

**请求体**:
```json
{
  "appKey": "ak_test_001",
  "path": "/api/users",
  "method": "GET",
  "requestCount": 150
}
```

**响应示例**:
```json
{
  "totalRequests": 150,
  "allowedCount": 100,
  "rejectedCount": 50,
  "allowedRate": 0.6667,
  "results": [
    { "index": 0, "allowed": true, ... },
    { "index": 1, "allowed": true, ... },
    ...
    { "index": 100, "allowed": false, ... }
  ]
}
```

---

### 3. 时间线模拟 API

#### POST /api/rate-limit/simulate/timeline
按自定义时间戳序列发送请求，特别适合测试窗口边界时刻的行为。

**请求体**:
```json
{
  "appKey": "ak_test_002",
  "path": "/api/users",
  "method": "GET",
  "timestamps": [
    1700000009000,
    1700000009500,
    1700000010000,
    1700000010500,
    1700000011000
  ]
}
```

**响应示例**:
```json
{
  "totalRequests": 5,
  "allowedCount": 5,
  "rejectedCount": 0,
  "allowedRate": 1.0,
  "results": [
    { "timestamp": "2026-05-05T10:00:09.000Z", "allowed": true, ... },
    { "timestamp": "2026-05-05T10:00:09.500Z", "allowed": true, ... },
    ...
  ]
}
```

---

### 4. 统计查询 API

#### GET /api/rate-limit/stats
查询任意时间范围内的限流统计数据。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| startTime | number | 开始时间戳（毫秒），默认 24 小时前 |
| endTime | number | 结束时间戳（毫秒），默认当前时间 |

**响应示例**:
```json
{
  "period": {
    "start": "2026-05-04T10:00:00.000Z",
    "end": "2026-05-05T10:00:00.000Z"
  },
  "summary": {
    "totalRequests": 1500,
    "allowedRequests": 1000,
    "rejectedRequests": 500,
    "allowedRate": 0.6667,
    "rejectedRate": 0.3333
  },
  "algorithmStats": [
    {
      "algorithm": "fixed-window",
      "total": 800,
      "allowed": 600,
      "rejected": 200
    },
    {
      "algorithm": "sliding-window",
      "total": 700,
      "allowed": 400,
      "rejected": 300
    }
  ],
  "appKeyStats": [
    {
      "app_key": "ak_test_001",
      "name": "测试应用 A",
      "total": 1000,
      "allowed": 700,
      "rejected": 300
    }
  ]
}
```

---

### 5. 报告导出 API

#### GET /api/rate-limit/report
导出 Markdown 或 JSON 格式的分析报告。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| startTime | number | 开始时间戳 |
| endTime | number | 结束时间戳 |
| format | string | 导出格式: `markdown` 或 `json`，默认 markdown |
| includeBoundaryAnalysis | boolean | 是否包含边界差异分析，默认 false |
| appKey | string | 用于边界分析的 App Key |
| path | string | 用于边界分析的路由路径 |
| method | string | 用于边界分析的 HTTP 方法 |
| windowSeconds | number | 用于边界分析的窗口大小 |

**示例**:
```bash
# 导出 Markdown 报告
curl -O -J "http://localhost:3000/api/rate-limit/report?format=markdown"

# 导出 JSON 报告
curl -O -J "http://localhost:3000/api/rate-limit/report?format=json"

# 导出包含边界分析的报告
curl -O -J "http://localhost:3000/api/rate-limit/report?format=markdown&includeBoundaryAnalysis=true&appKey=ak_test_002&path=/api/users&method=GET&windowSeconds=60"
```

---

### 6. 日志管理 API

#### GET /api/rate-limit/logs
查询详细的请求日志。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| startTime | number | 开始时间戳 |
| endTime | number | 结束时间戳 |
| limit | number | 返回数量限制，默认 1000 |

#### DELETE /api/rate-limit/logs
清空请求日志。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| appKey | string | 可选，仅清空指定 App Key 的日志 |
| path | string | 可选，仅清空指定路由的日志 |

---

### 7. 配置管理 API

#### App Key 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/config/app-keys | 获取所有 App Keys |
| POST | /api/config/app-keys | 创建新 App Key |
| GET | /api/config/app-keys/:id | 获取单个 App Key |
| PUT | /api/config/app-keys/:id | 更新 App Key |
| DELETE | /api/config/app-keys/:id | 删除 App Key |

#### 路由管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/config/routes | 获取所有路由 |
| POST | /api/config/routes | 创建新路由 |
| GET | /api/config/routes/:id | 获取单个路由 |
| PUT | /api/config/routes/:id | 更新路由 |
| DELETE | /api/config/routes/:id | 删除路由 |

#### 限流配置管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/config/rate-limit-configs | 获取所有限流配置 |
| POST | /api/config/rate-limit-configs | 创建新限流配置 |
| GET | /api/config/rate-limit-configs/:id | 获取单个配置 |
| PUT | /api/config/rate-limit-configs/:id | 更新配置 |
| DELETE | /api/config/rate-limit-configs/:id | 删除配置 |

---

## 算法说明

### 固定窗口算法 (Fixed Window)

**原理**:
- 将时间划分为固定大小的窗口（如每 60 秒一个窗口）
- 每个窗口内的请求计数独立
- 窗口结束时计数重置

**示例** (窗口 60s，配额 100):
```
时间轴:    0s    60s   120s  180s
          |-----|-----|-----|
窗口:     [0-60)[60-120)[120-180)...
计数:      100    100    100
```

**优点**:
- 实现简单，计算成本低
- 内存占用小

**缺点**:
- **边界问题**: 在窗口切换时刻可能允许双倍流量
- 例如: 55s 时 100 个请求，65s 时又 100 个请求，实际上 10 秒内有 200 个请求

### 滑动窗口算法 (Sliding Window)

**原理**:
- 跟踪过去 N 秒内的所有请求
- 新请求到来时，检查过去 N 秒内的请求总数
- 过期的请求自动从计数中移除

**示例** (窗口 60s，配额 100):
```
时间轴:          50s   60s   70s
过去 60s:        [-----]
                              ← 新请求在 70s 时
过去 60s (70s时):      [-----]
```

**优点**:
- **精确**: 真正限制任意 N 秒内的请求数
- 无边界突增问题

**缺点**:
- 计算成本较高
- 需要存储更多请求时间点

### 两种算法对比

| 特性 | 固定窗口 | 滑动窗口 |
|------|---------|---------|
| 实现复杂度 | 简单 | 较复杂 |
| 内存占用 | 低 | 较高 |
| 精确性 | 较低 | 高 |
| 边界突增 | **有风险** | 无 |
| 适用场景 | 非关键接口 | 关键接口（支付、登录等） |

---

## 使用示例

### 1. 基础限流检查
```bash
# 检查单个请求
curl -X POST "http://localhost:3000/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET"
  }'
```

### 2. 并发压力测试
```bash
# 模拟 200 个并发请求（配额 100）
curl -X POST "http://localhost:3000/api/rate-limit/simulate/concurrent" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "ak_test_001",
    "path": "/api/users",
    "method": "GET",
    "requestCount": 200
  }'
```

### 3. 边界时刻测试
```bash
# 测试窗口切换时刻的行为
# 构造跨越 60s 边界的时间戳
BASE_TIME=1700000000000

curl -X POST "http://localhost:3000/api/rate-limit/simulate/timeline" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"ak_test_002\",
    \"path\": \"/api/users\",
    \"method\": \"GET\",
    \"timestamps\": [
      $((BASE_TIME + 59000)),
      $((BASE_TIME + 59500)),
      $((BASE_TIME + 60000)),
      $((BASE_TIME + 60500)),
      $((BASE_TIME + 61000))
    ]
  }"
```

### 4. 查看统计并导出报告
```bash
# 查看统计
curl "http://localhost:3000/api/rate-limit/stats"

# 导出 Markdown 报告
curl -O -J "http://localhost:3000/api/rate-limit/report?format=markdown"

# 导出 JSON 报告
curl -O -J "http://localhost:3000/api/rate-limit/report?format=json"
```

---

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch
```

---

## 项目结构

```
rate-limit-validator/
├── src/
│   ├── index.js              # 服务入口
│   ├── config.js             # 配置文件
│   ├── database.js           # SQLite 数据库封装
│   ├── seed.js               # 种子数据脚本
│   ├── routes/
│   │   ├── rateLimitRoutes.js   # 限流相关 API
│   │   └── configRoutes.js      # 配置管理 API
│   └── services/
│       ├── rateLimitService.js  # 限流核心逻辑
│       └── reportService.js     # 报告生成服务
├── tests/
│   └── rateLimit.test.js        # 单元测试
├── examples/
│   ├── curl-examples.sh         # curl 示例脚本
│   └── bad-config-examples.md   # 坏配置样例与边界测试
├── data/                        # SQLite 数据库目录
├── package.json
├── jest.config.js
└── README.md
```

---

## 配置说明

### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| DB_PATH | ./data/rate-limit.db | 数据库文件路径 |
| LOG_LEVEL | info | 日志级别 |

---

## 注意事项

### 生产环境建议
1. **算法选择**: 关键接口（支付、登录）推荐使用滑动窗口算法
2. **配额设置**: 根据实际业务压测结果设置合理配额
3. **监控告警**: 监控 `rejectedRate` 突增，可能表示攻击或配置问题
4. **日志清理**: 定期清理旧的请求日志，避免数据库过大

### 已知限制
1. 当前实现使用 SQLite，适合本地测试和小规模使用
2. 高并发场景下考虑使用 Redis + Lua 脚本实现更精确的限流
3. 当前不支持分布式限流（多实例间计数不同步）

---

## 相关文档

- [坏配置样例与边界测试指南](./examples/bad-config-examples.md)
- [Curl 示例脚本](./examples/curl-examples.sh)

---

## License

MIT
