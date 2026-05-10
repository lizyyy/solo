# 短链归因防刷 API (Short Link Anti-Fraud API)

一个偏业务规则的短链归因防刷系统，旨在解决营销短链被机器刷点击后，渠道归因和转化率失真的问题。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    API 入口层 (Express)                       │
│  GET /:shortCode → 短链访问入口（含防刷检测）                  │
│  POST /api/v1/conversions → 转化上报                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    核心服务层                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ 设备指纹服务  │  │ 刷量规则引擎 │  │  归因服务       │    │
│  │ (Fingerprint)│  │ (FraudDetect)│  │ (Attribution)   │    │
│  └──────────────┘  └──────────────┘  └─────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ 黑名单服务   │  │ 重跑策略服务 │                         │
│  │ (Blacklist)  │  │ (Retry/Rerun)│                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层                                     │
│  PostgreSQL: short_links, access_logs, device_fingerprints   │
│              conversions, blacklists, attribution_reports    │
│              tasks                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    后台任务层 (Worker)                        │
│  任务队列、重试、失败恢复、报表生成                            │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 设备指纹 (Device Fingerprint)
- 基于 IP + User-Agent + 请求头生成唯一设备指纹
- Bot 检测（爬虫、脚本、机器人识别）
- 设备相似度计算（防止设备克隆）
- 可测试的指纹算法

### 2. 刷量规则引擎 (Fraud Detection)
- **频率限制**: 同一设备/IP 在时间窗口内的访问次数
- **Bot 检测**: 基于 User-Agent 和行为模式
- **黑名单拦截**: IP、设备指纹黑名单
- **设备相似度**: 检测相似设备集群（机器农场）
- **异常行为**: 高频请求、异常模式

### 3. 转化归因 (Attribution)
- **首次点击归因 (First Click)**: 默认模型
- **末次点击归因 (Last Click)**: 可选模型
- **归因窗口**: 可配置的点击到转化时间窗口
- **幂等性**: 同一订单号不会重复归因

### 4. 黑名单系统 (Blacklist)
- IP、设备指纹、User-Agent 三种类型
- 可配置过期时间
- 严重程度分级（low/medium/high/critical）
- 自动过期清理

### 5. 后台任务系统 (Background Worker)
- 任务状态追踪（pending/processing/completed/failed）
- 指数退避重试机制
- 失败任务自动重跑
- 手动触发重跑 API

## 并发控制与事务保证

### 数据库事务
```javascript
// src/services/shortLinkAccessService.js:40-103
async _processAccessTransaction(shortCode, req, requestId, ipAddress) {
  return sequelize.transaction(async (t) => {
    // 1. 验证短链（共享锁）
    // 2. 生成/获取设备指纹
    // 3. 刷量检测
    // 4. 记录访问日志
    // 5. 更新统计
    // 6. 队列后台任务
    // 全部在一个事务中，要么全成功，要么全失败
  });
}
```

### 防止重复结算
- **唯一约束**: `access_logs.requestId` 唯一索引
- **幂等性**: `conversions.externalOrderId` 唯一索引
- **乐观锁**: 任务 `attemptCount` 递增检测
- **状态机**: 任务状态流转（pending → processing → completed/failed）

### 重复请求处理
```javascript
// 1. 请求级别：requestId 唯一标识
// 2. 数据库级别：唯一约束防重复写入
// 3. 并发级别：数据库事务和行级锁
```

## 重跑机制 (Rerun Strategy)

### 1. 自动重跑（后台 Worker）

**触发条件**:
- 数据库连接超时
- 临时网络故障
- 资源竞争（死锁、锁等待）

**重试策略**:
```
第1次失败 → 等待 10 秒 → 重试
第2次失败 → 等待 20 秒 → 重试
第3次失败 → 等待 40 秒 → 重试
... 指数退避
```

**代码位置**:
```javascript
// src/worker/index.js:68-125
async processTask(task) {
  // 更新状态为 processing
  // 执行任务（带重试）
  // 成功 → completed
  // 失败 → 检查是否为最后一次尝试
  //   是 → 标记为 failed
  //   否 → 标记为 pending，设置 nextAttemptAt
}
```

### 2. 手动重跑（API 触发）

**API 接口**:

```bash
# 重跑单个失败任务
POST /api/v1/tasks/rerun/:taskId

# 重跑所有可重试的失败任务
POST /api/v1/tasks/rerun-all

# 查看失败任务列表
GET /api/v1/tasks/failed?type=process_access_log&limit=100
```

**代码位置**:
```javascript
// src/services/shortLinkAccessService.js:214-283
async rerunFailedTask(taskId) {
  // 1. 加载任务
  // 2. 重建请求上下文
  // 3. 使用 enhanced retry 策略（5次尝试）
  // 4. 更新任务状态
}

async rerunAllFailed() {
  // 批量获取可重试的失败任务
  // 逐个重跑
  // 返回汇总结果
}
```

### 3. 重跑时的状态处理

**任务状态流转**:
```
pending → processing → completed
                    → failed (可重试) → pending → ...
                    → failed (不可重试)
```

**不可重试的错误类型**:
- `VALIDATION_ERROR`: 数据验证失败
- `NOT_FOUND`: 资源不存在
- `DUPLICATE_ENTRY`: 唯一键冲突

**代码位置**:
```javascript
// src/utils/retry.js:82-98
shouldContinueProcessing(error, attempt) {
  const nonRetryableErrors = [
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'DUPLICATE_ENTRY',
  ];
  
  if (nonRetryableErrors.includes(error.code)) {
    return false;  // 停止处理
  }
  return attempt < 3;  // 继续处理
}
```

## 任务失败处理

### 1. 短链访问失败

**场景**: API 层处理短链访问时发生错误

**处理流程**:
1. 立即尝试 3 次重试（带指数退避）
2. 如果全部失败，创建失败任务到数据库
3. 后台 Worker 定期轮询并重跑
4. 可通过 API 手动触发重跑

**代码位置**:
```javascript
// src/services/shortLinkAccessService.js:25-37
async processAccess(shortCode, req) {
  const retryResult = await withRetry(
    () => this._processAccessTransaction(...),
    { maxAttempts: 3 },
    context
  );
  
  if (retryResult.success) {
    return retryResult.result;
  }
  
  // 创建失败任务
  await this._createFailedTask(...);
  throw retryResult.error;
}
```

### 2. 转化归因失败

**场景**: 转化上报后，归因过程中发生错误

**处理流程**:
1. 转化记录先写入（保证数据不丢）
2. 归因失败 → 创建 `process_conversion` 任务
3. Worker 异步处理，最多重试 3 次
4. 可通过 API 手动重新处理

**代码位置**:
```javascript
// src/controllers/conversionController.js:137-150
const attributionResult = await attributeConversion(conversion, ...);

if (!attributionResult.success) {
  await Task.create({
    type: 'process_conversion',
    referenceId: conversion.id,
    status: 'pending',
  });
}
```

### 3. 报表生成失败

**场景**: 生成归因报表时出错

**处理流程**:
1. 报表记录先创建（状态: processing）
2. 失败 → 更新状态为 failed，记录错误信息
3. 下次生成时自动覆盖，或手动触发

**代码位置**:
```javascript
// src/services/attributionService.js:184-283
async generateAttributionReport(reportDate, shortLinkId) {
  const [report, created] = await AttributionReport.findOrCreate({
    where: { reportDate, shortLinkId },
    defaults: { status: 'processing' },
  });
  
  try {
    // 生成报表...
    await report.update({ status: 'completed' });
  } catch (error) {
    await report.update({ 
      status: 'failed', 
      processingError: error.message,
      retryCount: report.retryCount + 1,
    });
    throw error;
  }
}
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- Redis (可选，用于高级任务队列)

### 安装

```bash
npm install
```

### 配置

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接等参数。

### 数据库迁移

```bash
npm run migrate
```

### 启动服务

```bash
# 启动 API 服务
npm start

# 启动后台 Worker
npm run worker

# 开发模式
npm run dev
```

### 运行测试

```bash
npm test

# 覆盖率报告
npm test -- --coverage

# 监听模式
npm run test:watch
```

## API 文档

### 短链访问
```
GET /:shortCode

响应：
- 302 重定向（正常访问）
- 403 拒绝访问（刷量检测）
- 200 Bot 检测
- 404 短链不存在
```

### 转化上报
```
POST /api/v1/conversions
Content-Type: application/json

{
  "conversionType": "purchase",
  "conversionValue": 99.99,
  "externalOrderId": "ORDER_12345",
  "externalUserId": "USER_67890",
  "shortCode": "ABC123",
  "deviceFingerprint": "..."
}
```

### 任务管理
```
# 查看失败任务
GET /api/v1/tasks/failed?type=process_access_log

# 重跑单个任务
POST /api/v1/tasks/rerun/:taskId

# 重跑所有可重试任务
POST /api/v1/tasks/rerun-all

# 处理待归因的转化
POST /api/v1/tasks/process-conversions
```

### 归因报表
```
POST /api/v1/reports/attribution
Content-Type: application/json

{
  "shortCode": "ABC123",
  "reportDate": "2024-01-15"
}
```

## 可测试的代码

所有核心规则都有对应的单元测试：

### 设备指纹测试
`src/__tests__/deviceFingerprintService.test.js`
- `normalizeString`: 字符串规范化
- `isBot`: Bot 检测规则
- `isMobileDevice`: 移动端检测
- `parseUserAgent`: User-Agent 解析
- `generateFingerprintHash`: 指纹生成一致性
- `calculateFingerprintSimilarity`: 相似度计算
- `getClientIP`: IP 地址获取

### 刷量规则测试
`src/__tests__/fraudDetectionService.test.js`
- `createFraudResult`: 结果对象创建
- `checkBotDetection`: Bot 检测
- `aggregateFraudResults`: 多规则聚合

### 重试机制测试
`src/__tests__/retry.test.js`
- `RetryableOperation`: 重试类功能
- `withRetry`: 重试包装函数
- `createRerunStrategy`: 重跑策略

### 归因规则测试
`src/__tests__/attributionService.test.js`
- `isValidClickForAttribution`: 有效点击判断

## 配置参数

| 参数 | 环境变量 | 默认值 | 说明 |
|------|----------|--------|------|
| 频率阈值 | FRAUD_FREQUENCY_THRESHOLD | 10 | 时间窗口内最大请求数 |
| 时间窗口 | FRAUD_TIME_WINDOW_SECONDS | 60 | 频率检测窗口（秒） |
| IP 最大请求 | FRAUD_IP_MAX_REQUESTS | 50 | 1小时内最大请求数 |
| 相似度阈值 | FRAUD_FINGERPRINT_SIMILARITY_THRESHOLD | 0.9 | 设备相似度判定阈值 |
| 归因窗口 | ATTRIBUTION_WINDOW_HOURS | 24 | 点击到转化的有效时间 |
| 最大重试 | RETRY_MAX_ATTEMPTS | 3 | 操作重试次数 |
| 重试间隔 | RETRY_DELAY_MS | 1000 | 初始重试间隔（毫秒） |

## 监控与告警

### 关键指标
- `access_logs.isFraud=true` - 欺诈点击数量
- `tasks.status=failed` - 失败任务数量
- `conversions.isAttributed=false` - 未归因转化数

### 日志级别
- `error`: 系统错误、任务失败
- `warn`: 欺诈检测、重试触发
- `info`: 正常操作、任务状态变更
- `debug`: 详细调试信息

## 故障排查

### 常见问题

**Q: 任务一直失败怎么办？**
A: 
1. 查看任务详情：`GET /api/v1/tasks/failed`
2. 检查错误信息 `errorMessage` 和 `errorStack`
3. 如果是临时错误：`POST /api/v1/tasks/rerun/:taskId`
4. 如果是数据错误：修复数据后重跑

**Q: 转化率突然下降？**
A:
1. 查看短链统计：`GET /stats/:shortCode`
2. 检查 `fraudClicks` 是否异常增加
3. 查看 `last24Hours.fraudReasons` 分布
4. 检查黑名单是否有误判

**Q: 数据库死锁？**
A:
- 所有写操作都在事务中
- 死锁时自动回滚并创建失败任务
- Worker 会自动重试

## 项目结构

```
src/
├── config/              # 配置文件
│   └── index.js
├── controllers/         # 控制器
│   ├── shortLinkController.js
│   ├── conversionController.js
│   └── taskController.js
├── db/                  # 数据库
│   ├── index.js
│   └── migrate.js
├── models/              # 数据模型
│   ├── ShortLink.js
│   ├── DeviceFingerprint.js
│   ├── AccessLog.js
│   ├── Blacklist.js
│   ├── Conversion.js
│   ├── AttributionReport.js
│   ├── Task.js
│   └── index.js
├── routes/              # 路由
│   └── index.js
├── services/            # 业务服务
│   ├── deviceFingerprintService.js
│   ├── fraudDetectionService.js
│   ├── shortLinkAccessService.js
│   ├── attributionService.js
│   └── blacklistService.js
├── utils/               # 工具函数
│   ├── logger.js
│   └── retry.js
├── worker/              # 后台任务
│   └── index.js
├── __tests__/           # 单元测试
│   ├── deviceFingerprintService.test.js
│   ├── fraudDetectionService.test.js
│   ├── retry.test.js
│   └── attributionService.test.js
├── app.js               # Express 应用
└── index.js             # 启动入口
```

## License

MIT
