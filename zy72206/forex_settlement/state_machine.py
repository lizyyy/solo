import uuid
from datetime import datetime
from typing import Optional, Tuple, List
from .models import (
    SettlementRecord,
    SettlementStatus,
    ProcessingStep,
    AuditLog,
    AuditAction,
    RecordSource,
)
from .boundary_rules import BoundaryRules


class StateMachine:
    def __init__(self):
        self.audit_logs: List[AuditLog] = []

    def _create_audit_log(
        self,
        record_id: str,
        action: AuditAction,
        operator: str,
        field_name: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        note: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            id=str(uuid.uuid4()),
            record_id=record_id,
            action=action,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            note=note,
        )
        self.audit_logs.append(log)
        return log

    def create_record(
        self,
        original_row_number: int,
        trade_date: str,
        settlement_date: str,
        currency_pair: str,
        amount: float,
        rate: float,
        remark: str = "",
        source: RecordSource = RecordSource.EX_DATE_SCREENSHOT,
        operator: str = "system",
        ex_date_evidence_id: Optional[str] = None,
    ) -> SettlementRecord:
        record = SettlementRecord(
            id=str(uuid.uuid4()),
            original_row_number=original_row_number,
            source=source,
            trade_date=trade_date,
            settlement_date=settlement_date,
            currency_pair=currency_pair,
            amount=amount,
            original_amount=amount,
            rate=rate,
            status=SettlementStatus.IMPORTED,
            current_step=ProcessingStep.STEP_1_IMPORT,
            remark=remark,
            ex_date_evidence_id=ex_date_evidence_id or str(uuid.uuid4()),
            created_by=operator,
            updated_by=operator,
        )
        record.has_zero_amount_with_reversal = BoundaryRules.is_zero_amount_with_reversal(
            record
        )
        record.risk_review_required = record.has_zero_amount_with_reversal
        if record.risk_review_required:
            record.status = SettlementStatus.PENDING_RISK_REVIEW
        self._create_audit_log(
            record.id,
            AuditAction.CREATED,
            operator,
            note=f"从{source.value}导入，原始行号: {original_row_number}",
        )
        return record

    def advance_step(
        self, record: SettlementRecord, operator: str
    ) -> Tuple[SettlementRecord, bool]:
        if record.status == SettlementStatus.PENDING_RISK_REVIEW:
            self._create_audit_log(
                record.id,
                AuditAction.STATUS_CHANGED,
                operator,
                field_name="current_step",
                old_value=record.current_step,
                new_value=record.current_step,
                note="因待风控复核，流程暂停推进",
            )
            return record, False
        old_step = record.current_step
        next_step = BoundaryRules.determine_next_step(record, "advance")
        if next_step == old_step:
            return record, False
        record.current_step = next_step
        status_map = {
            ProcessingStep.STEP_2_TAX_REVIEW: SettlementStatus.IMPORTED,
            ProcessingStep.STEP_3_SUMMARY: SettlementStatus.TAX_RATE_REVIEWED,
        }
        if next_step in status_map:
            record.status = status_map[next_step]
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.STATUS_CHANGED,
            operator,
            field_name="current_step",
            old_value=old_step,
            new_value=next_step,
        )
        return record, True

    def update_tax_rate(
        self,
        record: SettlementRecord,
        tax_rate: float,
        tax_rate_remark: str,
        operator: str,
    ) -> Tuple[SettlementRecord, bool]:
        if not BoundaryRules.can_edit_tax_rate(record):
            self._create_audit_log(
                record.id,
                AuditAction.MANUAL_EDIT,
                operator,
                field_name="tax_rate",
                old_value=str(record.tax_rate),
                new_value=str(tax_rate),
                note="操作被拒绝：当前步骤不允许修改税率",
            )
            return record, False
        old_tax_rate = record.tax_rate
        old_tax_remark = record.tax_rate_remark
        record.tax_rate = tax_rate
        record.tax_rate_remark = tax_rate_remark
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.MANUAL_EDIT,
            operator,
            field_name="tax_rate",
            old_value=str(old_tax_rate),
            new_value=str(tax_rate),
            note=f"税费率备注: {tax_rate_remark}",
        )
        return record, True

    def risk_review(
        self,
        record: SettlementRecord,
        approved: bool,
        review_note: str,
        operator: str,
    ) -> Tuple[SettlementRecord, bool]:
        if record.status != SettlementStatus.PENDING_RISK_REVIEW:
            return record, False
        old_status = record.status
        old_risk_note = record.risk_review_note
        if approved:
            record.status = SettlementStatus.RISK_APPROVED
            record.risk_review_note = f"通过: {review_note}"
            record.risk_review_required = False
        else:
            record.status = SettlementStatus.PENDING_RISK_REVIEW
            record.risk_review_note = f"驳回: {review_note}"
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.RISK_REVIEWED,
            operator,
            field_name="status",
            old_value=old_status,
            new_value=record.status,
            note=f"风控复核{'通过' if approved else '驳回'}: {review_note}",
        )
        return record, True

    def update_summary(
        self,
        record: SettlementRecord,
        summary_remark: str,
        operator: str,
    ) -> Tuple[SettlementRecord, bool]:
        if record.current_step != ProcessingStep.STEP_3_SUMMARY:
            return record, False
        old_remark = record.remark
        record.remark = f"{record.remark} | 摘要: {summary_remark}" if record.remark else f"摘要: {summary_remark}"
        record.status = SettlementStatus.SUMMARY_UPDATED
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.MANUAL_EDIT,
            operator,
            field_name="remark",
            old_value=old_remark,
            new_value=record.remark,
            note="负责人摘要更新",
        )
        return record, True

    def reverse_record(
        self,
        record: SettlementRecord,
        reason: str,
        operator: str,
    ) -> Tuple[SettlementRecord, bool]:
        if record.is_reversed:
            return record, False
        old_amount = record.amount
        old_status = record.status
        old_is_reversed = record.is_reversed
        record.amount = 0
        record.status = SettlementStatus.REVERSED
        record.is_reversed = True
        record.remark = f"{record.remark} | 已冲正: {reason}" if record.remark else f"已冲正: {reason}"
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.REVERSED,
            operator,
            field_name="amount",
            old_value=str(old_amount),
            new_value="0",
            note=f"冲正原因: {reason}",
        )
        return record, True

    def rollback_record(
        self,
        record: SettlementRecord,
        to_step: ProcessingStep,
        operator: str,
        reason: str,
    ) -> Tuple[SettlementRecord, bool]:
        requirements = BoundaryRules.get_rollback_requirements(record)
        if not requirements["can_rollback"]:
            return record, False
        old_step = record.current_step
        old_status = record.status
        record.current_step = to_step
        status_map = {
            ProcessingStep.STEP_1_IMPORT: SettlementStatus.IMPORTED,
            ProcessingStep.STEP_2_TAX_REVIEW: SettlementStatus.IMPORTED,
            ProcessingStep.STEP_3_SUMMARY: SettlementStatus.TAX_RATE_REVIEWED,
        }
        if to_step in status_map:
            record.status = status_map[to_step]
        record.updated_at = datetime.now()
        record.updated_by = operator
        self._create_audit_log(
            record.id,
            AuditAction.STATUS_CHANGED,
            operator,
            field_name="current_step",
            old_value=old_step,
            new_value=to_step,
            note=f"回滚原因: {reason}",
        )
        return record, True

    def get_blocking_info(self, record: SettlementRecord) -> dict:
        info = {
            "record_id": record.id,
            "current_step": record.current_step,
            "status": record.status,
            "is_blocked": False,
            "block_reason": None,
            "blocked_by": None,
            "next_action": None,
        }
        if record.has_zero_amount_with_reversal and record.status == SettlementStatus.PENDING_RISK_REVIEW:
            info["is_blocked"] = True
            info["block_reason"] = "金额为0且备注含'已冲正'，需风控复核"
            info["blocked_by"] = "system"
            info["next_action"] = "联系风控同事进行复核"
        elif record.risk_review_required and record.status == SettlementStatus.PENDING_RISK_REVIEW:
            info["is_blocked"] = True
            info["block_reason"] = "风控审核中"
            info["blocked_by"] = "risk_department"
            info["next_action"] = "等待风控复核结果"
        return info
