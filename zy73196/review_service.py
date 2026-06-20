from datetime import datetime
from typing import Optional, Dict, Any, List
import uuid

from models import (
    ReviewRecord,
    ReviewStatus,
    ReviewHistory,
    BoundaryParams,
    StudentWork,
    InputType,
)


def _generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


class ReviewService:
    def __init__(self):
        self._records: Dict[str, ReviewRecord] = {}

    def submit_work(self, work: StudentWork) -> ReviewRecord:
        record = ReviewRecord(
            work_id=work.id,
            work=work,
            current_status=ReviewStatus.SUBMITTED,
        )
        history = ReviewHistory(
            id=_generate_id("h_"),
            work_id=work.id,
            reviewer="system",
            old_status=None,
            new_status=ReviewStatus.SUBMITTED,
            reason="学生提交作业",
            source="submit",
            params_snapshot=record.current_params.to_dict(),
        )
        record.history.append(history)
        self._records[work.id] = record
        return record

    def _add_history(
        self,
        record: ReviewRecord,
        reviewer: str,
        new_status: ReviewStatus,
        reason: str,
        source: str,
        notes: Optional[str] = None,
    ) -> ReviewHistory:
        history = ReviewHistory(
            id=_generate_id("h_"),
            work_id=record.work_id,
            reviewer=reviewer,
            old_status=record.current_status,
            new_status=new_status,
            reason=reason,
            source=source,
            params_snapshot=record.current_params.to_dict(),
            notes=notes,
        )
        record.history.append(history)
        record.current_status = new_status
        record.updated_at = datetime.now()
        return history

    def start_review(self, work_id: str, reviewer: str) -> ReviewRecord:
        record = self._get_record(work_id)
        self._add_history(
            record,
            reviewer=reviewer,
            new_status=ReviewStatus.UNDER_REVIEW,
            reason=f"{reviewer} 开始复核",
            source="review_start",
        )
        return record

    def approve(self, work_id: str, reviewer: str, reason: str) -> ReviewRecord:
        record = self._get_record(work_id)
        self._add_history(
            record,
            reviewer=reviewer,
            new_status=ReviewStatus.APPROVED,
            reason=reason,
            source="approve",
        )
        return record

    def reject(self, work_id: str, reviewer: str, reason: str) -> ReviewRecord:
        record = self._get_record(work_id)
        self._add_history(
            record,
            reviewer=reviewer,
            new_status=ReviewStatus.REJECTED,
            reason=reason,
            source="reject",
        )
        return record

    def revise(
        self,
        work_id: str,
        reviewer: str,
        new_status: ReviewStatus,
        reason: str,
        source: str = "revise",
        notes: Optional[str] = None,
    ) -> ReviewRecord:
        record = self._get_record(work_id)
        self._add_history(
            record,
            reviewer=reviewer,
            new_status=new_status,
            reason=reason,
            source=source,
            notes=notes,
        )
        return record

    def withdraw(
        self,
        work_id: str,
        reviewer: str,
        reason: str,
    ) -> ReviewRecord:
        record = self._get_record(work_id)
        record.withdrawal_record = {
            "reviewer": reviewer,
            "reason": reason,
            "timestamp": datetime.now().isoformat(),
            "previous_status": record.current_status.value,
        }
        self._add_history(
            record,
            reviewer=reviewer,
            new_status=ReviewStatus.WITHDRAWN,
            reason=reason,
            source="withdraw",
        )
        return record

    def add_supplementary_note(
        self, work_id: str, reviewer: str, note: str
    ) -> ReviewRecord:
        record = self._get_record(work_id)
        record.supplementary_notes.append(
            {
                "reviewer": reviewer,
                "note": note,
                "timestamp": datetime.now().isoformat(),
            }
        )
        record.updated_at = datetime.now()
        return record

    def get_record(self, work_id: str) -> Optional[ReviewRecord]:
        return self._records.get(work_id)

    def _get_record(self, work_id: str) -> ReviewRecord:
        record = self._records.get(work_id)
        if not record:
            raise ValueError(f"未找到作业记录: {work_id}")
        return record

    def list_records(
        self,
        status: Optional[ReviewStatus] = None,
        reviewer: Optional[str] = None,
        date_from: Optional[datetime] = None,
    ) -> List[ReviewRecord]:
        results = list(self._records.values())
        if status:
            results = [r for r in results if r.current_status == status]
        if reviewer:
            results = [
                r for r in results if any(h.reviewer == reviewer for h in r.history)
            ]
        if date_from:
            results = [r for r in results if r.updated_at >= date_from]
        return sorted(results, key=lambda r: r.updated_at, reverse=True)

    def get_history(self, work_id: str) -> List[ReviewHistory]:
        record = self._get_record(work_id)
        return sorted(record.history, key=lambda h: h.timestamp)

    def get_reviewer_daily_changes(
        self, reviewer: str, date: Optional[datetime] = None
    ) -> List[ReviewHistory]:
        if date is None:
            date = datetime.now()
        target_date = date.date()
        changes = []
        for record in self._records.values():
            for h in record.history:
                if h.reviewer == reviewer and h.timestamp.date() == target_date:
                    changes.append(h)
        return sorted(changes, key=lambda h: h.timestamp, reverse=True)

    def list_anomalies(self) -> List[Dict[str, Any]]:
        anomalies = []
        for record in self._records.values():
            input_type = record.work.detect_input_type(record.current_params)
            if input_type != InputType.NORMAL:
                anomalies.append(
                    {
                        "work_id": record.work_id,
                        "student": record.work.student_name,
                        "input_type": input_type.value,
                        "status": record.current_status.value,
                        "flags": record.anomaly_flags,
                    }
                )
        return anomalies
