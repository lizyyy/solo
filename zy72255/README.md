# 矿井巷道支护标记管理系统

## 背景

CAD 图层名后来才补到群里，航测内业小魏回看"矿井巷道支护标记"时才发现巡检照片编号里的结论不能直接照抄。本系统的核心目标：**追证据时不断在半路**。

## 模块结构

```
mine_support_marker/
├── models.py          # 数据模型：MarkerRecord, ChangeEntry, ProcessingStatus, ZAxisConvention
├── repository.py      # 数据仓库：内存存储，按 marker_id / photo_number / batch_id 检索
├── importer.py        # 导入去重：同一批巡检照片编号重复导入不翻倍
├── history.py         # 变更历史：改前改后可追溯，支持按字段回滚
├── z_axis.py          # Z轴方向：检测旧习惯写反，标记待复核，修正/回滚
├── workflow.py        # 三步工作流：导入 → CAD图层名补看 → 路径回放更新
├── late_material.py   # 晚到材料：CAD图层名后补只刷新相关明细，不洗已确认内容
└── boundary.py        # 边界规则：9条规则写入代码，检测/修正/回滚全有据可查
```

## 边界规则（写入代码，不靠口头约定）

### 1. Z轴方向按旧习惯写反 — 检测

- **规则 ID**: `z_axis_reversal_detection`
- **检测方式**: `ZAxisService.detect_convention(z_value)` 检查 z_value 的正负号。标准习惯：向上为正。若 z_value < 0 且预期向上为正，则判定为 `OLD_REVERSED`。
- **代码位置**: [z_axis.py](mine_support_marker/z_axis.py) `ZAxisService.detect_convention()`

### 2. Z轴方向按旧习惯写反 — 不急归正常

- **规则 ID**: `z_axis_no_auto_normalize`
- **核心原则**: 检测到旧习惯写反后，**系统不自动将数值取反归正常**。必须留给现场班组复核确认后再修正。
- **原因**: 防止自动归正常导致现场班组无法追溯原始数据。
- **代码位置**: [z_axis.py](mine_support_marker/z_axis.py) `ZAxisService.flag_z_axis_reversal()` 只标记不修正

### 3. Z轴方向按旧习惯写反 — 现场班组复核

- **规则 ID**: `z_axis_field_team_review`
- **流程**: Z轴方向异常的记录必须经过现场班组复核才能继续三步工作流。路径回放更新（第三步）会拒绝 Z轴待复核的记录。
- **代码位置**: [workflow.py](mine_support_marker/workflow.py) `WorkflowService.step_3_path_replay_update()` 检查 `z_axis_flagged_for_review`

### 4. Z轴方向按旧习惯写反 — 回滚

- **规则 ID**: `z_axis_rollback_allowed`
- **回滚方式**: `ZAxisService.rollback_z_axis_correction()` 可回滚修正，恢复原始值并重新标记待复核。回滚操作本身也会记入 `change_history`。
- **代码位置**: [z_axis.py](mine_support_marker/z_axis.py) `ZAxisService.rollback_z_axis_correction()`

### 5. 已确认字段不可覆盖

- **规则 ID**: `confirmed_field_immutable`
- **保护范围**: 巡检照片编号中已经确认（`confirmed_fields`）的字段，晚到材料刷新时不能覆盖。
- **代码位置**: [history.py](mine_support_marker/history.py) `HistoryService.edit_field()` 检查 `is_field_confirmed()`

### 6. 重复导入不翻倍

- **规则 ID**: `dedup_on_reimport`
- **判定依据**: `photo_number + import_batch_id` 组合唯一。重复导入同一批巡检照片编号时，已存在的记录不重复创建，记入 `skipped_duplicates`。
- **代码位置**: [importer.py](mine_support_marker/importer.py) `MarkerImporter.import_rows()` / `reimport_rows()`

### 7. 晚到材料不洗已确认内容

- **规则 ID**: `late_material_no_overwrite`
- **原则**: CAD图层名晚上才补进来时，只刷新相关明细（如 `cad_layer_name`），不把巡检照片编号里已经确认的内容（如 `conclusion`、`remark`）洗掉。
- **代码位置**: [late_material.py](mine_support_marker/late_material.py) `LateMaterialService.apply_cad_layer_late_arrival()`

### 8. 状态流转顺序

- **规则 ID**: `status_transition_order`
- **流转链**: `IMPORTED` → `CAD_LAYER_REVIEWED` → `PATH_REPLAY_UPDATED` → `FIELD_TEAM_CONFIRMED` / `FIELD_TEAM_REJECTED`
- **子状态**: `Z_AXIS_FLAGGED` 是 `IMPORTED` 的子状态，修正后回到 `CAD_LAYER_REVIEWED`
- **代码位置**: [workflow.py](mine_support_marker/workflow.py) 各 step 方法检查前置状态

### 9. 变更历史保留

- **规则 ID**: `change_history_retention`
- **内容**: 每一条人工改动都记入 `change_history`，包括字段名、改动前值、改动后值、操作人、时间、原因。改前改后的差别必须可追溯。
- **代码位置**: [models.py](mine_support_marker/models.py) `MarkerRecord.apply_change()`

## 三步工作流

```
第一步：巡检照片编号首次导入
  ↓ （Z轴方向异常自动标记待复核，不急归正常）
第二步：航测内业小魏补看CAD图层名
  ↓ （Z轴待复核时仍可补看，但不允许进入第三步）
第三步：路径回放更新
  ↓ （Z轴待复核的记录被拒绝，必须等现场班组确认）
```

### 工作流示例

```python
from mine_support_marker.repository import MarkerRepository
from mine_support_marker.workflow import WorkflowService
from mine_support_marker.importer import ImportRow

repo = MarkerRepository()
workflow = WorkflowService(repo)

# 第一步：巡检照片编号首次导入
rows = [
    ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常", z_axis_value=-120.5),
    ImportRow(photo_number="IMG_002", line_number=2, conclusion="需复检", z_axis_value=80.0),
]
results = workflow.step_1_import(rows, batch_id="batch_20260603", operator="系统")
# IMG_001 的 Z轴值 < 0 → 自动标记 z_axis_flagged_for_review=True

# 第二步：航测内业小魏补看CAD图层名
marker_id = results[0].marker_id
result = workflow.step_2_review_cad_layer(marker_id, "支护图层-A01", "小魏")
# 即使 Z轴待复核，仍可补看CAD图层名

# 第三步：路径回放更新（Z轴待复核的记录会被拒绝）
result = workflow.step_3_path_replay_update(marker_id, {"remark": "路径回放备注"}, "系统")
# result.success == False, message 包含 "Z轴方向按旧习惯写反，归正常前需现场班组复核确认"

# 现场班组复核后修正Z轴
from mine_support_marker.z_axis import ZAxisService
z_service = ZAxisService(repo)
z_service.correct_z_axis(marker_id, "班组确认", "现场班组确认Z轴方向需修正")

# 修正后可进入第三步
result = workflow.step_3_path_replay_update(marker_id, {"remark": "路径回放备注"}, "系统")
# result.success == True
```

## 晚到材料流程

CAD 图层名晚上才补进来时，只刷新相关明细，不把巡检照片编号里已经确认的内容洗掉。

```python
from mine_support_marker.late_material import LateMaterialService

late = LateMaterialService(repo)

# 先确认巡检照片编号中的结论
record = repo.find_by_photo_number("IMG_001")[0]
record.confirm_field("conclusion")
record.confirm_field("remark")

# CAD图层名晚到，只刷新 cad_layer_name，不动 conclusion 和 remark
results = late.apply_cad_layer_late_arrival("IMG_001", "支护图层-A01", "小魏")
# fields_updated: ["cad_layer_name", "status"]
# fields_protected: ["conclusion", "remark"]
```

## 变更历史与证据追溯

航测内业小魏只改了一条备注时，历史里要能看出改前改后的差别：

```python
from mine_support_marker.history import HistoryService

history = HistoryService(repo)

# 小魏改备注
history.edit_field(marker_id, "remark", "支护正常，需复检", "小魏", "航测内业补看")

# 追溯改前改后
fh = history.get_field_history(marker_id, "remark")
for entry in fh.entries:
    print(f"{entry.changed_by} 将 {entry.field_name} 从 '{entry.old_value}' 改为 '{entry.new_value}'")
    print(f"  时间: {entry.changed_at}, 原因: {entry.reason}")

# 回滚到改前
history.rollback_field(marker_id, "remark", "admin", "回滚备注修改")
```

## Z轴方向按旧习惯写反 — 完整处理流程

```
检测（自动）: ZAxisService.detect_convention() / scan_batch_for_reversals()
    ↓ z_value < 0, 预期向上为正
标记（自动）: ZAxisService.flag_z_axis_reversal()
    → z_axis_flagged_for_review = True
    → z_axis_convention = OLD_REVERSED
    → status = Z_AXIS_FLAGGED
    ↓
不急归正常: 系统不自动将 z_value 取反
    ↓
现场班组复核:
    ├─ 确认 → ZAxisService.correct_z_axis()
    │         → z_value 取反, convention = STANDARD, flagged = False
    └─ 否决 → 保持原值，或 ZAxisService.rollback_z_axis_correction() 回滚
```

**回滚能力**: 修正后如果发现修正有误，`rollback_z_axis_correction()` 可恢复原始值，回滚操作本身也记入 `change_history`。

## 运行测试

```bash
python3 -m pytest tests/ -v -p no:asyncio
```

## 数据模型关键字段

| 字段 | 说明 |
|------|------|
| `photo_number` | 巡检照片编号 |
| `original_line_number` | 原始行号（导入时保留，不随后续修改变化） |
| `cad_layer_name` | CAD 图层名（可能晚到） |
| `z_axis_value` | Z 轴值 |
| `z_axis_convention` | Z 轴习惯标记：STANDARD / OLD_REVERSED |
| `z_axis_flagged_for_review` | Z 轴方向是否待现场班组复核 |
| `conclusion` | 结论 |
| `remark` | 备注 |
| `status` | 当前处理状态 |
| `import_batch_id` | 导入批次 ID（与 photo_number 组合做去重判定） |
| `confirmed_fields` | 已确认字段集合（不可被晚到材料覆盖） |
| `change_history` | 变更历史列表（每条含 field_name, old_value, new_value, changed_by, changed_at, reason） |
