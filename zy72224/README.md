# 投顾组合再平衡审核系统

## 概述

本系统用于管理"投顾组合再平衡审核"的完整生命周期，解决风控值班人员在审核过程中遇到的边界问题，尤其是审批人只留拼音时如何判定、如何修改、如何回滚。

## 边界规则

### 审批人姓名判定

| 输入 | 判定结果 | 后续动作 |
|------|----------|----------|
| 包含中文字符 | `NORMAL`（正常） | 流程正常推进 |
| 纯英文字母/空格（如 `zhangsan`、`ZS`） | `PINYIN_ONLY`（仅拼音） | 拦截流程，留给客户经理复核，不可直接归为正常 |
| 空值或不含中文也不纯英文 | `AMBIGUOUS`（模糊） | 标记为 `PinyinVerdict.AMBIGUOUS`，需人工确认 |

**核心原则：审批人只留拼音时，不急着归正常，留给客户经理复核。**

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
- **去重**：同一批税费率备注重复导入时，基于 fingerprint（`税类:税率:备注:审批人`）去重，不会导致数量翻倍
- 导入后自动检测审批人拼音，若为纯拼音则抛出 `PinyinInterceptError`，拦截流程

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

单条备注修改时，历史记录会显示改前改后：

```python
history = engine.update_note_remark(record, note_id, "新备注", operator="老秦")
# history.old_value = "旧备注"
# history.new_value = "新备注"

# 查看完整差异
diffs = engine.get_history_diff(record)
# ["[remark] '旧备注' -> '新备注' (by 老秦)", ...]
```

## 可视化与溯源

### 证据链回溯

在 3D 或图表展示中，点到一条审批人只留拼音的记录时，可以通过溯源服务回到税费率备注或柜台流水尾号：

```python
service = TraceabilityService()

# 从余额变化条目溯源到最原始的税费率备注
chain = service.full_evidence_chain(record, "balance_entry", entry_id)
# chain: [余额变化 → 柜台流水尾号 → 税费率备注]

# 获取具体详情
detail = service.get_source_detail(record, "tax_rate_note", note_id)
```

**核心原则：追证据时不要断在半路，结论看着很满也要能追踪到源头。**

## 数据模型

| 模型 | 说明 |
|------|------|
| `ReviewRecord` | 审核主记录，包含组合名、审批人、状态、工作流阶段 |
| `TaxRateNote` | 税费率备注，含税类、税率、备注、审批人、来源文件 |
| `CounterTransaction` | 柜台流水，含尾号、金额、关联税费率备注ID |
| `BalanceChangeEntry` | 余额变化条目，含账户、变动前后余额、关联流水ID |
| `ApproverBoundaryRule` | 审批人边界规则，含条件类型、条件值、动作 |
| `ChangeHistory` | 变更历史，含字段名、旧值、新值、操作人、变更类型 |
