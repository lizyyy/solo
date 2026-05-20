from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import json
import hashlib

from app.models import (
    ReconciliationRecord,
    ReconciliationBatch,
    DiscrepancyLog,
    ReviewHistory,
    ReconciliationStatus,
    VesselSchedule,
    Berth,
)
from app.services.reconciliation_service import ReconciliationService


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.reconciliation_service = ReconciliationService(db)

    def review_record(
        self,
        record_id: int,
        decision: str,
        notes: str = None,
        reviewer: str = None,
        override_reason: str = None,
    ) -> ReconciliationRecord:
        record = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.id == record_id).first()
        if not record:
            raise ValueError(f"Record {record_id} not found")

        previous_status = record.status
        previous_is_reviewed = record.is_reviewed

        if decision == "approve":
            record.status = ReconciliationStatus.APPROVED
            self._resolve_all_discrepancies(record_id, reviewer, "复核通过，差异已确认")
        elif decision == "reject":
            record.status = ReconciliationStatus.REJECTED
        elif decision == "need_info":
            record.status = ReconciliationStatus.NEEDS_MORE_INFO
        elif decision == "override":
            record.status = ReconciliationStatus.APPROVED
            record.override_reason = override_reason
            self._resolve_all_discrepancies(record_id, reviewer, f"强制放行: {override_reason}")

        record.is_reviewed = True
        record.reviewed_by = reviewer
        record.reviewed_at = datetime.utcnow()
        record.review_notes = notes

        history = ReviewHistory(
            record_id=record_id,
            batch_id=record.batch_id,
            action=f"review_{decision}",
            previous_status=previous_status,
            new_status=record.status,
            reviewer=reviewer,
            review_notes=notes,
            field_changes=json.dumps({"status": previous_status, "is_reviewed": previous_is_reviewed}),
        )
        self.db.add(history)

        self._update_batch_statistics(record.batch_id)
        self.db.commit()
        self.db.refresh(record)
        return record

    def batch_review(
        self,
        record_ids: List[int],
        decision: str,
        notes: str = None,
        reviewer: str = None,
    ) -> Dict[str, Any]:
        success_count = 0
        failed_ids = []

        for record_id in record_ids:
            try:
                self.review_record(record_id, decision, notes, reviewer)
                success_count += 1
            except Exception:
                failed_ids.append(record_id)

        return {
            "success_count": success_count,
            "failed_count": len(failed_ids),
            "failed_ids": failed_ids,
        }

    def resolve_discrepancy(
        self,
        discrepancy_id: int,
        resolution_notes: str,
        resolved_by: str = None,
    ) -> DiscrepancyLog:
        discrepancy = (
            self.db.query(DiscrepancyLog).filter(DiscrepancyLog.id == discrepancy_id).first()
        )
        if not discrepancy:
            raise ValueError(f"Discrepancy {discrepancy_id} not found")

        discrepancy.is_resolved = True
        discrepancy.resolved_by = resolved_by
        discrepancy.resolved_at = datetime.utcnow()
        discrepancy.resolution_notes = resolution_notes

        self.db.commit()
        self.db.refresh(discrepancy)

        record = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.id == discrepancy.record_id).first()
        if record:
            unresolved = (
                self.db.query(DiscrepancyLog)
                .filter(
                    DiscrepancyLog.record_id == record.id,
                    DiscrepancyLog.is_resolved == False,
                )
                .count()
            )
            if unresolved == 0 and record.status == ReconciliationStatus.AUTO_CHECKED:
                record.status = ReconciliationStatus.APPROVED
                self.db.commit()

            self._update_batch_statistics(record.batch_id)

        return discrepancy

    def update_vessel_and_recalculate(
        self,
        record_id: int,
        updates: Dict[str, Any],
        updated_by: str = None,
    ) -> ReconciliationRecord:
        record = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.id == record_id).first()
        if not record:
            raise ValueError(f"Record {record_id} not found")

        vessel = self.db.query(VesselSchedule).filter(VesselSchedule.id == record.vessel_schedule_id).first()
        if not vessel:
            raise ValueError(f"Vessel schedule not found for record {record_id}")

        old_values = {}
        for key, value in updates.items():
            if hasattr(vessel, key):
                old_values[key] = getattr(vessel, key)
                setattr(vessel, key, value)

        data_dict = {
            "vessel_name": vessel.vessel_name,
            "draft": vessel.draft,
            "eta": vessel.eta.isoformat() if vessel.eta else None,
            "berth_number": vessel.berth_number,
        }
        new_hash = hashlib.sha256(json.dumps(data_dict, sort_keys=True).encode()).hexdigest()

        record.current_data_hash = new_hash

        history = ReviewHistory(
            record_id=record_id,
            batch_id=record.batch_id,
            action="update_and_recalculate",
            previous_status=record.status,
            new_status=ReconciliationStatus.REVIEWING,
            reviewer=updated_by,
            review_notes=f"更新字段: {', '.join(old_values.keys())}",
            field_changes=json.dumps(old_values),
            data_snapshot=json.dumps({"old": old_values, "new": updates}),
        )
        self.db.add(history)

        batch_id = record.batch_id
        vessel_id = record.vessel_schedule_id

        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if batch:
            self.reconciliation_service.run_reconciliation(batch.batch_id)

        new_record = (
            self.db.query(ReconciliationRecord)
            .filter(
                ReconciliationRecord.batch_id == batch_id,
                ReconciliationRecord.vessel_schedule_id == vessel_id,
            )
            .first()
        )

        return new_record

    def get_review_history(self, record_id: int) -> List[ReviewHistory]:
        return (
            self.db.query(ReviewHistory)
            .filter(ReviewHistory.record_id == record_id)
            .order_by(ReviewHistory.created_at.desc())
            .all()
        )

    def approve_batch(self, batch_id: str, approved_by: str = None) -> ReconciliationBatch:
        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        records = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.batch_id == batch_id).all()
        for record in records:
            if record.status != ReconciliationStatus.REJECTED:
                record.status = ReconciliationStatus.APPROVED
                record.is_reviewed = True
                record.reviewed_by = approved_by
                record.reviewed_at = datetime.utcnow()
                self._resolve_all_discrepancies(record.id, approved_by, "批次整体审批通过")

        batch.status = ReconciliationStatus.APPROVED
        batch.approved_at = datetime.utcnow()
        batch.approved_by = approved_by

        self.db.commit()
        self.db.refresh(batch)
        return batch

    def _resolve_all_discrepancies(self, record_id: int, resolved_by: str, resolution_notes: str):
        discrepancies = (
            self.db.query(DiscrepancyLog)
            .filter(DiscrepancyLog.record_id == record_id, DiscrepancyLog.is_resolved == False)
            .all()
        )
        for disc in discrepancies:
            disc.is_resolved = True
            disc.resolved_by = resolved_by
            disc.resolved_at = datetime.utcnow()
            disc.resolution_notes = resolution_notes

    def _update_batch_statistics(self, batch_id: str):
        records = self.db.query(ReconciliationRecord).filter(ReconciliationRecord.batch_id == batch_id).all()

        total = len(records)
        passed = sum(1 for r in records if r.status == ReconciliationStatus.APPROVED)
        failed = sum(1 for r in records if r.status == ReconciliationStatus.REJECTED)
        warnings = sum(1 for r in records if r.has_discrepancy and r.status not in [ReconciliationStatus.REJECTED])

        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if batch:
            batch.total_records = total
            batch.passed_records = passed
            batch.failed_records = failed
            batch.warning_records = warnings
