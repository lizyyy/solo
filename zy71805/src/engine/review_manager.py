from typing import List, Optional
from datetime import datetime

from src.models.margin_record import MarginRecord
from src.models.audit_history import AuditRecord
from src.config import SOURCE_TYPE


class ReviewManager:
    def __init__(self):
        self.audit_records: List[AuditRecord] = []

    def confirm_record(self, record: MarginRecord, reviewer: str) -> MarginRecord:
        old_status = record.review_status
        record.review_status = "CONFIRMED"
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.now()

        self.audit_records.append(AuditRecord.create(
            record_type="MarginRecord",
            record_id=record.margin_id,
            action="CONFIRM",
            field_name="review_status",
            old_value=old_status,
            new_value="CONFIRMED",
            changed_by=reviewer,
            reason="风控复核通过"
        ))

        return record

    def mark_pending(self, record: MarginRecord, reviewer: str, reason: str, next_follow_up: str) -> MarginRecord:
        old_status = record.review_status
        record.review_status = "PENDING"
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.now()
        record.remarks = reason
        record.next_follow_up = next_follow_up

        self.audit_records.append(AuditRecord.create(
            record_type="MarginRecord",
            record_id=record.margin_id,
            action="MARK_PENDING",
            field_name="review_status",
            old_value=old_status,
            new_value="PENDING",
            changed_by=reviewer,
            reason=reason
        ))

        return record

    def manual_override(
        self,
        record: MarginRecord,
        reviewer: str,
        new_required_margin: Optional[float] = None,
        new_actual_margin: Optional[float] = None,
        override_reason: str = "",
        override_source: str = "",
        next_follow_up: str = ""
    ) -> MarginRecord:
        record.manual_override = True
        record.review_status = "MANUAL"
        record.override_reason = override_reason
        record.override_source = override_source
        record.next_follow_up = next_follow_up
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.now()

        source_detail = ""
        if override_source == "CREDIT_LEDGER":
            source_detail = f"数据来源: {SOURCE_TYPE.get(override_source, override_source)} - 请联系授信审批岗确认"
        elif override_source == "TRADE_FLOW":
            source_detail = f"数据来源: {SOURCE_TYPE.get(override_source, override_source)} - 请联系交易台确认"
        elif override_source == "MANUAL":
            source_detail = f"数据来源: {SOURCE_TYPE.get(override_source, override_source)} - 请联系前手确认备注依据"

        if source_detail and not record.remarks:
            record.remarks = source_detail

        if new_required_margin is not None:
            old_value = record.required_margin
            record.required_margin = new_required_margin
            self._recalculate_margin(record)
            self.audit_records.append(AuditRecord.create(
                record_type="MarginRecord",
                record_id=record.margin_id,
                action="MANUAL_OVERRIDE",
                field_name="required_margin",
                old_value=old_value,
                new_value=new_required_margin,
                changed_by=reviewer,
                reason=override_reason,
                source=override_source
            ))

        if new_actual_margin is not None:
            old_value = record.actual_margin
            record.actual_margin = new_actual_margin
            self._recalculate_margin(record)
            self.audit_records.append(AuditRecord.create(
                record_type="MarginRecord",
                record_id=record.margin_id,
                action="MANUAL_OVERRIDE",
                field_name="actual_margin",
                old_value=old_value,
                new_value=new_actual_margin,
                changed_by=reviewer,
                reason=override_reason,
                source=override_source
            ))

        return record

    def _recalculate_margin(self, record: MarginRecord):
        record.margin_shortfall = max(0, record.required_margin - record.actual_margin)
        record.margin_excess = max(0, record.actual_margin - record.required_margin)

    def get_records_by_status(self, records: List[MarginRecord], status: str) -> List[MarginRecord]:
        return [r for r in records if r.review_status == status]

    def get_review_checklist(self, records: List[MarginRecord]) -> dict:
        return {
            "confirmed": self.get_records_by_status(records, "CONFIRMED"),
            "pending": self.get_records_by_status(records, "PENDING"),
            "manual": self.get_records_by_status(records, "MANUAL"),
            "total": len(records)
        }

    def get_audit_records(self) -> List[AuditRecord]:
        return self.audit_records

    def clear_audit_records(self):
        self.audit_records = []
