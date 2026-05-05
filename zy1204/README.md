# 接口保护策略复盘台

一个本地的接口保护策略模拟和复盘工具，支持多种限流算法、熔断降级、过载保护等策略的模拟和分析。

## 功能特性

### 限流算法
- **令牌桶 (Token Bucket)**：灵活的速率控制，支持突发流量
- **漏桶 (Leaky Bucket)**：平滑请求流量，防止突发
- **滑动窗口 (Sliding Window)**：精确的时间窗口计数

### 保护机制
- **熔断器 (Circuit Breaker)**：防止级联失败，支持三种状态转换
- **降级 (Fallback)**：提供备用方案，支持多种降级策略
- **过载保护 (Overload Protection)**：控制系统负载，支持自适应调整

### 核心功能
- 导入流量 trace 数据（支持 JSON/CSV 格式）
- 创建和管理多种保护策略
- 组合多种策略进行实验模拟
- 查看实验结果：时间线、请求分布、错误率/延迟变化
- 导出 Markdown/JSON 格式的复盘报告

## 项目结构

```
├── src/
│   ├── algorithms/          # 限流算法实现
│   │   ├── tokenBucket.js
│   │   ├── leakyBucket.js
│   │   ├── slidingWindow.js
│   │   └── index.js
│   ├── protections/         # 保护机制实现
│   │   ├── circuitBreaker.js
│   │   ├── overloadProtection.js
│   │   ├── fallbackManager.js
│   │   └── index.js
│   ├── models/              # 数据模型
│   │   ├── experiment.js
│   │   ├── policy.js
│   │   ├── trafficTrace.js
│   │   ├── dependencyHealth.js
│   │   ├── decisionLog.js
│   │   └── index.js
│   ├── routes/              # API 路由
│   │   ├── experiments.js
│   │   ├── policies.js
│   │   ├── traces.js
│   │   └── index.js
│   ├── config/              # 配置文件
│   │   └── database.js
│   ├── seeders/             # 种子数据
│   │   └── seed.js
│   └── server.js            # 服务器入口
├── public/                  # 前端静态文件
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/                   # 测试文件
│   ├── algorithms.test.js
│   └── protections.test.js
├── data/                    # 数据库目录
├── package.json
├── jest.config.js
└── .env
```

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件（已默认创建）：

```
PORT=3000
NODE_ENV=development
DB_PATH=./data/app.db
```

### 初始化数据（可选）

运行种子数据脚本，创建示例策略、流量追踪和实验：

```bash
npm run seed
```

这会创建：
- 7 个示例策略（令牌桶、漏桶、滑动窗口、2个熔断器、过载保护、严格限流）
- 5 个流量追踪样本（正常流量、突发流量、高错误率、慢响应、混合场景）
- 3 个预配置实验草稿
- 5 个坏配置示例（用于学习和测试）

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后访问：`http://localhost:3000`

## 使用指南

### 1. 导入流量追踪

点击「流量追踪」→「导入流量」，支持以下格式：

**JSON 格式示例：**
```json
[
  {
    "requestId": "req_001",
    "url": "/api/users",
    "method": "GET",
    "latency": 50,
    "responseInfo": {
      "statusCode": 200
    }
  },
  {
    "requestId": "req_002",
    "url": "/api/orders",
    "method": "POST",
    "latency": 120,
    "responseInfo": {
      "statusCode": 200
    }
  }
]
```

**支持的字段：**
- `requestId`: 请求ID（可选）
- `timestamp`: 时间戳（可选）
- `url`: 请求URL
- `method`: HTTP方法
- `headers`: 请求头（可选）
- `body`: 请求体（可选）
- `query`: 查询参数（可选）
- `latency`: 延迟（毫秒）
- `responseInfo.statusCode`: 响应状态码

### 2. 创建保护策略

点击「策略配置」→「新建策略」，支持以下策略类型：

#### 限流策略
**令牌桶配置：**
- 桶容量：最大令牌数
- 令牌速率：每秒生成的令牌数
- 初始令牌数：初始时的令牌数
- 是否启用队列：令牌不足时是否排队
- 最大队列大小：队列的最大容量

**漏桶配置：**
- 桶容量：最大请求数
- 漏水速率：每秒处理的请求数
- 是否启用队列
- 最大队列大小

**滑动窗口配置：**
- 窗口大小（秒）：时间窗口长度
- 最大请求数：窗口内的最大请求数
- 是否启用队列
- 最大队列大小

#### 熔断策略
- 失败阈值：触发熔断的失败率比例（0-1）
- 最小请求数：评估熔断状态所需的最小请求数
- 半开探测请求数：半开状态下的探测请求数
- 重置超时（毫秒）：从打开到半开的等待时间
- 是否启用降级

#### 过载保护
- 最大并发数：同时处理的最大请求数
- 最大队列大小：排队等待的最大请求数
- 队列超时（毫秒）：队列中请求的最大等待时间
- 是否启用降级
- 是否自适应调整：根据延迟动态调整并发数
- 目标延迟（毫秒）：自适应调整的目标延迟

### 3. 创建并运行实验

1. 点击「实验管理」→「新建实验」
2. 输入实验名称和描述
3. 选择要使用的策略（可多选）
4. 选择流量追踪数据
5. 点击「创建」
6. 在实验列表中点击「运行」

### 4. 查看实验结果

实验完成后，点击「查看结果」可以看到：

- **基本信息**：实验状态、时间、配置
- **请求分布**：放行/排队/拒绝/降级的请求数量统计
- **统计指标**：总请求数、错误率、平均延迟
- **时间线**：请求处理的时间序列，显示每个请求的处理结果和原因

### 5. 导出报告

在实验结果页面，可以导出：
- **Markdown 报告**：适合文档归档
- **JSON 报告**：适合程序分析

## 算法说明

### 令牌桶算法 (Token Bucket)

令牌桶算法以恒定速率向桶中放入令牌，每次请求需要获取一个令牌才能执行。

**优点：**
- 支持突发流量（桶中有足够令牌时）
- 灵活的速率控制
- 可以轻松实现优先级

**配置示例：**
```javascript
{
  capacity: 100,      // 桶容量
  rate: 10,            // 每秒10个令牌
  initialTokens: 100,  // 初始令牌
  queueEnabled: true,
  maxQueueSize: 50
}
```

### 漏桶算法 (Leaky Bucket)

漏桶算法以恒定速率处理请求，请求先进入桶中，然后以固定速率流出。

**优点：**
- 平滑流量，防止突发
- 强制整形请求速率

**配置示例：**
```javascript
{
  capacity: 100,      // 桶容量
  rate: 5,             // 每秒处理5个请求
  queueEnabled: true,
  maxQueueSize: 50
}
```

### 滑动窗口算法 (Sliding Window)

滑动窗口算法在一个时间窗口内统计请求数，超过阈值则限流。

**优点：**
- 精确的时间窗口统计
- 简单直观

**配置示例：**
```javascript
{
  windowSize: 60,      // 60秒窗口
  maxRequests: 100,    // 最多100个请求
  queueEnabled: false,
  maxQueueSize: 0
}
```

### 熔断器模式 (Circuit Breaker)

熔断器有三种状态：
- **关闭 (Closed)**：正常状态，请求正常执行
- **打开 (Open)**：错误率超过阈值，拒绝所有请求
- **半开 (Half-Open)**：超时后尝试部分请求，探测是否恢复

**状态转换：**
```
关闭 → 打开（错误率超过阈值）
打开 → 半开（等待重置超时）
半开 → 关闭（探测全部成功）
半开 → 打开（探测有失败）
```

**配置示例：**
```javascript
{
  failureThreshold: 0.5,      // 失败率50%触发熔断
  minimumRequests: 10,         // 至少10个请求才评估
  halfOpenRequestLimit: 3,     // 半开时探测3个请求
  resetTimeout: 60000,         // 60秒后进入半开
  fallbackEnabled: true
}
```

## 坏配置示例

运行 `npm run seed` 后会创建一些坏配置示例（标记为 `[BAD]` 前缀），用于学习和测试：

| 配置名称 | 问题描述 | 影响 |
|---------|---------|------|
| 过严格的令牌桶 | 容量1，速率0.1/s | 几乎所有请求被拒绝 |
| 负数值限流 | 窗口大小和请求数为负数 | 逻辑错误，可能导致异常 |
| 不可能的熔断器 | 失败阈值150%，最小请求0 | 永远无法触发或立即触发 |
| 零并发限制 | 最大并发设为0 | 所有请求被拒绝 |
| 矛盾的降级配置 | 启用降级但无降级策略 | 配置逻辑不完整 |

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

## API 接口

### 实验管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/experiments | 获取实验列表 |
| GET | /api/experiments/:id | 获取实验详情 |
| POST | /api/experiments | 创建实验 |
| PUT | /api/experiments/:id | 更新实验 |
| DELETE | /api/experiments/:id | 删除实验 |
| POST | /api/experiments/:id/run | 运行实验 |
| GET | /api/experiments/:id/result | 获取实验结果 |
| GET | /api/experiments/:id/export/markdown | 导出Markdown报告 |
| GET | /api/experiments/:id/export/json | 导出JSON报告 |

### 策略管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/policies | 获取策略列表 |
| GET | /api/policies/:id | 获取策略详情 |
| POST | /api/policies | 创建策略 |
| PUT | /api/policies/:id | 更新策略 |
| DELETE | /api/policies/:id | 删除策略 |
| GET | /api/policies/types/list | 获取策略类型列表 |
| GET | /api/policies/rate-limit-types/list | 获取限流类型列表 |
| GET | /api/policies/templates/defaults | 获取默认模板 |

### 流量追踪

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/traces | 获取流量追踪列表 |
| GET | /api/traces/:id | 获取流量追踪详情 |
| POST | /api/traces | 创建流量追踪 |
| POST | /api/traces/import | 导入流量追踪 |
| PUT | /api/traces/:id | 更新流量追踪 |
| DELETE | /api/traces/:id | 删除流量追踪 |

### 系统接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/stats | 获取统计数据 |

## 数据模型

### Experiment (实验)
- id: UUID
- name: 实验名称
- description: 描述
- status: 状态（draft/running/completed/failed）
- startTime/endTime: 时间
- config: 配置（策略ID、流量追踪ID）
- result: 结果摘要

### Policy (策略)
- id: UUID
- name: 策略名称
- description: 描述
- type: 类型（rate_limit/circuit_breaker/fallback/overload_protection）
- rateLimitType: 限流类型（token_bucket/leaky_bucket/sliding_window）
- config: 策略配置
- isActive: 是否启用

### TrafficTrace (流量追踪)
- id: UUID
- name: 名称
- description: 描述
- source: 来源（file/manual/api/import）
- requestCount: 请求数
- data: 请求数据数组

### DecisionLog (判定日志)
- id: UUID
- experimentId: 实验ID
- requestId: 请求ID
- timestamp: 时间戳
- action: 动作（allow/queue/reject/fallback）
- policyType: 触发的策略类型
- reason: 原因
- requestInfo: 请求信息
- responseInfo: 响应信息
- latency: 延迟

## 开发说明

### 技术栈
- **后端**: Node.js + Express + SQLite + Sequelize
- **前端**: 原生 HTML/CSS/JavaScript
- **测试**: Jest
- **数据库**: SQLite（轻量级，适合本地开发）

### 目录说明
- `src/algorithms/`: 限流算法实现
- `src/protections/`: 保护机制实现
- `src/models/`: Sequelize 数据模型
- `src/routes/`: Express 路由
- `public/`: 前端静态文件
- `tests/`: 测试文件
- `data/`: SQLite 数据库文件

## 常见问题

### Q: 如何添加新的限流算法？
1. 在 `src/algorithms/` 下创建新的算法类
2. 在 `src/algorithms/index.js` 中导出并注册到 `createRateLimiter` 工厂函数
3. 在前端添加对应的配置表单

### Q: 如何添加新的保护策略？
1. 在 `src/protections/` 下创建新的保护类
2. 在 `src/protections/index.js` 的 `ProtectionEngine` 中添加对应方法
3. 在 `src/routes/policies.js` 中更新策略类型验证
4. 在前端添加对应的配置表单

### Q: 数据存储在哪里？
SQLite 数据库文件默认存储在 `data/app.db`，可以通过 `.env` 中的 `DB_PATH` 配置修改。

### Q: 如何重置所有数据？
删除 `data/app.db` 文件，或者重新运行：
```bash
npm run seed
```
注意：这会清空所有数据并重新创建示例数据。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
