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

### 两级去重策略（写死在代码里，绝不简单翻倍）

| 级别 | 判定依据 | 适用场景 |
|-----|---------|---------|
| **Level 1: 文件哈希** | 文件内容 SHA256 完全相同 | 完全同一个文件反复导入 |
| **Level 2: 业务主键** | 岗位 `position` + 原始行号 `original_row_number` | 内容有差异（如只改了一条备注），但实际是同一份数据 |

### 处理逻辑

| 场景 | 处理方式 | 数量变化 |
|-----|---------|---------|
| 全新的文件，所有岗位+行号都是新的 | 创建新批次、新记录 | 增加 N 条 |
| **同一文件重复导入（哈希相同）** | 标记为已去重，**不创建新记录** | **不变** |
| **内容不同，但岗位+行号与已有完全重合（如只改了一条备注）** | 更新差异字段，记录历史对比，**绝不新建记录** | **不变**，变更数 += 改了多少条 |
| 内容不同，有部分新的岗位+行号，部分已存在 | 已存在的合并更新，新增的创建新记录 | 新增条数 = 新出现的业务主键数 |

### 版本对比
每次更新（无论 Level 1 还是 Level 2 去重）自动生成 `RecordHistory`，包含：
- 改前快照（`snapshot_before`）、改后快照（`snapshot_after`）
- 变更字段、变更人、变更原因
- 状态变更前后
- 可通过 `get_version_diff(record_id)` / `get_detail_view(record_id)` 查看任意两次版本差异

### 字段级保护：人工确认值不被重复导入覆盖

**核心规则（硬编码）**：已由学生助教复核（`ta_review`）或人工修改（`manual_edit`）确认的字段，重复导入时**绝对不覆盖**。

| 字段最后修改来源 | 重复导入相同字段 | 处理方式 |
|----------------|-----------------|---------|
| `initial_import` / `re_import` / `boundary_detection` | 值不同 | 正常更新，记录历史 |
| **`ta_review`**（学生助教复核） | 值不同 | **保留人工确认值，不覆盖** |
| **`manual_edit`**（运营手动修改） | 值不同 | **保留人工确认值，不覆盖** |

### 冲突承接：不留下空的待复核状态

当重复导入的值与人工确认值冲突时：
1. 保留人工确认值（不覆盖）
2. 生成新的复核任务，分配给 `ta_conflict_resolver`
3. 任务备注写清：冲突字段、人工确认值、导入值、处理建议
4. 状态保持 `pending_review`，有明确的待办承接链路

**验证方式**：运行 [verify_reimport_protection.py](file:///Users/lzy/pro/solo/workspaces/zy72314/verify_reimport_protection.py) 完整复现：
导入→TA复核恢复P10=-500→重复导入→P10仍为-500→冲突待办已生成→所有视图同源一致

---

## 统一视图层：同源一致

### 设计原则
所有展示（列表、详情、摘要、导出、报告）全部来自同一份数据源：
`get_all_active_records()` —— 同业务主键（岗位+原始行号）只返回最新的一条记录。

### 包含的视图

| 视图 | 调用方式 | 说明 | 同源保证 |
|-----|---------|------|---------|
| **列表** | `get_list_view()` | 展示 ID、行号、岗位、分位数、状态、边界类型、待处理任务 | ✅ 来自 `get_all_active_records()` |
| **详情** | `get_detail_view()` | 原始说法、改后值、处理原因、处理时间线、下一步找谁 | ✅ 同一条记录 ID，与列表同源 |
| **摘要** | `get_summary_view()` | 总数、按状态统计、按边界类型统计 | ✅ 同一份数据聚合 |
| **导出** | `export_csv()` / `export_records()` | CSV/JSON，含历史留痕 | ✅ 列表的总数 = 导出的总数 |
| **边界报告** | `generate_boundary_report_view()` | 边界问题明细、下一步联系人 | ✅ 列表的边界数 = 报告的边界数 |
| **一致性校验** | `verify_consistency()` | 检查以上视图是否全部一致 | ✅ 自检接口 |

### 一致性校验示例
```python
check = system.verify_consistency(batch_id)
print(check["consistency_passed"])  # True/False
print(check["checks"])
# {
#   'list_total': 20, 'summary_total': 20,
#   'export_total': 20, 'report_total': 20,
#   'all_totals_match': True,
#   'detail_status_consistent': True
# }
```

### 详情视图：人工复核全留痕
`get_detail_view(record_id)` 返回以下关键信息，**绝不提前归到正常结果**：

```
{
  "original_row_number": 3,                 // 原始行号，证据追溯
  "original_values": {                      // 原始说法
    "weight_p10": None,
    "weight_p25": 15000, ...
  },
  "current_values": {                       // 改后的值
    "weight_p10": -500,
    "weight_p25": 15000, ...
  },
  "value_changes": [                        // 改前改后差别
    {"field": "weight_p10", "original_value": None, "current_value": -500}
  ],
  "status": "revised",
  "boundary_type": "negative_value",
  "processing_reasons": [                   // 处理原因（全链路）
    "[首次导入] alan_ops: 智能合并导入...",
    "[学生助教复核] ta_xiaoming: TA复核结论: restore_negative; 经与旧公式截图核对..."
  ],
  "processing_history": [                   // 处理时间线
    {step: 1, action: "首次导入", operator: "alan_ops", reason: "...", time: "..."}
    {step: 2, action: "学生助教复核", operator: "ta_xiaoming", reason: "...", time: "..."}
  ],
  "next_step": {                            // 下一步找谁
    "step": "已修正待确认",
    "assigned_to": ["运营规划"],
    "instruction": "已由学生助教修正，等待运营规划阿岚确认后可定标"
  }
}
```

---

## 学生助教复核机制

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

## 操作路速查：安装→启动→走完整条链路

### 1. 安装
```bash
cd /path/to/project
python3 -m pip install -r requirements.txt
```

### 2. 启动（创建系统实例）
```python
from quantile_calibration import QuantileCalibrationSystem
system = QuantileCalibrationSystem("data/quantile_calibration.db")
```

### 3. Step 1：导入评分权重表
```python
step1 = system.step1_import("data/rating_weights.csv", operator="alan_ops")
batch_id = step1["batch_id"]
print(step1["import_result"]["note"])
# 业务主键级智能合并（岗位+行号）：新增 0 条，更新 0 条，...
```

### 4. 导入 v2（只改了一条备注，内容不同但业务主键相同 → 不翻倍
```python
step1b = system.step1_import("data/rating_weights_edited.csv", operator="alan_ops")
print(step1b["import_result"]["is_duplicate"])       # True
print(step1b["import_result"]["duplicate_level"])    # business_key
print(step1b["import_result"]["total_count"]) # 20 → 数量不变
```

### 5. Step 2：运营规划阿岚补看旧公式截图
```python
step2 = system.step2_review_formula(
    batch_id=batch_id,
    reviewed_by="alan_ops",
    review_note="对照旧公式截图，确认高级产品经理 P10 原为 -500，旧表误标为缺失",
    screenshot_reference="旧公式截图_2024_v3.png"
)
```

### 6. Step 3：边界样本报告更新
```python
step3 = system.step3_boundary_report(
    batch_id=batch_id,
    operator="alan_ops",
    ta_assignee="ta_xiaoming"
)
print("创建复核任务数:", len(step3["review_tasks_created"]))
print(step3["note"])
# 负数被旧表当成缺失的 N 条样本已留待学生助教复核，未自动归正常
```

### 7. 手动改一条备注
```python
edit_result = system.manual_edit(
    record_id=1,
    updates={"remark": "运营规划阿岚复核：已与 HR 确认"},
    operator="alan_ops",
    reason="补充复核备注"
)
print("改前改后可查：", edit_result["version_diffs"])
```

### 8. 学生助教复核
```python
pending = system.get_pending_review_tasks("ta_xiaoming")
task = pending["tasks"][0]

review = system.ta_review_record(
    task_id=task["task_id"],
    record_id=task["record_id"],
    review_result="经与旧公式截图交叉核对，P10 确实是-500，旧表误标",
    correction_decision="restore_negative",
    corrected_values={"weight_p10": -500},
    ta_name="xiaoming"
)
print("复核后状态：", review["updated_status"])
```

### 9. 同源一致性检查
```python
check = system.verify_consistency(batch_id)
print(check["consistency_passed"])  # True ✅
print(check["note"])
# 列表/详情/摘要/导出/报告全部来自 get_all_active_records()，同源一致
```

### 10. 查看详情（全留痕
```python
detail = system.get_detail_view(task["record_id"])
print("原始行号：", detail["original_row_number"])
print("原始说法：", detail["original_values"])
print("改后的值：", detail["current_values"])
print("处理原因：", detail["processing_reasons"])
print("下一步找谁：", detail["next_step"]["assigned_to"])
```

### 11. 导出 CSV + 边界报告
```python
system.export_csv("data/final_export.csv", batch_id)
report = system.generate_boundary_report_view(batch_id)
```

---

## 常见问题 Q&A

### Q: 负数样本被旧表当成缺失，系统怎么处理？
A: 自动标记为 `NEGATIVE_TREATED_AS_MISSING`，状态设为 `PENDING_REVIEW`，**不自动归正常**，创建复核任务留给学生助教处理。所有判定规则硬编码在 `boundary_engine.py` 中。

### Q: 重复导入同一批数据，数量会翻倍吗？
A: 不会。**两级去重**：
- Level 1：文件哈希相同 → 不创建新记录
- Level 2：岗位+行号相同但内容有差异 → 更新差异字段，绝不新建记录

### Q: 运营规划阿岚只改了一条备注，能看出改前改后差别吗？
A: 能。每次改动都会生成历史快照，通过 `get_version_diff(record_id)` 或 `get_detail_view(record_id)` 可以看到改前改后对比。

### Q: 学生助教追问时，能回到证据吗？
A: 能。通过 `get_detail_view(record_id)` 可以查看：**原始行号、原始说法、改后的值、处理原因、处理时间线、下一步找谁。

### Q: 列表、详情、摘要、导出、报告数据一致吗？
A: **一致**。全部来自同一份数据源 `get_all_active_records()`，可通过 `verify_consistency()` 自检。

### Q: 改错了能回滚吗？
A: 能。通过 `rollback_to_history()` 回滚到任意历史版本，回滚操作本身也留痕。

### Q: 边界规则能口头约定吗？
A: **不能**。所有边界规则全部硬编码在代码中，不靠口头约定。修改规则必须改代码。

---

## 代码中关键逻辑位置

- 边界类型判定：[boundary_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/boundary_engine.py#L40-L91)
- 负数痕迹检测：[boundary_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/boundary_engine.py#L68-L91)
- 两级去重逻辑：[importer.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/importer.py#L46-L218)
- 三步工作流：[workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/workflow.py#L30-L210)
- 学生助教复核：[workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/workflow.py#L245-L309)
- 统一视图层（同源）：[views.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/views.py)
- 一致性校验：[main.py](file:///Users/lzy/pro/solo/workspaces/zy72314/quantile_calibration/main.py#L227-L269)
