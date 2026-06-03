from __future__ import annotations

from collections import OrderedDict
from typing import Optional

from .models import (
    ClearingRecord,
    EvidenceSummary,
    HolidayExtensionInfo,
    ProcessingStatus,
    SelfCheckResult,
    SelfCheckRule,
    SummaryUpdate,
    WorkflowStep,
)


class ResultStore:
    _instance: Optional[ResultStore] = None

    @classmethod
    def get_instance(cls) -> ResultStore:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        cls._instance = None

    def __init__(self) -> None:
        self._records: OrderedDict[str, ClearingRecord] = OrderedDict()
        self._check_results: list[SelfCheckResult] = []
        self._holiday_notes: dict[str, HolidayExtensionInfo] = {}
        self._summaries: dict[str, SummaryUpdate] = {}
        self._workflow_position: dict[str, WorkflowStep] = {}

    def add_record(self, record: ClearingRecord) -> None:
        self._records[record.id] = record
        self._workflow_position[record.id] = WorkflowStep.IMPORT

    def get_record(self, record_id: str) -> Optional[ClearingRecord]:
        return self._records.get(record_id)

    def get_records(self) -> list[ClearingRecord]:
        return list(self._records.values())

    def find_by_batch_no(self, clearing_batch_no: str) -> list[ClearingRecord]:
        return [r for r in self._records.values() if r.clearing_batch_no == clearing_batch_no]

    def store_check_results(self, results: list[SelfCheckResult]) -> None:
        self._check_results.extend(results)

    def get_check_results(self) -> list[SelfCheckResult]:
        return list(self._check_results)

    def apply_holiday_note(self, info: HolidayExtensionInfo) -> None:
        self._holiday_notes[info.clearing_batch_no] = info
        for record in self.find_by_batch_no(info.clearing_batch_no):
            record.holiday_extension_note = info.note
            record.add_audit(
                action="holiday_extension_applied",
                detail=f"节假日顺延: {info.note}",
                new_value=info.note,
            )
            if record.status == ProcessingStatus.SELF_CHECK_PASSED:
                record.status = ProcessingStatus.HOLIDAY_NOTED
            self._workflow_position[record.id] = WorkflowStep.HOLIDAY_NOTE

    def get_holiday_note(self, clearing_batch_no: str) -> Optional[HolidayExtensionInfo]:
        return self._holiday_notes.get(clearing_batch_no)

    def apply_summary_update(self, update: SummaryUpdate) -> None:
        self._summaries[update.clearing_batch_no] = update
        for record in self.find_by_batch_no(update.clearing_batch_no):
            if record.status in (ProcessingStatus.HOLIDAY_NOTED, ProcessingStatus.SELF_CHECK_PASSED, ProcessingStatus.PENDING_REVIEW):
                if record.is_zero_reversed:
                    record.status = ProcessingStatus.PENDING_REVIEW
                    record.add_audit(
                        action="summary_update_skipped_zero_reversed",
                        detail="金额为0且备注已冲正，留待风控复核",
                    )
                else:
                    record.status = ProcessingStatus.SUMMARY_UPDATED
                    record.add_audit(
                        action="summary_updated",
                        detail=f"摘要更新: {update.note}",
                    )
                self._workflow_position[record.id] = WorkflowStep.SUMMARY_UPDATE

    def get_summary(self, clearing_batch_no: str) -> Optional[SummaryUpdate]:
        return self._summaries.get(clearing_batch_no)

    def get_workflow_step(self, record_id: str) -> Optional[WorkflowStep]:
        return self._workflow_position.get(record_id)

    def build_evidence_summary(self, record_id: str) -> Optional[EvidenceSummary]:
        record = self.get_record(record_id)
        if record is None:
            return None
        return EvidenceSummary(
            clearing_batch_no=record.clearing_batch_no,
            original_line_no=record.original_line_no,
            amount=record.amount,
            remark=record.remark,
            status=record.status,
            is_zero_reversed=record.is_zero_reversed,
            holiday_extension_note=record.holiday_extension_note,
            audit_trail_summary=[
                f"[{e.timestamp:%Y-%m-%d %H:%M:%S}] {e.action}: {e.detail}"
                for e in record.audit_trail
            ],
        )

    def export_records(self) -> list[dict]:
        return [r.model_dump(mode="json") for r in self._records.values()]

    def export_check_results(self) -> list[dict]:
        return [r.model_dump(mode="json") for r in self._check_results]

    def export_evidence_summaries(self) -> list[dict]:
        return [
            self.build_evidence_summary(rid).model_dump(mode="json")
            for rid in self._records
            if self.build_evidence_summary(rid) is not None
        ]

    def clear(self) -> None:
        self._records.clear()
        self._check_results.clear()
        self._holiday_notes.clear()
        self._summaries.clear()
        self._workflow_position.clear()
