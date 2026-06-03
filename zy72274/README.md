# 应急救援楼层剖面 (Rescue Floor Profile)

> 代码即规则，规则即代码。所有边界判定逻辑与 `boundary_rules.py` 保持同源。

---

## 一、核心设计原则

### 1.1 不做过度清洗
CAD 图层名的备注经常比正式表还重要，**永远不要**把图层备注洗成一行干净数据。

- `cad_layers.layer_name`：完整保留原始图层名（含所有备注、括号内说明）
- `cad_layers.layer_remark`：许工补录的备注单独存储，便于检索
- `inspection_photos.raw_data`：完整保留每次导入的原始 JSON

### 1.2 证据链可追溯
不怕界面简单，怕的是结论看着很满，追证据时断在半路。

- 每个 3D 数据点、每个图表数据，都携带 `_source_refs` 溯源引用
- 点击可追溯到：巡检照片编号、CAD 图层名、原始导入数据
- 所有修改写入 `change_history`，可对比、可回滚

### 1.3 异常不自动修正
碰到补录路线未重新计算长度时，别急着归正常，留给展陈客户复核。

- 检测到异常 → 标记 `needs_review = True`
- 状态保持 `pending`，**绝不自动**设为 `normal`
- 只有客户复核完成，才能解除待复核状态

---

## 二、边界规则清单

> 代码实现见 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72274/boundary_rules.py)

### RULE_001: 补录路线长度未重新计算

**判定条件**（满足任一即触发）：
1. `has_recalculated_length == False`
2. `route_length` 为空
3. 路线长度与历史值差异 > 5%

**处理方式**：
- 设置 `needs_review = True`
- 设置 `length_mismatch = True`
- `status` 保持为 `pending`，不归为 `normal`
- 留给展陈客户复核，不自动修正

**修改流程**：
1. 在 3D/图表中点击数据点，追溯到巡检照片编号
2. 重新计算路线长度
3. 调用 `resolve_length_mismatch(profile_id, new_length, operator, recalculated=True)`
4. 系统自动标记 `has_recalculated_length = True`，写入变更历史

**回滚方式**：
1. 在 `change_history` 表中找到对应记录
2. 检查 `rollback_possible == True`
3. 调用 `HistoryService.rollback(history_id, operator)`
4. 系统恢复旧值，并写入新的历史记录标记 `rolled_back = True`

---

### RULE_002: 重复导入同一批巡检照片编号

**判定条件**：
- 数据库中已存在相同的 `photo_number`

**处理方式**：
- 跳过该条记录的导入
- `duplicate_count` 计数 +1
- `new_count` 不增加
- 不更新已有记录的任何字段（含备注）
- **不**会导致"应急救援楼层剖面"数量翻倍

---

### RULE_003: 修改CAD图层备注历史追踪

**判定条件**：
- `layer_remark` 或 `layer_name` 字段值发生变化

**处理方式**：
- 自动写入 `change_history` 表
- 完整保留 `old_value`（修改前备注）
- 完整保留 `new_value`（修改后备注）
- 记录 `changed_by` 操作人
- 支持 `compare_history(history_id)` 查看改前改后差别

---

### RULE_004: 工作流步骤跳过

**判定条件**：
- 推进 `workflow_step` 时，目标步骤索引 > 当前步骤索引 + 1

**处理方式**：
- 阻止步骤推进
- 设置 `needs_review = True`
- 返回错误信息提示缺失的步骤

---

### RULE_005: 未复核就导出

**判定条件**：
- `needs_review == True` 或 `length_mismatch == True` 时调用导出

**处理方式**：
- 阻止导出
- 返回错误信息："存在待复核项，请先完成复核再导出"

---

## 三、三步工作流

### 流程图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  巡检照片导入   │───▶│ CAD图层补看     │───▶│ 导出截图更新     │
│  photo_import   │    │ cad_layer_review│    │ export_screenshot│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
  检查 RULE_001           许工补录备注               检查 RULE_005
  length_mismatch?     RULE_003 记录历史        needs_review 必须为 False
          │                       │
  是→标记待复核              是→写入 change_history
  否→继续                   否→无操作
```

### 步骤详解

#### Step 1: 巡检照片编号第一次导入

**操作**：调用 `ImportService.import_photos(records, source_file, operator)`

**自动检查**：
- RULE_002：跳过重复编号，不计入数量
- RULE_001：检查路线长度是否重新计算

**产出**：
- `InspectionPhoto` 记录（含 `raw_data`）
- `RescueProfile` 记录，`workflow_step = "photo_import"`
- 如存在长度问题：`needs_review = True`, `length_mismatch = True`

#### Step 2: 设备工程师许工补看CAD图层名

**操作**：调用 `WorkflowService.advance_step(profile_id, "许工", cad_data={...})`

**自动检查**：
- RULE_004：不能从 Step 1 直接跳到 Step 3
- RULE_003：修改备注自动记录历史

**注意**：
- `layer_name` 完整保留，含所有备注
- `layer_remark` 单独存储许工补录内容
- `has_remark = True` 标记存在备注

#### Step 3: 导出截图更新

**操作**：调用 `WorkflowService.advance_step(profile_id, operator, screenshot_path=...)`

**前置检查 RULE_005**：
- `needs_review` 必须为 `False`
- `length_mismatch` 必须为 `False`
- 否则阻止导出

**如果卡在 Step 1 和 Step 2 之间**：
- 原因：检测到 `length_mismatch == True`
- 处理：不要硬推，调用 `complete_customer_review()` 让客户复核
- 复核通过后才能继续推进

---

## 四、数据模型

### inspection_photos - 巡检照片

| 字段 | 类型 | 说明 |
|------|------|------|
| `photo_number` | VARCHAR(100) | 唯一键，巡检照片编号 |
| `route_length` | FLOAT | 巡检路线长度 |
| `has_recalculated_length` | BOOLEAN | 是否已重新计算长度（RULE_001） |
| `raw_data` | TEXT | **完整原始导入数据，不做任何清洗** |
| `import_batch_id` | VARCHAR(100) | 导入批次号 |

### cad_layers - CAD图层

| 字段 | 类型 | 说明 |
|------|------|------|
| `layer_name` | VARCHAR(200) | **完整图层名，含所有备注** |
| `layer_name_clean` | VARCHAR(100) | 清洗后的图层名（仅展示用） |
| `layer_remark` | TEXT | 许工补录的备注 |
| `has_remark` | BOOLEAN | 是否存在备注 |
| `reviewed_by` | VARCHAR(50) | 复核人，如"许工" |

### rescue_profiles - 应急救援楼层剖面

| 字段 | 类型 | 说明 |
|------|------|------|
| `profile_type` | VARCHAR(20) | 2d / 3d / chart |
| `length_mismatch` | BOOLEAN | RULE_001 触发标记 |
| `needs_review` | BOOLEAN | 是否需要客户复核 |
| `status` | VARCHAR(20) | pending / reviewed / normal / abnormal |
| `workflow_step` | VARCHAR(50) | 当前工作流步骤 |

### change_history - 变更历史

| 字段 | 类型 | 说明 |
|------|------|------|
| `field_name` | VARCHAR(100) | 修改的字段名 |
| `old_value` | TEXT | **修改前完整值（含备注）** |
| `new_value` | TEXT | **修改后完整值（含备注）** |
| `rollback_possible` | BOOLEAN | 是否可回滚 |
| `rolled_back` | BOOLEAN | 是否已被回滚 |
| `rollback_from_id` | INTEGER | 从哪条历史回滚 |

---

## 五、快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化数据库

```python
from database import Base, engine
from models import *

Base.metadata.create_all(bind=engine)
```

### 运行完整工作流演示

```python
from database import SessionLocal
from services.workflow_service import WorkflowService

db = SessionLocal()
workflow = WorkflowService(db)

# 模拟补录路线未重新计算长度（触发 RULE_001）
photo_data = {
    "photo_number": "INSP-2026-0001",
    "floor": "B1F",
    "location_x": 100.5,
    "location_y": 200.3,
    "location_z": -5.0,
    "route_length": 45.2,
    "has_recalculated_length": False  # 触发 RULE_001
}

cad_layers = [
    {
        "layer_name": "WALL-B1F-001【防火墙+耐火极限3h+许工复核2026.06.01】",
        "layer_remark": "此处为新增防火墙，原图纸漏标，需重点关注",
        "layer_material": "混凝土",
        "layer_thickness": 0.3
    }
]

result = workflow.run_complete_workflow(
    photo_data=photo_data,
    cad_layers_data=cad_layers,
    operator="许工"
)

print(result["needs_customer_review"])  # True - 留给客户复核
```

---

## 六、常见操作示例

### 1. 对比许工修改备注的前后差别

```python
from services.history_service import HistoryService

history = HistoryService(db)
diff = history.compare_history(history_id=1)

print("改前:", diff["before"]["value"])
print("改后:", diff["after"]["value"])
print("差异:\n", diff["diff"])
```

### 2. 从3D视图追溯到原始数据

```python
from services.display_service import DisplayService

display = DisplayService(db)
source = display.trace_to_source(profile_id=1, point_index=0)

print("巡检照片编号:", source["photo_number"])
print("CAD图层名:", [l["layer_name"] for l in source["cad_layers"]])
print("是否存在长度问题:", source.get("length_issue", {}).get("has_issue"))
```

### 3. 回滚误操作

```python
from services.history_service import HistoryService

history = HistoryService(db)
rollback_record = history.rollback(history_id=1, rolled_back_by="管理员")

print("回滚完成，新历史记录ID:", rollback_record.id)
```

### 4. 客户复核完成

```python
from services.workflow_service import WorkflowService

workflow = WorkflowService(db)
profile = workflow.complete_customer_review(
    profile_id=1,
    reviewed_by="客户代表",
    review_result="accepted",  # accepted / rejected / needs_recalculation
    remarks="同意按现有长度处理，已与现场确认"
)

print("复核后状态:", profile.status)  # abnormal (因为 length_mismatch 仍为 True)
print("是否还需复核:", profile.needs_review)  # False
```

---

## 七、代码目录结构

```
.
├── config.py              # 配置（工作流步骤、数据库路径）
├── database.py            # 数据库连接
├── models.py              # 数据模型（5张表）
├── boundary_rules.py      # 边界规则引擎（5条核心规则）
├── services/
│   ├── __init__.py
│   ├── import_service.py      # 导入服务（去重）
│   ├── history_service.py     # 历史服务（追踪+回滚）
│   ├── display_service.py     # 展示服务（3D/图表可追溯）
│   └── workflow_service.py    # 工作流服务（三步流程）
├── tests/
│   └── test_rescue_profile.py # 单元测试
├── requirements.txt
└── README.md
```

---

## 八、版本信息

- 规则版本：1.0
- 最后更新：2026-06-03
- 规则代码与本文档同源，修改时需同时更新两处
