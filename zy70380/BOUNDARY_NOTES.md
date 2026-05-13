# 积分流水重算 API - 边界说明

## 一、主要边界

### 1. 已兑换积分锁定

**边界描述：**
已确认兑换的积分(lockedPoints)不能被直接扣减。

**业务逻辑：**
- 当会员进行礼品兑换并确认后，这部分积分被标记为"锁定"
- 重算时，锁定积分不参与任何扣减操作
- 如果重算差异为负，只能扣减"可用积分"（原始积分 - 锁定积分）
- 如果扣减需求超过可用积分，超出部分需要运营审核

**技术实现：**
- 通过 `redemptions` 表的 `status='confirmed'` 记录计算锁定积分
- `src/services/recalculationService.ts:266` - `getTotalLockedPoints()` 获取锁定积分
- `src/services/recalculationService.ts:272-284` - 负差异处理逻辑

**运营解释示例：**
> "会员原有1000积分，已兑换800积分礼品。这800积分已经被使用，不能因为规则变更而扣回。剩余可用积分只有200，如果重算需要扣减500，只能先扣200，剩下的300需要确认是否从其他来源扣减或放弃。"

### 2. 负差异待审核

**边界描述：**
当重算差异为负且超过可用积分时，生成待审核扣减记录。

**业务逻辑：**
- 原始积分 = 1000，锁定积分 = 800，可用积分 = 200
- 重算差异 = -500（新积分只有500）
- 可直接扣减 = 200（可用积分）
- 待审核扣减 = 300（超出可用部分）
- 待审核记录需要运营确认后才会生成扣减流水

**技术实现：**
- `src/services/recalculationService.ts:272-284` - 判断是否需要待审核
- `src/services/recalculationService.ts:348-377` - `createPendingAdjustments()` 创建待审核记录
- `src/services/recalculationService.ts:379-410` - `confirmCompensationAdjustment()` 确认扣减

**运营解释示例：**
> "重算显示该会员应该少得500积分，但他已经用800积分兑换了礼品。我们最多只能扣他还没用的200积分。剩下的300需要确认：是通过其他方式扣减（如后续消费抵扣），还是就不扣了？"

### 3. 规则版本必须冻结

**边界描述：**
用于重算的积分规则版本必须是冻结状态，防止规则变动导致重算结果不一致。

**业务逻辑：**
- 创建重算任务前，检查规则版本的 `isFrozen` 状态
- 未冻结的规则版本会抛出错误
- 冻结后规则不能修改（需要创建新版本）

**技术实现：**
- `src/services/pointRuleService.ts:50-55` - `freezePointRuleVersion()` 冻结规则
- `src/services/recalculationService.ts:146-152` - 创建任务前检查冻结状态

**运营解释示例：**
> "积分规则可能会被运营人员修改。为了保证重算结果的一致性和可追溯性，我们要求在重算前先冻结规则版本。这样即使后续规则又改了，这次重算的结果也是确定的。"

### 4. 重复重算幂等

**边界描述：**
相同范围（规则版本 + 会员 + 时间范围）的重算任务是幂等的。

**业务逻辑：**
- 第一次提交：创建新任务，执行重算
- 第二次提交相同参数：查找已有任务，直接返回已有结果
- 不创建新任务，不重复执行
- 保证同一范围不会被重算多次

**技术实现：**
- `src/services/recalculationService.ts:71-107` - `findExistingRecalculationTask()` 查找已有任务
- `src/services/recalculationService.ts:154-157` - 找到已有任务直接返回

**运营解释示例：**
> "运营人员可能会误操作，重复提交同一个重算任务。幂等机制保证了即使重复提交，也只会执行一次，不会导致积分被重复补偿或重复扣减。"

---

## 二、一个失败路径

### 路径：规则版本未冻结导致重算失败

**步骤：**

1. **提交重算任务**
   - 操作：调用 `POST /api/recalculation-tasks`
   - 参数：`ruleVersionId` 指向一个未冻结的规则版本

2. **检查规则状态**
   - 处理逻辑：`src/services/recalculationService.ts:146-152`
   - 检查 `ruleVersion.isFrozen`
   - 发现 `isFrozen = false`

3. **抛出错误**
   - 错误信息：`"Point rule version must be frozen before creating recalculation task"`
   - 返回状态码：400

4. **失败恢复**
   - 步骤1：调用 `POST /api/point-rules/{id}/freeze` 冻结规则
   - 步骤2：重新提交重算任务

**代码路径：**
```typescript
// src/services/recalculationService.ts:146-152
const ruleVersion = await getPointRuleVersionById(ruleVersionId);
if (!ruleVersion) {
  throw new Error('Point rule version not found');
}
if (!ruleVersion.isFrozen) {
  throw new Error('Point rule version must be frozen before creating recalculation task');
}
```

**curl 示例（失败）：**
```bash
# 1. 创建未冻结的规则版本
curl -X POST http://localhost:3000/api/point-rules \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.0.0",
    "name": "新版规则",
    "rules": [{"category": "电子", "multiplier": 3}],
    "effectiveAt": "2026-05-01T00:00:00.000Z"
  }'
# 返回: {"id": "rule-xxx", "isFrozen": false, ...}

# 2. 尝试使用未冻结的规则创建重算任务（失败）
curl -X POST http://localhost:3000/api/recalculation-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "重算测试",
    "ruleVersionId": "rule-xxx",
    "autoExecute": true
  }'
# 返回: {"error": "Point rule version must be frozen before creating recalculation task"}
```

---

## 三、一次重复执行路径

### 路径：同一范围重复重算返回已有结果

**第一次执行：**

1. **提交重算任务**
   - 参数：会员A + 最近三个月 + v2规则版本
   - 操作：`POST /api/recalculation-tasks`

2. **查找已有任务**
   - `findExistingRecalculationTask()` 查找
   - 结果：没有匹配的任务

3. **创建新任务**
   - 状态：`pending`
   - 插入 `recalculation_tasks` 表

4. **执行重算**
   - 状态：`processing` → `completed`
   - 生成会员重算结果
   - 生成补偿调整记录

**第二次执行（相同参数）：**

1. **提交重算任务**
   - 参数：会员A + 最近三个月 + v2规则版本（完全相同）
   - 操作：`POST /api/recalculation-tasks`

2. **查找已有任务**
   - `findExistingRecalculationTask()` 查找
   - SQL条件：
     - `rule_version_id = ?` （相同规则版本）
     - `member_ids = ?` （相同会员列表）
     - `start_time = ?` （相同开始时间）
     - `end_time = ?` （相同结束时间）
     - `status IN ('processing', 'completed')` （正在进行或已完成）
   - 结果：找到第一次创建的任务

3. **直接返回已有结果**
   - 不创建新任务
   - 返回第一次的任务ID和数据
   - `isExisting: true`

**关键代码：**
```typescript
// src/services/recalculationService.ts:71-107
export async function findExistingRecalculationTask(
  ruleVersionId: string,
  memberIds?: string[],
  startTime?: string,
  endTime?: string
): Promise<RecalculationTask | undefined> {
  let sql = `
    SELECT * FROM recalculation_tasks 
    WHERE rule_version_id = ? 
    AND status IN ('processing', 'completed')
  `;
  // ... 匹配 member_ids, start_time, end_time
  
  const rows = await getDbAll(sql, params);
  return rows.length > 0 ? dbRowToRecalculationTask(rows[0]) : undefined;
}

// src/services/recalculationService.ts:154-157
const existingTask = await findExistingRecalculationTask(ruleVersionId, memberIds, startTime, endTime);
if (existingTask) {
  return existingTask;
}
```

**curl 示例：**
```bash
# 第一次提交
curl -X POST http://localhost:3000/api/recalculation-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "v2规则重算",
    "ruleVersionId": "rule-v2",
    "memberIds": ["member-A"],
    "startTime": "2026-02-13T09:00:00.000Z",
    "endTime": "2026-05-13T09:00:00.000Z",
    "autoExecute": true
  }'
# 返回: {"task": {"id": "task-001", "status": "completed", ...}, "isExisting": false}

# 第二次提交（相同参数）
curl -X POST http://localhost:3000/api/recalculation-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "v2规则重算",
    "ruleVersionId": "rule-v2",
    "memberIds": ["member-A"],
    "startTime": "2026-02-13T09:00:00.000Z",
    "endTime": "2026-05-13T09:00:00.000Z",
    "autoExecute": true
  }'
# 返回: {"task": {"id": "task-001", "status": "completed", ...}, "isExisting": true}
# 注意：isExisting = true，表示返回的是已有任务
```

---

## 四、API 接口汇总

### 核心重算接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/recalculation-tasks` | 创建重算任务 |
| POST | `/api/recalculation-tasks/:id/execute` | 执行重算任务 |
| POST | `/api/recalculation-tasks/:taskId/apply-positive` | 应用正向补偿 |
| POST | `/api/compensations/:id/confirm` | 确认补偿调整 |

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recalculation-tasks` | 查询重算任务列表（支持按会员/时间/状态筛选） |
| GET | `/api/recalculation-tasks/:id` | 查询单个重算任务详情 |
| GET | `/api/recalculation-tasks/:taskId/results` | 查询任务下所有会员重算结果 |
| GET | `/api/recalculation-tasks/:taskId/results/:memberId` | 查询单个会员重算结果 |
| GET | `/api/recalculation-tasks/:taskId/report` | 查询重算报告 |
| GET | `/api/recalculation-tasks/:taskId/adjustments` | 查询补偿调整记录 |

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/members` | 创建会员 |
| GET | `/api/members` | 查询会员列表 |
| GET | `/api/members/:id` | 查询会员详情 |
| POST | `/api/point-rules` | 创建积分规则版本 |
| POST | `/api/point-rules/:id/freeze` | 冻结积分规则版本 |
| POST | `/api/transactions` | 创建消费流水 |
| POST | `/api/redemptions` | 创建兑换记录 |
| POST | `/api/redemptions/:id/confirm` | 确认兑换 |

---

## 五、数据模型关系

```
members (会员)
    │
    ├── transactions (消费流水) ── 1:N
    │       └── point_logs (积分流水) ── 1:1 (earn类型)
    │
    ├── redemptions (兑换记录) ── 1:N
    │       └── point_logs (积分流水) ── 1:1 (spend类型)
    │
    └── member_recalculation_results (会员重算结果) ── 1:N
            └── compensation_adjustments (补偿调整) ── 1:N
                    └── point_logs (积分流水) ── 1:1 (compensation/adjustment类型)

point_rule_versions (积分规则版本)
    └── recalculation_tasks (重算任务) ── 1:N
            └── member_recalculation_results (会员重算结果) ── 1:N
```

---

## 六、状态流转

### 重算任务状态

```
pending (待执行)
    │
    ▼
processing (处理中)
    │
    ├─ success ──► completed (已完成)
    │
    └─ error ────► failed (失败)
```

### 会员重算结果状态

```
ready (可执行) ── 正向差异或可直接扣减
    │
    ├─ apply-positive ──► completed (已完成)
    │
    └─ (负差异超可用) ──► pending_review (待审核)
                              │
                              └─ confirm ──► completed (已完成)
```

### 补偿调整状态

```
pending_review (待审核)
    │
    ├─ approve ──► approved (已通过)
    │
    └─ reject ───► rejected (已拒绝)
```
