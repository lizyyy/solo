from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.models import (
    ReconciliationRecordDB,
    AppointmentDB,
    AuditLogDB,
    VaccineInventoryDB
)


class TraceService:
    def __init__(self, db: Session):
        self.db = db

    def get_full_trace(self, record_id: str) -> Dict[str, Any]:
        record = self.db.query(ReconciliationRecordDB).filter(
            ReconciliationRecordDB.record_id == record_id
        ).first()

        if not record:
            raise ValueError(f"对账记录 {record_id} 不存在")

        appt = self.db.query(AppointmentDB).filter(
            AppointmentDB.appointment_id == record.appointment_id
        ).first()

        audit_logs = self.db.query(AuditLogDB).filter(
            AuditLogDB.reconciliation_record_id == record_id
        ).order_by(AuditLogDB.timestamp).all()

        inventory = None
        if appt:
            inventory = self.db.query(VaccineInventoryDB).filter(
                VaccineInventoryDB.vaccine_name == appt.vaccine_name
            ).first()

        trace = {
            "record_id": record_id,
            "generated_at": datetime.utcnow(),
            "trace_path": record.trace_path,
            "appointment": self._get_appointment_info(appt),
            "reconciliation": self._get_reconciliation_info(record),
            "audit_history": self._get_audit_history(audit_logs),
            "inventory_snapshot": self._get_inventory_info(inventory),
            "decision_explanation": self._generate_decision_explanation(record, appt)
        }

        return trace

    def _get_appointment_info(self, appt) -> Dict[str, Any]:
        if not appt:
            return {}
        return {
            "appointment_id": appt.appointment_id,
            "child_name": appt.child_name,
            "child_id_card": appt.child_id_card,
            "birth_date": appt.birth_date.isoformat() if appt.birth_date else None,
            "vaccine_name": appt.vaccine_name,
            "vaccine_batch": appt.vaccine_batch,
            "appointment_date": appt.appointment_date.isoformat() if appt.appointment_date else None,
            "appointment_time": appt.appointment_time,
            "is_reschedule": appt.is_reschedule,
            "reschedule_count": appt.reschedule_count,
            "original_appointment_id": appt.original_appointment_id,
            "guardian_name": appt.guardian_name,
            "contact_phone": appt.contact_phone,
            "address": appt.address,
            "remarks": appt.remarks,
            "import_batch": appt.batch_id,
            "imported_at": appt.imported_at.isoformat() if appt.imported_at else None
        }

    def _get_reconciliation_info(self, record) -> Dict[str, Any]:
        return {
            "record_id": record.record_id,
            "reconciliation_batch": record.reconciliation_batch_id,
            "status": record.status,
            "discrepancies": record.discrepancies,
            "auto_check_passed": record.auto_check_passed,
            "review_notes": record.review_notes,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
            "final_decision": record.final_decision,
            "decision_reason": record.decision_reason,
            "calculated_at": record.calculated_at.isoformat() if record.calculated_at else None,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None
        }

    def _get_audit_history(self, logs) -> List[Dict[str, Any]]:
        history = []
        for log in logs:
            history.append({
                "log_id": log.log_id,
                "action": log.action,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "changed_by": log.changed_by,
                "change_reason": log.change_reason,
                "previous_state": log.previous_state,
                "new_state": log.new_state
            })
        return history

    def _get_inventory_info(self, inventory) -> Dict[str, Any]:
        if not inventory:
            return {}
        return {
            "vaccine_name": inventory.vaccine_name,
            "vaccine_batch": inventory.vaccine_batch,
            "manufacturer": inventory.manufacturer,
            "expiration_date": inventory.expiration_date.isoformat() if inventory.expiration_date else None,
            "available_quantity": inventory.available_quantity,
            "total_quantity": inventory.total_quantity,
            "min_stock_level": inventory.min_stock_level,
            "location": inventory.location
        }

    def _generate_decision_explanation(self, record, appt) -> Dict[str, Any]:
        explanation = {
            "current_status": record.status,
            "status_meaning": self._get_status_meaning(record.status),
            "reasons": [],
            "recommended_actions": [],
            "can_appeal": record.status in ["auto_rejected", "manually_rejected", "needs_more_info"]
        }

        for disc in record.discrepancies:
            explanation["reasons"].append({
                "type": disc.get("type"),
                "description": disc.get("description"),
                "severity": disc.get("severity")
            })
            if disc.get("suggested_action"):
                explanation["recommended_actions"].append(disc.get("suggested_action"))

        if record.decision_reason:
            explanation["manual_decision_reason"] = record.decision_reason

        return explanation

    def _get_status_meaning(self, status: str) -> str:
        meanings = {
            "pending": "待处理 - 记录已创建，尚未进行自动校验",
            "auto_approved": "自动通过 - 所有自动校验通过，无严重差异",
            "auto_rejected": "自动拒绝 - 存在严重问题，自动校验不通过",
            "needs_review": "待人工复核 - 存在需要人工判断的差异",
            "manually_approved": "人工通过 - 经人工复核确认通过",
            "manually_rejected": "人工拒绝 - 经人工复核确认拒绝",
            "needs_more_info": "需补充材料 - 需要更多信息才能做出决定"
        }
        return meanings.get(status, "未知状态")

    def get_record_by_appointment(self, appointment_id: str) -> List[Dict[str, Any]]:
        records = self.db.query(ReconciliationRecordDB).filter(
            ReconciliationRecordDB.appointment_id == appointment_id
        ).order_by(ReconciliationRecordDB.created_at.desc()).all()

        return [self.get_full_trace(r.record_id) for r in records]

    def get_child_history(self, child_id_card: str) -> Dict[str, Any]:
        appts = self.db.query(AppointmentDB).filter(
            AppointmentDB.child_id_card == child_id_card
        ).order_by(AppointmentDB.appointment_date).all()

        history = {
            "child_id_card": child_id_card,
            "total_appointments": len(appts),
            "appointments": []
        }

        for appt in appts:
            records = self.db.query(ReconciliationRecordDB).filter(
                ReconciliationRecordDB.appointment_id == appt.appointment_id
            ).all()

            history["appointments"].append({
                "appointment_id": appt.appointment_id,
                "vaccine_name": appt.vaccine_name,
                "appointment_date": appt.appointment_date.isoformat() if appt.appointment_date else None,
                "is_reschedule": appt.is_reschedule,
                "reschedule_count": appt.reschedule_count,
                "reconciliation_records": [
                    {
                        "record_id": r.record_id,
                        "status": r.status,
                        "created_at": r.created_at.isoformat() if r.created_at else None
                    }
                    for r in records
                ]
            })

        return history
