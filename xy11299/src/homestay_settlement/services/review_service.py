from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import (
    Issue,
    CleaningRecord,
    Rework,
    Cleaner,
    DeductionStatus,
    RecordStatus,
    AuditLog,
)


class ReviewService:
    def __init__(self, db: Session, operator: str = "system"):
        self.db = db
        self.operator = operator

    def _log_audit(self, action: str, entity_type: str, entity_id: int, old_value: Dict = None, new_value: Dict = None):
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            operator=self.operator,
        )
        self.db.add(log)

    def get_pending_issues(self, cleaner_id: int = None) -> List[Issue]:
        query = self.db.query(Issue).filter(Issue.deduction_status == DeductionStatus.PENDING)
        if cleaner_id:
            query = query.join(CleaningRecord).filter(CleaningRecord.cleaner_id == cleaner_id)
        return query.all()

    def confirm_deduction(self, issue_id: int, reviewer_notes: str = "") -> Optional[Issue]:
        issue = self.db.query(Issue).filter(Issue.id == issue_id).first()
        if not issue:
            return None

        old_status = issue.deduction_status
        issue.deduction_status = DeductionStatus.CONFIRMED
        issue.reviewer = self.operator
        issue.reviewed_at = datetime.utcnow()
        issue.resolution_notes = reviewer_notes

        self._log_audit(
            "confirm_deduction",
            "Issue",
            issue.id,
            old_value={"status": old_status},
            new_value={"status": DeductionStatus.CONFIRMED, "notes": reviewer_notes},
        )

        self.db.commit()
        return issue

    def appeal_issue(self, issue_id: int, appeal_reason: str) -> Optional[Issue]:
        issue = self.db.query(Issue).filter(Issue.id == issue_id).first()
        if not issue:
            return None

        old_status = issue.deduction_status
        issue.deduction_status = DeductionStatus.APPEALED
        issue.resolution_notes = f"申诉: {appeal_reason}"

        self._log_audit(
            "appeal",
            "Issue",
            issue.id,
            old_value={"status": old_status},
            new_value={"status": DeductionStatus.APPEALED, "appeal_reason": appeal_reason},
        )

        self.db.commit()
        return issue

    def resolve_issue(self, issue_id: int, resolution_notes: str, adjust_amount: float = None) -> Optional[Issue]:
        issue = self.db.query(Issue).filter(Issue.id == issue_id).first()
        if not issue:
            return None

        old_status = issue.deduction_status
        old_amount = issue.deduction_amount

        issue.deduction_status = DeductionStatus.RESOLVED
        issue.resolution_notes = resolution_notes
        issue.reviewer = self.operator
        issue.reviewed_at = datetime.utcnow()

        if adjust_amount is not None:
            issue.deduction_amount = adjust_amount

        self._log_audit(
            "resolve",
            "Issue",
            issue.id,
            old_value={"status": old_status, "amount": old_amount},
            new_value={"status": DeductionStatus.RESOLVED, "amount": issue.deduction_amount, "notes": resolution_notes},
        )

        self.db.commit()
        return issue

    def create_rework(self, issue_id: int, cleaner_id: int, rework_date: datetime, notes: str = "") -> Optional[Rework]:
        issue = self.db.query(Issue).filter(Issue.id == issue_id).first()
        if not issue:
            return None

        rework = Rework(
            issue_id=issue.id,
            cleaner_id=cleaner_id,
            rework_date=rework_date,
            notes=notes,
            is_completed=False,
        )

        self.db.add(rework)
        self.db.flush()
        self._log_audit("create_rework", "Rework", rework.id, new_value={"issue_id": issue_id, "cleaner_id": cleaner_id})

        self.db.commit()
        return rework

    def complete_rework(self, rework_id: int, verified_by: str = None) -> Optional[Rework]:
        rework = self.db.query(Rework).filter(Rework.id == rework_id).first()
        if not rework:
            return None

        rework.is_completed = True
        rework.verified_by = verified_by or self.operator
        rework.verified_at = datetime.utcnow()

        self._log_audit("complete_rework", "Rework", rework.id, new_value={"completed": True})

        self.db.commit()
        return rework

    def mark_record_reviewed(self, record_id: int) -> Optional[CleaningRecord]:
        record = self.db.query(CleaningRecord).filter(CleaningRecord.id == record_id).first()
        if not record:
            return None

        old_status = record.status_record
        record.status_record = RecordStatus.REVIEWED

        self._log_audit(
            "mark_reviewed",
            "CleaningRecord",
            record.id,
            old_value={"status": old_status},
            new_value={"status": RecordStatus.REVIEWED},
        )

        self.db.commit()
        return record

    def get_issue_summary(self, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        query = self.db.query(Issue)

        if start_date:
            query = query.filter(Issue.reported_at >= start_date)
        if end_date:
            query = query.filter(Issue.reported_at <= end_date)

        all_issues = query.all()

        summary = {
            "total": len(all_issues),
            "by_status": {},
            "by_type": {},
            "total_deductions": 0.0,
        }

        for status in DeductionStatus:
            count = sum(1 for i in all_issues if i.deduction_status == status.value)
            if count > 0:
                summary["by_status"][status.value] = count

        for issue_type in IssueType:
            count = sum(1 for i in all_issues if i.issue_type == issue_type.value)
            if count > 0:
                summary["by_type"][issue_type.value] = count

        summary["total_deductions"] = sum(
            i.deduction_amount for i in all_issues if i.deduction_status in [DeductionStatus.CONFIRMED, DeductionStatus.RESOLVED]
        )

        return summary
