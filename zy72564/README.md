# 主动学习标注挑样系统

## 一、系统目标

解决评测切片的全链路追踪问题：原始行号留痕、人工改动可追溯、状态流转清晰、边界规则明确。避免"离线和线上分数差了一个桶被汇总数字盖过去"的问题。

---

## 二、核心数据结构

### 2.1 评测切片 (EvalSample)

| 字段 | 说明 | 是否必填 |
|------|------|----------|
| sample_id | 样本唯一ID（slice_id + 行号） | 是 |
| original_row_number | **原始行号**（导入时的 Excel/CSV 行号） | 是 |
| slice_id | 评测切片批次ID | 是 |
| feature_snapshot_id | 特征快照编号 | 否 |
| offline_score | 离线实验分数 | 否 |
| online_score | 线上实验分数 | 否 |
| score_bucket_offline | 离线分数所在桶 | 自动计算 |
| score_bucket_online | 线上分数所在桶 | 自动计算 |
| score_gap_level | 分差等级（none/one_bucket/multi_bucket） | 自动计算 |
| remark | 人工备注 | 否 |
| status | 当前处理状态 | 自动流转 |

### 2.2 变更记录 (ChangeRecord)

每条字段修改都会留下一条记录，包含：
- 字段名、改前值、改后值
- 修改人、修改时间
- 修改类型、备注说明

---

## 三、处理状态流转

```
IMPORTED (已导入)
    │
    ▼  补充特征快照编号
FEATURE_ADDED (特征已补充)
    │
    ▼  更新实验分数
    ├───────────────────────────────┐
    │ 分差正常                       │ 分差≥1个桶
    ▼                               ▼
EXPERIMENT_UPDATED          PENDING_REVIEW (待复核)
    │                               │
    │                               ├─ 复核通过 → REVIEW_APPROVED
    │                               └─ 复核驳回 → REVIEW_REJECTED
    │
    ▼ 任意状态可回滚
ROLLED_BACK (已回滚)
```

---

## 四、边界规则（写死在代码里，不只靠口头约定）

### 4.1 分数分桶规则

桶阈值（可在 `sample_manager.py` 的 `BUCKET_THRESHOLDS` 调整）：
```
桶0: [0.0, 0.2)
桶1: [0.2, 0.4)
桶2: [0.4, 0.6)
桶3: [0.6, 0.8)
桶4: [0.8, 1.0]
```

### 4.2 离线线上分差判定逻辑

| 桶号差值 | 分差等级 | 自动处理 |
|----------|----------|----------|
| 0 | none | 正常流转 |
| 1 | one_bucket | **强制转 PENDING_REVIEW，留给评测运营复核** |
| ≥2 | multi_bucket | 强制转 PENDING_REVIEW |

> **重要：分差1个桶时，系统不会自动归为正常，必须等评测运营人工复核。**

### 4.3 复核规则

- 只有 `PENDING_REVIEW` 状态的样本可被复核
- 复核人角色：`operation`（评测运营）
- 复核通过 → `REVIEW_APPROVED`
- 复核驳回 → `REVIEW_REJECTED`

### 4.4 回滚规则

- 任意状态都可回滚到之前的任意状态
- 回滚会留下专门的 `ROLLBACK` 类型变更记录
- 回滚需要注明回滚原因

### 4.5 重复导入规则

- 判重键：`slice_id + original_row_number`（原始行号）
- 重复导入时：跳过已存在的行，不翻倍
- 返回结果中明确区分 `imported`（新增）和 `skipped_duplicate`（跳过）

---

## 五、标准三步流程

### 第一步：导入评测切片

```python
from sample_manager import ActiveLearningSampler

sampler = ActiveLearningSampler()

rows = [
    {"original_row_number": 1, "offline_score": 0.75, "remark": "初始导入"},
    {"original_row_number": 2, "offline_score": 0.55},
    {"original_row_number": 3, "offline_score": 0.82},
]

result = sampler.import_slice(slice_id="slice_20260601", rows=rows, operator="linjie")
# 返回: {"imported": 3, "skipped_duplicate": 0, ...}
```

### 第二步：数据科学家补看特征快照编号

```python
sampler.add_feature_snapshot(
    sample_id="slice_20260601_row_1",
    feature_snapshot_id="feat_v2_20260607_001",
    operator="linjie",
    remark="对照特征快照表第5页确认",
)
```

### 第三步：实验对比更新分数

```python
result = sampler.update_experiment_scores(
    sample_id="slice_20260601_row_1",
    offline_score=0.75,
    online_score=0.58,  # 离线桶3，线上桶2 → 差1个桶
    operator="linjie",
)
# 返回: {"success": True, "needs_review": True}
# 自动进入 PENDING_REVIEW 状态，不会自动归正常
```

### 评测运营复核

```python
sampler.review_decision(
    sample_id="slice_20260601_row_1",
    approved=True,
    operator="operation",
    review_remark="桶边界正常样本，误差可接受",
)
```

---

## 六、常见问题处理（错口径 & 补录返工）

### 6.1 错口径：分数录错了怎么办？

直接重新调用 `update_experiment_scores`，系统会：
1. 记录改前改后的分数差异
2. 重新计算分差等级
3. 根据新的分差决定是否要复核

### 6.2 补录返工：重新导入同一批数据

直接重复调用 `import_slice`：
- 已存在的行会被跳过（不会翻倍）
- 新的行（新行号）会被正常导入
- 返回结果明确告诉你哪些跳过了

### 6.3 只改了一条备注

```python
sampler.update_remark(
    sample_id="slice_20260601_row_1",
    remark="这个样本和 feat_v1 对比过，趋势一致",
    operator="linjie",
)
```

历史记录里能看到改前改后的备注内容。

---

## 七、证据追溯（评测运营追问时）

### 7.1 查单个样本的完整历史

```python
history = sampler.get_sample_history("slice_20260601_row_1")
for h in history:
    print(f"[{h['changed_at']}] {h['changed_by']} {h['change_type']}")
    print(f"  {h['field_name']}: {h['old_value']} → {h['new_value']}")
    if h['remark']:
        print(f"  备注: {h['remark']}")
```

### 7.2 查所有待复核的样本

```python
pending = sampler.get_samples_pending_review(slice_id="slice_20260601")
for s in pending:
    print(f"行号{s.original_row_number}: 离线桶{s.score_bucket_offline} vs 线上桶{s.score_bucket_online}")
```

### 7.3 查某个切片的所有样本（带原始行号）

```python
samples = sampler.store.list_samples(slice_id="slice_20260601")
for s in samples:
    print(f"行号{s.original_row_number} | 状态{s.status.value} | 分差{s.score_gap_level.value}")
```

---

## 八、代码文件说明

| 文件 | 说明 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72564/models.py) | 数据模型、状态枚举、变更记录 |
| [sample_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72564/sample_manager.py) | 核心业务逻辑、边界规则、状态流转 |
| [example_workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72564/example_workflow.py) | 完整流程示例 |
| [test_sampler.py](file:///Users/lzy/pro/solo/workspaces/zy72564/test_sampler.py) | 测试用例 |

---

## 九、配置调整

### 9.1 修改分桶阈值

编辑 `sample_manager.py` 中的 `BUCKET_THRESHOLDS`：
```python
BUCKET_THRESHOLDS = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]  # 默认5个桶
```

### 9.2 接入真实存储

当前 `SampleStore` 是内存实现，生产环境可替换为：
- SQLite（轻量）
- PostgreSQL（正式）
- 只需保持相同的接口契约即可
