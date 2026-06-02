from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .models import ChangeType, RemarkStatus, SettlementType, TaxRateRemark


class WorkflowStep(str, Enum):
    STEP_1_IMPORT = "step_1_import"
    STEP_2_TAIL_REVIEW = "step_2_tail_review"
    STEP_3_RECONCILIATION = "step_3_reconciliation"
    COMPLETED = "completed"


@dataclass
class WorkflowTransition:
    from_step: WorkflowStep
    to_step: WorkflowStep
    remark_id: str
    operator: str
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "from_step": self.from_step.value,
            "to_step": self.to_step.value,
            "remark_id": self.remark_id,
            "operator": self.operator,
            "reason": self.reason,
        }


STEP_ORDER = [
    WorkflowStep.STEP_1_IMPORT,
    WorkflowStep.STEP_2_TAIL_REVIEW,
    WorkflowStep.STEP_3_RECONCILIATION,
    WorkflowStep.COMPLETED,
]

STATUS_TO_STEP: dict[RemarkStatus, WorkflowStep] = {
    RemarkStatus.IMPORTED: WorkflowStep.STEP_1_IMPORT,
    RemarkStatus.PENDING_REVIEW: WorkflowStep.STEP_1_IMPORT,
    RemarkStatus.TAIL_REVIEWED: WorkflowStep.STEP_2_TAIL_REVIEW,
    RemarkStatus.RECONCILIATION_UPDATED: WorkflowStep.STEP_3_RECONCILIATION,
    RemarkStatus.FLAGGED_FOR_MANAGER: WorkflowStep.STEP_1_IMPORT,
}


class WorkflowError(Exception):
    pass


class WorkflowEngine:
    def get_current_step(self, remark: TaxRateRemark) -> WorkflowStep:
        return STATUS_TO_STEP.get(remark.status, WorkflowStep.STEP_1_IMPORT)

    def can_advance(
        self, remark: TaxRateRemark, target_step: WorkflowStep
    ) -> tuple[bool, str]:
        if remark.flagged_for_manager:
            return False, "该备注已被标记待基金经理复核，不允许推进工作流"

        current = self.get_current_step(remark)
        current_idx = STEP_ORDER.index(current)
        target_idx = STEP_ORDER.index(target_step)

        if target_idx <= current_idx:
            return False, f"不能从 {current.value} 回退到 {target_step.value}，应使用回滚操作"

        if target_idx > current_idx + 1:
            return False, f"不能跳过步骤，当前: {current.value}，目标: {target_step.value}"

        if target_step == WorkflowStep.STEP_2_TAIL_REVIEW:
            if not remark.counter_flow_tail:
                return False, "补看柜台流水尾号后才能推进到第二步，请先填写柜台流水尾号"

        if target_step == WorkflowStep.STEP_3_RECONCILIATION:
            if not remark.reconciliation_note:
                return False, "对账说明更新后才能推进到第三步，请先填写对账说明"

        return True, ""

    def advance(
        self,
        remark: TaxRateRemark,
        target_step: WorkflowStep,
        operator: str = "",
        reason: str = "",
    ) -> WorkflowTransition:
        can, msg = self.can_advance(remark, target_step)
        if not can:
            raise WorkflowError(msg)

        current = self.get_current_step(remark)
        transition = WorkflowTransition(
            from_step=current,
            to_step=target_step,
            remark_id=remark.id,
            operator=operator,
            reason=reason,
        )

        if target_step == WorkflowStep.STEP_2_TAIL_REVIEW:
            remark.status = RemarkStatus.TAIL_REVIEWED
            remark.record_change(
                change_type=ChangeType.TAIL_REVIEW,
                operator=operator,
                reason=reason or "补看柜台流水尾号完成",
            )
        elif target_step == WorkflowStep.STEP_3_RECONCILIATION:
            remark.status = RemarkStatus.RECONCILIATION_UPDATED
            remark.record_change(
                change_type=ChangeType.RECONCILIATION_UPDATE,
                operator=operator,
                reason=reason or "对账说明更新完成",
            )
        elif target_step == WorkflowStep.COMPLETED:
            remark.status = RemarkStatus.RECONCILIATION_UPDATED
            remark.record_change(
                change_type=ChangeType.STATUS_CHANGE,
                operator=operator,
                reason=reason or "核验流程完成",
            )

        return transition

    def manager_review_resolve(
        self,
        remark: TaxRateRemark,
        approved: bool,
        manager_operator: str = "",
        reason: str = "",
    ) -> tuple[bool, str]:
        if not remark.flagged_for_manager:
            return False, "该备注未被标记待基金经理复核"

        if approved:
            remark.flagged_for_manager = False
            remark.flag_reason = ""
            remark.status = RemarkStatus.PENDING_REVIEW
            remark.record_change(
                change_type=ChangeType.STATUS_CHANGE,
                operator=manager_operator,
                reason=reason or "基金经理复核通过，清除标记",
            )
            return True, "基金经理复核通过，可继续推进工作流"
        else:
            remark.record_change(
                change_type=ChangeType.STATUS_CHANGE,
                operator=manager_operator,
                reason=reason or "基金经理复核未通过，需修正",
            )
            return False, "基金经理复核未通过，请修正后重新提交"
