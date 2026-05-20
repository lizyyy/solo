import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import (
    ReconciliationRecordDB,
    AuditLogDB,
    RecordStatus,
    ReviewAction
)


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def review_record(
        self,
        record_id: str,
        action: ReviewAction,
        reviewer: str,
        review_notes: Optional[str] = None,
        decision_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        record = self.db.query(ReconciliationRecordDB).filter(
            ReconciliationRecordDB.record_id == record_id
        ).first()

        if not record:
            raise ValueError(f"对账记录 {record_id} 不存在")

        previous_state = {
            "status": record.status,
            "review_notes": record.review_notes,
            "final_decision": record.final_decision,
            "decision_reason": record.decision_reason,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None
        }

        new_status = self._map_action_to_status(action)
        record.status = new_status.value
        record.review_notes = review_notes
        record.final_decision = action.value
        record.decision_reason = decision_reason
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.utcnow()

        trace_entry = f"人工复核:{reviewer}:{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        if trace_entry not in record.trace_path:
            record.trace_path.append(trace_entry)

        audit_log = self._create_audit_log(
            record_id=record_id,
            action=f"review_{action.value}",
            previous_state=previous_state,
            new_state={
                "status": record.status,
                "review_notes": review_notes,
                "final_decision": action.value,
                "decision_reason": decision_reason,
                "reviewed_by": reviewer,
                "reviewed_at": record.reviewed_at.isoformat()
            },
            changed_by=reviewer,
            change_reason=decision_reason or review_notes or "人工复核"
        )

        self.db.add(audit_log)
        self.db.commit()

        return {
            "record_id": record_id,
            "previous_status": previous_state["status"],
            "new_status": new_status.value,
            "action": action.value,
            "reviewer": reviewer,
            "reviewed_at": record.reviewed_at,
            "audit_log_id": audit_log.log_id
        }

    def _map_action_to_status(self, action: ReviewAction) -> RecordStatus:
        mapping = {
            ReviewAction.APPROVE: RecordStatus.MANUALLY_APPROVED,
            ReviewAction.REJECT: RecordStatus.MANUALLY_REJECTED,
            ReviewAction.REQUEST_INFO: RecordStatus.NEEDS_MORE_INFO,
            ReviewAction.MARK_AS_RESOLVED: RecordStatus.MANUALLY_APPROVED
        }
        return mapping.get(action, RecordStatus.NEEDS_REVIEW)

    def _create_audit_log(
        self,
        record_id: str,
        action: str,
        previous_state: Dict[str, Any],
        new_state: Dict[str, Any],
        changed_by: str,
        change_reason: str
    ) -> AuditLogDB:
        return AuditLogDB(
            log_id=f"log_{uuid.uuid4().hex[:12]}",
            reconciliation_record_id=record_id,
            action=action,
            previous_state=previous_state,
            new_state=new_state,
            changed_by=changed_by,
            change_reason=change_reason,
            timestamp=datetime.utcnow()
        )

    def get_review_statistics(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(ReconciliationRecordDB)
        if batch_id:
            query = query.filter(ReconciliationRecordDB.reconciliation_batch_id == batch_id)

        records = query.all()

        total = len(records)
        stats = {
            "total": total,
            "by_status": {},
            "review_progress": 0,
            "auto_processed": 0,
            "manually_processed": 0,
            "pending_review": 0
        }

        for status in RecordStatus:
            count = sum(1 for r in records if r.status == status.value)
            stats["by_status"][status.value] = count

        stats["auto_processed"] = (
            stats["by_status"].get(RecordStatus.AUTO_APPROVED.value, 0) +
            stats["by_status"].get(RecordStatus.AUTO_REJECTED.value, 0)
        )

        stats["manually_processed"] = (
            stats["by_status"].get(RecordStatus.MANUALLY_APPROVED.value, 0) +
            stats["by_status"].get(RecordStatus.MANUALLY_REJECTED.value, 0) +
            stats["by_status"].get(RecordStatus.NEEDS_MORE_INFO.value, 0)
        )

        stats["pending_review"] = (
            stats["by_status"].get(RecordStatus.NEEDS_REVIEW.value, 0) +
            stats["by_status"].get(RecordStatus.PENDING.value, 0)
        )

        if total > 0:
            stats["review_progress"] = round((stats["manually_processed"] + stats["auto_processed"]) / total * 100, 2)

        return stats

    def batch_review(
        self,
        record_ids: list,
        action: ReviewAction,
        reviewer: str,
        batch_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        results = []
        errors = []

        for record_id in record_ids:
            try:
                result = self.review_record(
                    record_id=record_id,
                    action=action,
                    reviewer=reviewer,
                    review_notes=batch_notes,
                    decision_reason=f"批量处理: {batch_notes}" if batch_notes else "批量处理"
                )
                results.append(result)
            except Exception as e:
                errors.append({"record_id": record_id, "error": str(e)})

        return {
            "processed_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors
        }
