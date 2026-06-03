from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional


class BoundaryRuleId(Enum):
    Z_AXIS_REVERSAL_DETECTION = "z_axis_reversal_detection"
    Z_AXIS_NO_AUTO_NORMALIZE = "z_axis_no_auto_normalize"
    Z_AXIS_FIELD_TEAM_REVIEW = "z_axis_field_team_review"
    Z_AXIS_ROLLBACK_ALLOWED = "z_axis_rollback_allowed"
    CONFIRMED_FIELD_IMMUTABLE = "confirmed_field_immutable"
    DEDUP_ON_REIMPORT = "dedup_on_reimport"
    LATE_MATERIAL_NO_OVERWRITE = "late_material_no_overwrite"
    STATUS_TRANSITION_ORDER = "status_transition_order"
    CHANGE_HISTORY_RETENTION = "change_history_retention"


@dataclass
class BoundaryRule:
    rule_id: BoundaryRuleId
    title: str
    description: str
    detect: str
    correct: str
    rollback: str
    examples: list[str]


BOUNDARY_RULES: dict[BoundaryRuleId, BoundaryRule] = {
    BoundaryRuleId.Z_AXIS_REVERSAL_DETECTION: BoundaryRule(
        rule_id=BoundaryRuleId.Z_AXIS_REVERSAL_DETECTION,
        title="Z轴方向按旧习惯写反 — 检测",
        description=(
            "当巡检照片编号中Z轴值的符号与标准习惯不符时（标准：向上为正），"
            "系统自动检测为「旧习惯写反」。"
            "检测依据：z_axis_value 的正负号与预期方向不一致。"
        ),
        detect=(
            "ZAxisService.detect_convention(z_value) "
            "检查 z_value 的正负号。"
            "若 z_value < 0 且预期向上为正，则判定为 OLD_REVERSED。"
        ),
        correct="不自动修正，标记 z_axis_flagged_for_review=True，等待现场班组复核。",
        rollback="N/A（检测阶段不涉及修正）",
        examples=[
            "z_value=-120.5, 预期向上为正 → 检测为 OLD_REVERSED",
            "z_value=120.5, 预期向上为正 → 检测为 STANDARD",
        ],
    ),
    BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE: BoundaryRule(
        rule_id=BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE,
        title="Z轴方向按旧习惯写反 — 不急归正常",
        description=(
            "检测到Z轴旧习惯写反后，系统不自动将数值取反归正常。"
            "必须留给现场班组复核确认后再修正。"
            "这是为了防止自动归正常导致现场班组无法追溯原始数据。"
        ),
        detect="z_axis_flagged_for_review=True 时即触发此规则。",
        correct=(
            "仅在现场班组确认后才可调用 ZAxisService.correct_z_axis()，"
            "将 z_axis_value 取反并标记 z_axis_convention=STANDARD。"
        ),
        rollback=(
            "ZAxisService.rollback_z_axis_correction() 可回滚修正，"
            "恢复原始值并重新标记待复核。"
        ),
        examples=[
            "检测到 z=-120.5 → 不自动改为 120.5，标记待复核",
            "现场班组确认后 → 修正为 z=120.5",
            "现场班组否决 → 保持原值 z=-120.5",
        ],
    ),
    BoundaryRuleId.Z_AXIS_FIELD_TEAM_REVIEW: BoundaryRule(
        rule_id=BoundaryRuleId.Z_AXIS_FIELD_TEAM_REVIEW,
        title="Z轴方向按旧习惯写反 — 现场班组复核",
        description=(
            "Z轴方向异常的记录必须经过现场班组复核才能继续三步工作流。"
            "路径回放更新（第三步）会拒绝 Z轴待复核的记录。"
        ),
        detect="status=Z_AXIS_FLAGGED 时触发。",
        correct=(
            "现场班组确认后，调用 correct_z_axis()，"
            "状态变为 CAD_LAYER_REVIEWED 或 PATH_REPLAY_UPDATED。"
        ),
        rollback="现场班组否决后，调用 rollback_z_axis_correction() 保持原值。",
        examples=[
            "Z_AXIS_FLAGGED → 现场班组确认 → correct_z_axis → CAD_LAYER_REVIEWED",
            "Z_AXIS_FLAGGED → 现场班组否决 → 保持 Z_AXIS_FLAGGED",
        ],
    ),
    BoundaryRuleId.Z_AXIS_ROLLBACK_ALLOWED: BoundaryRule(
        rule_id=BoundaryRuleId.Z_AXIS_ROLLBACK_ALLOWED,
        title="Z轴方向按旧习惯写反 — 回滚",
        description=(
            "Z轴修正后如果发现修正有误，可以回滚到修正前的值。"
            "回滚操作本身也会记入 change_history。"
        ),
        detect="z_axis_convention 从 OLD_REVERSED 变为 STANDARD 后又需要退回。",
        correct="调用 rollback_z_axis_correction() 恢复原始值。",
        rollback="回滚操作本身可再次回滚（理论上），但建议谨慎。",
        examples=[
            "z=-120.5(OLD_REVERSED) → 修正为 120.5(STANDARD) → 回滚到 -120.5(OLD_REVERSED)",
        ],
    ),
    BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE: BoundaryRule(
        rule_id=BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE,
        title="已确认字段不可覆盖",
        description=(
            "巡检照片编号中已经确认（confirmed_fields）的字段，"
            "晚到材料刷新时不能覆盖。这是防止 CAD 图层名后补时洗掉已有结论。"
        ),
        detect="字段名在 record.confirmed_fields 集合中。",
        correct="晚到材料流程跳过已确认字段，仅刷新未确认字段。",
        rollback="确认操作本身不可回滚（防止误操作需另行处理）。",
        examples=[
            "conclusion 已确认 → 晚到 CAD 图层名刷新时跳过 conclusion",
            "remark 未确认 → 晚到 CAD 图层名刷新时可更新 remark",
        ],
    ),
    BoundaryRuleId.DEDUP_ON_REIMPORT: BoundaryRule(
        rule_id=BoundaryRuleId.DEDUP_ON_REIMPORT,
        title="重复导入不翻倍",
        description=(
            "重复导入同一批巡检照片编号时，已存在的记录不重复创建。"
            "判定依据：photo_number + import_batch_id 组合唯一。"
        ),
        detect="MarkerImporter 查找 photo_number + batch_id 是否已存在。",
        correct="已存在则跳过，记录到 skipped_duplicates。",
        rollback="N/A（跳过的记录未创建，无需回滚）",
        examples=[
            "第一次导入 photo_001(batch_abc) → 创建",
            "第二次导入 photo_001(batch_abc) → 跳过，不翻倍",
        ],
    ),
    BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE: BoundaryRule(
        rule_id=BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE,
        title="晚到材料不洗已确认内容",
        description=(
            "CAD图层名晚上才补进来时，只刷新相关明细（如 cad_layer_name），"
            "不把巡检照片编号里已经确认的内容（如 conclusion、remark）洗掉。"
        ),
        detect="晚到材料流程检查每个字段的 confirmed 状态。",
        correct="仅更新未确认的字段，已确认的列入 fields_protected。",
        rollback="晚到材料更新记入 change_history，可按字段回滚。",
        examples=[
            "CAD图层名晚到 → 仅更新 cad_layer_name，conclusion 已确认则不动",
        ],
    ),
    BoundaryRuleId.STATUS_TRANSITION_ORDER: BoundaryRule(
        rule_id=BoundaryRuleId.STATUS_TRANSITION_ORDER,
        title="状态流转顺序",
        description=(
            "矿井巷道支护标记的状态必须按顺序流转："
            "IMPORTED → CAD_LAYER_REVIEWED → PATH_REPLAY_UPDATED → FIELD_TEAM_CONFIRMED/REJECTED。"
            "Z_AXIS_FLAGGED 是 IMPORTED 的子状态，修正后回到 CAD_LAYER_REVIEWED。"
        ),
        detect="WorkflowService 在每一步检查当前状态是否允许进入下一步。",
        correct="不允许跳步，返回错误信息。",
        rollback="状态变更记入 change_history，可按记录回滚。",
        examples=[
            "IMPORTED → CAD_LAYER_REVIEWED → PATH_REPLAY_UPDATED ✓",
            "IMPORTED → PATH_REPLAY_UPDATED ✗（跳步不允许）",
            "Z_AXIS_FLAGGED → 现场确认 → CAD_LAYER_REVIEWED ✓",
        ],
    ),
    BoundaryRuleId.CHANGE_HISTORY_RETENTION: BoundaryRule(
        rule_id=BoundaryRuleId.CHANGE_HISTORY_RETENTION,
        title="变更历史保留",
        description=(
            "每一条人工改动都记入 change_history，包括字段名、改动前值、改动后值、"
            "操作人、时间、原因。改前改后的差别必须可追溯。"
        ),
        detect="MarkerRecord.apply_change() 自动记录。",
        correct="HistoryService.edit_field() 确保每次编辑产生 ChangeEntry。",
        rollback="HistoryService.rollback_field/rollback_to_entry 支持按字段回滚。",
        examples=[
            "小魏改备注 remark: '支护正常' → '支护正常，需复检' → 历史可见两次值",
        ],
    ),
}


def get_boundary_rule(rule_id: BoundaryRuleId) -> Optional[BoundaryRule]:
    return BOUNDARY_RULES.get(rule_id)


def get_all_boundary_rules() -> list[BoundaryRule]:
    return list(BOUNDARY_RULES.values())


def validate_boundary(
    rule_id: BoundaryRuleId, context: dict[str, Any]
) -> tuple[bool, str]:
    rule = BOUNDARY_RULES.get(rule_id)
    if rule is None:
        return False, f"边界规则 {rule_id.value} 不存在"

    if rule_id == BoundaryRuleId.DEDUP_ON_REIMPORT:
        already_exists = context.get("already_exists", False)
        if already_exists:
            return True, "记录已存在，跳过重复导入"
        return True, "记录不存在，允许导入"

    if rule_id == BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE:
        is_confirmed = context.get("is_confirmed", False)
        if is_confirmed:
            return False, "字段已确认，不可覆盖"
        return True, "字段未确认，允许更新"

    if rule_id == BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE:
        is_flagged = context.get("z_axis_flagged", False)
        auto_correct = context.get("auto_correct", False)
        if is_flagged and auto_correct:
            return False, "Z轴方向异常，不自动归正常，需现场班组复核"
        return True, "Z轴方向正常或已由现场班组确认"

    if rule_id == BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE:
        confirmed_fields = context.get("confirmed_fields", set())
        target_field = context.get("target_field", "")
        if target_field in confirmed_fields:
            return False, f"字段 {target_field} 已确认，晚到材料不可覆盖"
        return True, f"字段 {target_field} 未确认，允许晚到材料刷新"

    if rule_id == BoundaryRuleId.STATUS_TRANSITION_ORDER:
        current = context.get("current_status", "")
        required = context.get("required_status", "")
        if current != required and current not in (
            ProcessingStatus.Z_AXIS_FLAGGED.value
            if "Z_AXIS_FLAGGED" in str(context)
            else ""
        ):
            return False, f"当前状态 {current} 不满足前置条件 {required}"
        return True, "状态流转顺序正确"

    return True, "边界规则校验通过"
