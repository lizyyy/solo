from __future__ import annotations

import uuid
from typing import Optional

from .models import ClearingRecord, HolidayExtensionInfo, ProcessingStatus, SummaryUpdate
from .self_check import SelfCheckEngine
from .store import ResultStore


class WorkflowEngine:
    def __init__(self, store: ResultStore | None = None) -> None:
        self._store = store or ResultStore.get_instance()
        self._check_engine = SelfCheckEngine(self._store)

    def import_records(self, rows: list[dict], actor: str = "system") -> list[ClearingRecord]:
        records: list[ClearingRecord] = []
        for i, row in enumerate(rows):
            record_id = row.get("id") or str(uuid.uuid4())[:8]
            amount = row.get("amount", 0)
            if isinstance(amount, str):
                amount = int(float(amount) * 100)
            remark = row.get("remark", "")
            record = ClearingRecord(
                id=record_id,
                clearing_batch_no=row["clearing_batch_no"],
                original_line_no=row.get("original_line_no", i + 1),
                channel=row.get("channel", ""),
                amount=amount,
                remark=remark,
            )
            record.add_audit(action="imported", actor=actor, detail="首次导入")
            self._store.add_record(record)
            records.append(record)
        return records

    def run_self_check(self) -> list[dict]:
        results = self._check_engine.run_all()
        return [r.model_dump(mode="json") for r in results]

    def apply_holiday_note(self, clearing_batch_no: str, note: str,
                           effective_date: str = "", source: str = "",
                           actor: str = "system") -> Optional[HolidayExtensionInfo]:
        records = self._store.find_by_batch_no(clearing_batch_no)
        if not records:
            return None

        info = HolidayExtensionInfo(
            clearing_batch_no=clearing_batch_no,
            note=note,
            effective_date=effective_date,
            source=source,
        )
        self._store.apply_holiday_note(info)

        for record in records:
            record.add_audit(
                action="holiday_extension_applied",
                actor=actor,
                detail=f"节假日顺延说明: {note} (来源: {source})",
                new_value=note,
            )
        self._store.save()
        return info

    def update_summary(self, clearing_batch_no: str, note: str = "",
                       actor: str = "system") -> Optional[SummaryUpdate]:
        records = self._store.find_by_batch_no(clearing_batch_no)
        if not records:
            return None

        total_diff = sum(r.amount for r in records)
        total_reversed = sum(r.amount for r in records if r.is_zero_reversed)
        pending_review_count = sum(1 for r in records if r.is_zero_reversed)

        update = SummaryUpdate(
            clearing_batch_no=clearing_batch_no,
            total_diff=total_diff,
            total_reversed=total_reversed,
            pending_review_count=pending_review_count,
            note=note,
        )
        self._store.apply_summary_update(update)

        for record in records:
            record.add_audit(
                action="summary_update_processed",
                actor=actor,
                detail=f"摘要更新: {note or '(无额外说明)'}",
            )
        self._store.save()
        return update

    def confirm_record(self, record_id: str, actor: str = "risk_control") -> Optional[ClearingRecord]:
        record = self._store.get_record(record_id)
        if record is None:
            return None
        if record.status != ProcessingStatus.PENDING_REVIEW:
            return record
        record.status = ProcessingStatus.CONFIRMED
        record.add_manual_edit(
            action="confirmed",
            actor=actor,
            detail="风控确认通过",
            original_value=ProcessingStatus.PENDING_REVIEW.value,
            new_value=ProcessingStatus.CONFIRMED.value,
        )
        self._store.save()
        return record

    def reject_record(self, record_id: str, reason: str, actor: str = "risk_control") -> Optional[ClearingRecord]:
        record = self._store.get_record(record_id)
        if record is None:
            return None
        old_status = record.status.value
        record.status = ProcessingStatus.REJECTED
        record.add_manual_edit(
            action="rejected",
            actor=actor,
            detail=f"风控驳回: {reason}",
            original_value=old_status,
            new_value=ProcessingStatus.REJECTED.value,
        )
        self._store.save()
        return record

    def supplement_record(self, record_id: str, new_amount: int, note: str = "",
                          actor: str = "system") -> Optional[ClearingRecord]:
        record = self._store.get_record(record_id)
        if record is None:
            return None
        old_amount = str(record.amount)
        record.amount = new_amount
        record.supplement_applied = True
        record.add_manual_edit(
            action="supplement_applied",
            actor=actor,
            detail=f"补录: {note}",
            original_value=old_amount,
            new_value=str(new_amount),
        )
        self._store.save()
        return record
