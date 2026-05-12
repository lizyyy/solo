# 影子流量对比 API

用于在不影响生产环境的情况下，通过影子流量对比新旧服务的实现效果。

## 功能特性

- **实验注册**：配置对比实验，包括采样比例、忽略字段、差异白名单、副作用字段等
- **影子流量处理**：接收影子请求，并行调用新旧处理器，记录响应差异
- **差异对比引擎**：支持忽略动态字段、差异白名单、副作用字段检测
- **自动暂停机制**：发现副作用字段后自动暂停实验
- **报告生成**：按接口、租户和差异类型汇总，给出流量扩大建议

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### 1. 注册对比实验

**POST** `/api/experiments`

请求体参数：
- `name`: 实验名称
- `endpoint`: 目标接口
- `samplingRate`: 采样比例 (0-1)
- `oldProcessor`: 旧处理器名称
- `newProcessor`: 新处理器名称
- `ignoredFields`: 忽略的字段列表（支持通配符 `*`）
- `whitelistedDifferences`: 差异白名单（支持通配符 `*`）
- `sideEffectFields`: 副作用字段（检测到差异立即暂停实验）

### 2. 获取实验列表

**GET** `/api/experiments`

### 3. 获取单个实验

**GET** `/api/experiments/:id`

### 4. 提交影子请求

**POST** `/api/experiments/:id/shadow`

请求体参数：
- `requestId`: 请求唯一标识（必填，用于去重）
- `tenantId`: 租户 ID
- `body`: 请求体
- `headers`: 请求头

### 5. 暂停实验

**POST** `/api/experiments/:id/pause`

### 6. 恢复实验

**POST** `/api/experiments/:id/resume`

### 7. 生成实验报告

**GET** `/api/experiments/:id/report`

## Curl 示例

### 1. 注册价格服务对比实验

```bash
curl -X POST http://localhost:3000/api/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "价格服务新旧版本对比",
    "endpoint": "/api/price/calculate",
    "samplingRate": 1.0,
    "oldProcessor": "old-price",
    "newProcessor": "new-price",
    "ignoredFields": ["processedAt"],
    "whitelistedDifferences": [],
    "sideEffectFields": ["inventory*", "bill*"]
  }'
```

**返回示例**：
```json
{
  "success": true,
  "experiment": {
    "id": "实验ID",
    "name": "价格服务新旧版本对比",
    "status": "active",
    ...
  }
}
```

### 2. 价格一致（无差异）

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-001",
    "tenantId": "tenant-001",
    "body": {
      "productId": "prod-001",
      "quantity": 2,
      "tenantId": "tenant-001"
    }
  }'
```

**返回示例**：
```json
{
  "success": true,
  "sampled": true,
  "shadowRequestId": "...",
  "hasDifferences": false,
  "hasSideEffectRisk": false,
  "differences": [],
  "sideEffectRisk": null
}
```

### 3. 四舍五入差异

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-002",
    "tenantId": "tenant-001",
    "body": {
      "productId": "prod-002",
      "quantity": 3,
      "tenantId": "tenant-001",
      "triggerScenario": "rounding_diff"
    }
  }'
```

**返回示例**：
```json
{
  "success": true,
  "sampled": true,
  "shadowRequestId": "...",
  "hasDifferences": true,
  "hasSideEffectRisk": false,
  "differences": [
    {
      "field": "tax",
      "type": "value_changed",
      "oldValue": 60,
      "newValue": 61
    },
    {
      "field": "finalPrice",
      "type": "value_changed",
      "oldValue": 661,
      "newValue": 662
    }
  ]
}
```

### 4. 字段缺失

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-003",
    "tenantId": "tenant-002",
    "body": {
      "productId": "prod-003",
      "quantity": 5,
      "tenantId": "tenant-002",
      "triggerScenario": "missing_field"
    }
  }'
```

**返回示例**：
```json
{
  "success": true,
  "sampled": true,
  "shadowRequestId": "...",
  "hasDifferences": true,
  "hasSideEffectRisk": false,
  "differences": [
    {
      "field": "currency",
      "type": "missing_in_new",
      "oldValue": "CNY",
      "newValue": null
    }
  ]
}
```

### 5. 副作用风险（实验暂停）

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-004",
    "tenantId": "tenant-003",
    "body": {
      "productId": "prod-001",
      "quantity": 1,
      "tenantId": "tenant-003",
      "triggerScenario": "side_effect"
    }
  }'
```

**返回示例**：
```json
{
  "success": true,
  "sampled": true,
  "shadowRequestId": "...",
  "hasDifferences": true,
  "hasSideEffectRisk": true,
  "differences": [],
  "sideEffectRisk": {
    "field": "inventoryUpdated",
    "type": "missing_in_old",
    "oldValue": null,
    "newValue": true
  }
}
```

### 6. 实验暂停后再次提交（被拒绝）

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-005",
    "tenantId": "tenant-001",
    "body": {
      "productId": "prod-001",
      "quantity": 10,
      "tenantId": "tenant-001"
    }
  }'
```

**返回示例**（HTTP 403）：
```json
{
  "success": false,
  "error": "实验已暂停: 检测到副作用风险: inventoryUpdated",
  "code": "EXPERIMENT_PAUSED",
  "pausedReason": "检测到副作用风险: inventoryUpdated"
}
```

### 7. 同一请求重复上报

```bash
curl -X POST http://localhost:3000/api/experiments/{实验ID}/shadow \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req-001",
    "tenantId": "tenant-001",
    "body": {
      "productId": "prod-001",
      "quantity": 2,
      "tenantId": "tenant-001"
    }
  }'
```

**返回示例**（HTTP 400）：
```json
{
  "success": false,
  "error": "请求已处理过",
  "code": "DUPLICATE_REQUEST",
  "existingRequestId": "..."
}
```

### 8. 获取实验报告

```bash
curl http://localhost:3000/api/experiments/{实验ID}/report
```

**返回示例**：
```json
{
  "success": true,
  "report": {
    "experiment": {
      "id": "...",
      "name": "价格服务新旧版本对比",
      "status": "paused",
      "pausedReason": "检测到副作用风险: inventoryUpdated",
      "totalRequests": 5,
      "matchedRequests": 1,
      "differenceCount": 2,
      "sideEffectRiskCount": 1
    },
    "summary": {
      "byEndpoint": {
        "/api/price/calculate": {
          "count": 2,
          "differences": [...]
        }
      },
      "byTenant": {
        "tenant-001": { "count": 1, "differences": [...] },
        "tenant-002": { "count": 1, "differences": [...] }
      },
      "byDifferenceType": {
        "value_changed": { "count": 2, "fields": ["tax", "finalPrice"] },
        "missing_in_new": { "count": 1, "fields": ["currency"] }
      }
    },
    "canExpandTraffic": false,
    "expansionRecommendation": "检测到副作用风险，实验已暂停，不可扩大流量",
    "responseDifferences": [...],
    "sideEffectRisks": [...]
  }
}
```

## 补充说明

### 主要边界

1. **实验状态边界**：
   - 实验有 `active`（活跃）和 `paused`（暂停）两种状态
   - 只有 `active` 状态的实验才能处理影子请求
   - 暂停状态的实验返回 HTTP 403 并包含暂停原因

2. **采样比例边界**：
   - `samplingRate` 必须在 0 到 1 之间
   - 采样基于随机数 `Math.random() < samplingRate`
   - 未被采样的请求不会调用处理器，直接返回成功

3. **处理器依赖边界**：
   - 注册实验时必须指定已注册的处理器名称
   - 处理器名称不存在会导致实验注册失败
   - 处理器执行失败会返回对应错误码

4. **请求标识边界**：
   - `requestId` 是必填字段，用于去重
   - 同一 `requestId` 只会被处理一次
   - 重复请求会返回 `DUPLICATE_REQUEST` 错误

5. **副作用字段边界**：
   - 副作用字段支持通配符匹配（如 `inventory*`）
   - 检测到副作用字段差异立即暂停实验
   - 副作用风险优先级高于普通响应差异

### 一个失败路径

**路径描述**：实验暂停后再次提交影子请求

**步骤**：
1. 注册实验：`POST /api/experiments`，设置 `sideEffectFields: ["inventory*"]`
2. 提交触发副作用的请求：`POST /api/experiments/:id/shadow`，包含 `triggerScenario: "side_effect"`
3. 实验检测到 `inventoryUpdated` 字段差异，自动暂停
4. 再次提交新的影子请求
5. 系统检测到实验状态为 `paused`
6. 返回 HTTP 403，错误码 `EXPERIMENT_PAUSED`，包含暂停原因

**关键点**：
- 副作用风险一旦触发，实验立即暂停
- 暂停后所有新请求都会被拒绝
- 拒绝响应中包含明确的暂停原因，便于排查

### 一次重复执行路径

**路径描述**：同一请求重复上报

**步骤**：
1. 提交第一个请求：`requestId: "req-001"`
2. 系统检查请求历史，`req-001` 不存在
3. 执行采样判断，调用新旧处理器
4. 对比响应，记录结果
5. 将 `req-001` 标记为已处理
6. 再次提交相同 `requestId: "req-001"` 的请求
7. 系统检查请求历史，`req-001` 已存在
8. 返回 `DUPLICATE_REQUEST` 错误，包含首次处理的请求 ID

**关键点**：
- 去重基于 `requestId`，不是请求内容
- 重复请求不会被处理，避免重复调用处理器
- 返回已存在请求的 ID，便于追溯

## 处理器开发

要添加自定义处理器，需要：

1. 在 `src/processors/` 目录下创建处理器文件
2. 导出一个异步函数，接收 `requestData` 参数
3. 在 `src/server.js` 中注册处理器

```javascript
// 处理器示例
async function myProcessor(requestData) {
  const { body, headers, tenantId } = requestData;
  // 处理逻辑
  return { result: '...' };
}

// 注册处理器
experimentManager.registerProcessor('my-processor', myProcessor);
```

## 注意事项

- 本实现使用内存存储，重启后数据会丢失
- 生产环境建议使用持久化存储（如 Redis、数据库）
- 处理器应该是无副作用的（只读操作）
- 副作用字段应该仔细配置，避免误判
