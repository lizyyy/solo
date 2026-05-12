# 数据修复工单 API - 边界说明与关键路径

---

## 一、主要边界条件

### 1. 状态机边界

```
draft ──precheck──► pending_precheck
        │              │
        │              ├── passed ──► pending_approval ──► approved ──► executed ──► rolled_back
        │              │                       │           │             │
        │              └── failed ──► precheck_failed     │         (需引用原执行记录)
        │                                              [only approved/execution_failed]
        │              ┌───────────────────────────────────┘
        ▼              ▼
    (仅草稿可修改)   (预检通过才能审批)

状态流转规则：
┌───────────────────┬─────────────────────────────────────────────────┐
│ 允许的状态         │ 允许的操作                                      │
├───────────────────┼─────────────────────────────────────────────────┤
│ draft             │ 创建、修改修复动作、预检                        │
│ pending_precheck  │ (预检进行中，不允许其他操作)                    │
│ precheck_failed   │ 预检、关闭                                      │
│ pending_approval  │ 审批、驳回                                      │
│ approved          │ 执行                                            │
│ executing         │ (执行进行中，不允许其他操作)                    │
│ executed          │ 回滚、关闭                                      │
│ execution_failed  │ 执行(重试)、关闭                                │
│ rollbacking       │ (回滚进行中)                                    │
│ rolled_back       │ 关闭                                            │
│ rollback_failed   │ 回滚(重试)、关闭、查看残留差异                  │
│ rejected          │ 关闭                                            │
│ closed            │ (终结状态，不允许任何操作)                      │
└───────────────────┴─────────────────────────────────────────────────┘
```

### 2. 预检边界
- **记录存在性**：所有 `record_id` 必须存在于对应表中
- **字段有效性**：所有更新字段必须是表中实际存在的字段
- **预检失败禁止审批**：审批接口会校验 `precheck.passed === true`
- **预检后禁止修改**：一旦进入 `pending_approval` 状态，无法再修改 `repair_actions`

### 3. 审批边界
- **哈希校验**：审批和执行时都会重新计算 `repair_actions_hash`，必须与创建时的哈希一致
- **多级审批**：高风险字段需要 `required_approval_level=2`，普通字段 `level=1` 即可
- **审批不可逆**：审批通过后状态不可逆（除非驳回，但驳回只能在 `pending_approval` 状态）

### 4. 执行边界
- **执行条件**：必须 `approved` 状态，且 `current_approval_level >= required_approval_level`
- **重复执行保护**：如果已有 `execution.status === 'success'`，再次执行会被拒绝
- **失败可重试**：`execution_failed` 状态允许再次调用执行接口
- **哈希保护**：执行时同样校验 `repair_actions_hash`

### 5. 回滚边界
- **引用要求**：必须传入 `reference_execution_id`，且该执行记录必须属于当前工单
- **状态限制**：只能从 `executed` 或 `rollback_failed` 状态发起回滚
- **残留追踪**：回滚时如果记录已不存在，会记录在 `residual_differences` 中

### 6. 高风险字段定义
```javascript
const HIGH_RISK_FIELDS = {
  orders: ['status', 'amount'],        // 订单状态和金额
  members: ['balance', 'points', 'level'], // 会员余额、积分、等级
  invoices: ['status', 'amount']       // 发票状态和金额
};
```

---

## 二、失败路径分析

### 路径 A: 预检失败路径

**触发条件**：修复动作中引用了不存在的记录或字段

**完整步骤**：
```
步骤1: 创建工单
POST /api/v1/tickets
{
  "repair_actions": [{
    "table": "orders",
    "record_id": "NOT_EXIST_999",  ← 不存在的记录
    "updates": { "status": "CANCELLED" }
  }]
}
返回: { status: "draft", id: "ticket-x" }

步骤2: 执行预检
POST /api/v1/tickets/ticket-x/precheck
返回: {
  status: "failed",
  passed: false,
  errors: ["记录不存在: orders.NOT_EXIST_999"],
  estimated_impact_count: 0
}

步骤3: 工单状态变为 precheck_failed
GET /api/v1/tickets/ticket-x
返回: { status: "precheck_failed", ... }

步骤4: 尝试审批（会被拦截）
POST /api/v1/tickets/ticket-x/approve
返回: { error: "预检未通过，不能审批" }  ← 关键点：预检失败禁止审批

步骤5: 可选路径
  a) 修改修复动作后重新预检（必须回到 draft 状态，但当前是 precheck_failed）
  b) 关闭工单
```

**检查清单（复查用）**：
- [ ] 预检失败后状态变为 `precheck_failed`
- [ ] `precheck.passed === false`
- [ ] `precheck.errors` 包含具体错误信息
- [ ] 审批接口返回 `"预检未通过，不能审批"`
- [ ] 执行接口不可用

---

## 三、重复执行路径分析

### 路径 B: 重复执行路径

**触发条件**：已成功执行的工单，尝试再次执行

**完整步骤**：
```
步骤1: 工单已完成审批并执行成功
假设工单状态: executed
已有执行记录: { id: "exec-1", status: "success", ... }

步骤2: 首次执行成功
POST /api/v1/tickets/ticket-x/execute
{ "executor": "operator01" }
返回: {
  id: "exec-1",
  status: "success",
  actual_impact_count: 1,
  snapshot_before: [...],
  snapshot_after: [...]
}
工单状态变为: executed
audit_id 已设置

步骤3: 尝试重复执行
POST /api/v1/tickets/ticket-x/execute
{ "executor": "operator02" }
返回: { error: "已执行成功，禁止重复执行" }  ← 关键点

步骤4: 验证数据未被重复修改
GET /api/v1/data/orders/ORD001
返回的数据应该与步骤2执行后的结果一致（没有再次修改）
```

**内部逻辑** (`engine.js:executeTicket`):
```javascript
// 关键检查
if (ticket.execution_id) {
  const prevExec = db.executions.get(ticket.execution_id);
  if (prevExec && prevExec.status === 'success') {
    throw new Error('已执行成功，禁止重复执行');
  }
}
```

**对比: 失败后的重试（允许的情况）**：
```
首次执行失败 → 状态: execution_failed
允许再次调用执行接口（重试）
执行成功后 → 状态: executed
再次调用执行接口 → 被拒绝
```

**检查清单（复查用）**：
- [ ] 首次成功执行后 `execution.status === 'success'`
- [ ] 重复调用执行接口返回 `"已执行成功，禁止重复执行"`
- [ ] 数据未被重复修改（快照验证）
- [ ] 只有 `execution_failed` 状态允许重试
- [ ] 重试成功后同样不允许再次重复执行

---

## 四、审批后修改检测路径

### 路径 C: 审批后偷偷修改检测

**触发条件**：审批通过后，试图修改 `repair_actions` 再执行

**完整步骤**：
```
步骤1: 创建工单
POST /api/v1/tickets
repair_actions_hash: "hash-1" (基于原始动作计算)

步骤2: 预检 → 审批通过
状态: approved
required_approval_level: 1
current_approval_level: 1

步骤3: 尝试修改修复动作
POST /api/v1/tickets/ticket-x/repair-actions
{
  "repair_actions": [{ ... 不同的动作 ... }]
}
返回: { error: "仅草稿状态允许修改修复动作" }  ← 第一重保护

步骤4: 假设通过某种方式绕过了状态检查，直接修改了内存中的 repair_actions

步骤5: 执行时的哈希校验
POST /api/v1/tickets/ticket-x/execute

内部逻辑:
const currentHash = hashRepairActions(ticket.repair_actions)
if (currentHash !== ticket.repair_actions_hash) {
  throw new Error('修复动作已被修改，需重新审批')  ← 第二重保护
}

返回: { error: "修复动作已被修改，需重新审批" }
```

**检查清单（复查用）**：
- [ ] 非 `draft` 状态调用 `/repair-actions` 接口被拒绝
- [ ] 审批时校验 `repair_actions_hash`
- [ ] 执行时再次校验 `repair_actions_hash`
- [ ] 哈希不一致时明确提示需重新审批
- [ ] 哈希算法是确定性的（相同输入产生相同哈希）

---

## 五、二级审批路径

### 路径 D: 高风险字段需要二级审批

**完整步骤**：
```
步骤1: 创建包含高风险字段的工单
repair_actions: [{
  table: "members",
  record_id: "USER002",
  updates: {
    points: 5000,     ← 高风险字段
    level: "GOLD"     ← 高风险字段
  }
}]

返回: {
  required_approval_level: 2,    ← 关键点：自动识别为需要二级审批
  risk_level: "low" (预检后会更新为 "high")
}

步骤2: 预检
POST /api/v1/tickets/ticket-x/precheck
返回: {
  high_risk_fields: [
    { field: "points", old_value: 2000, new_value: 5000 },
    { field: "level", old_value: "SILVER", new_value: "GOLD" }
  ]
}
工单 risk_level 更新为: "high"

步骤3: 一级审批
POST /api/v1/tickets/ticket-x/approve
{ approver: "manager01", level: 1 }

current_approval_level: 1  (未满足)
工单状态: pending_approval (未变)

步骤4: 尝试执行
POST /api/v1/tickets/ticket-x/execute
返回: { error: "当前状态不允许执行" }

步骤5: 二级审批
POST /api/v1/tickets/ticket-x/approve
{ approver: "director01", level: 2 }

current_approval_level: 2  (满足)
工单状态: approved

步骤6: 执行成功
POST /api/v1/tickets/ticket-x/execute
返回: { status: "success", ... }
```

**检查清单（复查用）**：
- [ ] 高风险字段自动设置 `required_approval_level: 2`
- [ ] 预检返回 `high_risk_fields` 列表
- [ ] 一级审批后状态仍为 `pending_approval`
- [ ] `current_approval_level: 1 < 2` 时执行被拒绝
- [ ] 二级审批后状态变为 `approved`
- [ ] 执行成功

---

## 六、回滚必须引用原执行记录

### 路径 E: 回滚引用校验

**完整步骤**：
```
步骤1: 工单已执行成功
执行记录: { id: "exec-1", ticket_id: "ticket-x", rollback_data: [...] }

步骤2: 回滚时不提供引用
POST /api/v1/tickets/ticket-x/rollback
{ executor: "operator01" }
返回: { error: "回滚必须引用原执行记录" }

步骤3: 提供错误的引用（属于其他工单）
POST /api/v1/tickets/ticket-x/rollback
{
  executor: "operator01",
  reference_execution_id: "exec-other-ticket"
}
返回: { error: "执行记录不属于当前工单" }

步骤4: 提供正确的引用
POST /api/v1/tickets/ticket-x/rollback
{
  executor: "operator01",
  reference_execution_id: "exec-1"
}
返回: { status: "success", ... }

步骤5: 回滚失败时的残留追踪
（如果执行记录中的某条数据在回滚时已被删除）
返回: {
  status: "partial",
  residual_differences: [{
    table: "orders",
    record_id: "ORD001",
    issue: "记录已不存在，无法完全回滚"
  }]
}
```

**检查清单（复查用）**：
- [ ] 缺少 `reference_execution_id` 时返回明确错误
- [ ] 引用其他工单的执行记录被拒绝
- [ ] 正确引用后回滚成功
- [ ] 回滚失败时记录 `residual_differences`
- [ ] 审计报告能看到残留差异

---

## 七、复查用快速检查表

### 边界条件检查
- [ ] 状态机流转正确（每个状态只允许特定操作）
- [ ] 预检失败时审批被阻止
- [ ] 审批后修改 `repair_actions` 被哈希校验拦截
- [ ] 高风险字段需要二级审批
- [ ] 成功执行后重复执行被阻止
- [ ] 回滚必须引用原执行记录
- [ ] 回滚失败时残留差异被追踪
- [ ] 审计报告包含所有必要信息（影响数、差异、操作者）

### 关键数据完整性
- [ ] `snapshot_before` 和 `snapshot_after` 完整保存
- [ ] `repair_actions_hash` 在创建、审批、执行三个节点一致
- [ ] 审计记录与执行记录一一对应
- [ ] 回滚记录引用正确的执行记录
