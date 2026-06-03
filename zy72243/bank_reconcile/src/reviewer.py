from datetime import datetime
from .database import load_config, get_session
from .models import ClearingBatch, TransactionRecord, AuditTrail, HolidayAdjustment


class ReviewManager:
    def __init__(self):
        self.session = get_session()
        config = load_config()
        self.roles = config["roles"]
        self.audit_reasons = config["audit_reasons"]

    def add_holiday_adjustment(self, batch_no, original_date, adjusted_date, reason, operator_note=""):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if batch:
            adjustment = HolidayAdjustment(
                batch_id=batch.id,
                original_date=original_date,
                adjusted_date=adjusted_date,
                reason=reason,
                operator_note=operator_note,
                applied_by=self.roles["operator"],
                applied_at=datetime.now()
            )
            self.session.add(adjustment)
            batch.status = "holiday_applied"
            self.session.commit()

            self._update_audit_after_holiday(batch.id)
            return {"id": adjustment.id, "batch_no": batch_no}
        return None

    def _update_audit_after_holiday(self, batch_id):
        audits = self.session.query(AuditTrail).filter(
            AuditTrail.batch_id == batch_id,
            AuditTrail.audit_type == "missing_holiday_note",
            AuditTrail.is_resolved == False
        ).all()

        for audit in audits:
            audit.status = "reviewed"
            audit.is_resolved = True
            audit.resolved_at = datetime.now()
            audit.resolved_note = f"已补录节假日顺延说明，由{self.roles['operator']}操作"
            audit.next_action = "已完成"
            audit.reason = "节假日顺延说明已补录"
            audit.missing_materials = ""

        self.session.commit()

    def review_mixed_currency(self, transaction_id, review_note, reviewed_by=None, mark_normal=False):
        record = self.session.query(TransactionRecord).filter_by(id=transaction_id).first()
        if not record:
            return None

        record.is_reviewed = True
        record.reviewed_by = reviewed_by or self.roles["custodian"]
        record.reviewed_at = datetime.now()
        record.review_note = review_note

        if mark_normal:
            record.has_mixed_currency = False

        audits = self.session.query(AuditTrail).filter(
            AuditTrail.transaction_id == transaction_id,
            AuditTrail.audit_type == "mixed_currency"
        ).all()

        for audit in audits:
            if mark_normal:
                audit.status = "resolved"
                audit.is_resolved = True
                audit.resolved_at = datetime.now()
                audit.resolved_note = review_note
                audit.reason = "已复核，确认无异常"
                audit.next_action = "已完成"
                audit.missing_materials = ""
            else:
                audit.status = "reviewed"
                audit.reason = f"{self.roles['custodian']}已复核: {review_note}"
                audit.next_action = "请确认最终处理方式"

        self.session.commit()
        return {
            "transaction_id": transaction_id,
            "reviewed_by": record.reviewed_by,
            "mark_normal": mark_normal
        }

    def get_pending_reviews(self, batch_no=None, review_type=None):
        query = self.session.query(AuditTrail).filter(AuditTrail.is_resolved == False)

        if batch_no:
            batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
            if batch:
                query = query.filter(AuditTrail.batch_id == batch.id)

        if review_type:
            query = query.filter(AuditTrail.audit_type == review_type)

        audits = query.all()
        return [self._audit_to_dict(a) for a in audits]

    def get_transaction_with_audit(self, transaction_id):
        record = self.session.query(TransactionRecord).filter_by(id=transaction_id).first()
        if not record:
            return None

        audits = self.session.query(AuditTrail).filter_by(transaction_id=transaction_id).all()
        batch = self.session.query(ClearingBatch).filter_by(id=record.batch_id).first()
        holiday_notes = self.session.query(HolidayAdjustment).filter_by(batch_id=record.batch_id).all()

        return {
            "transaction": self._record_to_dict(record),
            "batch": self._batch_to_dict(batch) if batch else None,
            "audits": [self._audit_to_dict(a) for a in audits],
            "holiday_notes": [self._holiday_to_dict(h) for h in holiday_notes]
        }

    def get_batch_summary(self, batch_no):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if batch:
            return self._batch_to_dict(batch)
        return None

    def _record_to_dict(self, record):
        return {
            "id": record.id,
            "batch_id": record.batch_id,
            "transaction_date": record.transaction_date.strftime("%Y-%m-%d") if record.transaction_date else None,
            "transaction_no": record.transaction_no,
            "summary": record.summary,
            "amount": record.amount,
            "amount_column_raw": record.amount_column_raw,
            "currency": record.currency,
            "has_mixed_currency": record.has_mixed_currency,
            "detected_currencies": record.detected_currencies,
            "counterparty": record.counterparty,
            "remark": record.remark,
            "is_reviewed": record.is_reviewed,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else None,
            "review_note": record.review_note
        }

    def _audit_to_dict(self, audit):
        return {
            "id": audit.id,
            "batch_id": audit.batch_id,
            "transaction_id": audit.transaction_id,
            "audit_type": audit.audit_type,
            "status": audit.status,
            "reason": audit.reason,
            "missing_materials": audit.missing_materials,
            "next_action": audit.next_action,
            "responsible_party": audit.responsible_party,
            "is_resolved": audit.is_resolved,
            "resolved_at": audit.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if audit.resolved_at else None,
            "resolved_note": audit.resolved_note,
            "created_at": audit.created_at.strftime("%Y-%m-%d %H:%M:%S") if audit.created_at else None
        }

    def _batch_to_dict(self, batch):
        return {
            "id": batch.id,
            "batch_no": batch.batch_no,
            "import_date": batch.import_date.strftime("%Y-%m-%d %H:%M:%S") if batch.import_date else None,
            "source_file": batch.source_file,
            "status": batch.status,
            "total_records": batch.total_records,
            "mixed_currency_count": batch.mixed_currency_count
        }

    def _holiday_to_dict(self, holiday):
        return {
            "id": holiday.id,
            "batch_id": holiday.batch_id,
            "original_date": holiday.original_date.strftime("%Y-%m-%d") if holiday.original_date else None,
            "adjusted_date": holiday.adjusted_date.strftime("%Y-%m-%d") if holiday.adjusted_date else None,
            "reason": holiday.reason,
            "operator_note": holiday.operator_note,
            "applied_by": holiday.applied_by,
            "applied_at": holiday.applied_at.strftime("%Y-%m-%d %H:%M:%S") if holiday.applied_at else None
        }
