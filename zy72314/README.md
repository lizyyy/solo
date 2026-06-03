# 分位数薪酬校准系统

## 系统定位
处理运营规划阿岚最头疼的「评分权重表」和「旧公式截图」互相补台又互相打架的问题。所有边界规则**写死在代码里，所有改动全留痕，学生助教追问时能回到证据。

---

## 核心设计原则

1. **证据优先**：原始行号、人工改动、处理状态，全部保留。
2. **规则硬编码**：边界规则写在代码里，不靠口头约定。
3. **去重不翻倍**：重复导入同一批数据，绝不简单翻倍。
4. **改前改后可查**：每次改动生成历史快照，版本对比一目了然。
5. **负数不急着归正常**：碰到负数样本被旧表当成缺失，留给学生助教复核。

---

## 三步核心工作流程

### Step 1: 评分权重表第一次导入
**输入**：评分权重表（Excel/CSV）
**自动处理**：
- 保存原始行号（`original_row_number`）
- 保存原始数据快照（`raw_data`）
- 自动边界检测
- 标记边界类型，但 **NEGATIVE_TREATED_AS_MISSING 自动标记为 PENDING_REVIEW

### Step 2: 运营规划阿岚补看旧公式截图
**输入**：旧公式截图参考、复核意见
**处理**：
- 记录复核人、截图参考、复核意见
- 所有意见写入工作流状态
- 不自动修改数据，仅记录结论

### Step 3: 边界样本报告更新
**输出**：边界样本报告
**处理**：
- 生成边界统计
- 为 NEGATIVE_TREATED_AS_MISSING 创建复核任务
- 分配给学生助教处理
- **关键**：负数被旧表当成缺失的样本，**不自动归正常，创建复核任务

---

## 边界规则（硬编码在代码中）

### 边界类型定义

| 边界类型 | 值 | 判定规则 | 处理方式 |
|---------|-----|---------|---------|
| NORMAL | `normal` | 所有分位数值正常，无缺失，无负数 | 正常处理 |
| NEGATIVE_VALUE | `negative_value` | 任一分位数值 < 0 | 标记 PENDING_REVIEW |
| MISSING_VALUE | `missing_value` | 任一分位数值为空 / None / NaN | 标记 PENDING_REVIEW |
| **NEGATIVE_TREATED_AS_MISSING** | `negative_treated_as_missing` | 分位数为空，但原始数据有负数痕迹（备注含"实际是-xxx"、"负数""误标为缺失"等关键词，或原始值含负数字符串） | **标记 PENDING_REVIEW，创建复核任务，不急着归正常** |
| OUTLIER | `outlier` | 异常值（后续扩展） | 标记 PENDING_REVIEW |

### 判定优先级

1. 先检查是否有 NEGATIVE_VALUE（分位数值 < 0）
2. 再检查是否有 MISSING_VALUE（分位数值为空）
3. 最后检查是否 NEGATIVE_TREATED_AS_MISSING（为空但原始数据有负数痕迹）

### 负数痕迹检测规则

原始数据中出现以下任一情况即判定为有负数痕迹：
- 单元格值以 "-" 开头且长度 > 1（如 "-500"）
- 备注中包含 "实际是-"、"实为-"、"原是-"
- 备注中同时包含 "负数" 且包含 "缺失"、"为空"、"误标" 等词
- 字符串中匹配正则 `-\d+`（负数字符串模式）

---

## 导入去重规则

### 去重机制
基于文件内容 **SHA256 哈希** 判断是否为同一文件。

### 处理逻辑

| 场景 | 处理方式 | 数量变化 |
|-----|---------|---------|
| 新文件首次导入 | 创建新批次、新记录 | 增加 N 条 |
| **同一文件重复导入（内容完全相同）** | 标记为已去重，**不创建新记录** | 数量 **不变** |
| 同一文件，但运营规划阿岚**只改了一条备注** | 更新现有记录的备注字段，记录历史版本对比 | 数量 **不变**，变更数 += 1 |
| 完全不同的新文件 | 创建新批次、新记录 | 增加 M 条 |

### 版本对比
每次更新自动生成 `RecordHistory`，包含：
- 改前快照（`snapshot_before`）
- 改后快照（`snapshot_after`）
- 变更字段、变更人、变更原因
- 状态变更前后

可通过 `get_version_diff(record_id)` 查看任意两个版本的差异。

---

## 学生助教复核机制

### 复核任务分配
- Step 3 自动创建复核任务，分配给指定学生助教
- 任务状态：待处理 / 已完成

### 复核决策选项

| 决策 | 含义 | 操作 |
|-----|------|------|
| `restore_negative` | 恢复为负数值 | 将分位数值恢复为负数（原来是负数，旧表错标为缺失） | 更新对应分位数字段为负数值 |
| `keep_missing` | 保持缺失 | 确认不是录入错误，保持为空 | 不修改数值，仅标记为 MISSING_VALUE |
| `set_to_normal` | 修改为正常值 | 人工修正为合理正值 | 更新对应分位数字段为正常值 |
| `mark_outlier` | 标记为异常值 | 数据异常，标记为 OUTLIER | 标记边界类型为 OUTLIER |

### 复核留痕
- 所有复核操作全部记录历史，包含：
  - 复核人、复核时间、复核结论
  - 修正值、决策理由
  - 改前改后版本对比

---

## 回滚策略

### 回滚场景
1. 运营规划阿岚改错了
2. 学生助教复核错了
3. 需要恢复到之前的某个版本

### 回滚操作
```python
system.rollback_to_history(
    record_id=123,
    history_id=456,
    operator="alan_ops"
)
```

### 回滚留痕
- 回滚操作本身也会生成一条历史记录
- 变更来源标记为 `ROLLBACK`
- 记录回滚到的历史版本 ID
- 所有操作可追溯

---

## 数据模型

### 核心表结构

#### rating_weight_records（评分权重记录
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 主键 |
| `import_batch_id` | INTEGER | 导入批次 ID |
| `original_row_number` | INTEGER | **原始行号，保留原始行号** |
| `raw_data` | TEXT | **原始数据 JSON，JSON 格式 |
| `current_data` | TEXT | 当前数据 JSON |
| `position` | TEXT | 岗位 |
| `weight_p10` ~ `weight_p90` | REAL | 分位数值 |
| `sample_count` | INTEGER | 样本量 |
| `boundary_type` | TEXT | 边界类型 |
| `status` | TEXT | 处理状态 |
| `remark` | TEXT | 备注 |
| `created_at` / `updated_at` | TEXT | 时间戳 |
| `created_by` / `updated_by` | TEXT | 操作人 |

#### record_histories（历史变更记录
| 字段 | 类型 | 说明 |
|------|------|------|
| `record_id` | INTEGER | 记录 ID |
| `change_source` | TEXT | 变更来源 |
| `field_name` | TEXT | 变更字段 |
| `old_value` / `new_value` | TEXT | 新旧值 |
| `old_status` / `new_status` | TEXT | 状态变更 |
| `snapshot_before` / `snapshot_after` | TEXT | **改前改后快照** |
| `changed_by` | TEXT | 操作人 |
| `change_reason` | TEXT | 变更原因 |

#### import_batches（导入批次
| 字段 | 类型 | 说明 |
|------|------|------|
| `file_hash` | TEXT | 文件哈希，用于去重 |
| `is_deduplicated` | BOOLEAN | 是否已去重 |

#### review_tasks（复核任务
| 字段 | 类型 | 说明 |
|------|------|------|
| `record_id` | INTEGER | 记录 ID |
| `boundary_type` | TEXT | 边界类型 |
| `assigned_to` | TEXT | 分配给 |
| `review_result` | TEXT | 复核结论 |
| `is_completed` | BOOLEAN | 是否已完成 |

---

## 处理状态流转

```
IMPORTED (已导入)
    ↓
PENDING_REVIEW (待复核) ←──┐
    ↓                    │
REVIEWED (已复核)         │ 回滚
    ↓                    │
REVISED (已修正)         │
    ↓                    │
FINALIZED (已定稿)        │
    ↓                    │
ROLLED_BACK (已回滚) ────┘
```

---

## 使用示例

### 完整三步流程

```python
from quantile_calibration import QuantileCalibrationSystem

system = QuantileCalibrationSystem("data/calibration.db")

# 完整执行三步流程
result = system.run_complete_workflow(
    file_path="data/rating_weights.csv",
    import_operator="alan_ops",
    formula_reviewer="alan_ops",
    formula_review_note="对照旧公式截图_2024_v3.png",
    screenshot_reference="旧公式截图，确认高级产品经理 P10 原为 -500，被旧表误标为缺失",
    ta_assignee="ta_xiaoming"
)

# 查看工作流状态
status = system.get_workflow_status(batch_id=1)

# 学生助教获取待复核任务
pending = system.get_pending_review_tasks("ta_xiaoming")

# 学生助教复核
review_result = system.ta_review_record(
    task_id=1,
    record_id=2,
    review_result="经复核，P10 确实是 -500",
    correction_decision="restore_negative",
    corrected_values={"weight_p10": -500},
    ta_name="xiaoming"
)

# 学生助教追问时，回到证据
evidence = system.get_evidence(record_id=2)
print(evidence["original_row_number"])  # 原始行号
print(evidence["raw_data"])       # 原始数据
print(evidence["full_history"])        # 所有历史变更

# 查看版本对比
diff = system.get_version_diff(record_id=2)

# 回滚到历史版本
rollback = system.rollback_to_history(
    record_id=2,
    history_id=5,
    operator="alan_ops"
)
```

### 手动修改记录（只改备注

```python
result = system.manual_edit(
    record_id=1,
    updates={"remark": "已复核，确认数值正常"},
    operator="alan_ops",
    reason="运营规划阿岚复核后修改备注"
)

# 查看改前改后差别
diff = system.get_version_diff(record_id=1)
```

---

## 运行测试

```bash
# 安装依赖
pip install -r requirements.txt

# 运行所有测试
python -m unittest tests.test_calibration_system -v
```

---

## 项目结构

```
quantile_calibration/
├── __init__.py
├── main.py              # 主入口，提供简洁 API
├── models.py            # 数据模型定义
├── database.py          # 数据库操作层
├── boundary_engine.py   # 边界规则引擎（规则硬编码在此
├── importer.py          # 评分权重表导入器（含去重
└── workflow.py         # 工作流程管理器
tests/
├── __init__.py
└── test_calibration_system.py  # 单元测试
data/
├── test_rating_weights_v1.csv
└── test_rating_weights_v1_edited.csv
requirements.txt
README.md
```

---

## 常见问题 Q&A

### Q: 负数样本被旧表当成缺失，系统怎么处理？
A: 自动标记为 `NEGATIVE_TREATED_AS_MISSING`，状态设为 `PENDING_REVIEW`，**不自动归正常**，创建复核任务留给学生助教处理。所有判定规则硬编码在 `boundary_engine.py` 中。

### Q: 重复导入同一批数据，数量会翻倍吗？
A: 不会。基于文件哈希去重，同一文件重复导入不创建新记录。如果文件内容有变更（如只改了备注，只更新差异字段并记录历史。

### Q: 运营规划阿岚只改了一条备注，能看出改前改后差别吗？
A: 能。每次改动都会生成历史快照，通过 `get_version_diff(record_id)` 可以看到改前改后对比。

### Q: 学生助教追问时，能回到证据吗？
A: 能。通过 `get_evidence(record_id)` 可以查看：原始行号、原始数据、所有历史变更、版本对比、复核任务。

### Q: 改错了能回滚吗？
A: 能。通过 `rollback_to_history()` 回滚到任意历史版本，回滚操作本身也留痕。

### Q: 边界规则能口头约定吗？
A: **不能**。所有边界规则全部硬编码在代码中，不靠口头约定。修改规则必须改代码。

---

## 代码中边界规则位置

- 边界类型判定：[boundary_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/boundary_engine.py#L40-L91)
- 负数痕迹检测：[boundary_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/boundary_engine.py#L68-L91)
- 导入去重逻辑：[importer.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/importer.py#L132-L188)
- 三步工作流：[workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/workflow.py#L30-L210)
- 学生助教复核：[workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/workflow.py#L245-L309)
