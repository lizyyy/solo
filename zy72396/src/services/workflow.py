from typing import Tuple, Optional, List, Dict
from ..models.photo import WorkingConditionPhoto
from ..models.base import ChangeRecord
from ..models.enums import (
    ProcessingStatus,
    UserRole,
    ChangeType,
)
from .boundary_rules import BoundaryRuleService


STEP_1_DESCRIPTION = "第一步：工况照片第一次导入"
STEP_2_DESCRIPTION = "第二步：实验老师林老师补看手写巡检备注"
STEP_3_DESCRIPTION = "第三步：交接报告更新"


class WorkflowService:
    def __init__(self, boundary_service: BoundaryRuleService):
        self.boundary_service = boundary_service

    def get_current_step(self, photo: WorkingConditionPhoto) -> int:
        status = photo.error_status

        if status in [ProcessingStatus.IMPORTED, ProcessingStatus.COACH_REVIEW_PENDING]:
            return 1
        elif status == ProcessingStatus.LIN_TEACHER_REVIEWED:
            return 2
        elif status in [ProcessingStatus.COACH_APPROVED, ProcessingStatus.REPORT_UPDATED]:
            return 3
        elif status == ProcessingStatus.ROLLBACKED:
            return 1
        else:
            return 1

    def get_step_description(self, step: int) -> str:
        if step == 1:
            return STEP_1_DESCRIPTION
        elif step == 2:
            return STEP_2_DESCRIPTION
        elif step == 3:
            return STEP_3_DESCRIPTION
        else:
            return "未知步骤"

    def can_advance_to_step(self, photo: WorkingConditionPhoto, target_step: int) -> Tuple[bool, str]:
        current_step = self.get_current_step(photo)

        if self.boundary_service.requires_coach_review(photo):
            if target_step >= 2:
                return False, "存在摄氏度/开尔文混用情况，需训练教练复核后才能继续"

        if target_step <= current_step:
            return True, "Already at or beyond target step"

        if target_step > current_step + 1:
            return False, f"Cannot skip steps: current step {current_step}, target {target_step}"

        return True, "OK"

    def step1_import_complete(
        self,
        photo: WorkingConditionPhoto,
        operator: UserRole = UserRole.OPERATOR,
    ) -> Tuple[bool, str]:
        if photo.error_status not in [
            ProcessingStatus.IMPORTED,
            ProcessingStatus.COACH_REVIEW_PENDING,
        ]:
            return False, f"Invalid status for step 1: {photo.error_status}"

        if self.boundary_service.check_mixed_units(photo):
            change = ChangeRecord(
                operator=operator,
                change_type=ChangeType.STATUS_CHANGE,
                field_name="error_status",
                old_value=photo.error_status.value,
                new_value=ProcessingStatus.COACH_REVIEW_PENDING.value,
                remark="导入完成，检测到摄氏度/开尔文混用，待教练复核，不进入下一步",
            )
            photo.add_change(change)
            return True, "Import complete - MIXED UNITS DETECTED, pending coach review"
        else:
            old_status = photo.error_status
            photo.error_status = ProcessingStatus.MANUAL_REVIEW_PENDING
            change = ChangeRecord(
                operator=operator,
                change_type=ChangeType.STATUS_CHANGE,
                field_name="error_status",
                old_value=old_status.value,
                new_value=ProcessingStatus.MANUAL_REVIEW_PENDING.value,
                remark="第一步完成：导入成功，等待林老师补看手写备注",
            )
            photo.add_change(change)
            return True, "第一步完成：导入成功"

    def step2_lin_teacher_add_remark(
        self,
        photo: WorkingConditionPhoto,
        handwritten_remark: str,
        operator: UserRole = UserRole.LIN_TEACHER,
    ) -> Tuple[bool, str]:
        if operator != UserRole.LIN_TEACHER:
            return False, "仅林老师可执行第二步操作"

        if self.boundary_service.requires_coach_review(photo):
            return False, "存在摄氏度/开尔文混用情况，请先由训练教练复核"

        old_remark = photo.handwritten_remark
        photo.handwritten_remark = handwritten_remark

        old_status = photo.error_status
        photo.error_status = ProcessingStatus.LIN_TEACHER_REVIEWED

        change = ChangeRecord(
            operator=operator,
            change_type=ChangeType.REMARK_ADD,
            field_name="handwritten_remark + error_status",
            old_value=f"remark={old_remark}, status={old_status.value}",
            new_value=f"remark={handwritten_remark}, status={ProcessingStatus.LIN_TEACHER_REVIEWED.value}",
            remark="第二步完成：林老师补看手写巡检备注",
        )
        photo.add_change(change)

        return True, "第二步完成：手写备注已补充"

    def step3_update_report(
        self,
        photo: WorkingConditionPhoto,
        report_content: str,
        operator: UserRole = UserRole.COACH,
    ) -> Tuple[bool, str]:
        if operator != UserRole.COACH:
            return False, "仅训练教练可执行第三步操作"

        if self.boundary_service.requires_coach_review(photo):
            return False, "存在摄氏度/开尔文混用情况，请先处理混用问题"

        old_report = photo.report_content
        photo.report_content = report_content

        old_status = photo.error_status
        photo.error_status = ProcessingStatus.REPORT_UPDATED

        change = ChangeRecord(
            operator=operator,
            change_type=ChangeType.STATUS_CHANGE,
            field_name="report_content + error_status",
            old_value=f"report={old_report}, status={old_status.value}",
            new_value=f"report={report_content}, status={ProcessingStatus.REPORT_UPDATED.value}",
            remark="第三步完成：交接报告已更新",
        )
        photo.add_change(change)

        return True, "第三步完成：交接报告已更新"

    def get_workflow_summary(self, photo: WorkingConditionPhoto) -> Dict:
        current_step = self.get_current_step(photo)
        return {
            "photo_id": photo.photo_id,
            "original_row": photo.original_row_number,
            "file_name": photo.file_name,
            "current_step": current_step,
            "current_step_description": self.get_step_description(current_step),
            "status": photo.error_status.value,
            "has_mixed_units": photo.has_mixed_units,
            "requires_coach_review": self.boundary_service.requires_coach_review(photo),
            "version": photo.version,
            "is_rollbacked": photo.is_rollbacked,
            "rollback_to_version": photo.rollback_to_version,
        }

    def get_batch_workflow_summary(self, photos: List[WorkingConditionPhoto]) -> Dict:
        total = len(photos)
        step1 = sum(1 for p in photos if self.get_current_step(p) == 1)
        step2 = sum(1 for p in photos if self.get_current_step(p) == 2)
        step3 = sum(1 for p in photos if self.get_current_step(p) == 3)
        need_coach = sum(1 for p in photos if self.boundary_service.requires_coach_review(p))
        mixed_units = sum(1 for p in photos if p.has_mixed_units)

        return {
            "total_count": total,
            "step_1_count": step1,
            "step_2_count": step2,
            "step_3_count": step3,
            "pending_coach_review": need_coach,
            "has_mixed_units_count": mixed_units,
        }
