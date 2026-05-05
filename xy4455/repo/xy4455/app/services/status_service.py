from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid
import json

from app.models.models import (
    AnesthesiaRecord, InfusionPumpLog, CageSensor, MedicationPlan,
    HandoffRecord, PatientStatus, AuditLog
)
from app.services.anomaly_service import AnomalyDetectionService

class StatusJudgmentService:
    def __init__(self, db: Session):
        self.db = db
        self.anomaly_service = AnomalyDetectionService(db)
    
    def determine_patient_status(self, patient_id: str) -> Dict[str, Any]:
        anomalies = self.anomaly_service.check_all_anomalies(patient_id)
        
        has_awakening_timeout = anomalies["awakening_timeout"]["has_timeout"]
        has_infusion_interruption = anomalies["infusion_interruption"]["has_interruption"]
        has_temp_oxygen_abnormal = anomalies["temp_oxygen_abnormal"]["has_abnormal"]
        has_medication_conflicts = anomalies["medication_conflicts"]["has_conflict"]
        
        abnormal_details = []
        
        if has_awakening_timeout:
            abnormal_details.append(anomalies["awakening_timeout"]["details"])
        
        if has_infusion_interruption:
            abnormal_details.append(anomalies["infusion_interruption"]["details"])
        
        if has_temp_oxygen_abnormal:
            abnormal_details.append(anomalies["temp_oxygen_abnormal"]["details"])
        
        if has_medication_conflicts:
            abnormal_details.append(anomalies["medication_conflicts"]["details"])
        
        high_risk_anomalies = 0
        medium_risk_anomalies = 0
        
        if has_awakening_timeout:
            high_risk_anomalies += 1
        
        if has_infusion_interruption:
            for interruption in anomalies["infusion_interruption"].get("interruptions", []):
                if interruption.get("is_ongoing"):
                    high_risk_anomalies += 1
                else:
                    medium_risk_anomalies += 1
        
        if has_temp_oxygen_abnormal:
            for reading in anomalies["temp_oxygen_abnormal"].get("abnormal_readings", []):
                if reading.get("temp_abnormal"):
                    temp = reading.get("temperature")
                    if temp is not None and (temp < 35.0 or temp > 40.0):
                        high_risk_anomalies += 1
                    else:
                        medium_risk_anomalies += 1
                
                if reading.get("oxy_abnormal"):
                    oxy = reading.get("oxygen_level")
                    if oxy is not None and oxy < 85.0:
                        high_risk_anomalies += 1
                    else:
                        medium_risk_anomalies += 1
        
        if has_medication_conflicts:
            for conflict in anomalies["medication_conflicts"].get("conflicts", []):
                if conflict.get("severity") == "高":
                    high_risk_anomalies += 1
                else:
                    medium_risk_anomalies += 1
        
        if high_risk_anomalies > 0:
            status = PatientStatus.ALERT
            status_reason = f"存在 {high_risk_anomalies} 项高风险异常"
        elif medium_risk_anomalies > 0:
            status = PatientStatus.NEED_REVIEW
            status_reason = f"存在 {medium_risk_anomalies} 项中风险异常, 需要复查"
        else:
            status = PatientStatus.NORMAL_CARE
            status_reason = "所有指标正常, 可转普通护理"
        
        return {
            "patient_id": patient_id,
            "status": status,
            "status_reason": status_reason,
            "high_risk_count": high_risk_anomalies,
            "medium_risk_count": medium_risk_anomalies,
            "has_awakening_timeout": has_awakening_timeout,
            "has_infusion_interruption": has_infusion_interruption,
            "has_temp_oxygen_abnormal": has_temp_oxygen_abnormal,
            "has_medication_conflicts": has_medication_conflicts,
            "abnormal_details": "; ".join(abnormal_details) if abnormal_details else None,
            "anomaly_details": anomalies
        }
    
    def create_handoff_record(self, patient_id: str, shift_date: datetime,
                               nurse_name: Optional[str] = None,
                               review_notes: Optional[str] = None) -> HandoffRecord:
        patient_info = self._get_patient_basic_info(patient_id)
        
        status_result = self.determine_patient_status(patient_id)
        
        handoff_id = f"HO-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        
        handoff_record = HandoffRecord(
            handoff_id=handoff_id,
            patient_id=patient_id,
            patient_name=patient_info.get("patient_name"),
            species=patient_info.get("species"),
            breed=patient_info.get("breed"),
            shift_date=shift_date,
            nurse_name=nurse_name,
            status=status_result["status"],
            has_awakening_timeout=status_result["has_awakening_timeout"],
            has_infusion_interruption=status_result["has_infusion_interruption"],
            has_temp_oxygen_abnormal=status_result["has_temp_oxygen_abnormal"],
            has_medication_conflict=status_result["has_medication_conflicts"],
            abnormal_details=status_result["abnormal_details"],
            nurse_review_notes=review_notes
        )
        
        self.db.add(handoff_record)
        
        audit_log = AuditLog(
            handoff_id=handoff_id,
            patient_id=patient_id,
            action="创建交接记录",
            action_details=json.dumps({
                "initial_status": status_result["status"].value,
                "anomaly_summary": {
                    "awakening_timeout": status_result["has_awakening_timeout"],
                    "infusion_interruption": status_result["has_infusion_interruption"],
                    "temp_oxygen_abnormal": status_result["has_temp_oxygen_abnormal"],
                    "medication_conflict": status_result["has_medication_conflicts"]
                }
            }, ensure_ascii=False),
            performed_by=nurse_name
        )
        self.db.add(audit_log)
        
        self.db.commit()
        self.db.refresh(handoff_record)
        
        return handoff_record
    
    def update_handoff_status(self, handoff_id: str, new_status: PatientStatus,
                               review_notes: Optional[str] = None,
                               reviewed_by: Optional[str] = None) -> Optional[HandoffRecord]:
        handoff_record = self.db.query(HandoffRecord).filter(
            HandoffRecord.handoff_id == handoff_id
        ).first()
        
        if not handoff_record:
            return None
        
        old_status = handoff_record.status
        old_final_status = handoff_record.final_status
        
        handoff_record.final_status = new_status
        handoff_record.is_reviewed = True
        handoff_record.reviewed_by = reviewed_by
        handoff_record.reviewed_at = datetime.utcnow()
        
        if review_notes:
            existing_notes = handoff_record.nurse_review_notes or ""
            handoff_record.nurse_review_notes = f"{existing_notes}\n[复核改判] {reviewed_by or '未知'}: {review_notes}".strip()
        
        audit_log = AuditLog(
            handoff_id=handoff_id,
            patient_id=handoff_record.patient_id,
            action="状态改判",
            action_details=json.dumps({
                "old_status": old_status.value,
                "old_final_status": old_final_status.value if old_final_status else None,
                "new_status": new_status.value,
                "review_notes": review_notes
            }, ensure_ascii=False),
            performed_by=reviewed_by
        )
        self.db.add(audit_log)
        
        self.db.commit()
        self.db.refresh(handoff_record)
        
        return handoff_record
    
    def _get_patient_basic_info(self, patient_id: str) -> Dict[str, Any]:
        anesthesia = self.db.query(AnesthesiaRecord).filter(
            AnesthesiaRecord.patient_id == patient_id
        ).order_by(AnesthesiaRecord.created_at.desc()).first()
        
        if anesthesia:
            return {
                "patient_name": anesthesia.patient_name,
                "species": anesthesia.species,
                "breed": anesthesia.breed
            }
        
        return {
            "patient_name": None,
            "species": None,
            "breed": None
        }
    
    def get_handoff_record(self, handoff_id: str) -> Optional[HandoffRecord]:
        return self.db.query(HandoffRecord).filter(
            HandoffRecord.handoff_id == handoff_id
        ).first()
    
    def get_patient_handoffs(self, patient_id: str) -> List[HandoffRecord]:
        return self.db.query(HandoffRecord).filter(
            HandoffRecord.patient_id == patient_id
        ).order_by(HandoffRecord.created_at.desc()).all()
    
    def get_all_handoffs(self, start_date: Optional[datetime] = None,
                         end_date: Optional[datetime] = None,
                         status: Optional[PatientStatus] = None) -> List[HandoffRecord]:
        query = self.db.query(HandoffRecord)
        
        if start_date:
            query = query.filter(HandoffRecord.shift_date >= start_date)
        
        if end_date:
            query = query.filter(HandoffRecord.shift_date <= end_date)
        
        if status:
            query = query.filter(
                (HandoffRecord.final_status == status) | 
                (HandoffRecord.status == status)
            )
        
        return query.order_by(HandoffRecord.created_at.desc()).all()
