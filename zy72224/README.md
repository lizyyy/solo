# 投顾组合再平衡审核系统

## 概述

本系统用于管理"投顾组合再平衡审核"的完整生命周期，解决风控值班人员在审核过程中遇到的边界问题，尤其是审批人只留拼音时如何判定、如何修改、如何回滚。所有边界规则同时写在代码和文档中，杜绝口头约定。

## 边界规则（代码+文档双保障）

所有边界规则在 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72224/rebalance_review/engine.py#L15-L68) 中以代码形式显式定义（`APPROVER_NAME_BOUNDARY_RULES` 和 `ROLLBACK_FIELD_HANDLERS`），确保文档与代码一致。

### 审批人姓名判定规则（怎么判）

| 输入示例 | 判定结果 `PinyinVerdict` | 状态 `ReviewStatus` | 自动通过 | 需客户经理复核 | 代码中的动作定义 |
|----------|--------------------------|---------------------|----------|----------------|------------------|
| `张三`、`张三ZS` | `NORMAL`（正常） | `APPROVED` | ✅ 是 | ❌ 否 | `NORMAL_NAME_ACTION` |
| `zhangsan`、`ZS`、`zhang san` | `PINYIN_ONLY`（仅拼音） | `AWAITING_CLIENT_MANAGER_REVIEW` | ❌ 否 | ✅ 是 | `PINYIN_ONLY_ACTION` |
| 空值、`_001`、`审批人_001`（不含中文） | `AMBIGUOUS`（模糊） | `PINYIN_FLAGGED` | ❌ 否 | ❌ 否 | `AMBIGUOUS_NAME_ACTION` |

**核心原则：审批人只留拼音时，不急着归正常，留给客户经理复核。**

代码中可直接查询判定理由：

```python
engine = RebalanceReviewEngine()
engine.describe_boundary_decision("zhangsan")
# "审批人 'zhangsan': 审批人仅留拼音，不可直接归为正常，留给客户经理复核"
```

### 审批人姓名修改流程（怎么改）

1. **触发条件**：审批人姓名判定为 `PINYIN_ONLY` 时，工作流抛出 `PinyinInterceptError`
2. **修改权限**：仅客户经理（`operator="client_manager"`）可修改
3. **修改记录**：每次修改自动记录到 `ChangeHistory`，包含旧值、新值、旧判定、新判定
4. **修改后判定**：自动重新判定姓名，若变为 `NORMAL` 则状态恢复为 `PENDING`

```python
from rebalance_review.workflow import PinyinInterceptError

try:
    workflow.step_import_tax_notes(record, notes, operator="老秦")
except PinyinInterceptError:
    # 流程暂停，等待客户经理复核
    workflow.resolve_pinyin_flag(record, confirmed_name="张三", operator="客户经理")
    # 复核后从之前中断的阶段继续推进
    workflow.step_import_tax_notes(record, [], operator="老秦")
```

### 审批人姓名回滚流程（怎么回滚）

1. **回滚依据**：以 `ChangeHistory.id` 为回滚目标点
2. **回滚范围**：支持所有字段的回滚（见 `ROLLBACK_FIELD_HANDLERS`）
3. **回滚记录**：回滚操作本身也会被记录（`change_type="rollback"`）
4. **回滚后状态**：状态变为 `ROLLED_BACK`，需重新走审核流程

```python
# 回滚到指定历史节点
engine.rollback_record(record, history_id="abc123", operator="管理员")
assert record.status == ReviewStatus.ROLLED_BACK
```

### 自定义边界规则

通过 `ApproverBoundaryRule` 可扩展规则：

```python
from rebalance_review import ApproverBoundaryRule

rule = ApproverBoundaryRule(
    rule_name="审批人含数字标记",
    description="审批人名含数字时需标记",
    condition_type="approver_name_pattern",
    condition_value=r"\d",
    action="flag_pinyin",
    priority=10,
)
engine.add_boundary_rule(rule)
```

支持的 `condition_type`：
- `approver_name_pattern`：正则匹配审批人名
- `status_equals`：匹配审核状态
- `portfolio_name_pattern`：正则匹配组合名

支持的 `action`：
- `flag_pinyin`：标记为拼音存疑
- `await_client_manager`：留给客户经理复核
- `reject`：直接拒绝

### 回滚机制

1. 每次字段变更均写入 `ChangeHistory`，包含 `old_value`、`new_value`、`changed_by`、`change_type`
2. 通过 `engine.rollback_record(record, history_id, operator)` 可回滚到指定历史节点
3. 回滚操作本身也会被记录到历史中（`change_type="rollback"`）
4. 回滚后状态变为 `ROLLED_BACK`，需重新走审核流程

## 三步工作流

```
税费率备注导入 → 风控补看柜台流水尾号 → 余额变化表更新
   (Phase 1)          (Phase 2)             (Phase 3)
```

### Phase 1: 税费率备注导入

- 导入税费率备注数据
- **去重机制**：同一批税费率备注重复导入时，基于 `content_fingerprint()`（`税类:税率:备注:审批人`）去重，不会导致数量翻倍
- 去重逻辑在 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72224/rebalance_review/engine.py#L129-L155) 的 `import_tax_notes` 中实现
- 导入后自动检测审批人拼音，若为纯拼音则抛出 `PinyinInterceptError`，拦截流程

### 去重机制详解

系统使用双重 fingerprint 机制：

| 方法 | 用途 | 格式 |
|------|------|------|
| `content_fingerprint()` | 用于去重判断 | `税类:税率:备注:审批人` |
| `fingerprint()` | 用于历史追踪 | `id:税类:税率:备注:审批人` |

**关键区别**：
- 同一条备注修改 `remark` 后，`content_fingerprint()` 会变化，可以被重新导入
- 历史记录中保存 `id:content_fingerprint`，可以追踪到同一条备注的改前改后差别

### Phase 2: 风控补看柜台流水尾号

- 风控值班人员补充柜台流水尾号信息
- 若审批人仍为纯拼音状态，再次拦截

### Phase 3: 余额变化表更新

- 更新余额变化表
- 完成后流程状态变为 `COMPLETED`

### 拼音拦截与客户经理复核

当流程被拼音拦截时：

```python
try:
    workflow.step_import_tax_notes(record, notes, operator="老秦")
except PinyinInterceptError:
    # 流程暂停，等待客户经理复核
    workflow.resolve_pinyin_flag(record, confirmed_name="张三", operator="客户经理")
    # 复核后可继续推进
```

## 历史变更追踪

单条备注修改时，历史记录会显示改前改后的完整信息，包含 content_fingerprint 变化：

```python
history = engine.update_note_remark(record, note_id, "新备注", operator="老秦")
# history.old_value = "旧备注 (fp:增值税:0.06:旧备注:张三)"
# history.new_value = "新备注 (fp:增值税:0.06:新备注:张三)"

# 查看完整差异
diffs = engine.get_history_diff(record)
# ["[remark] '旧备注 (fp:增值税:0.06:旧备注:张三)' -> '新备注 (fp:增值税:0.06:新备注:张三)' (by 老秦)", ...]
```

**即使风控值班老秦只改了一条备注，"投顾组合再平衡审核"历史里也能清晰看出改前改后的差别。**

### 变更历史字段说明

所有字段变更均记录到 `ChangeHistory`，包含：

| 字段 | 说明 |
|------|------|
| `field_name` | 变更的字段名 |
| `old_value` | 变更前的值（含 fingerprint） |
| `new_value` | 变更后的值（含 fingerprint） |
| `changed_by` | 操作人 |
| `change_type` | 变更类型：`add`/`update`/`transition`/`intercept`/`pinyin_resolution`/`rollback` |

## 可视化与溯源（先服务复核，再看漂亮画面）

### 证据链回溯（防断链）

在 3D 或图表展示中，点到一条审批人只留拼音的记录时，可以通过溯源服务回到税费率备注或柜台流水尾号，**不要只剩漂亮画面**：

```python
service = TraceabilityService()

# 从余额变化条目溯源到最原始的税费率备注（完整证据链）
chain = service.full_evidence_chain(record, "balance_entry", entry_id)
# chain: [余额变化 → 柜台流水尾号 → 税费率备注]

# 每一步都能点击回溯到上一层证据
for link in chain:
    detail = service.get_source_detail(record, link.display_type, link.display_id)
    # detail 包含完整的原始数据（税费率备注、柜台流水、余额变化）
```

**核心原则：追证据时不要断在半路，结论看着很满也要能追踪到源头。**

### 溯源支持的跳转路径

| 当前位置 | 可跳转至 | 说明 |
|----------|----------|------|
| 3D/图表中的审批人拼音 | 税费率备注 | 点击拼音 → 查看原始备注详情 |
| 余额变化条目 | 柜台流水尾号 | 点击余额变化 → 查看关联的流水 |
| 柜台流水尾号 | 税费率备注 | 点击流水 → 查看关联的原始备注 |
| 任意节点 | 完整证据链 | 一键获取从当前节点到最源头的完整链路 |

## 三步工作流完整示例（含拼音拦截场景）

```python
# ===== 场景：审批人只留了拼音 "zhangsan" =====

# Step 1: 税费率备注第一次导入
record = engine.create_record("组合A", "zhangsan")
note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="zhangsan")

try:
    workflow.step_import_tax_notes(record, [note], operator="老秦")
except PinyinInterceptError:
    # 被拦截了！别急着归正常，留给客户经理复核
    assert record.status == ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW

# Step 2: 客户经理复核并补全审批人姓名
workflow.resolve_pinyin_flag(record, confirmed_name="张三", operator="客户经理")
assert record.approver_pinyin_verdict == PinyinVerdict.NORMAL

# 从中断处继续推进（Phase 1 剩余部分）
workflow.step_import_tax_notes(record, [], operator="老秦")
assert record.workflow_phase == WorkflowPhase.COUNTER_TRANSACTION_CHECK

# Step 3: 风控值班老秦补看柜台流水尾号
tx = CounterTransaction(tail_number="8899", amount=100000, linked_tax_note_id=note.id)
workflow.step_check_counter_transactions(record, [tx], operator="老秦")
assert record.workflow_phase == WorkflowPhase.BALANCE_UPDATE

# Step 4: 余额变化表更新
entry = BalanceChangeEntry(account="A001", before_balance=500000, after_balance=600000, linked_counter_tx_id=tx.id)
workflow.step_update_balance(record, [entry], operator="老秦")
assert record.workflow_phase == WorkflowPhase.COMPLETED

# 任意时刻都能回溯证据链
chain = service.full_evidence_chain(record, "balance_entry", entry.id)
# 证据链完整：余额变化 → 柜台流水尾号 8899 → 税费率备注
```

## 数据模型

| 模型 | 说明 |
|------|------|
| `ReviewRecord` | 审核主记录，包含组合名、审批人、状态、工作流阶段 |
| `TaxRateNote` | 税费率备注，含税类、税率、备注、审批人、来源文件 |
| `CounterTransaction` | 柜台流水，含尾号、金额、关联税费率备注ID |
| `BalanceChangeEntry` | 余额变化条目，含账户、变动前后余额、关联流水ID |
| `ApproverBoundaryRule` | 审批人边界规则，含条件类型、条件值、动作 |
| `ChangeHistory` | 变更历史，含字段名、旧值、新值、操作人、变更类型 |
