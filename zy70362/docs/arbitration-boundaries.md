# 任务优先级仲裁 API - 边界、失败路径与重复执行路径说明

## 一、核心边界 (Boundaries)

### 1.1 优先级权重边界

**配置位置**: `src/arbitrator/PriorityArbitrator.js:15-30`

| 维度 | 基础权重 | 可调整范围 | 最大有效优先级 |
|------|---------|-----------|--------------|
| 任务类型 | realtime_export=100 | 0-200 | 100 |
| 租户等级 | gold=100 | 0-200 | 100 |
| 用户优先级 | 0-20 | 每级 *5 | 100 |
| 等待时间加成 | 每10秒+2 | 封顶30 | 30 |
| 补偿任务递增 | 每5分钟+20 | 封顶80 | 80 |
| 截止时间紧急 | 已过期+100 | 固定 | 100 |

**注意**: 单任务理论最高优先级 = 100+100+100+30+80+100 = 510

### 1.2 资源边界

**配置位置**: `src/arbitrator/PriorityArbitrator.js:33,84-92`

```javascript
maxResources = { cpu: 8, memory: 16 };  // 全局资源上限
resourceEstimate.cpu 范围: 0-8         // 单任务 CPU 核数
resourceEstimate.memory 范围: 0-16     // 单任务 内存 GB
```

**资源检查算法**:
- 提交时验证参数范围 (routes/tasks.js:26-33)
- 调度前检查: `used + requested <= max`
- 资源不足时**不会静默丢弃**，保持 `pending` 状态

### 1.3 抢占边界

**配置位置**: `src/arbitrator/PriorityArbitrator.js:104-131`

| 可被抢占的任务类型 | 可被抢占的租户等级 | 抢占阈值 |
|------------------|------------------|---------|
| batch_processing | bronze, guest    | 新任务优先级 > 当前任务 + 30 |
| compensation     |                  |          |

**不可抢占保护**:
- realtime_export 类型任务不会被抢占
- gold/silver 租户任务不会被抢占
- 抢占必须有明确的优先级差（>30）

### 1.4 补偿任务递增边界

**配置位置**: `src/arbitrator/PriorityArbitrator.js:29-30,55-66`

- 触发阈值: 等待 > 5 分钟
- 递增步长: 每 5 分钟 +20
- 最大递增: 最多 +80（即等待 20 分钟后封顶）
- 只对 `taskType = compensation` 生效

### 1.5 幂等性边界

**配置位置**: `src/arbitrator/PriorityArbitrator.js:172-185`

- 使用 `idempotencyKey` 字段去重
- 只在**同一进程实例**内有效（内存存储）
- 无论任务状态如何（pending/running/completed/failed），相同 key 都返回同一个任务
- **边界风险**: 服务重启后幂等映射丢失

### 1.6 状态流转边界

**状态机**:
```
pending → running → completed
   ↓         ↓
paused  →  running  →  failed
   ↓         ↓
delayed (预留)
rejected (预留)
```

**关键约束**:
- 只有 `running` 状态可以标记为 `completed` 或 `failed`
- 只有 `running` 状态可以被抢占为 `paused`
- `paused` 状态在资源释放后自动恢复

---

## 二、一个失败路径 (A Failure Path)

### 场景：高优先级任务抢占后自身失败

**执行路径 (可直接复查)**:

#### 步骤 1: 提交低优先级批处理任务

```bash
# 任务 A: guest 租户的批处理
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "guest-user",
    "taskType": "batch_processing",
    "tenantLevel": "guest",
    "priority": 0,
    "resourceEstimate": {"cpu": 4, "memory": 4, "duration": 300}
  }'
```

**仲裁结果**: 任务 A 进入 `running`（假设资源足够）

#### 步骤 2: 提交高优先级任务触发抢占

```bash
# 任务 B: gold 租户的实时导出
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "vip-company",
    "taskType": "realtime_export",
    "tenantLevel": "gold",
    "priority": 10,
    "resourceEstimate": {"cpu": 4, "memory": 4, "duration": 60}
  }'
```

**仲裁结果**:
1. 计算任务 B 有效优先级 = 100(类型) + 100(租户) + 50(用户) = 250
2. 任务 A 有效优先级 = 20(类型) + 0(租户) = 20
3. 差值 = 230 > 30，满足抢占条件
4. 任务 A 被暂停 → `paused`
5. 任务 B 开始执行 → `running`

**可复查点**:
- 任务 A 历史记录应包含 `paused` 事件
- 任务 A 的 `arbitrationReason` = "被更高优先级任务抢占"
- 任务 A 的 `suspendedCount` = 1

#### 步骤 3: 高优先级任务失败

```bash
# 任务 B 执行失败（模拟）
curl -X POST http://localhost:3000/api/tasks/<task-b-id>/fail \
  -H 'Content-Type: application/json' \
  -d '{"error": "Database connection timeout"}'
```

**仲裁结果 (失败路径)**:

1. **问题发生**: 任务 B 标记为 `failed`
2. **资源释放**: CPU=4, Memory=4 释放回资源池
3. **自动触发再仲裁**: `completeTask`/`failTask` 末尾调用 `runArbitration()`
4. **恢复逻辑**: 检查 pausedQueue，任务 A 满足资源条件
5. **任务 A 恢复**: 从 `paused` → `running`

**可复查点 (验证恢复逻辑)**:
- 任务 B 状态 = `failed`
- 任务 B 历史记录包含 `failed` 事件及 error 信息
- 任务 A 状态 = `running`
- 任务 A 的 `resumedCount` = 1
- 任务 A 历史记录包含 `resumed` 事件，原因为"抢占结束后恢复执行"

**失败路径的边界风险**:
1. 任务 A 的执行上下文丢失（暂停时的进度未持久化）
2. 任务 A 需要从头开始执行，无法恢复暂停前的状态
3. 如果任务 B 频繁失败，任务 A 会被反复暂停/恢复

---

## 三、一次重复执行路径 (A Re-execution Path)

### 场景：同一任务因网络重试被重复提交

**执行路径 (可直接复查)**:

#### 步骤 1: 首次提交（带幂等键）

```bash
# 第一次提交
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "enterprise",
    "taskType": "report_generation",
    "tenantLevel": "silver",
    "priority": 5,
    "idempotencyKey": "daily-report-2026-05-13-001",
    "resourceEstimate": {"cpu": 2, "memory": 2, "duration": 120},
    "payload": {"date": "2026-05-13", "type": "sales"}
  }'
```

**仲裁结果**:
- 检查 `idempotencyMap`，key 不存在
- 创建新任务，taskId 生成
- `idempotencyMap.set("daily-report-2026-05-13-001", <taskId>)`
- 返回 `isNew: true`

**可复查点**:
- 响应中 `data.isNew = true`
- 响应中 `data.submissionReason = "普通排队执行"`

#### 步骤 2: 重复提交（相同幂等键）

```bash
# 第二次提交（网络超时重试场景）
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "enterprise",
    "taskType": "report_generation",
    "tenantLevel": "silver",
    "priority": 5,
    "idempotencyKey": "daily-report-2026-05-13-001",
    "resourceEstimate": {"cpu": 2, "memory": 2, "duration": 120},
    "payload": {"date": "2026-05-13", "type": "sales"}
  }'
```

**仲裁结果**:
1. 检查 `idempotencyMap`，发现 key 已存在
2. 查找已有任务对象
3. **不创建新任务**，直接返回已有任务
4. 返回 `isNew: false`

**可复查点 (验证幂等性)**:
- 响应中 `data.isNew = false`
- 响应中 `data.submissionReason = "重复任务，返回已有结果"`
- 两次响应的 `data.task.taskId` 完全相同
- 任务的 `history` 只包含一次 `submitted` 事件

#### 步骤 3: 任务执行完成

```bash
# 标记任务完成
curl -X POST http://localhost:3000/api/tasks/<task-id>/complete
```

#### 步骤 4: 再次重复提交（任务已完成后）

```bash
# 第三次提交（任务已完成后的重试）
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "enterprise",
    "taskType": "report_generation",
    "tenantLevel": "silver",
    "idempotencyKey": "daily-report-2026-05-13-001",
    "resourceEstimate": {"cpu": 2, "memory": 2, "duration": 120},
    "payload": {"date": "2026-05-13", "type": "sales"}
  }'
```

**仲裁结果**:
- 即使任务状态为 `completed`，仍然返回同一个任务
- 幂等键不区分任务状态

**可复查点**:
- 返回的任务状态 = `completed`
- `completedAt` 有值
- 不会重新排队执行

**重复执行路径的边界风险**:
1. 服务重启后 `idempotencyMap` 清空，相同 key 会创建新任务
2. 不同进程实例之间不共享幂等映射
3. 幂等键只做简单字符串相等匹配，大小写敏感

---

## 四、快速复查检查表

### 4.1 抢占场景复查 (对应失败路径)

| 检查项 | 位置 | 期望结果 |
|--------|------|---------|
| 低优先级任务被暂停 | `task.suspendedCount` | >= 1 |
| 暂停原因记录 | `task.history` 中 event=paused | 存在 |
| 暂停时的仲裁原因 | `task.arbitrationReason` | "被更高优先级任务抢占" |
| 高优先级任务释放资源 | `completeTask/failTask` 后 | 调用 `runArbitration()` |
| 低优先级任务恢复 | `task.resumedCount` | >= 1 |
| 恢复原因记录 | `task.history` 中 event=resumed | 存在 |

### 4.2 幂等场景复查 (对应重复执行路径)

| 检查项 | 位置 | 期望结果 |
|--------|------|---------|
| 首次提交 | 响应 `data.isNew` | true |
| 重复提交 | 响应 `data.isNew` | false |
| 任务 ID 一致 | 两次响应的 `taskId` | 完全相同 |
| 提交次数 | `task.history` 中 submitted 事件 | 只有 1 个 |
| 提交原因 | `data.submissionReason` | "重复任务，返回已有结果" |

### 4.3 资源不足场景复查

| 检查项 | 位置 | 期望结果 |
|--------|------|---------|
| 资源不足时状态 | `task.status` | "pending" (不是 rejected) |
| 等待时间累加 | `task.waitTimeMs` | 持续增长 |
| 等待时间加成 | `task.effectivePriority` | 包含 ageBonus |
| 资源释放后自动调度 | `runArbitration()` | 被触发 |

### 4.4 补偿任务递增复查

| 检查项 | 位置 | 期望结果 |
|--------|------|---------|
| 等待 <5 分钟 | 优先级 | 无递增 |
| 等待 5-10 分钟 | `effectivePriority` | +20 |
| 等待 10-15 分钟 | `effectivePriority` | +40 |
| 等待 15-20 分钟 | `effectivePriority` | +60 |
| 等待 >20 分钟 | `effectivePriority` | +80 (封顶) |
| 递增原因记录 | `task.history` | 有 `priority_escalated` 事件 |
