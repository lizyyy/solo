from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import json

from app.models.models import (
    HandoffRecord, PatientStatus, AuditLog, AnesthesiaRecord,
    InfusionPumpLog, CageSensor, MedicationPlan
)

STATUS_DISPLAY = {
    PatientStatus.NORMAL_CARE: "转普通护理",
    PatientStatus.NEED_REVIEW: "需要复查",
    PatientStatus.ALERT: "必须报警"
}

class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_markdown_handoff(self, handoff_id: str) -> Optional[str]:
        handoff = self.db.query(HandoffRecord).filter(
            HandoffRecord.handoff_id == handoff_id
        ).first()
        
        if not handoff:
            return None
        
        patient_details = self._get_patient_details(handoff.patient_id)
        
        md_lines = []
        
        md_lines.append(f"# 术后监护交接单\n")
        md_lines.append(f"**交接编号**: {handoff.handoff_id}  \n")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n")
        md_lines.append(f"**交接日期**: {handoff.shift_date.strftime('%Y-%m-%d') if handoff.shift_date else '未知'}  \n")
        md_lines.append(f"**护士**: {handoff.nurse_name or '未记录'}  \n")
        md_lines.append(f"\n---\n")
        
        md_lines.append(f"## 患者信息\n")
        md_lines.append(f"| 项目 | 内容 |")
        md_lines.append(f"|------|------|")
        md_lines.append(f"| 患者ID | {handoff.patient_id} |")
        md_lines.append(f"| 姓名 | {handoff.patient_name or '未知'} |")
        md_lines.append(f"| 物种 | {handoff.species or '未知'} |")
        md_lines.append(f"| 品种 | {handoff.breed or '未知'} |")
        md_lines.append(f"\n")
        
        md_lines.append(f"## 状态判定\n")
        display_status = STATUS_DISPLAY.get(handoff.status, handoff.status.value)
        final_status = STATUS_DISPLAY.get(handoff.final_status, "未复核") if handoff.final_status else "未复核"
        
        status_color = "🟢" if handoff.status == PatientStatus.NORMAL_CARE else (
            "🟡" if handoff.status == PatientStatus.NEED_REVIEW else "🔴"
        )
        
        md_lines.append(f"**初始状态**: {status_color} {display_status}  \n")
        md_lines.append(f"**最终状态**: {final_status}  \n")
        md_lines.append(f"**复核状态**: {'✅ 已复核' if handoff.is_reviewed else '⏳ 待复核'}  \n")
        if handoff.reviewed_by:
            md_lines.append(f"**复核人**: {handoff.reviewed_by}  \n")
        if handoff.reviewed_at:
            md_lines.append(f"**复核时间**: {handoff.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}  \n")
        md_lines.append(f"\n")
        
        md_lines.append(f"## 异常检测结果\n")
        
        anomalies = []
        if handoff.has_awakening_timeout:
            anomalies.append("- ⚠️ 苏醒超时")
        if handoff.has_infusion_interruption:
            anomalies.append("- ⚠️ 输液中断")
        if handoff.has_temp_oxygen_abnormal:
            anomalies.append("- ⚠️ 温氧异常")
        if handoff.has_medication_conflict:
            anomalies.append("- ⚠️ 用药冲突")
        
        if anomalies:
            md_lines.append("### 检测到的异常:\n")
            for a in anomalies:
                md_lines.append(a)
        else:
            md_lines.append("✅ 未检测到异常\n")
        
        if handoff.abnormal_details:
            md_lines.append(f"\n**详细信息**:  \n{handoff.abnormal_details}\n")
        md_lines.append(f"\n")
        
        if patient_details["anesthesia"]:
            md_lines.append(f"## 麻醉记录\n")
            anes = patient_details["anesthesia"]
            md_lines.append(f"| 项目 | 内容 |")
            md_lines.append(f"|------|------|")
            md_lines.append(f"| 麻醉类型 | {anes.get('anesthetic_type', '未知')} |")
            md_lines.append(f"| 开始时间 | {anes.get('start_time', '未知')} |")
            md_lines.append(f"| 结束时间 | {anes.get('end_time', '未知')} |")
            md_lines.append(f"| 苏醒时间 | {anes.get('awakening_time', '未知')} |")
            md_lines.append(f"\n")
        
        if patient_details["infusion"]:
            md_lines.append(f"## 输液记录\n")
            md_lines.append(f"| 药物 | 速率 | 已输注 | 状态 |")
            md_lines.append(f"|------|------|--------|------|")
            for inf in patient_details["infusion"]:
                status = "⚠️ 中断" if inf.get("is_interrupted") else "✅ 正常"
                md_lines.append(f"| {inf.get('drug_name', '未知')} | {inf.get('infusion_rate', 'N/A')} | {inf.get('volume_infused', 'N/A')} | {status} |")
            md_lines.append(f"\n")
        
        if patient_details["sensors"]:
            md_lines.append(f"## 笼位监测\n")
            md_lines.append(f"| 时间 | 体温 | 血氧 | 状态 |")
            md_lines.append(f"|------|------|------|------|")
            for sensor in patient_details["sensors"]:
                temp_status = "⚠️" if sensor.get("temp_abnormal") else "✅"
                oxy_status = "⚠️" if sensor.get("oxy_abnormal") else "✅"
                md_lines.append(f"| {sensor.get('time', '未知')} | {sensor.get('temperature', 'N/A')}°C {temp_status} | {sensor.get('oxygen', 'N/A')}% {oxy_status} | {sensor.get('status', '正常')} |")
            md_lines.append(f"\n")
        
        if patient_details["medications"]:
            md_lines.append(f"## 用药计划\n")
            md_lines.append(f"| 药物 | 剂量 | 途径 | 频率 | 状态 |")
            md_lines.append(f"|------|------|------|------|------|")
            for med in patient_details["medications"]:
                status = "⚠️ 冲突" if med.get("has_conflict") else "✅ 正常"
                md_lines.append(f"| {med.get('drug_name', '未知')} | {med.get('dosage', 'N/A')} | {med.get('route', 'N/A')} | {med.get('frequency', 'N/A')} | {status} |")
            md_lines.append(f"\n")
        
        if handoff.nurse_review_notes:
            md_lines.append(f"## 复核备注\n")
            md_lines.append(f"```\n{handoff.nurse_review_notes}\n```\n")
        
        return "\n".join(md_lines)
    
    def generate_audit_package(self, handoff_id: str) -> Optional[Dict[str, Any]]:
        handoff = self.db.query(HandoffRecord).filter(
            HandoffRecord.handoff_id == handoff_id
        ).first()
        
        if not handoff:
            return None
        
        audit_logs = self.db.query(AuditLog).filter(
            AuditLog.handoff_id == handoff_id
        ).order_by(AuditLog.created_at).all()
        
        patient_details = self._get_patient_details(handoff.patient_id)
        
        package = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "handoff_record": {
                "handoff_id": handoff.handoff_id,
                "patient_id": handoff.patient_id,
                "patient_name": handoff.patient_name,
                "species": handoff.species,
                "breed": handoff.breed,
                "shift_date": handoff.shift_date.isoformat() if handoff.shift_date else None,
                "nurse_name": handoff.nurse_name,
                "initial_status": handoff.status.value if handoff.status else None,
                "final_status": handoff.final_status.value if handoff.final_status else None,
                "has_awakening_timeout": handoff.has_awakening_timeout,
                "has_infusion_interruption": handoff.has_infusion_interruption,
                "has_temp_oxygen_abnormal": handoff.has_temp_oxygen_abnormal,
                "has_medication_conflict": handoff.has_medication_conflict,
                "abnormal_details": handoff.abnormal_details,
                "nurse_review_notes": handoff.nurse_review_notes,
                "is_reviewed": handoff.is_reviewed,
                "reviewed_by": handoff.reviewed_by,
                "reviewed_at": handoff.reviewed_at.isoformat() if handoff.reviewed_at else None,
                "created_at": handoff.created_at.isoformat() if handoff.created_at else None,
                "updated_at": handoff.updated_at.isoformat() if handoff.updated_at else None
            },
            "patient_details": patient_details,
            "audit_trail": [
                {
                    "id": log.id,
                    "action": log.action,
                    "action_details": log.action_details,
                    "performed_by": log.performed_by,
                    "performed_at": log.performed_at.isoformat() if log.performed_at else None,
                    "created_at": log.created_at.isoformat() if log.created_at else None
                }
                for log in audit_logs
            ]
        }
        
        return package
    
    def export_batch_audit(self, handoff_ids: List[str]) -> Dict[str, Any]:
        packages = []
        failed = []
        
        for handoff_id in handoff_ids:
            package = self.generate_audit_package(handoff_id)
            if package:
                packages.append(package)
            else:
                failed.append(handoff_id)
        
        return {
            "success_count": len(packages),
            "failed_count": len(failed),
            "failed_ids": failed,
            "packages": packages
        }
    
    def _get_patient_details(self, patient_id: str) -> Dict[str, Any]:
        anesthesia = self.db.query(AnesthesiaRecord).filter(
            AnesthesiaRecord.patient_id == patient_id
        ).order_by(AnesthesiaRecord.created_at.desc()).first()
        
        infusions = self.db.query(InfusionPumpLog).filter(
            InfusionPumpLog.patient_id == patient_id
        ).order_by(InfusionPumpLog.log_time.desc()).limit(10).all()
        
        sensors = self.db.query(CageSensor).filter(
            CageSensor.patient_id == patient_id
        ).order_by(CageSensor.reading_time.desc()).limit(10).all()
        
        medications = self.db.query(MedicationPlan).filter(
            MedicationPlan.patient_id == patient_id
        ).order_by(MedicationPlan.created_at.desc()).all()
        
        return {
            "anesthesia": {
                "anesthetic_type": anesthesia.anesthetic_type if anesthesia else None,
                "start_time": anesthesia.anesthesia_start_time.isoformat() if anesthesia and anesthesia.anesthesia_start_time else None,
                "end_time": anesthesia.anesthesia_end_time.isoformat() if anesthesia and anesthesia.anesthesia_end_time else None,
                "awakening_time": anesthesia.awakening_time.isoformat() if anesthesia and anesthesia.awakening_time else None,
                "heart_rate": anesthesia.heart_rate if anesthesia else None,
                "respiratory_rate": anesthesia.respiratory_rate if anesthesia else None,
                "temperature": anesthesia.temperature if anesthesia else None,
                "spo2": anesthesia.spo2 if anesthesia else None
            } if anesthesia else None,
            "infusion": [
                {
                    "drug_name": inf.drug_name,
                    "infusion_rate": inf.infusion_rate,
                    "volume_infused": inf.volume_infused,
                    "volume_remaining": inf.volume_remaining,
                    "is_interrupted": inf.is_interrupted,
                    "interruption_reason": inf.interruption_reason,
                    "log_time": inf.log_time.isoformat() if inf.log_time else None
                }
                for inf in infusions
            ],
            "sensors": [
                {
                    "time": sensor.reading_time.isoformat() if sensor.reading_time else None,
                    "temperature": sensor.temperature,
                    "oxygen": sensor.oxygen_level,
                    "humidity": sensor.humidity,
                    "temp_abnormal": sensor.is_temperature_abnormal,
                    "oxy_abnormal": sensor.is_oxygen_abnormal,
                    "status": "异常" if (sensor.is_temperature_abnormal or sensor.is_oxygen_abnormal) else "正常"
                }
                for sensor in sensors
            ],
            "medications": [
                {
                    "drug_name": med.drug_name,
                    "generic_name": med.generic_name,
                    "dosage": med.dosage,
                    "route": med.route,
                    "frequency": med.frequency,
                    "start_time": med.start_time.isoformat() if med.start_time else None,
                    "end_time": med.end_time.isoformat() if med.end_time else None,
                    "has_conflict": med.is_conflict,
                    "conflict_drugs": med.conflict_drugs,
                    "conflict_notes": med.conflict_notes
                }
                for med in medications
            ]
        }
