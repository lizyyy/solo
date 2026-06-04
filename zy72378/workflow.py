from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict

from models import (
    WindSpeedRecord,
    Direction,
    InspectionSource,
    ConflictResolution,
)
from verification_engine import VerificationEngine


class WorkflowStep(Enum):
    STEP1_IMPORT_HANDWRITTEN = "第一步：手写巡检备注导入"
    STEP2_COACH_REVIEW_THRESHOLD = "第二步：教练补看安全阈值表"
    STEP3_UPDATE_ABNORMAL = "第三步：异常工况表更新"


class WorkflowResult:
    def __init__(self, step: WorkflowStep, success: bool, messages: List[str], needs_review: bool = False):
        self.step = step
        self.success = success
        self.messages = messages
        self.needs_review = needs_review


class VerificationWorkflow:
    def __init__(self, engine: VerificationEngine):
        self.engine = engine
        self.current_step = WorkflowStep.STEP1_IMPORT_HANDWRITTEN
        self._step1_done = False
        self._step2_done = False
        self._step3_done = False

    def step1_import_handwritten_notes(
        self, records: List[WindSpeedRecord]
    ) -> List[WorkflowResult]:
        results = []
        all_messages = []
        has_left_direction = False

        for record in records:
            if record.source != InspectionSource.HANDWRITTEN_NOTE:
                all_messages.append(f"记录 {record.record_id} 不是手写巡检备注来源，跳过。")
                continue

            errors = self.engine.import_record(record)
            conflicts = self.engine.detect_conflicts(record)

            if record.direction == Direction.LEFT_WRITTEN_AS_NEGATIVE:
                has_left_direction = True

            for err in errors:
                all_messages.append(err)

            for conflict in conflicts:
                all_messages.append(
                    f"冲突：手写备注与安全阈值表不一致——字段「{conflict.field_name}」，"
                    f"手写值：{conflict.handwritten_value}，阈值表值：{conflict.threshold_value}，"
                    f"请教练确认。"
                )

        needs_review = has_left_direction or len(self.engine.get_pending_conflicts()) > 0

        if has_left_direction:
            all_messages.append(
                "⚠️ 发现负方向被现场师傅写成「向左」的记录，已标记为待复核，"
                "不会自动归为正常，请实验老师复核后再进入下一步。"
            )

        result = WorkflowResult(
            step=WorkflowStep.STEP1_IMPORT_HANDWRITTEN,
            success=True,
            messages=all_messages,
            needs_review=needs_review,
        )
        results.append(result)
        self._step1_done = True
        return results

    def step2_coach_review_threshold(
        self, coach_name: str, conflict_resolutions: Optional[List[Dict]] = None
    ) -> WorkflowResult:
        messages = []

        if not self._step1_done:
            return WorkflowResult(
                step=WorkflowStep.STEP2_COACH_REVIEW_THRESHOLD,
                success=False,
                messages=["请先完成第一步：手写巡检备注导入。"],
            )

        pending_conflicts = self.engine.get_pending_conflicts()
        if conflict_resolutions:
            for res in conflict_resolutions:
                rid = res.get("record_id")
                field = res.get("field_name")
                action = res.get("resolution")
                if action == "confirm":
                    self.engine.resolve_conflict(
                        rid, field, ConflictResolution.CONFIRMED_BY_COACH, coach_name
                    )
                    messages.append(f"教练 {coach_name} 确认采纳：记录 {rid} 字段 {field}。")
                elif action == "reject":
                    self.engine.resolve_conflict(
                        rid, field, ConflictResolution.REJECTED_BY_COACH, coach_name
                    )
                    messages.append(f"教练 {coach_name} 驳回：记录 {rid} 字段 {field}。")

        remaining = self.engine.get_pending_conflicts()
        if remaining:
            messages.append(
                f"仍有 {len(remaining)} 条冲突待处理，请逐一确认后再进入下一步。"
            )
            return WorkflowResult(
                step=WorkflowStep.STEP2_COACH_REVIEW_THRESHOLD,
                success=False,
                messages=messages,
                needs_review=True,
            )

        pending_reviews = self.engine.get_pending_reviews()
        if pending_reviews:
            messages.append(
                f"仍有 {len(pending_reviews)} 条异常工况待复核，包括方向标识待复核的记录。"
            )

        messages.append("教练已完成安全阈值表核查，可进入第三步。")
        self._step2_done = True
        return WorkflowResult(
            step=WorkflowStep.STEP2_COACH_REVIEW_THRESHOLD,
            success=True,
            messages=messages,
        )

    def step3_update_abnormal_table(self) -> WorkflowResult:
        messages = []

        if not self._step1_done:
            return WorkflowResult(
                step=WorkflowStep.STEP3_UPDATE_ABNORMAL,
                success=False,
                messages=["请先完成第一步：手写巡检备注导入。"],
            )
        if not self._step2_done:
            return WorkflowResult(
                step=WorkflowStep.STEP3_UPDATE_ABNORMAL,
                success=False,
                messages=["请先完成第二步：教练补看安全阈值表。"],
            )

        for record in self.engine.records:
            threshold_errors = self.engine.verify_against_threshold(record)
            messages.extend(threshold_errors)

        mismatch_errors = self.engine.match_abnormal_with_history()
        messages.extend(mismatch_errors)

        supplementary_errors = self.engine.recalculate_after_supplementary()
        messages.extend(supplementary_errors)

        pending_reviews = self.engine.get_pending_reviews()
        if pending_reviews:
            messages.append(
                f"异常工况表已更新，但仍有 {len(pending_reviews)} 条待复核记录"
                "（含方向标识待复核），请实验老师后续确认。"
            )

        messages.append("异常工况表更新完成。")
        self._step3_done = True
        return WorkflowResult(
            step=WorkflowStep.STEP3_UPDATE_ABNORMAL,
            success=True,
            messages=messages,
        )
