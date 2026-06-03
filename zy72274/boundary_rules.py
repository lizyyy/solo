from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from enum import Enum
from datetime import datetime


class LengthMismatchDecision(str, Enum):
    PENDING_REVIEW = "pending_review"
    MARK_ABNORMAL = "mark_abnormal"
    RECALCULATE = "recalculate"
    ROLLBACK = "rollback"
    ACCEPT_AS_IS = "accept_as_is"


class BoundaryRuleCode(str, Enum):
    ROUTE_LENGTH_NOT_RECALCULATED = "RULE_001"
    DUPLICATE_PHOTO_IMPORT = "RULE_002"
    REMARK_MODIFIED_WITHOUT_REVIEW = "RULE_003"
    WORKFLOW_SKIP_STEP = "RULE_004"
    EXPORT_WITHOUT_REVIEW = "RULE_005"


@dataclass
class BoundaryCheckResult:
    rule_code: BoundaryRuleCode
    passed: bool
    message: str
    decision: LengthMismatchDecision
    evidence: Dict
    can_rollback: bool = True


class BoundaryRuleEngine:
    """
    应急救援楼层剖面 - 边界规则引擎
    ======================================
    代码即规则，规则即代码。所有判定逻辑同时写入 README。

    边界规则清单（代码版）：
    RULE_001: 补录路线没有重新计算长度
      - 判定: has_recalculated_length == False 且 路线长度为空或与历史值差异>5%
      - 处理: 标记 needs_review=True，status='pending'，不归为 normal
      - 回滚: 可回滚到重新计算前状态
      - 修改: 重算长度 → 标记已重算 → 自动复核

    RULE_002: 重复导入同一批巡检照片编号
      - 判定: photo_number 已存在
      - 处理: 跳过导入，不计入新数量，duplicate_count++
      - 回滚: 不可回滚（仅计数不修改数据）

    RULE_003: 修改CAD图层备注
      - 判定: layer_remark 新旧值不同
      - 处理: 写入 change_history，保留 old_value 和 new_value
      - 回滚: 可回滚到修改前状态

    RULE_004: 跳过工作流步骤
      - 判定: workflow_step 推进时缺失上一步标记
      - 处理: 阻止推进，needs_review=True
      - 回滚: 可回滚到上一步

    RULE_005: 未复核就导出
      - 判定: needs_review == True 时调用 export
      - 处理: 阻止导出，提示先复核
    """

    RULE_DOCS = {
        BoundaryRuleCode.ROUTE_LENGTH_NOT_RECALCULATED: {
            "name": "补录路线长度未重新计算",
            "判定条件": [
                "has_recalculated_length 标记为 False",
                "route_length 为空，或与历史记录中该照片路线长度差异 > 5%"
            ],
            "处理方式": [
                "设置 needs_review = True",
                "status 保持为 'pending'，不归为 'normal'",
                "length_mismatch = True",
                "留给展陈客户复核，不自动修正"
            ],
            "修改流程": [
                "1. 点击数据点追溯到巡检照片编号",
                "2. 重新计算路线长度",
                "3. 标记 has_recalculated_length = True",
                "4. 写入变更历史，记录修改人"
            ],
            "回滚方式": [
                "1. 在 change_history 中找到对应记录",
                "2. 检查 rollback_possible = True",
                "3. 执行 rollback() 恢复旧值",
                "4. 写入新的历史记录标记 rolled_back = True"
            ]
        },
        BoundaryRuleCode.DUPLICATE_PHOTO_IMPORT: {
            "name": "重复导入巡检照片编号",
            "判定条件": "数据库中已存在相同的 photo_number",
            "处理方式": [
                "跳过该条记录的导入",
                "duplicate_count 计数 +1",
                "new_count 不增加",
                "不更新已有记录的任何字段（含备注）"
            ]
        },
        BoundaryRuleCode.REMARK_MODIFIED_WITHOUT_REVIEW: {
            "name": "备注修改历史追踪",
            "判定条件": "layer_remark 或 layer_name 字段值发生变化",
            "处理方式": [
                "自动写入 change_history 表",
                "完整保留 old_value（修改前备注）",
                "完整保留 new_value（修改后备注）",
                "记录 changed_by 操作人"
            ]
        },
        BoundaryRuleCode.WORKFLOW_SKIP_STEP: {
            "name": "工作流步骤跳过",
            "判定条件": "推进 workflow_step 时，上一步骤未完成标记",
            "处理方式": "阻止步骤推进，设置 needs_review = True"
        },
        BoundaryRuleCode.EXPORT_WITHOUT_REVIEW: {
            "name": "未复核导出",
            "判定条件": "needs_review = True 时调用导出",
            "处理方式": "阻止导出，返回错误信息提示先完成复核"
        }
    }

    @classmethod
    def check_route_length(cls, photo_data: Dict) -> BoundaryCheckResult:
        """RULE_001: 检查补录路线是否重新计算了长度"""
        has_recalculated = photo_data.get("has_recalculated_length", True)
        route_length = photo_data.get("route_length")
        historical_length = photo_data.get("historical_route_length")

        mismatch = False
        evidence = {
            "has_recalculated_length": has_recalculated,
            "current_length": route_length,
            "historical_length": historical_length
        }

        if not has_recalculated:
            mismatch = True
            message = "补录路线未重新计算长度，标记待复核"
        elif route_length is None:
            mismatch = True
            message = "路线长度为空，标记待复核"
        elif historical_length is not None and historical_length > 0:
            diff_pct = abs(route_length - historical_length) / historical_length * 100
            evidence["diff_percentage"] = round(diff_pct, 2)
            if diff_pct > 5:
                mismatch = True
                message = f"路线长度与历史值差异 {diff_pct:.1f}%，超过5%阈值，标记待复核"

        if mismatch:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.ROUTE_LENGTH_NOT_RECALCULATED,
                passed=False,
                message=message,
                decision=LengthMismatchDecision.PENDING_REVIEW,
                evidence=evidence,
                can_rollback=True
            )

        return BoundaryCheckResult(
            rule_code=BoundaryRuleCode.ROUTE_LENGTH_NOT_RECALCULATED,
            passed=True,
            message="路线长度校验通过",
            decision=LengthMismatchDecision.ACCEPT_AS_IS,
            evidence=evidence,
            can_rollback=False
        )

    @classmethod
    def check_duplicate_import(cls, photo_number: str, exists: bool) -> BoundaryCheckResult:
        """RULE_002: 检查重复导入"""
        if exists:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.DUPLICATE_PHOTO_IMPORT,
                passed=False,
                message=f"照片编号 {photo_number} 已存在，跳过导入，不计入数量",
                decision=LengthMismatchDecision.ACCEPT_AS_IS,
                evidence={"photo_number": photo_number, "exists": True},
                can_rollback=False
            )

        return BoundaryCheckResult(
            rule_code=BoundaryRuleCode.DUPLICATE_PHOTO_IMPORT,
            passed=True,
            message=f"照片编号 {photo_number} 为新数据",
            decision=LengthMismatchDecision.ACCEPT_AS_IS,
            evidence={"photo_number": photo_number, "exists": False},
            can_rollback=False
        )

    @classmethod
    def check_remark_change(cls, field_name: str, old_value: str, new_value: str) -> BoundaryCheckResult:
        """RULE_003: 检查备注修改"""
        if old_value != new_value:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.REMARK_MODIFIED_WITHOUT_REVIEW,
                passed=True,
                message=f"{field_name} 已修改，历史记录已保存",
                decision=LengthMismatchDecision.ACCEPT_AS_IS,
                evidence={
                    "field": field_name,
                    "old_value": old_value,
                    "new_value": new_value
                },
                can_rollback=True
            )

        return BoundaryCheckResult(
            rule_code=BoundaryRuleCode.REMARK_MODIFIED_WITHOUT_REVIEW,
            passed=True,
            message="字段值未变化",
            decision=LengthMismatchDecision.ACCEPT_AS_IS,
            evidence={"field": field_name},
            can_rollback=False
        )

    @classmethod
    def check_workflow_step(cls, current_step: str, target_step: str, steps: List[str]) -> BoundaryCheckResult:
        """RULE_004: 检查工作流步骤是否跳步"""
        if current_step not in steps or target_step not in steps:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.WORKFLOW_SKIP_STEP,
                passed=False,
                message="无效的工作流步骤",
                decision=LengthMismatchDecision.PENDING_REVIEW,
                evidence={"current": current_step, "target": target_step},
                can_rollback=True
            )

        current_idx = steps.index(current_step)
        target_idx = steps.index(target_step)

        if target_idx > current_idx + 1:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.WORKFLOW_SKIP_STEP,
                passed=False,
                message=f"跳过步骤：从 {current_step} 到 {target_step} 缺失中间步骤",
                decision=LengthMismatchDecision.PENDING_REVIEW,
                evidence={"current_idx": current_idx, "target_idx": target_idx},
                can_rollback=True
            )

        if target_idx < current_idx:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.WORKFLOW_SKIP_STEP,
                passed=True,
                message=f"回退步骤：从 {current_step} 到 {target_step}",
                decision=LengthMismatchDecision.ROLLBACK,
                evidence={"current_idx": current_idx, "target_idx": target_idx},
                can_rollback=True
            )

        return BoundaryCheckResult(
            rule_code=BoundaryRuleCode.WORKFLOW_SKIP_STEP,
            passed=True,
            message=f"步骤推进正常：{current_step} → {target_step}",
            decision=LengthMismatchDecision.ACCEPT_AS_IS,
            evidence={"current": current_step, "target": target_step},
            can_rollback=False
        )

    @classmethod
    def check_export_allowed(cls, needs_review: bool, length_mismatch: bool) -> BoundaryCheckResult:
        """RULE_005: 检查是否允许导出"""
        if needs_review or length_mismatch:
            return BoundaryCheckResult(
                rule_code=BoundaryRuleCode.EXPORT_WITHOUT_REVIEW,
                passed=False,
                message="存在待复核项（长度不匹配或未完成复核），请先完成复核再导出",
                decision=LengthMismatchDecision.PENDING_REVIEW,
                evidence={"needs_review": needs_review, "length_mismatch": length_mismatch},
                can_rollback=False
            )

        return BoundaryCheckResult(
            rule_code=BoundaryRuleCode.EXPORT_WITHOUT_REVIEW,
            passed=True,
            message="复核完成，允许导出",
            decision=LengthMismatchDecision.ACCEPT_AS_IS,
            evidence={},
            can_rollback=False
        )

    @classmethod
    def get_rule_documentation(cls) -> Dict:
        """获取完整的规则文档，用于生成 README"""
        return {
            "version": "1.0",
            "last_updated": datetime.now().isoformat(),
            "rules": {
                k.value: {
                    "code": k.value,
                    **v
                } for k, v in cls.RULE_DOCS.items()
            }
        }
