# 管弦乐椅位调整系统

## 概述

本系统用于管理琴行管弦乐椅位调整流程，解决调音师留言与排练群接龙信息不一致的问题，确保每一条调整记录都有完整的证据链可追溯。

## 核心特性

1. **完整证据链**：保留调音师留言原始行号、人工改动记录、当前处理状态
2. **边界规则固化**：返工原因自动识别、版权运营复核流程
3. **去重导入**：同一批数据重复导入不会翻倍记录数量
4. **变更追踪**：每一条修改都记录改前改后的值和操作人
5. **回滚机制**：支持回滚到导入时的初始状态

## 边界规则（代码中同样定义）

### 1. 返工原因识别规则

**触发关键词**（大小写不敏感）：
- `返工`
- `rework`
- `需重新`
- `重新调音`
- `调整返工`

**判定逻辑**：
- 轨道备注中包含上述任一关键词 → 标记为返工记录
- 状态自动设置为 `rework_review`（待版权运营复核）
- **重要**：即使后续修改备注移除了返工关键词，状态仍保持 `rework_review`，必须由版权运营手动复核

### 2. 状态流转规则

| 状态 | 说明 | 可操作人 | 下一状态 |
|------|------|----------|----------|
| `pending` | 待处理，刚导入的正常记录 | 老周 | `normal`, `rework_review` |
| `normal` | 正常处理中 | 老周 | `rework_review`, `confirmed` |
| `rework_review` | 待版权运营复核 | 版权运营 | `normal`, `confirmed` |
| `confirmed` | 已确认 | - | - |
| `rolled_back` | 已回滚 | - | - |

### 3. 返工记录处理规则

**怎么判：**
- 导入时自动检测轨道备注中的返工关键词
- 店长（老周）修改备注时，如果新增返工关键词，状态自动变为 `rework_review`
- 店长（老周）修改备注时，如果移除返工关键词，状态**保持** `rework_review`（不自动恢复）

**怎么改：**
- 版权运营拥有最终决定权
- 复核通过 → 状态变为 `confirmed`
- 复核不通过 → 状态变为 `normal`

**怎么回滚：**
- 任何状态都可以回滚
- 回滚后状态变为 `rolled_back`
- 备注恢复为导入时的原始值
- 座位号、乐器信息恢复为导入时的原始值
- 回滚操作本身也会记录在变更历史中

### 4. 重复导入判定规则

- 使用 SHA-256 对导入数据内容计算哈希
- 哈希相同则判定为重复导入
- 重复导入时：
  - 创建新的批次记录，标记 `is_duplicate = true`
  - 记录重复的原批次 ID
  - **不创建新的调整记录**，直接返回原批次的记录
  - 统计数量不增加

## 三步核心流程

### 第一步：调音师留言第一次导入

```python
from orchestra_seat_adjustment import OrchestraSeatAdjustmentSystem

system = OrchestraSeatAdjustmentSystem()

tuner_data = [
    {
        "row_number": 3,
        "seat_number": "A-05",
        "instrument": "第一小提琴",
        "track_remark": "音准正常，椅位微调左移5cm",
    },
    {
        "row_number": 7,
        "seat_number": "B-12",
        "instrument": "大提琴",
        "track_remark": "返工：上次调音音准偏差",
    },
]

batch, adjustments = system.import_tuner_messages(
    tuner_data,
    source_file="调音师留言_20260606.xlsx",
    imported_by="老周",
)
```

### 第二步：琴行店长老周补看排练群接龙

```python
# 补充排练群接龙信息
signup_data = {
    "group_name": "周六管弦乐排练群",
    "date": "2026-06-07",
    "attendees": ["小王", "小李", "老张"],
    "seat_conflict_note": "B-12座位临时换人",
}

system.update_rehearsal_signup(
    adjustment_id,
    signup_data,
    operator="老周",
)

# 老周修改备注
system.manager_edit_remark(
    adjustment_id,
    new_remark="修改后的备注内容",
    editor="老周",
    edit_reason="补充排练注意事项",
)
```

### 第三步：排练变更记录更新

```python
change_record = {
    "change_type": "人员调整",
    "original_seat": "B-12",
    "new_player": "老赵",
    "change_time": "2026-06-06 16:30",
    "approved_by": "老周",
}

system.update_rehearsal_change(
    adjustment_id,
    change_record,
    operator="老周",
)
```

**重要**：如果轨道备注有返工原因，以上操作后状态仍为 `rework_review`，留给版权运营复核。

## 版权运营复核

```python
# 复核通过
system.copyright_review_rework(
    adjustment_id,
    approve=True,
    reviewer="版权运营-张姐",
    review_comment="返工原因属实，确认通过",
)

# 复核不通过
system.copyright_review_rework(
    adjustment_id,
    approve=False,
    reviewer="版权运营-张姐",
    review_comment="不属于返工范畴",
)
```

## 证据链查询

```python
evidence = system.get_adjustment_with_evidence(adjustment_id)

print(f"原始行号: {evidence['evidence_summary']['original_row_number']}")
print(f"原始文件: {evidence['evidence_summary']['original_source_file']}")
print(f"人工修改次数: {evidence['evidence_summary']['manual_edit_count']}")
print(f"状态变更轨迹: {evidence['evidence_summary']['status_changes']}")
```

## 回滚操作

```python
system.rollback_adjustment(
    adjustment_id,
    operator="老周",
    rollback_reason="误操作，撤销修改",
)
```

## 查看统计信息

```python
stats = system.get_statistics()
print(stats)
```

输出示例：
```python
{
    "total_adjustments": 3,
    "total_tuner_messages": 3,
    "total_import_batches": 2,
    "duplicate_batches": 1,
    "status_distribution": {
        "pending": 1,
        "rework_review": 1,
        "confirmed": 1
    },
    "rework_awaiting_review": 1
}
```

## 运行演示

```bash
python main.py
```

## 文件结构

```
.
├── models.py                      # 数据模型定义
├── orchestra_seat_adjustment.py   # 核心业务逻辑
├── main.py                        # 演示程序
├── test_system.py                 # 测试用例
└── README.md                      # 本文档
```

## 关键代码位置

- 边界规则定义：[orchestra_seat_adjustment.py](file:///Users/lzy/pro/solo/workspaces/zy72414/orchestra_seat_adjustment.py#L18-L23) 中的 `BOUNDARY_RULES`
- 返工检测逻辑：[orchestra_seat_adjustment.py](file:///Users/lzy/pro/solo/workspaces/zy72414/orchestra_seat_adjustment.py#L66-L70) 中的 `_detect_rework`
- 去重导入逻辑：[orchestra_seat_adjustment.py](file:///Users/lzy/pro/solo/workspaces/zy72414/orchestra_seat_adjustment.py#L83-L99) 中的 `import_tuner_messages`
- 变更记录：[orchestra_seat_adjustment.py](file:///Users/lzy/pro/solo/workspaces/zy72414/orchestra_seat_adjustment.py#L40-L64) 中的 `_record_change`
