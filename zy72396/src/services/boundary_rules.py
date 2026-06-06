from typing import Optional, Tuple, Dict, List
from ..models.photo import WorkingConditionPhoto
from ..models.base import ChangeRecord
from ..models.enums import (
    ProcessingStatus,
    TemperatureUnit,
    UserRole,
    ChangeType,
)
from ..utils.temperature import normalize_to_celsius, celsius_to_kelvin, kelvin_to_celsius


BOUNDARY_RULES_DOC = """
# 机械表摆轮误差 - 边界规则

## 1. 摄氏度和开尔文混用判定规则

### 1.1 触发条件
当同一工况照片的温度数据中同时出现以下情况时，判定为"摄氏度/开尔文混用"：
- 文本中同时包含摄氏度标识（°C, C, 摄氏度）和开尔文标识（K, 开尔文）
- 同一行数据中出现多个温度值且单位不一致

### 1.2 自动处理流程
1. **禁止自动归为正常**：系统不得自动修正或忽略混用情况
2. **强制进入教练复核**：状态自动设为 `COACH_REVIEW_PENDING`
3. **保留原始证据**：`temperature_raw` 字段必须完整保留原始文本，不得修改

### 1.3 判定标记
- `has_mixed_units = True`
- `temperature_unit = MIXED`
- `error_status = COACH_REVIEW_PENDING`

---

## 2. 混用情况修改规则

### 2.1 允许修改的角色
- 仅 `COACH`（训练教练）角色可修改混用标记
- `LIN_TEACHER` 可补充备注，但不能改变状态或单位

### 2.2 修改操作
1. 教练需指定最终采用的单位（CELSIUS 或 KELVIN）
2. 系统自动转换温度值
3. 记录完整变更历史：旧值、新值、操作人、时间、备注

### 2.3 修改后状态流转
- 修改完成后，状态变为 `COACH_APPROVED`
- 保留 `has_mixed_units = True` 作为历史标记，方便追溯

---

## 3. 回滚规则

### 3.1 允许回滚的条件
- 任何已完成的修改操作都可回滚
- 回滚操作仅限 `COACH` 或更高权限角色

### 3.2 回滚操作
1. 指定回滚到的版本号（基于 change_history）
2. 恢复所有字段到该版本时的状态
3. 新增一条 ROLLBACK 类型的变更记录
4. 标记 `is_rollbacked = True` 和 `rollback_to_version`

### 3.3 回滚后状态
- 状态恢复到目标版本时的 `error_status`
- 所有变更历史保留，回滚记录追加到末尾

---

## 4. 重复导入规则

### 4.1 去重逻辑
- 唯一键：`source_file + file_name + original_row_number`
- 同一照片重复导入时，不创建新记录

### 4.2 重复导入时的处理
- 仅更新有变化的字段（如 handwritten_remark）
- 每条变更都记录到 change_history
- 不增加计数，不重复统计

---

## 5. 历史追溯要求

### 5.1 必须保留的信息
- 原始行号：`original_row_number`
- 原始温度文本：`temperature_raw`（永不修改）
- 每次人工改动的：操作人、时间、字段、旧值、新值、备注
- 当前处理状态：`error_status`

### 5.2 追溯路径
训练教练追问时，可通过以下路径追溯：
1. 找到目标照片（按行号或文件名）
2. 查看 `change_history` 列表
3. 按版本号对比每次改动
4. 必要时回滚到任意历史版本
"""


class BoundaryRuleService:
    def __init__(self):
        self.rules_doc = BOUNDARY_RULES_DOC

    def check_mixed_units(self, photo: WorkingConditionPhoto) -> bool:
        return photo.has_mixed_units

    def requires_coach_review(self, photo: WorkingConditionPhoto) -> bool:
        return photo.error_status == ProcessingStatus.COACH_REVIEW_PENDING

    def coach_fix_mixed_units(
        self,
        photo: WorkingConditionPhoto,
        final_unit: TemperatureUnit,
        coach_remark: str,
        operator: UserRole = UserRole.COACH,
    ) -> Tuple[bool, str]:
        if operator != UserRole.COACH:
            return False, "Only coach can fix mixed units"

        if not photo.has_mixed_units:
            return False, "No mixed units to fix"

        old_unit = photo.temperature_unit
        old_value = photo.temperature_value
        old_status = photo.error_status

        if final_unit == TemperatureUnit.CELSIUS:
            if old_unit == TemperatureUnit.KELVIN and old_value is not None:
                new_value = kelvin_to_celsius(old_value)
            else:
                new_value = old_value
        elif final_unit == TemperatureUnit.KELVIN:
            if old_unit == TemperatureUnit.CELSIUS and old_value is not None:
                new_value = celsius_to_kelvin(old_value)
            else:
                new_value = old_value
        else:
            return False, f"Invalid final unit: {final_unit}"

        photo.temperature_unit = final_unit
        photo.temperature_value = new_value
        photo.error_status = ProcessingStatus.COACH_APPROVED

        change = ChangeRecord(
            operator=operator,
            change_type=ChangeType.TEMPERATURE_UNIT_FIX,
            field_name="temperature_unit/temperature_value",
            old_value=f"unit={old_unit}, value={old_value}, status={old_status}",
            new_value=f"unit={final_unit}, value={new_value}, status={ProcessingStatus.COACH_APPROVED}",
            remark=coach_remark,
        )
        photo.add_change(change)

        return True, "Mixed units fixed by coach"

    def rollback_to_version(
        self,
        photo: WorkingConditionPhoto,
        target_version: int,
        operator: UserRole,
        rollback_remark: str,
    ) -> Tuple[bool, str]:
        if operator != UserRole.COACH:
            return False, "Only coach can perform rollback"

        if target_version < 0 or target_version >= len(photo.change_history):
            return False, f"Invalid version: {target_version}"

        target_change = photo.change_history[target_version]

        status_before_target = ProcessingStatus.IMPORTED
        for i in range(target_version + 1):
            ch = photo.change_history[i]
            if ch.change_type == ChangeType.STATUS_CHANGE:
                if ch.new_value:
                    try:
                        status_before_target = ProcessingStatus(ch.new_value)
                    except ValueError:
                        pass

        photo.error_status = status_before_target
        photo.is_rollbacked = True
        photo.rollback_to_version = target_version

        rollback_change = ChangeRecord(
            operator=operator,
            change_type=ChangeType.ROLLBACK,
            old_value=f"version={photo.version}, status={photo.error_status}",
            new_value=f"rolled back to version={target_version}",
            remark=rollback_remark,
        )
        photo.add_change(rollback_change)

        return True, f"Rolled back to version {target_version}"

    def get_audit_trail(self, photo: WorkingConditionPhoto) -> List[Dict]:
        trail = []
        for idx, change in enumerate(photo.change_history):
            trail.append(
                {
                    "version": idx,
                    "timestamp": change.timestamp.isoformat(),
                    "operator": change.operator.value,
                    "change_type": change.change_type.value,
                    "field": change.field_name,
                    "old_value": change.old_value,
                    "new_value": change.new_value,
                    "remark": change.remark,
                }
            )
        return trail

    def compare_versions(
        self, photo: WorkingConditionPhoto, v1: int, v2: int
    ) -> Optional[Dict]:
        if v1 < 0 or v1 >= len(photo.change_history):
            return None
        if v2 < 0 or v2 >= len(photo.change_history):
            return None

        c1 = photo.change_history[v1]
        c2 = photo.change_history[v2]

        return {
            "version_1": {
                "timestamp": c1.timestamp.isoformat(),
                "operator": c1.operator.value,
                "change_type": c1.change_type.value,
                "value": c1.new_value,
                "remark": c1.remark,
            },
            "version_2": {
                "timestamp": c2.timestamp.isoformat(),
                "operator": c2.operator.value,
                "change_type": c2.change_type.value,
                "value": c2.new_value,
                "remark": c2.remark,
            },
        }
