# 电磁铁吸力标定 - 温度校准记录管理系统

## 概述

本系统用于管理电磁铁吸力标定过程中的温度校准记录，重点解决温度校准记录与传感器编号之间的一致性问题，确保可追溯、可回滚、可审计。

## 核心特性

- ✅ **保留原始行号** - 每条温度校准记录保留 `original_line_no`，安全员可追溯到导入文件的原始位置
- ✅ **变更历史追踪** - 所有人工改动都记录在 `change_history`，包含改前改后的值、操作人、时间、原因
- ✅ **幂等导入** - 同一批记录重复导入不会导致数量翻倍
- ✅ **差异检测** - 重新导入时仅更新有变化的字段，每个字段变更独立记录
- ✅ **三步工作流** - 导入 → 工程师审核 → 安全员复核
- ✅ **传感器重启检测** - 传感器重启后编号变更自动标记，不自动归正常，留待安全员复核
- ✅ **边界规则代码化** - 所有规则同时记录在代码（`boundary.py`）和本文档

## 目录结构

```
em_calibrator/
├── __init__.py
├── models.py      # 数据模型定义
├── db.py          # SQLite 数据库层
├── importer.py    # 导入与幂等逻辑
├── workflow.py    # 工作流状态机
└── boundary.py   # 边界规则
tests/
├── __init__.py
└── test_em_calibrator.py   # 单元测试
```

## 三步工作流

### 第一步：导入温度校准记录

```python
from em_calibrator.db import Database
from em_calibrator.importer import import_records

db = Database("calibration.db")

records = [
    {
        "original_line_no": 2,
        "sensor_id": "S-001",
        "equipment_position": "POS-01",
        "temperature_value": 25.5,
        "caliber": "DN50",
        "remark": "初始记录",
    }
]

batch_id, created, updated = import_records(db, records, source_file="20260604.csv")
```

**导入后状态**：记录状态为 `imported`

### 第二步：设备工程师何工补看传感器编号

```python
from em_calibrator.workflow import engineer_review

# 工程师审核每条记录
for rec in db.get_records_by_batch(batch_id):
    engineer_review(db, rec.id, operator="何工", note="传感器编号已核对")
```

**审核后状态**：
- 如果该设备位号上次记录的传感器编号一致 → `safety_review`（待安全员审核）
- 如果传感器编号不一致（重启过）→ `sensor_changed`（标记异常，等待安全员复核）

### 第三步：安全员复核

```python
from em_calibrator.workflow import safety_review

# 审核通过
safety_review(db, record_id, operator="安全员", approve=True)

# 审核不通过（回滚）
safety_review(db, record_id, operator="安全员", approve=False, note="传感器编号变更未确认")
```

**审核后状态**：
- 正常审核通过 → `completed`
- 传感器变更被批准 → `completed`
- 被拒绝 → 回滚传感器编号，状态回到 `engineer_review`

## 边界规则（Boundary Rules）

所有规则定义在 [boundary.py](file:///Users/lzy/pro/solo/workspaces/zy72364/em_calibrator/boundary.py#L66-L87) 的 `BOUNDARY_RULES` 字典中。

### 1. 传感器重启（sensor_restart）

- **判定**：同一 `equipment_position`（设备位号）下，新导入记录的 `sensor_id` 与该位号最近一次历史记录的 `sensor_id` 不一致
- **处理**：自动标记为 `sensor_changed` 状态，创建 `SensorMapping` 记录，**绝不自动归为正常，必须经过安全员复核
- **回滚**：安全员可以拒绝，系统自动将 `sensor_id` 回滚到旧值，记录回退到 `engineer_review` 状态

### 2. 口径不一致（caliber_mismatch）

- **判定**：同一 `equipment_position` 下，新记录的 `caliber`（口径）与历史记录不一致
- **处理**：返回警告信息，工程师必须确认后才能继续
- **回滚**：工程师可手动改回原口径

### 3. 重复导入（duplicate_import）

- **判定**：通过 `batch_hash`（对所有记录内容哈希）判断是否已存在相同批次
- **处理**：直接返回已存在的 `batch_id`，不写入任何新数据，计数为 0
- **回滚**：无需回滚，未写入数据

### 4. 状态转移（status_transition）

状态机定义在 [models.py](file:///Users/lzy/pro/solo/workspaces/zy72364/em_calibrator/models.py#L89-L102) 的 `STATUS_TRANSITIONS`：

```
imported → engineer_review
engineer_review → safety_review | sensor_changed
sensor_changed → safety_review
safety_review → completed | sensor_changed | engineer_review
completed → engineer_review
```

## 可追溯性设计

### 温度校准记录证据链

```python
from em_calibrator.importer import get_record_with_evidence

evidence = get_record_with_evidence(db, record_id)
print(f"原始行号：{evidence['original_line_no']}")
print(f"当前状态：{evidence['current_status']}")
for ch in evidence['change_history']:
    print(f"{ch.changed_at} {ch.change_type}: {ch.field_name} {ch.old_value} → {ch.new_value}")
```

### 完整审计追踪

```python
from em_calibrator.workflow import get_full_audit_trail

audit = get_full_audit_trail(db, record_id)
print("变更历史：", audit["change_history"])
print("工作流日志：", audit["workflow_log"])
```

### 变更类型（ChangeType）

- `import` - 初始导入
- `manual_edit` - 人工修改字段
- `sensor_remap` - 传感器编号重新映射
- `rollback` - 回滚操作
- `status_change` - 状态变更

## 重新导入（补录返工）

当同一批记录部分字段有修改时，使用 `reimport_records` 不会重复创建记录，只会更新变化的字段：

```python
from em_calibrator.importer import reimport_records

# 假设只改了一条备注
modified_records = original_records.copy()
modified_records[0]["remark"] = "何工补充：已复核"

batch_id, created, updated = reimport_records(
    db, modified_records, source_file="20260604.csv", operator="何工"
)
# 返回 updated = 1（只有备注改了）
# 变更历史会记录 remark 从 "初始记录" → "何工补充：已复核"
```

## 传感器重启编号变更完整流程

```python
# 第一次导入（传感器 S-001 → completed

# 传感器重启后，编号变成 S-999
# 工程师审核时自动检测到变化
engineer_review(db, record_id, operator="何工")
# → 状态变为 sensor_changed，不自动归正常

# 安全员复核
# 批准 → 传感器变更被认可，流程继续
safety_review(db, record_id, operator="安全员", approve=True)

# 或拒绝 → 传感器 ID 回滚到 S-001
safety_review(db, record_id, operator="安全员", approve=False)
```

## 回滚机制

手动回滚到工程师审核状态：

```python
from em_calibrator.workflow import rollback_to_engineer_review

rollback_to_engineer_review(
    db, record_id, operator="安全员", reason="数据有误，需重新核对"
)
```

## 运行测试

```bash
python3 -m unittest tests.test_em_calibrator -v
```

## 数据模型

### TemperatureRecord

- `id` - 主键
- `batch_id` - 批次ID
- `original_line_no` - **原始行号**（导入文件中的行号）
- `sensor_id` - 传感器编号
- `equipment_position` - 设备位号
- `temperature_value` - 温度值
- `caliber` - 口径
- `remark` - 备注
- `status` - 处理状态
- `created_at` / `updated_at` - 创建/更新时间

### ChangeHistory

- `record_id` - 关联记录ID
- `change_type` - 变更类型
- `field_name` - 变更字段
- `old_value` / `new_value` - 改前改后值
- `changed_by` - 操作人
- `changed_at` - 变更时间
- `reason` - 变更原因

### SensorMapping

- `equipment_position` - 设备位号
- `old_sensor_id` - 旧传感器编号
- `new_sensor_id` - 新传感器编号
- `verdict` - 安全员复核结果（pending/approved/rejected）

## 常见场景

### 错口径处理

1. 导入时检测到口径不一致，返回警告
2. 工程师确认是否继续或修正口径
3. 如为录入错误则修正后重新导入
4. 如为实际变更则备注说明

### 补录返工

1. 导出原始记录，修改需要改动的字段
2. 使用 `reimport_records` 重新导入
3. 系统自动检测差异，只更新变化字段
4. 每条变更都记录在 `change_history`

### 传感器重启编号变了

1. 工程师审核时自动检测到编号变化
2. 系统标记为 `sensor_changed`，**不自动归正常
3. 安全员复核：
   - 批准 → 流程继续，记录批准人
   - 拒绝 → 自动回滚传感器编号，退回工程师

## 维护说明

- 所有规则变更需同时更新：
  1. `boundary.py` 中的 `BOUNDARY_RULES` 字典
  2. 本 README 对应章节
  3. 相关测试用例
