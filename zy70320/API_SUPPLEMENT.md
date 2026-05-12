# 队列积压根因 API - 补充说明

## 一、API 接口概览

### 1. 指标上报接口
```
POST /api/v1/queues/{queueName}/metrics
```
上报队列生产/消费指标数据。

**请求字段:**
- `timestamp` (必填): 毫秒级时间戳
- `produceRate`: 生产速率 (msg/s)
- `consumeRate`: 消费速率 (msg/s)
- `backlogCount`: 积压消息数
- `failureCount`: 失败消息数 (可选)
- `partitionMetrics`: 分区级指标 (可选)

---

### 2. 消费组心跳接口
```
POST /api/v1/consumers/{groupId}/heartbeat
```
上报消费者存活状态。

**请求字段:**
- `timestamp` (必填): 毫秒级时间戳
- `instanceId` (必填): 消费者实例ID
- `consumerCount`: 消费者实例数量
- `status`: 健康状态 (healthy/degraded/unhealthy)

---

### 3. 失败样本接口
```
POST /api/v1/queues/{queueName}/failures
```
上报消息消费失败样本。

**请求字段:**
- `timestamp` (必填): 毫秒级时间戳
- `messageId`: 消息唯一标识
- `errorMessage`: 错误信息
- `retryCount`: 重试次数
- `payload`: 消息载荷 (可选)

---

### 4. 重试队列状态接口
```
POST /api/v1/retry/{retryName}/status
```
上报重试队列状态。

**请求字段:**
- `timestamp` (必填): 毫秒级时间戳
- `totalCount`: 重试队列总消息数
- `messages`: 重试消息列表，每条包含 `messageId` 和 `retryCount`

---

### 5. 诊断查询接口
```
GET /api/v1/queues/{queueName}/diagnosis?consumerGroupId={groupId}
```
获取队列积压根因诊断结果。

**响应字段:**
- `status`: overall status (normal/warning/critical/unknown)
- `backlogCount`: 当前积压数量
- `rootCauses`: 根因列表，每个包含 `cause`, `description`, `evidence`
- `suggestions`: 建议动作列表，每个包含 `action`, `evidence`, `priority`
- `manualChecks`: 待人工确认项列表
- `evidence`: 所有证据指标汇总

---

### 6. 告警管理接口
```
POST /api/v1/queues/{queueName}/diagnosis/generate-alert  # 生成/自动处理告警
GET  /api/v1/alerts?queueName={queueName}&status={status} # 查询告警
POST /api/v1/alerts/{alertId}/acknowledge                 # 确认告警
POST /api/v1/alerts/{alertId}/resolve                     # 解决告警
POST /api/v1/alerts/{alertId}/reopen                      # 重新打开告警
```

---

## 二、CURL 样例

### 场景1: 正常队列
```bash
# 上报正常指标
curl -X POST http://localhost:3001/api/v1/queues/normal-queue/metrics \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "produceRate": 50, "consumeRate": 50, "backlogCount": 100}'

# 上报心跳
curl -X POST http://localhost:3001/api/v1/consumers/normal-group/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "instanceId": "consumer-1", "consumerCount": 3}'

# 查询诊断
curl "http://localhost:3001/api/v1/queues/normal-queue/diagnosis?consumerGroupId=normal-group"
```

**期望输出:**
```json
{
  "status": "normal",
  "overallDescription": "队列状态正常",
  "rootCauses": [],
  "suggestions": []
}
```

---

### 场景2: 生产突增
```bash
# 先上报历史正常指标
for i in 1 2 3; do
  TS=$(( $(date +%s) - (4-i) * 60 ))
  curl -X POST http://localhost:3001/api/v1/queues/prod-spike-queue/metrics \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 50, \"consumeRate\": 50, \"backlogCount\": 200}"
done

# 再上报突增指标
for i in 4 5 6; do
  TS=$(( $(date +%s) - (4-i) * 60 ))
  curl -X POST http://localhost:3001/api/v1/queues/prod-spike-queue/metrics \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 150, \"consumeRate\": 60, \"backlogCount\": 2000}"
done

curl -X POST http://localhost:3001/api/v1/consumers/prod-group/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "instanceId": "consumer-1", "consumerCount": 3}'

# 查询诊断 (需要至少30个历史数据点才能触发生产突增检测)
curl "http://localhost:3001/api/v1/queues/prod-spike-queue/diagnosis?consumerGroupId=prod-group"
```

**期望输出 (关键片段):**
```json
{
  "status": "warning",
  "rootCauses": [{
    "cause": "production_spike",
    "description": "生产速率突增",
    "evidence": [
      "当前生产速率: 150.00 msg/s",
      "历史生产速率: 50.00 msg/s",
      "增长倍数: 3.00x"
    ]
  }],
  "suggestions": [
    {"action": "扩容消费者", "evidence": "生产速率从 50.00 突增至 150.00", "priority": "high"},
    {"action": "检查流量来源", "evidence": "生产速率突增可能源于上游业务洪峰或异常", "priority": "medium"}
  ]
}
```

---

### 场景3: 消费者掉线
```bash
# 上报指标
curl -X POST http://localhost:3001/api/v1/queues/offline-queue/metrics \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "produceRate": 100, "consumeRate": 10, "backlogCount": 5000}'

# 上报超时心跳 (2分钟前)
OLD_TS=$(( $(date +%s) - 120 ))
curl -X POST http://localhost:3001/api/v1/consumers/offline-group/heartbeat \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${OLD_TS}000, \"instanceId\": \"consumer-1\", \"consumerCount\": 2}"

# 查询诊断
curl "http://localhost:3001/api/v1/queues/offline-queue/diagnosis?consumerGroupId=offline-group"
```

**期望输出 (关键片段):**
```json
{
  "status": "critical",
  "rootCauses": [{
    "cause": "consumer_offline",
    "description": "消费者掉线",
    "evidence": [
      "最后心跳时间: 2026-05-12T15:00:29.000Z",
      "心跳超时阈值: 60s",
      "队列积压: 5000 msg"
    ]
  }],
  "suggestions": [
    {"action": "重启消费者", "evidence": "心跳超时超过 60s", "priority": "critical"},
    {"action": "检查消费者部署", "evidence": "消费者可能已崩溃或被调度器驱逐", "priority": "high"}
  ],
  "manualChecks": [
    "消费者实例数量是否正常",
    "消费者是否有OOM或crash",
    "网络连接是否正常"
  ]
}
```

---

### 场景4: 失败重试堆积
```bash
# 上报高失败率指标
curl -X POST http://localhost:3001/api/v1/queues/failure-queue/metrics \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "produceRate": 80, "consumeRate": 50, "failureCount": 20, "backlogCount": 3000}'

# 上报失败样本
for i in 1 2 3 4 5; do
  curl -X POST http://localhost:3001/api/v1/queues/failure-queue/failures \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": $(date +%s)000, \"messageId\": \"msg-fail-$i\", \"errorMessage\": \"数据库连接超时\", \"retryCount\": 2}"
done

# 上报重试循环
curl -X POST http://localhost:3001/api/v1/retry/failure-queue-retry/status \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "totalCount": 500, "messages": [{"messageId": "msg-loop-1", "retryCount": 5}, {"messageId": "msg-loop-2", "retryCount": 8}]}'

curl -X POST http://localhost:3001/api/v1/consumers/failure-group/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "instanceId": "consumer-1", "consumerCount": 3}'

# 查询诊断
curl "http://localhost:3001/api/v1/queues/failure-queue/diagnosis?consumerGroupId=failure-group"
```

**期望输出 (关键片段):**
```json
{
  "status": "critical",
  "rootCauses": [
    {
      "cause": "retry_loop",
      "description": "重试队列循环",
      "evidence": [
        "重试队列积压: 500 msg",
        "重试次数>=3的消息数: 2",
        "最大重试次数: 8"
      ]
    },
    {
      "cause": "failure_rate_spike",
      "description": "失败率升高",
      "evidence": [
        "当前失败率: 40.00%",
        "失败率阈值: 10%",
        "最近失败原因: 数据库连接超时"
      ]
    }
  ],
  "suggestions": [
    {"action": "清理重试循环消息", "evidence": "发现 2 条消息陷入重试循环", "priority": "critical"},
    {"action": "死信队列处理", "evidence": "将无法处理的消息移入死信队列", "priority": "high"},
    {"action": "隔离坏消息", "evidence": "失败率达到 40.00%，存在坏消息可能", "priority": "high"}
  ]
}
```

---

### 场景5: 告警确认后重新打开
```bash
# 1. 为消费者掉线队列生成告警
curl -X POST http://localhost:3001/api/v1/queues/offline-queue/diagnosis/generate-alert \
  -H "Content-Type: application/json" \
  -d '{"consumerGroupId": "offline-group"}'

# 记录返回的 alertId
ALERT_ID="alert_xxx"

# 2. 值班同事确认告警
curl -X POST http://localhost:3001/api/v1/alerts/$ALERT_ID/acknowledge

# 3. 检查告警状态 (已确认但仍为 critical)
curl "http://localhost:3001/api/v1/alerts?status=acknowledged"

# 4. 状况持续恶化，再次触发告警生成 (会自动重新打开)
curl -X POST http://localhost:3001/api/v1/queues/offline-queue/diagnosis/generate-alert \
  -H "Content-Type: application/json" \
  -d '{"consumerGroupId": "offline-group"}'

# 5. 检查告警状态 (应该重新变为 open)
curl "http://localhost:3001/api/v1/alerts/$ALERT_ID"
```

---

## 三、主要边界条件

### 边界1: 数据窗口不足
**条件:** 队列指标历史数据点 < 60 个
**影响:** 无法计算生产速率突增和消费速率下降（需要对比历史数据）
**表现:** 诊断结果可能只显示 "队列积压超过阈值" 而不给出具体根因
**应对:** 持续收集至少 1 小时的历史数据后再进行精确诊断

### 边界2: 心跳数据缺失
**条件:** 从未上报过消费组心跳
**影响:** 无法判断消费者是否在线，可能将正常延迟误判为消费者掉线
**表现:** 即使消费者正常，也可能触发 `consumer_offline` 根因
**应对:** 确保监控系统定时上报心跳（建议每 10 秒一次）

### 边界3: 多根因叠加
**条件:** 同时存在多种异常（如: 生产突增 + 消费者掉线）
**影响:** 诊断引擎会按优先级排序返回多个根因
**优先级顺序:**
  1. 消费者掉线 (critical)
  2. 重试队列循环 (critical)
  3. 生产速率突增 (high)
  4. 消费速率下降 (high)
  5. 失败率升高 (high)
  6. 单分区热点 (medium)
**应对:** 按优先级顺序处理，先解决 critical 级别的问题

### 边界4: 阈值配置不当
**当前配置 (可在 services/diagnostic.js 中调整):**
- 生产突增阈值: 2.0x (当前/历史)
- 消费下降阈值: 0.5x (当前/历史)
- 失败率阈值: 10%
- 重试循环阈值: >= 3 次
- 心跳超时: 60 秒
- 分区热点阈值: 3.0x (最大/平均)
- 积压告警阈值: 1000 msg

**影响:** 阈值过高会漏报，过低会误报
**应对:** 根据业务实际情况调整，建议先观察 1-2 周再调优

### 边界5: 幂等窗口过期
**条件:** 同一指标在 5 分钟后重复上报
**影响:** 5 分钟 TTL 过期后，去重 key 被清理，同一时间戳的数据会被重新接受
**应对:** 监控系统应确保在 5 分钟内完成重试，或使用唯一的 messageId 级别的幂等

---

## 四、失败路径示例

### 失败路径: 数据库连接失败 → 消费失败 → 重试循环 → 队列积压

**步骤1: 下游数据库故障**
- 时间: T0
- 现象: 消费者尝试消费消息时，数据库连接超时
- API: 失败样本开始上报
```bash
curl -X POST http://localhost:3001/api/v1/queues/order-queue/failures \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "messageId": "order-123", "errorMessage": "Connection timeout", "retryCount": 1}'
```

**步骤2: 失败率升高触发告警**
- 时间: T0 + 5 分钟
- 触发条件: 失败样本 >= 3 条且失败率 >= 10%
- 诊断根因: `failure_rate_spike`
- 建议动作: 隔离坏消息、检查下游依赖

**步骤3: 消息进入重试队列**
- 时间: T0 + 10 分钟
- 现象: 失败消息被移入重试队列，持续重试
- API: 重试队列状态上报
```bash
curl -X POST http://localhost:3001/api/v1/retry/order-queue-retry/status \
  -H "Content-Type: application/json" \
  -d '{"timestamp": '$(date +%s)000', "totalCount": 100, "messages": [{"messageId": "order-123", "retryCount": 3}]}'
```

**步骤4: 重试循环检测**
- 时间: T0 + 30 分钟
- 触发条件: 消息重试次数 >= 3
- 诊断根因: `retry_loop`
- 建议动作: 清理重试循环、移入死信队列

**步骤5: 主队列积压**
- 时间: T0 + 60 分钟
- 现象: 主队列积压超过 1000 条，生产持续但消费受阻
- 触发告警: 队列积压告警
- 值班同事看到的现象: "队列积压告警"，但不知道根因

**API 诊断结果 (关键信息):**
```json
{
  "status": "critical",
  "backlogCount": 5000,
  "rootCauses": [
    {"cause": "retry_loop", "description": "重试队列循环"},
    {"cause": "failure_rate_spike", "description": "失败率升高"}
  ],
  "suggestions": [
    {"action": "清理重试循环消息", "evidence": "发现 100 条消息重试 >= 3 次", "priority": "critical"},
    {"action": "检查下游数据库", "evidence": "失败原因: Connection timeout", "priority": "high"}
  ],
  "manualChecks": [
    "数据库连接池是否耗尽",
    "数据库实例是否存活",
    "网络是否有丢包"
  ]
}
```

**值班同事下一步动作:**
1. 先看 `suggestions`，按优先级处理
2. 第一优先级: 检查数据库（从 `evidence` 看到是连接超时）
3. 第二优先级: 清理重试队列（避免消息循环占用资源）
4. 数据库恢复后，从死信队列重放消息

---

## 五、重复执行路径示例

### 路径: 网络抖动导致指标重复上报 → 幂等处理

**步骤1: 正常上报**
- 时间: T0
- 请求:
```bash
curl -X POST http://localhost:3001/api/v1/queues/test-queue/metrics \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 1778598000000, "produceRate": 100, "consumeRate": 100, "backlogCount": 100}'
```
- 响应: `{"success": true, "isNew": true}`
- 存储: 指标被记录，去重 key 被设置

**步骤2: 网络抖动，客户端重发**
- 时间: T0 + 5 秒 (5 分钟 TTL 内)
- 同样的请求再次发送
- 响应: `{"success": true, "isNew": false}`
- 存储: 指标不重复存储（通过去重 key 检测）

**步骤3: 验证存储结果**
- 查询:
```bash
curl http://localhost:3001/api/v1/queues/test-queue/metrics
```
- 结果: 只包含 1 条记录（时间戳 1778598000000）

**步骤4: TTL 过期后**
- 时间: T0 + 6 分钟
- 同样的请求再次发送
- 响应: `{"success": true, "isNew": true}`
- 存储: 去重 key 已过期，指标被重新记录（可能导致重复数据）

**关键点:**
- 去重键生成规则: `type|queueName|timestamp`（指标）
- 去重 TTL: 5 分钟
- 适用范围: 指标、心跳、重试状态、失败样本

---

## 六、启动服务

```bash
# 安装依赖
npm install

# 启动服务 (默认端口 3000)
npm start

# 或指定端口
PORT=3001 npm start

# 健康检查
curl http://localhost:3001/health
```

---

## 七、项目结构

```
.
├── server.js              # 服务入口
├── package.json           # 依赖管理
├── data/
│   └── models.js          # 内存存储模型
├── services/
│   ├── storage.js         # 存储服务（含幂等）
│   └── diagnostic.js      # 诊断引擎（6种根因规则）
├── routes/
│   ├── metrics.js         # 指标/心跳/失败样本/重试路由
│   └── diagnostic.js      # 诊断/告警路由
├── test-curls.sh          # 测试脚本
└── API_SUPPLEMENT.md      # 本文档
```
