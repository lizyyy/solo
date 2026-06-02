# 融资融券利息日切系统

## 业务背景

风控值班人员处理"融资融券利息日切"时，需要面对托管确认页、除权日截图等多份证据。本系统确保审批人信息、原始行号、人工改动、处理状态等关键信息完整留存，客户经理追问时能追溯到原始证据，而非仅查看汇总数据。

## 核心边界规则（代码即约定）

### 1. 审批人拼音判定规则

**判定逻辑** ([pinyinDetector.ts](file:///Users/lzy/pro/solo/workspaces/zy72214/src/utils/pinyinDetector.ts#L1-L19)):

```typescript
// 判定为拼音审批人的情况：
1. 名称为空或仅含空格
2. 不包含任何中文字符（[\u4e00-\u9fa5]）
3. 仅由英文字母和空格组成
4. 或仅为单个英文单词

// 判定为中文审批人：
- 包含任意中文字符
```

**处理方式**:
- 自动标记 `isPinyinApprover = true`
- 状态设置为 `PENDING_APPROVER_VERIFICATION`（待客户经理复核）
- 指派人 `currentAssignee = '客户经理'`
- **不会自动推进到后续流程**，必须等客户经理复核

**修改方式**:
- 客户经理调用 `dataStore.verifyApproverName(id, verifiedName, verifiedBy)`
- 系统记录：人工修改记录 + 状态变更历史 + 改前改后对比

**回滚方式**:
- 调用 `dataStore.rollbackToStatus(id, targetStatus, operator, reason)`
- 目标状态必须早于当前状态
- 回滚时会删除对应步骤产生的关联数据（余额更新、除权审查记录）

### 2. 重复导入防翻倍规则

**去重逻辑** ([dataStore.ts](file:///Users/lzy/pro/solo/workspaces/zy72214/src/store/dataStore.ts#L57-L68)):

```typescript
// 唯一键生成规则：
const uniqueKey = `${importBatchId}-${originalRowNumber}-${clientAccount}-${interestAmount}`

// 同一批次 + 同一行号 + 同一客户 + 同一金额 = 重复
```

**导入结果**:
- `successCount`: 成功导入数量
- `duplicateCount`: 重复跳过数量
- `duplicateRowNumbers`: 重复的原始行号列表

### 3. 历史追踪规则

**留存字段** ([types/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72214/src/types/index.ts#L82-L92)):

```typescript
interface HistoryRecord {
  entityId: string;           // 关联记录ID
  changeType: ChangeType;     // CREATE | UPDATE | DELETE | ROLLBACK | STATUS_CHANGE
  changedBy: string;          // 操作人
  changedAt: string;          // 操作时间
  beforeState: object | null; // 修改前完整状态
  afterState: object | null;  // 修改后完整状态
  diffSummary: string;        // 变更摘要
}
```

**备注修改追踪**:
- 风控值班老秦仅修改一条备注也会记录
- 可查看: `manualModifications` 数组 + `historyRecords` 时间线

## 标准三步流程

```
第一步：托管确认页导入
        ↓
        ├─ 检测：审批人是否为拼音？
        │   ├─ 是 → PENDING_APPROVER_VERIFICATION（停在此处）
        │   └─ 否 → IMPORTED（继续）
        ↓
第二步：风控值班老秦补看除权日截图
        ↓
        ├─ 记录：截图引用、是否有除权事件、调整金额
        └─ 状态：EX_RIGHTS_DATE_REVIEWED
        ↓
第三步：余额变化表更新
        ↓
        ├─ 计算：原余额 + 利息 + 除权调整 = 新余额
        └─ 状态：BALANCE_UPDATED
```

**关键点**: 当审批人仅留拼音时，流程卡在第一步之后，必须由客户经理复核后才能继续。

## 证据链查询

当客户经理追问时，调用:

```typescript
const evidence = dailyCutService.getEvidenceForCustomerManager(confirmationId);

// 返回内容：
{
  originalRowNumber: number;      // 原始行号
  rawContent: string;             // 原始内容
  manualModifications: Array<{    // 人工改动
    fieldName, oldValue, newValue, modifiedBy, modifiedAt, reason
  }>;
  status: ProcessingStatus;       // 当前状态
  statusFlow: Array<{             // 状态流转时间线
    status, time, operator
  }>;
  history: Array<{                // 完整历史
    changeType, changedBy, changedAt, diffSummary
  }>;
  exRightsReview: ExRightsDateReview | null;  // 除权日审查记录
  balanceChange: BalanceChange | null;        // 余额变化记录
}
```

## 处理常见错误

### 错口径修正

```typescript
// 修改任意字段，自动留痕
dataStore.updateConfirmationField(
  confirmationId,
  'interestAmount',  // 字段名
  1500.50,           // 新值
  '风控老秦',         // 修改人
  '原始口径错误，按新公式重新计算'  // 原因
);
```

### 补录返工

```typescript
// 回滚到指定状态，重新处理
const result = dataStore.rollbackToStatus(
  confirmationId,
  ProcessingStatus.IMPORTED,  // 回滚目标
  '风控老秦',
  '除权日截图遗漏，需重新补看'
);
```

## 状态枚举

| 状态 | 说明 |
|------|------|
| `IMPORTED` | 已导入 |
| `PENDING_APPROVER_VERIFICATION` | 待审批人复核（拼音情况） |
| `APPROVER_VERIFIED` | 审批人已复核 |
| `EX_RIGHTS_DATE_REVIEWED` | 除权日已审查 |
| `BALANCE_UPDATED` | 余额已更新 |
| `NEEDS_REWORK` | 需返工 |
| `ROLLBACKED` | 已回滚 |

## API 速览

| 操作 | 方法 |
|------|------|
| 导入确认页 | `dataStore.importConfirmations(rawData, operator)` |
| 修改备注 | `dataStore.updateRemark(id, newRemark, operator, reason)` |
| 复核审批人 | `dataStore.verifyApproverName(id, verifiedName, operator)` |
| 修改字段 | `dataStore.updateConfirmationField(id, field, value, operator, reason)` |
| 除权日审查 | `dailyCutService.reviewExRightsDate(...)` |
| 余额更新 | `dailyCutService.updateBalance(...)` |
| 完整流程 | `dailyCutService.processFullWorkflow(...)` |
| 回滚 | `dataStore.rollbackToStatus(id, targetStatus, operator, reason)` |
| 查证据 | `dailyCutService.getEvidenceForCustomerManager(id)` |
| 查历史 | `dataStore.getHistory(id)` |
| 查状态流 | `dataStore.getStatusFlow(id)` |
| 统计 | `dailyCutService.getStatistics()` |
