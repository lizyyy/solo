from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional
from .models import (
    TranslationRecord,
    WorkflowLog,
    WorkflowStep,
    RecordStatus,
    AbnormalType,
    EvidenceSummary,
)
from .storage import Storage


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class WorkflowManager:
    def __init__(self, storage: Storage):
        self.storage = storage

    def _log_transition(
        self,
        record_id: str,
        from_step: WorkflowStep,
        to_step: WorkflowStep,
        operator: str,
        action: str,
        remark: str = "",
    ) -> WorkflowLog:
        log = WorkflowLog(
            log_id=_gen_id("log"),
            record_id=record_id,
            from_step=from_step,
            to_step=to_step,
            operator=operator,
            action=action,
            remark=remark,
        )
        self.storage.save_workflow_log(log)
        return log

    def advance_to_desensitization(
        self,
        record_id: str,
        operator: str,
        remark: str = "",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if record.current_step != WorkflowStep.STEP1_IMPORT:
            raise ValueError(
                f"Cannot advance from step {record.current_step} to desensitization"
            )

        from_step = record.current_step
        record.current_step = WorkflowStep.STEP2_DESENSITIZATION

        if AbnormalType.MODEL_VERSION_CHANGED not in record.abnormal_types:
            record.status = RecordStatus.DESENSITIZATION_REVIEWED
        else:
            record.status = RecordStatus.NEEDS_RECHECK

        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_transition(
            record_id, from_step, record.current_step, operator,
            "推进到脱敏规则复核", remark
        )
        return record

    def advance_to_product_review(
        self,
        record_id: str,
        operator: str,
        remark: str = "",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if record.current_step != WorkflowStep.STEP2_DESENSITIZATION:
            raise ValueError(
                f"Cannot advance from step {record.current_step} to product review"
            )

        if not record.desensitization_note:
            raise ValueError("必须先完成脱敏规则备注才能推进到产品复盘")

        from_step = record.current_step
        record.current_step = WorkflowStep.STEP3_PRODUCT

        if AbnormalType.MODEL_VERSION_CHANGED not in record.abnormal_types:
            record.status = RecordStatus.PRODUCT_REVIEWED
        else:
            record.status = RecordStatus.NEEDS_RECHECK

        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_transition(
            record_id, from_step, record.current_step, operator,
            "推进到产品复盘", remark
        )
        return record

    def operator_review(
        self,
        record_id: str,
        operator: str,
        approve: bool,
        remark: str = "",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if AbnormalType.MODEL_VERSION_CHANGED not in record.abnormal_types:
            raise ValueError("该记录不需要运营复核")

        from_step = record.current_step
        if approve:
            if not record.desensitization_note:
                record.status = RecordStatus.PENDING_REVIEW
            elif record.current_step == WorkflowStep.STEP3_PRODUCT:
                record.status = RecordStatus.NORMAL
                record.current_step = WorkflowStep.COMPLETED
            elif record.current_step == WorkflowStep.STEP2_DESENSITIZATION:
                record.status = RecordStatus.PRODUCT_REVIEWED
            else:
                record.status = RecordStatus.DESENSITIZATION_REVIEWED
        else:
            record.status = RecordStatus.ABNORMAL

        record.updated_at = datetime.now()
        self.storage.save_record(record)

        action = "运营复核通过" if approve else "运营复核驳回"
        self._log_transition(
            record_id, from_step, record.current_step, operator,
            action, remark
        )
        return record

    def complete_workflow(
        self,
        record_id: str,
        operator: str,
        remark: str = "",
    ) -> TranslationRecord:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        if AbnormalType.MODEL_VERSION_CHANGED in record.abnormal_types:
            if record.status != RecordStatus.NORMAL:
                raise ValueError("存在模型版本变更的记录必须先经过运营复核")

        if record.current_step != WorkflowStep.STEP3_PRODUCT:
            raise ValueError(
                f"Cannot complete from step {record.current_step}, must be in product review"
            )

        from_step = record.current_step
        record.current_step = WorkflowStep.COMPLETED
        record.status = RecordStatus.NORMAL
        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_transition(
            record_id, from_step, WorkflowStep.COMPLETED, operator,
            "完成全流程", remark
        )
        return record

    def get_evidence_summary(self, record_id: str) -> EvidenceSummary:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        feedback_summary = (
            f"工单 {record.feedback_ticket.ticket_id} "
            f"(行号 {record.feedback_ticket.original_line_no}): "
            f"{record.feedback_ticket.feedback_type} - "
            f"{record.feedback_ticket.customer_text[:30]}..."
        )

        desensitization_summary = None
        if record.desensitization_note:
            desensitization_summary = (
                f"规则: {record.desensitization_note.rule_name}, "
                f"是否脱敏: {'是' if record.desensitization_note.is_desensitized else '否'}, "
                f"复核人: {record.desensitization_note.reviewer}"
            )

        return EvidenceSummary(
            record_id=record.record_id,
            sample_no=record.sample_no,
            model_version=record.model_version,
            status=record.status,
            current_step=record.current_step,
            abnormal_types=record.abnormal_types,
            original_line_no=record.feedback_ticket.original_line_no,
            ticket_id=record.feedback_ticket.ticket_id,
            has_manual_changes=len(record.manual_changes) > 0,
            manual_change_count=len(record.manual_changes),
            has_desensitization_note=record.desensitization_note is not None,
            desensitization_reviewer=(
                record.desensitization_note.reviewer
                if record.desensitization_note else None
            ),
            recheck_count=record.recheck_count,
            feedback_summary=feedback_summary,
            desensitization_summary=desensitization_summary,
        )

    def list_records_needing_review(self) -> List[TranslationRecord]:
        records = self.storage.list_records()
        return [
            r for r in records
            if AbnormalType.MODEL_VERSION_CHANGED in r.abnormal_types
            and r.status == RecordStatus.NEEDS_RECHECK
        ]

    def get_workflow_progress(self, record_id: str) -> dict:
        record = self.storage.get_record(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        steps = [
            {"step": WorkflowStep.STEP1_IMPORT, "name": "导入反馈工单", "completed": False},
            {"step": WorkflowStep.STEP2_DESENSITIZATION, "name": "脱敏规则复核", "completed": False},
            {"step": WorkflowStep.STEP3_PRODUCT, "name": "产品复盘", "completed": False},
            {"step": WorkflowStep.COMPLETED, "name": "完成", "completed": False},
        ]

        current_idx = 0
        for i, s in enumerate(steps):
            if s["step"] == record.current_step:
                current_idx = i
                break

        for i in range(current_idx + 1):
            steps[i]["completed"] = True

        logs = self.storage.list_workflow_logs(record_id=record_id)
        return {
            "record_id": record_id,
            "current_step": record.current_step,
            "status": record.status,
            "needs_operation_review": (
                AbnormalType.MODEL_VERSION_CHANGED in record.abnormal_types
                and record.status == RecordStatus.NEEDS_RECHECK
            ),
            "steps": steps,
            "logs": [
                {
                    "action": log.action,
                    "operator": log.operator,
                    "time": log.created_at,
                    "remark": log.remark,
                }
                for log in logs
            ],
        }
