# 只读副本延迟 API - 补充说明

## 一、主要边界情况

### 边界 1: 刚写入后的读
- 触发条件: 写入操作后 WRITE_COOLDOWN_MS (3秒) 内发起查询
- 决策结果: 读主库
- trace 说明: reason 字段显示 "刚写入({时间}ms前，读走主库"
- 原因: 防止读取到延迟的从库数据

### 边界 2: 从库延迟超过阈值
- 触发条件: syncLatencyMs > LATENCY_THRESHOLD_MS (5秒)
- 决策结果: 自动切主库 + 记录降级 + 触发告警
- trace 说明: degraded=true, reason 显示延迟数值对比
- 告警: latencyAlerts 新增未解决告警

### 边界 3: 有待同步数据但在阈值内
- 触发条件: primaryVersion > replicaVersion 且 syncLatencyMs ≤ 5秒
- 决策结果: 等待从库追上 (最多 30 秒)
- trace 说明: waited=true, 显示等待时长
- 超时处理: 等待超时后读主库

### 边界 4: 列表查询
- 触发条件: isListQuery=true
- 决策结果: 可容忍一定延迟，读从库
- 例外: 即使在写后 3 秒内，列表查询也不走主库

### 边界 5: 强一致性读取
- 触发条件: strongConsistency=true
- 决策结果: 无条件读主库
- trace 说明: reason 显示 "强一致性读取强制走主库"

---

## 二、一个失败路径

### 失败路径: 从库持续高延迟 + 等待超时

**场景描述:**
1. 初始状态: syncLatencyMs = 10000 (10秒)
2. 用户写入 user1 数据 version=1
3. 3 秒内发起读请求 (在写后冷却期内)
4. 决策: 因写后读 → 走主库 ✓
5. 3 秒后再次发起读请求 (冷却期已过)
6. 决策: 延迟 10 秒 > 阈值 5 秒 → 自动切主库 + 记录降级 + 告警 ✓
7. 同时记录到 degradedQueries
8. 等待 20 秒后读: 延迟仍为 10 秒
9. 决策: 同样切主库，告警持续未解决

**复查验证点:**
- [ ] 第一次读 traceId 显示 targetDb=primary
- [ ] 第二次读 trace 显示 degraded=true
- [ ] latencyAlerts 有未解决告警
- [ ] degradedQueries 有记录
- [ ] report 显示 degradedReads>0

---

## 三、一次重复执行路径

### 重复路径: 同一用户多次写-读循环 (trace 关联)

**场景步骤:**

**阶段 1: 初始状态 - 延迟 2 秒
- syncLatencyMs=2000
- GET /api/config/status 确认状态

**阶段 2: 第一次写入
- POST /api/users/user1 {name:"A"}
- 记录 writeTraces[0] id=trace-write-1 version=1

**阶段 3: 写后立刻读 (trace 关联)
- GET /api/users/user1?traceId=trace-read-1
- 决策: 写后冷却期内 → 走主库
- 记录 readTraces[0] traceId=trace-read-1 targetDb=primary

**阶段 4: 等待 3 秒后读 (同一 traceId)
- GET /api/users/user1?traceId=trace-read-2
- 决策: 冷却期已过，有待同步数据 → 等待从库
- 等待约 2 秒后追上
- 记录 readTraces[1] traceId=trace-read-2 waited=true waitTimeMs≈2000 targetDb=replica

**阶段 5: 延迟恢复后再读 (路由变化)
- GET /api/users/user1?traceId=trace-read-3
- 决策: 无待同步数据 → 读从库
- 记录 readTraces[2] traceId=trace-read-3 targetDb=replica

**阶段 6: 第二次写入**
- POST /api/users/user1 {name:"B"}
- 记录 writeTraces[1] id=trace-write-2 version=2

**阶段 7: 写后立刻读**
- GET /api/users/user1?traceId=trace-read-4
- 决策: 写后冷却期内 → 走主库
- 记录 readTraces[3] traceId=trace-read-4 targetDb=primary

**复查验证点:**
- [ ] writeTraces 长度=2 (两次写入)
- [ ] readTraces 长度=4 (四次读取)
- [ ] 每次 read 都有唯一 traceId
- [ ] 阶段 3: targetDb=primary
- [ ] 阶段 4: waited=true, waitTimeMs≈2000
- [ ] 阶段 5: targetDb=replica (与阶段 3 路由不同)
- [ ] 阶段 7: targetDb=primary

**路由变化说明:**
同一查询在不同时间点因状态变化:
- 阶段 3: 主库 (写后冷却期)
- 阶段 5: 从库 (延迟恢复后)

---

## 四、关键配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| LATENCY_THRESHOLD_MS | 5000 | 从库延迟超过此值自动切主库 |
| WRITE_COOLDOWN_MS | 3000 | 写后冷却期，此期间读走主库 |
| WAIT_TIMEOUT_MS | 30000 | 等待从库追上的最大等待时间 |
| WAIT_INTERVAL_MS | 100 | 等待轮询间隔 |

---

## 五、trace 字段说明

### 读 trace 字段
- `traceId`: 唯一追踪 ID (可由请求传入)
- `targetDb`: 'primary' 或 'replica'
- `reason`: 路由选择理由
- `waited`: 是否等待过
- `waitTimeMs`: 等待时长 (毫秒)
- `degraded`: 是否降级 (延迟过高或等待超时)
- `currentLatencyMs`: 当前从库延迟
- `primaryVersion`: 主库版本号
- `replicaVersion`: 从库版本号

### 写 trace 字段
- `id`: 唯一追踪 ID
- `version`: 写入后的版本号
- `timestamp`: 写入时间戳
