# 低温罐液位换算系统

## 一、系统概述

本系统用于训练教练老唐管理低温罐液位巡检数据的录入、换算、复核全流程。核心目标是解决**传感器重启后编号变化**导致的数据混乱问题，确保每一条数据都可追溯、可复核、可回滚。

---

## 二、边界规则（写在代码里的约定）

### 🔴 规则 1：传感器重启编号变更处理

**现象**：传感器重启后，系统分配的编号可能发生变化（如 S-001 变成 S-001-new），导致同一点位的数据被误认为是两个不同传感器。

**判定逻辑**（见 [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L107-L159) `_detect_sensor_change` 方法）：
1. 导入新数据时，若传感器编号不在已注册列表中，触发匹配检测
2. 基于液位值相似度（差值 < 5% 加 0.4 分）和温度相似度（差值 < 2℃ 加 0.3 分）计算匹配置信度
3. 置信度 ≥ 0.5 时，判定为"传感器重启后编号可能变化"

**处理方式**：
- 自动创建 `SensorMapping` 记录，标记 `PENDING_REVIEW`（待安全员复核）
- 关联的液位换算记录状态设为 `pending_review`，**不自动并入正常统计**
- 此时记录不可修改、不可推进工作流

**怎么改**（安全员复核流程）：
1. 调用 `review_sensor_mapping(old_id, new_id, approved=True)`
2. 若确认是同一传感器：
   - 旧传感器标记为非活跃（is_active=False）
   - 新传感器继承旧传感器的物理位置和罐区信息
   - 所有关联记录状态恢复为 `normal`
3. 若判定不是同一传感器：标记为 `rejected`，记录保留但不合并

**怎么回滚**：
- 复核前：无需回滚，记录本身就是待复核状态
- 复核后：目前不支持撤销复核，需联系管理员手动处理
- 重要：**经过安全员确认的修改，不允许通过 rollback 接口回滚**（见 [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L322-L324)）

---

### 🟡 规则 2：重复导入不翻倍

**现象**：老唐重复导入同一批手写巡检备注，导致液位换算数量翻倍。

**判定逻辑**（见 [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L34-L40) `_compute_batch_hash` 方法）：
1. 每批导入生成唯一 `batch_id`
2. 对批次内所有记录（按传感器编号+记录时间排序）计算 SHA-256 内容哈希
3. 若同一 `batch_id` 的哈希已存在且完全一致，拒绝导入

**处理方式**：
- 抛出 `DUPLICATE_IMPORT` 错误，提示用户使用"修改单条备注"功能
- 若同一 `batch_id` 但内容不同（真的是修改后重传），允许覆盖，但会保留修改历史

---

### 🟢 规则 3：单条修改留痕

**现象**：老唐只改了一条备注的某个数字，需要看出改前改后的差别。

**处理逻辑**（见 [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L193-L262) `update_single_note` 方法）：
1. 每次修改前，对比每个字段的新旧值
2. 对每个发生变化的字段，创建一条 `ChangeHistory` 记录，包含：
   - `field_name`：字段名
   - `old_value` / `new_value`：修改前后的值
   - `changed_by`：修改人（默认"老唐"）
   - `change_reason`：修改原因
3. 若修改的是 `level_reading`，自动同步更新换算后的液位值，并额外记录换算记录的变更历史

**查看历史**：调用 `get_change_history(record_id)` 获取该记录的所有修改轨迹，按时间倒序排列。

---

## 三、三步工作流

### 流程图
```
第一步：手写巡检备注导入
          ↓
   [若检测到传感器编号变化] → 标记待复核，暂停流程
          ↓ （复核通过后自动继续）
第二步：训练教练老唐补看安全阈值表
          ↓
第三步：安全提醒更新
```

### Step 1：首次导入巡检备注
- 接口：`import_inspection_notes(batch_id, notes_data)`
- 输出：巡检备注列表、液位换算记录列表、检测到的传感器映射列表
- 状态：`STEP_1_NOTES_IMPORTED`

### Step 2：安全阈值复核
- 前置条件：记录状态为 `normal`（非待复核）
- 接口：`workflow.step_2_review_threshold(record_id, threshold_verified=True)`
- 操作：老唐对照安全阈值表，确认液位换算是否在合理范围内
- 状态变更：`STEP_1_NOTES_IMPORTED` → `STEP_2_THRESHOLD_REVIEWED`
- 异常：若记录正在待安全员复核，报错"当前记录等待安全员复核，暂时不能修改"

### Step 3：安全提醒更新
- 前置条件：已完成 Step 2
- 接口：`workflow.step_3_update_safety_reminder(record_id, safety_note)`
- 操作：录入安全提醒内容（如"液位偏低，注意补加"）
- 状态变更：`STEP_2_THRESHOLD_REVIEWED` → `STEP_3_SAFETY_UPDATED`

### ⚠️ 工作流边界规则
1. **不允许跳步**：未完成 Step 1 不能直接到 Step 2，报错提示"请先完成第一步"
2. **待复核记录暂停工作流**：检测到传感器编号变化的记录，在安全员复核前，不能推进任何工作流步骤
3. **不可逆**：工作流状态只能前进，不能后退。如需撤销，使用 `rollback_record` 接口（但经过安全员确认的记录不可回滚）

---

## 四、3D / 图表展示复核机制

### 设计原则
> 不要只剩漂亮画面——点到任何数据点，都要能回到原始依据

### 点选回溯（Drill-down）
调用 [visualization.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/visualization.py#L108-L117) `visualization.drilldown(target_type, target_id)`：

| target_type | 返回内容 | 应用场景 |
|------------|----------|----------|
| `note` | 手写巡检备注原文、传感器信息、关联的阈值表、修改历史 | 图表上点一个数据点 → 回到老唐的手写记录 |
| `sensor` | 传感器位置、历史读数、待复核的编号变更记录 | 3D 视图点一个传感器 → 看有没有编号变化问题 |
| `threshold` | 安全阈值表详情、安全范围/预警范围 | 点阈值线 → 看具体阈值定义 |
| `record` | 完整上下文（记录+备注+传感器+阈值+映射+全部历史） | 详情页展示完整溯源链 |

### 3D 视图特殊标记
- 待复核的传感器显示红色边框，`is_pending_review: true`
- 点击后优先展示编号变更证据（液位相似度、温度相似度）
- 提供一键跳转到"安全员复核"界面的入口

---

## 五、错误提示规范

**所有错误提示必须说人话，不暴露内部字段名。**

完整错误列表见 [errors.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/errors.py#L8-L20)：

| 错误码 | 提示文案 | 场景 |
|--------|----------|------|
| `DUPLICATE_IMPORT` | 这批巡检备注已经导入过了，不需要重复导入。如果是修改内容，请使用'修改单条备注'功能。 | 重复导入同一批数据 |
| `SENSOR_ID_CHANGED` | 检测到传感器编号可能发生了变化（传感器重启后常见现象）。已标记待安全员复核，请勿直接覆盖原有数据。 | 检测到传感器编号可能变化 |
| `INVALID_LEVEL_VALUE` | 液位值 {value} 不在合理范围内（0-100），请检查手写记录是否正确。 | 液位值超出 0-100 |
| `WORKFLOW_NOT_READY` | 当前步骤还没完成，不能跳到下一步。请先完成 {current_step}。 | 工作流跳步 |
| `CANNOT_ROLLBACK` | 无法回滚到该状态，因为中间有其他修改已经过安全员确认。 | 回滚被安全员确认过的记录 |
| `RECORD_UNDER_REVIEW` | 这条记录当前正在等待安全员复核，暂时不能修改。 | 尝试修改待复核记录 |
| `MISSING_REQUIRED_FIELD` | 缺少必填信息：{field_name}。请补充完整后再提交。 | 字段缺失（使用中文名称） |

---

## 六、快速开始

```python
from cryo_tank_level import (
    CryoTankLevelSystem,
    ThreeStepWorkflow,
    VisualizationService,
    SafetyThreshold,
)
from datetime import datetime

# 初始化系统
system = CryoTankLevelSystem()
workflow = ThreeStepWorkflow(system)
viz = VisualizationService(system)

# 1. 注册传感器和安全阈值
system.register_sensor("S-001", "A罐顶部", "A罐")
threshold = SafetyThreshold(
    threshold_id="TH-A",
    tank_name="A罐",
    min_safe_level=20.0,
    max_safe_level=80.0,
    warning_low=15.0,
    warning_high=85.0,
)
system.storage.save_safety_threshold(threshold)

# 2. 第一步：导入手写巡检备注
batch = [
    {
        "sensor_id": "S-001",
        "level_reading": 45.2,
        "temperature": -180.5,
        "handwritten_note": "A罐液位正常，外观无异常",
        "recorded_at": datetime.now().isoformat(),
    }
]
notes, records, mappings = system.import_inspection_notes("BATCH-001", batch, imported_by="老唐")
record_id = records[0].record_id

# 3. 第二步：老唐复核安全阈值
workflow.step_2_review_threshold(record_id, threshold_verified=True, reviewed_by="老唐")

# 4. 第三步：更新安全提醒
workflow.step_3_update_safety_reminder(record_id, safety_note="液位正常，无需处理")

# 5. 查看工作流状态
summary = workflow.get_workflow_summary(record_id)
print(f"当前状态: {summary['current_state_name']}")

# 6. 生成图表数据（含点选回溯信息）
chart_data = viz.generate_chart_data("A罐")
for point in chart_data["data_points"]:
    # 点击后可通过 drilldown 回到原始备注
    detail = viz.drilldown("note", point["drilldown_target"]["note_id"])
    print(f"手写备注原文: {detail['handwritten_content']}")
```

---

## 七、回滚操作

```python
# 回滚到上一版本（需确保没有安全员确认过的修改）
try:
    rolled_back = system.rollback_record(record_id, reason="数据录入错误")
    print(f"已回滚: {rolled_back.review_notes}")
except Exception as e:
    print(f"回滚失败: {e}")  # 可能是因为有安全员确认过的修改
```

---

## 八、文件结构

```
cryo_tank_level/
├── __init__.py          # 对外暴露的接口
├── models.py            # 数据模型定义
├── errors.py            # 错误提示（全中文，无内部字段）
├── storage.py           # JSON 存储层
├── core.py              # 核心业务逻辑（导入、去重、传感器变更检测、修改历史）
├── workflow.py          # 三步工作流引擎
└── visualization.py     # 3D/图表数据生成 + 点选回溯
tests/
└── test_core.py         # 核心功能测试
README.md                # 本文档（边界规则、操作流程全部写在这里）
```

---

## 九、关键代码位置速查

| 功能 | 文件 | 方法/行号 |
|------|------|-----------|
| 传感器重启编号检测 | [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L107-L159) | `_detect_sensor_change` |
| 重复导入哈希校验 | [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L34-L53) | `_compute_batch_hash` + 导入校验 |
| 单条修改历史记录 | [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L193-L262) | `update_single_note` |
| 安全员复核接口 | [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L272-L308) | `review_sensor_mapping` |
| 三步工作流 | [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/workflow.py) | `ThreeStepWorkflow` 类 |
| 点选回溯 | [visualization.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/visualization.py#L108-L189) | `drilldown` + 各 `_drilldown_to_*` 方法 |
| 回滚逻辑（含安全员确认保护） | [core.py](file:///Users/lzy/pro/solo/workspaces/zy72395/cryo_tank_level/core.py#L313-L345) | `rollback_record` |
