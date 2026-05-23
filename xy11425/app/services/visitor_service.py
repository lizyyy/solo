from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    VisitorRecord,
    AuditLog,
    Batch,
    Material,
)
from ..schemas import VisitorRecordUpdate


class VisitorService:
    @staticmethod
    def create_visitor_record(
        db: Session,
        batch_id: int,
        material_id: Optional[int],
        visitor_data: Dict[str, Any],
        created_by: str,
    ) -> VisitorRecord:
        record = VisitorRecord(
            batch_id=batch_id,
            material_id=material_id,
            visitor_name=visitor_data.get("visitor_name"),
            visitor_phone=visitor_data.get("visitor_phone"),
            id_card=visitor_data.get("id_card"),
            license_plate=visitor_data.get("license_plate"),
            visit_date=visitor_data.get("visit_date"),
            expected_end_date=visitor_data.get("expected_end_date"),
            actual_end_date=visitor_data.get("actual_end_date"),
            gate_in_time=visitor_data.get("gate_in_time"),
            gate_out_time=visitor_data.get("gate_out_time"),
            is_overstay=visitor_data.get("is_overstay", False),
            price_adjustment=visitor_data.get("price_adjustment"),
            review_status=visitor_data.get("review_status"),
            review_comment=visitor_data.get("review_comment"),
            source=visitor_data.get("source"),
            metadata=visitor_data.get("metadata", {}),
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        audit_log = AuditLog(
            batch_id=batch_id,
            visitor_record_id=record.id,
            action="create",
            changed_by=created_by,
            metadata={"source": record.source},
        )
        db.add(audit_log)
        db.commit()

        return record

    @staticmethod
    def get_visitor_record(
        db: Session,
        record_id: int,
    ) -> Optional[VisitorRecord]:
        return (
            db.query(VisitorRecord).filter(VisitorRecord.id == record_id).first()
        )

    @staticmethod
    def list_visitor_records(
        db: Session,
        batch_id: Optional[int] = None,
        is_overstay: Optional[bool] = None,
        review_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[VisitorRecord], int]:
        query = db.query(VisitorRecord)

        if batch_id:
            query = query.filter(VisitorRecord.batch_id == batch_id)
        if is_overstay is not None:
            query = query.filter(VisitorRecord.is_overstay == is_overstay)
        if review_status:
            query = query.filter(VisitorRecord.review_status == review_status)

        total = query.count()
        records = query.order_by(VisitorRecord.created_at.desc()).offset(skip).limit(limit).all()

        return records, total

    @staticmethod
    def update_visitor_record(
        db: Session,
        record_id: int,
        update_data: VisitorRecordUpdate,
        updated_by: str,
    ) -> Optional[VisitorRecord]:
        record = VisitorService.get_visitor_record(db, record_id)
        if not record:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        
        for field, new_value in update_dict.items():
            old_value = getattr(record, field)
            if old_value != new_value:
                audit_log = AuditLog(
                    batch_id=record.batch_id,
                    visitor_record_id=record.id,
                    action="update",
                    field_name=field,
                    old_value=str(old_value) if old_value else None,
                    new_value=str(new_value) if new_value else None,
                    changed_by=updated_by,
                )
                db.add(audit_log)

                setattr(record, field, new_value)

        record.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(record)

        return record

    @staticmethod
    def get_audit_logs(
        db: Session,
        record_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[AuditLog], int]:
        query = db.query(AuditLog)

        if record_id:
            query = query.filter(AuditLog.visitor_record_id == record_id)
        if batch_id:
            query = query.filter(AuditLog.batch_id == batch_id)

        total = query.count()
        logs = query.order_by(AuditLog.changed_at.desc()).offset(skip).limit(limit).all()

        return logs, total

    @staticmethod
    def get_batch_statistics(
        db: Session,
        batch_id: int,
    ) -> Dict[str, Any]:
        records = db.query(VisitorRecord).filter(VisitorRecord.batch_id == batch_id)

        total = records.count()
        overstay_count = records.filter(VisitorRecord.is_overstay == True).count()
        has_price_adjustment = records.filter(
            VisitorRecord.price_adjustment.isnot(None)
        ).count()
        reviewed_count = records.filter(
            VisitorRecord.reviewed_by.isnot(None)
        ).count()

        return {
            "total_visitors": total,
            "overstay_count": overstay_count,
            "overstay_rate": (overstay_count / total * 100) if total > 0 else 0,
            "manual_adjustment_count": has_price_adjustment,
            "reviewed_count": reviewed_count,
            "pending_review_count": total - reviewed_count,
        }

    @staticmethod
    def bulk_create_records(
        db: Session,
        batch_id: int,
        material_id: Optional[int],
        records_data: List[Dict[str, Any]],
        created_by: str,
    ) -> int:
        count = 0
        for data in records_data:
            VisitorService.create_visitor_record(
                db, batch_id, material_id, data, created_by
            )
            count += 1
        return count
