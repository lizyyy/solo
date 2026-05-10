# 资金付款批次复核 API - 验收点文档

## 文档说明

本文档提供了一套自然语言验收点，普通使用者按照说明操作，能够知道：
1. 下一步该查哪里
2. 检查什么
3. 出现问题时如何排查

---

## 一、主流程验收点

### 1. 付款批次创建与校验

**操作路径**：`POST /api/v1/batches` → `POST /api/v1/batches/{id}/submit`

**验收检查点**：

- **创建批次时**
  - 用同一个 `idempotencyKey` 重复请求，应该返回相同的批次数据，不会重复创建
  - 查看响应的 `validation.warnings` 数组，确认是否有重复项、未验证账户等提示
  - 校验 `batch.status` 为 `DRAFT`（草稿状态）

- **提交批次前**
  - 调用 `GET /api/v1/limits/check?totalAmount=XXX&totalCount=XXX` 确认限额是否充足
  - 检查 `dailyAmountLimit` 和 `dailyCountLimit` 是否够用
  - 查看 `currentUsage` 了解当前已用额度

- **提交批次后**
  - 如果批次金额未触发审批流，状态应为 `APPROVED`
  - 如果触发审批流，状态应为 `PENDING_REVIEW`
  - 查看 `GET /api/v1/approvals/batches/{id}/context` 确认审批级别

**问题排查**：
- 提示 `LIMIT_EXCEEDED` → 查 `/api/v1/limits` 调整限额，或拆分批次
- 提示 `INVALID_ACCOUNT_FORMAT` → 检查账号格式是否全为数字、长度是否足够
- 账户名称不匹配 → 联系收款人确认开户名

---

### 2. 收款账户管理

**操作路径**：`POST /api/v1/accounts` → `POST /api/v1/accounts/{id}/verify`

**验收检查点**：

- **新增账户时**
  - 重复账号会提示 `VALIDATION_ERROR: 账户已存在`
  - `isVerified` 初始为 `false`（未验证）

- **验证账户后**
  - 再次创建包含该账户的批次时，不会再出现 `UNVERIFIED_ACCOUNT` 警告
  - 可在 `/api/v1/accounts` 筛选 `isVerified=true` 查看已验证账户

**问题排查**：
- 账户被禁用 → 调用 `/api/v1/accounts/{id}/toggle` 重新启用
- 账户名称不匹配 → 查看报错信息中 `providedName` 和 `registeredName` 的差异

---

### 3. 限额校验

**操作路径**：`POST /api/v1/limits` → `GET /api/v1/limits/check`

**验收检查点**：

- **创建限额规则**
  - `limitType + limitKey` 组合唯一，重复会提示冲突
  - `singleAmountMin` 必须大于0，通常设为 `0.01`

- **每日限额检查**
  - 查看 `/api/v1/limits` → 检查 `dailyAmountLimit` 日额度
  - 调用创建批次时，系统自动校验：
    - 单笔金额是否在 `[singleAmountMin, singleAmountMax]` 范围内
    - 本日累计金额 + 本次金额 ≤ `dailyAmountLimit`
    - 本日累计笔数 + 本次笔数 ≤ `dailyCountLimit`

- **退票后额度释放**
  - 成功退票后，对应金额会从 `DailyLimitUsage.usedAmount` 中扣减
  - 可通过次日或其他批次验证额度已恢复

**问题排查**：
- `DAILY_AMOUNT_LIMIT` 超限 → 拆分批次或次日再付
- `SINGLE_AMOUNT_MAX` 超限 → 调整单笔金额或联系管理员提高限额
- 退票后额度未释放 → 检查 `refund.status` 是否为 `processedAt` 有值

---

### 4. 审批链处理

**操作路径**：`POST /api/v1/approvals/flows` → 提交批次 → 逐级审批

**验收检查点**：

- **创建审批流**
  - 按金额区间配置：`minAmount` 到 `maxAmount`
  - `levels` 数组按 level 升序排列（1级、2级、3级...）

- **审批流转**
  - 提交批次后，查看 `GET /api/v1/approvals/batches/{id}/context`
    - `currentLevel` 表示当前需要审批的级别
    - `isFullyApproved` 为 `false` 表示还有待审批级别
  - 审批通过后：
    - 非最后一级：当前级别状态变 `APPROVED`，`currentLevel` 指向下一级
    - 最后一级：批次状态从 `PENDING_REVIEW` 变 `APPROVED`

- **审批拒绝**
  - 任意级别拒绝后，`isRejected = true`
  - 批次状态变为 `REJECTED`
  - 记录 `rejectedReason` 便于后续查看

**问题排查**：
- 找不到匹配的审批流 → 检查金额是否落在某个 `[minAmount, maxAmount]` 区间
- 审批流未生效 → 确认 `isActive = true`
- 无法审批 → 检查 `context.isRejected` 是否为 true（已被拒绝无法继续审批）

---

### 5. 退票处理

**操作路径**：`POST /api/v1/refunds` → `GET /api/v1/refunds/{id}`

**验收检查点**：

- **退票前置条件**
  - 只有 `SUCCESS` 或 `PARTIAL_REFUND` 状态的付款才能退票
  - 退票金额 ≤ 剩余可退金额（原金额 - 已退票金额）

- **退票后状态变化**
  - 全额退票：`payment.status` 变为 `REFUNDED`
  - 部分退票：`payment.status` 变为 `PARTIAL_REFUND`
  - 批次状态会联动更新（部分成功、全部退票等）

- **幂等性验证**
  - 用同一个 `idempotencyKey` 重复请求，返回相同的退款记录
  - 不会重复扣款（实际是不会重复生成退款）

**问题排查**：
- 退票失败 → 检查付款状态是否为 `SUCCESS`
- `INVALID_AMOUNT` → 计算剩余可退金额 = 原金额 - `refunds` 列表金额之和
- 批次状态未更新 → 系统会自动联动，检查 `batch.failCount` 和 `batch.successCount`

---

### 6. 付款报表

**操作路径**：`GET /api/v1/reports/*` 系列接口

**验收检查点**：

- **汇总报表** `GET /api/v1/reports/summary`
  - `totalBatches` 批次总数
  - `successCount` + `failCount` + `pendingCount` 应等于 `totalPayments`
  - `refundAmount` 包含所有退票金额（含部分退票）

- **日趋势** `GET /api/v1/reports/trend?days=7`
  - 每天一条记录，按日期升序排列
  - `amount` 为批次创建时的金额（含后续退票的）

- **账户维度** `GET /api/v1/reports/accounts`
  - 按收款账户聚合统计
  - 同一账户多笔付款会合并显示

- **状态分布** `GET /api/v1/reports/status`
  - `batches` 为各状态批次数量
  - `payments` 为各状态付款数量

- **退票统计** `GET /api/v1/reports/refunds`
  - `byReason` 按退票原因分类统计数量
  - `byReasonAmount` 按原因分类统计金额

**问题排查**：
- 金额不一致 → 用 `startDate` 和 `endDate` 缩小范围，逐笔核对
- 账户维度少数据 → 确认账户有 `payments` 关联记录

---

## 二、异常场景验收点

### 1. 重复提交幂等性

**测试方法**：
1. 用同一个 `idempotencyKey` 连续调用 `POST /api/v1/batches` 三次
2. 检查三次响应的 `batch.id` 是否完全相同

**预期结果**：
- 三次返回相同的批次数据
- 数据库中只有一条 `PaymentBatch` 记录
- 不会产生重复付款

**排查路径**：
- 查询 `GET /api/v1/batches?idempotencyKey=XXX`（自定义查询）
- 查看 `AuditLog` 确认只记录了一次 `BATCH_CREATE`

---

### 2. 限额超限回滚

**测试方法**：
1. 设置日限额为 1000 元
2. 提交一个 800 元的批次（成功）
3. 再提交一个 300 元的批次（应该失败）

**预期结果**：
- 第二个批次创建时返回 `LIMIT_EXCEEDED` 错误
- 第一个批次不受影响
- 日限额使用量仍然只记录 800 元

**排查路径**：
- 查看 `/api/v1/limits/check` 的 `currentUsage.usedAmount`
- 确认第二个批次没有扣减额度

---

### 3. 审批中途拒绝

**测试方法**：
1. 配置 2 级审批流
2. 提交批次（金额触发审批）
3. 第 1 级审批人拒绝

**预期结果**：
- 批次状态变为 `REJECTED`
- 第 2 级审批人看不到待审批任务
- 额度已在提交时扣减，需确认是否需要释放（根据业务规则）

**排查路径**：
- `GET /api/v1/approvals/batches/{id}/context` → `isRejected = true`
- 查看 `batch.rejectedReason` 和 `batch.rejectedBy`

---

### 4. 部分退票后状态正确

**测试方法**：
1. 创建 3 笔付款的批次，全部成功
2. 对其中 1 笔做全额退票
3. 对第 2 笔做部分退票（如 1000 元退 300 元）

**预期结果**：
- 批次状态变为 `PARTIAL_SUCCESS`
- `batch.successCount = 2`（第3笔全成功 + 第2笔部分成功）
- `batch.failCount = 1`（第1笔全退 + 第2笔退的部分）
- 第 2 笔付款状态为 `PARTIAL_REFUND`

**排查路径**：
- `GET /api/v1/batches/{id}` → 查看 `payments[].status`
- 检查每笔付款的 `refunds` 数组

---

### 5. 并发限额扣减

**测试方法**：
1. 设置日额度 1000 元
2. 同时提交两个各 600 元的批次（并发）

**预期结果**：
- 其中一个成功，另一个因超限失败
- 不会出现两个都成功、总额超 1000 的情况

**排查路径**：
- 查看两个批次的状态
- 确认成功的那个扣减了额度，失败的未扣减

---

## 三、数据一致性验收点

### 1. 批次金额与明细之和一致

**检查方法**：
- 任意取一个批次：`GET /api/v1/batches/{id}`
- 计算：`payments` 数组的 `amount` 求和
- 与 `batch.totalAmount` 对比

**验收标准**：
- 两者完全相等（保留2位小数）
- 如有不符，属于数据不一致，需排查创建时的逻辑

---

### 2. 付款状态与退票记录一致

**检查方法**：
- 对每笔有退票的付款：
  - `payment.amount` = `payment.refunds` 金额之和 + 剩余成功金额
  - 全退时 `payment.status = REFUNDED`
  - 部分退时 `payment.status = PARTIAL_REFUND`

**验收标准**：
- 金额计算一致
- 状态与实际退票情况匹配

---

### 3. 审批记录完整可追溯

**检查方法**：
- 对已审批的批次：
  - `GET /api/v1/approvals/batches/{id}/context`
  - 检查 `records` 数组中：
    - 每级审批的 `approverId`、`approverName`、`approvedAt`
    - 拒绝的要有 `rejectedAt` 和 `comment`

**验收标准**：
- 审批流配置的每个级别都有对应记录
- 时间顺序合理（低级先审批，高级后审批）
- 操作人信息完整

---

### 4. 审计日志与操作一致

**检查方法**：
- 执行任意操作（创建、提交、审批、退票）
- 查看 `AuditLog` 表（未来可增加查询接口）

**验收标准**：
- 每类操作都有对应 `actionType` 记录：
  - `BATCH_CREATE`、`BATCH_SUBMIT`、`BATCH_CANCEL`
  - `REFUND_CREATE`
- `operatorId` 和 `operatorName` 与请求头一致
- `beforeValue`/`afterValue` 能还原变更内容

---

## 四、快速排查指南

### 常见问题 → 检查位置

| 现象 | 先查哪里 | 再查哪里 |
|------|---------|---------|
| 批次创建失败 | `validation.errors` 数组 | `/api/v1/limits/check` |
| 提交后状态不对 | `batch.status` 当前值 | `/api/v1/approvals/batches/{id}/context` |
| 无法审批 | `context.isRejected` | `context.currentLevel` 是否轮到 |
| 退票失败 | `payment.status` 是否为 SUCCESS | 剩余可退金额计算 |
| 报表金额不对 | `startDate/endDate` 范围 | 逐笔核对 payments 数据 |
| 重复创建问题 | 检查 `idempotencyKey` 是否唯一 | 查看 `AuditLog` 操作记录 |

---

## 五、API 接口速查

### 账户管理
- `POST /api/v1/accounts` - 创建账户
- `GET /api/v1/accounts` - 账户列表
- `GET /api/v1/accounts/{id}` - 账户详情
- `POST /api/v1/accounts/{id}/verify` - 验证账户
- `POST /api/v1/accounts/{id}/toggle` - 启/停用

### 付款批次
- `POST /api/v1/batches` - 创建批次（幂等）
- `POST /api/v1/batches/validate` - 仅校验不创建
- `GET /api/v1/batches` - 批次列表
- `GET /api/v1/batches/{id}` - 批次详情（含付款明细）
- `POST /api/v1/batches/{id}/submit` - 提交批次
- `POST /api/v1/batches/{id}/cancel` - 取消批次

### 审批流
- `POST /api/v1/approvals/flows` - 创建审批流
- `GET /api/v1/approvals/flows` - 审批流列表
- `GET /api/v1/approvals/batches/{id}/context` - 审批进度
- `POST /api/v1/approvals/batches/{id}/approve` - 审批通过
- `POST /api/v1/approvals/batches/{id}/reject` - 审批拒绝

### 限额管理
- `POST /api/v1/limits` - 创建限额规则
- `GET /api/v1/limits` - 限额列表
- `GET /api/v1/limits/check` - 限额检查

### 退票管理
- `POST /api/v1/refunds` - 退票处理（幂等）
- `GET /api/v1/refunds` - 退票列表
- `GET /api/v1/refunds/{id}` - 退票详情

### 报表
- `GET /api/v1/reports/summary` - 批次汇总
- `GET /api/v1/reports/trend` - 日趋势
- `GET /api/v1/reports/accounts` - 账户维度
- `GET /api/v1/reports/status` - 状态分布
- `GET /api/v1/reports/refunds` - 退票统计
