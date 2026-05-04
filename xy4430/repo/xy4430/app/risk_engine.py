from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import (
    Cylinder, FillRecord, CompressorMaintenance,
    Appointment, Risk, ReviewRecord, Batch
)


class RiskEngine:
    RISK_TYPES = {
        "overdue_test": "超检未复验",
        "pressure_exceeded": "充填压力超限",
        "filter_expired": "压缩机滤芯过期",
        "duplicate_appointment": "同一气瓶重复预约",
        "insufficient_cooling": "取瓶前冷却时间不足"
    }
    
    SEVERITY_LEVELS = {
        "high": "高风险",
        "medium": "中风险",
        "low": "低风险"
    }
    
    COOLING_REQUIRED_HOURS = 24
    PRESSURE_TOLERANCE_PERCENT = 5
    
    def __init__(self, db: Session):
        self.db = db
    
    def check_all_risks(self) -> Dict[str, Any]:
        results = {
            "total_risks": 0,
            "by_type": {},
            "details": []
        }
        
        risk_checks = [
            self.check_overdue_tests,
            self.check_pressure_exceeded,
            self.check_filter_expired,
            self.check_duplicate_appointments,
            self.check_insufficient_cooling
        ]
        
        for check_func in risk_checks:
            check_result = check_func()
            results["total_risks"] += check_result["count"]
            results["by_type"][check_result["type"]] = check_result["count"]
            results["details"].extend(check_result["risks"])
        
        return results
    
    def check_overdue_tests(self) -> Dict[str, Any]:
        risk_type = "overdue_test"
        now = datetime.utcnow()
        risks = []
        
        overdue_cylinders = self.db.query(Cylinder).filter(
            Cylinder.test_expiry_date < now
        ).all()
        
        for cylinder in overdue_cylinders:
            existing_risk = self.db.query(Risk).filter(
                Risk.risk_type == risk_type,
                Risk.cylinder_id == cylinder.id,
                Risk.is_resolved == False
            ).first()
            
            if not existing_risk:
                days_overdue = (now - cylinder.test_expiry_date).days
                risk = Risk(
                    risk_type=risk_type,
                    severity="high",
                    description=f"气瓶 {cylinder.serial_number} 检验有效期已过期 {days_overdue} 天",
                    cylinder_id=cylinder.id,
                    detected_at=now
                )
                self.db.add(risk)
                self.db.flush()
                
                risks.append({
                    "risk_id": risk.id,
                    "type": risk_type,
                    "type_name": self.RISK_TYPES[risk_type],
                    "severity": risk.severity,
                    "serial_number": cylinder.serial_number,
                    "test_expiry_date": cylinder.test_expiry_date.strftime("%Y-%m-%d"),
                    "days_overdue": days_overdue
                })
        
        self.db.commit()
        
        return {
            "type": risk_type,
            "type_name": self.RISK_TYPES[risk_type],
            "count": len(risks),
            "risks": risks
        }
    
    def check_pressure_exceeded(self) -> Dict[str, Any]:
        risk_type = "pressure_exceeded"
        now = datetime.utcnow()
        risks = []
        
        fill_records = self.db.query(FillRecord).all()
        
        for record in fill_records:
            cylinder = self.db.query(Cylinder).filter(
                Cylinder.id == record.cylinder_id
            ).first()
            
            if not cylinder or not cylinder.working_pressure_bar:
                continue
            
            max_allowed_pressure = cylinder.working_pressure_bar * (1 + self.PRESSURE_TOLERANCE_PERCENT / 100)
            
            if record.fill_pressure_bar > max_allowed_pressure:
                existing_risk = self.db.query(Risk).filter(
                    Risk.risk_type == risk_type,
                    Risk.cylinder_id == cylinder.id
                ).first()
                
                if not existing_risk:
                    pressure_excess = record.fill_pressure_bar - max_allowed_pressure
                    risk = Risk(
                        risk_type=risk_type,
                        severity="high",
                        description=f"气瓶 {cylinder.serial_number} 充填压力超限 {pressure_excess} bar",
                        cylinder_id=cylinder.id,
                        detected_at=now
                    )
                    self.db.add(risk)
                    self.db.flush()
                    
                    risks.append({
                        "risk_id": risk.id,
                        "type": risk_type,
                        "type_name": self.RISK_TYPES[risk_type],
                        "severity": risk.severity,
                        "serial_number": cylinder.serial_number,
                        "working_pressure": cylinder.working_pressure_bar,
                        "actual_pressure": record.fill_pressure_bar,
                        "max_allowed": round(max_allowed_pressure, 2)
                    })
        
        self.db.commit()
        
        return {
            "type": risk_type,
            "type_name": self.RISK_TYPES[risk_type],
            "count": len(risks),
            "risks": risks
        }
    
    def check_filter_expired(self) -> Dict[str, Any]:
        risk_type = "filter_expired"
        now = datetime.utcnow()
        risks = []
        
        compressors = self.db.query(CompressorMaintenance).all()
        
        for compressor in compressors:
            if not compressor.filter_expiry_date:
                continue
            
            if compressor.filter_expiry_date < now:
                existing_risk = self.db.query(Risk).filter(
                    Risk.risk_type == risk_type,
                    Risk.compressor_id == compressor.compressor_id,
                    Risk.is_resolved == False
                ).first()
                
                if not existing_risk:
                    days_overdue = (now - compressor.filter_expiry_date).days
                    risk = Risk(
                        risk_type=risk_type,
                        severity="high",
                        description=f"压缩机 {compressor.compressor_id} 滤芯已过期 {days_overdue} 天",
                        compressor_id=compressor.compressor_id,
                        detected_at=now
                    )
                    self.db.add(risk)
                    self.db.flush()
                    
                    risks.append({
                        "risk_id": risk.id,
                        "type": risk_type,
                        "type_name": self.RISK_TYPES[risk_type],
                        "severity": risk.severity,
                        "compressor_id": compressor.compressor_id,
                        "filter_expiry_date": compressor.filter_expiry_date.strftime("%Y-%m-%d"),
                        "days_overdue": days_overdue
                    })
        
        self.db.commit()
        
        return {
            "type": risk_type,
            "type_name": self.RISK_TYPES[risk_type],
            "count": len(risks),
            "risks": risks
        }
    
    def check_duplicate_appointments(self) -> Dict[str, Any]:
        risk_type = "duplicate_appointment"
        now = datetime.utcnow()
        risks = []
        
        appointments = self.db.query(Appointment).filter(
            Appointment.status.in_(["pending", "confirmed"])
        ).all()
        
        cylinder_appointments = {}
        for appt in appointments:
            if appt.cylinder_id not in cylinder_appointments:
                cylinder_appointments[appt.cylinder_id] = []
            cylinder_appointments[appt.cylinder_id].append(appt)
        
        for cylinder_id, appts in cylinder_appointments.items():
            if len(appts) > 1:
                cylinder = self.db.query(Cylinder).filter(
                    Cylinder.id == cylinder_id
                ).first()
                
                existing_risk = self.db.query(Risk).filter(
                    Risk.risk_type == risk_type,
                    Risk.cylinder_id == cylinder_id,
                    Risk.is_resolved == False
                ).first()
                
                if not existing_risk and cylinder:
                    appointment_numbers = [a.appointment_number for a in appts]
                    risk = Risk(
                        risk_type=risk_type,
                        severity="medium",
                        description=f"气瓶 {cylinder.serial_number} 存在重复预约: {', '.join(appointment_numbers)}",
                        cylinder_id=cylinder.id,
                        detected_at=now
                    )
                    self.db.add(risk)
                    self.db.flush()
                    
                    risks.append({
                        "risk_id": risk.id,
                        "type": risk_type,
                        "type_name": self.RISK_TYPES[risk_type],
                        "severity": risk.severity,
                        "serial_number": cylinder.serial_number,
                        "appointment_numbers": appointment_numbers,
                        "pickup_dates": [a.pickup_date.strftime("%Y-%m-%d %H:%M") for a in appts]
                    })
        
        self.db.commit()
        
        return {
            "type": risk_type,
            "type_name": self.RISK_TYPES[risk_type],
            "count": len(risks),
            "risks": risks
        }
    
    def check_insufficient_cooling(self) -> Dict[str, Any]:
        risk_type = "insufficient_cooling"
        now = datetime.utcnow()
        risks = []
        
        appointments = self.db.query(Appointment).filter(
            Appointment.status.in_(["pending", "confirmed"])
        ).all()
        
        for appt in appointments:
            latest_fill = self.db.query(FillRecord).filter(
                FillRecord.cylinder_id == appt.cylinder_id
            ).order_by(FillRecord.fill_date.desc()).first()
            
            if latest_fill:
                cooling_start = latest_fill.cooling_start_time or latest_fill.fill_date
                required_cooling_end = cooling_start + timedelta(hours=self.COOLING_REQUIRED_HOURS)
                
                if appt.pickup_date < required_cooling_end:
                    cylinder = self.db.query(Cylinder).filter(
                        Cylinder.id == appt.cylinder_id
                    ).first()
                    
                    existing_risk = self.db.query(Risk).filter(
                        Risk.risk_type == risk_type,
                        Risk.appointment_id == appt.id,
                        Risk.is_resolved == False
                    ).first()
                    
                    if not existing_risk and cylinder:
                        cooling_hours_needed = (required_cooling_end - appt.pickup_date).total_seconds() / 3600
                        risk = Risk(
                            risk_type=risk_type,
                            severity="medium",
                            description=f"气瓶 {cylinder.serial_number} 预约取瓶时间冷却不足，还需冷却 {round(cooling_hours_needed, 1)} 小时",
                            cylinder_id=cylinder.id,
                            appointment_id=appt.id,
                            detected_at=now
                        )
                        self.db.add(risk)
                        self.db.flush()
                        
                        risks.append({
                            "risk_id": risk.id,
                            "type": risk_type,
                            "type_name": self.RISK_TYPES[risk_type],
                            "severity": risk.severity,
                            "serial_number": cylinder.serial_number,
                            "appointment_number": appt.appointment_number,
                            "pickup_date": appt.pickup_date.strftime("%Y-%m-%d %H:%M"),
                            "cooling_start": cooling_start.strftime("%Y-%m-%d %H:%M"),
                            "required_cooling_end": required_cooling_end.strftime("%Y-%m-%d %H:%M"),
                            "additional_cooling_hours_needed": round(cooling_hours_needed, 1)
                        })
        
        self.db.commit()
        
        return {
            "type": risk_type,
            "type_name": self.RISK_TYPES[risk_type],
            "count": len(risks),
            "risks": risks
        }
    
    def get_active_risks(self) -> List[Dict[str, Any]]:
        active_risks = self.db.query(Risk).filter(
            Risk.is_resolved == False
        ).order_by(Risk.detected_at.desc()).all()
        
        results = []
        for risk in active_risks:
            result = {
                "risk_id": risk.id,
                "type": risk.risk_type,
                "type_name": self.RISK_TYPES.get(risk.risk_type, risk.risk_type),
                "severity": risk.severity,
                "severity_name": self.SEVERITY_LEVELS.get(risk.severity, risk.severity),
                "description": risk.description,
                "detected_at": risk.detected_at.strftime("%Y-%m-%d %H:%M:%S") if risk.detected_at else None
            }
            
            if risk.cylinder_id:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == risk.cylinder_id).first()
                if cylinder:
                    result["serial_number"] = cylinder.serial_number
            
            if risk.appointment_id:
                appt = self.db.query(Appointment).filter(Appointment.id == risk.appointment_id).first()
                if appt:
                    result["appointment_number"] = appt.appointment_number
            
            if risk.compressor_id:
                result["compressor_id"] = risk.compressor_id
            
            results.append(result)
        
        return results
    
    def resolve_risk(self, risk_id: int, resolved_by: str, notes: str = None) -> Dict[str, Any]:
        risk = self.db.query(Risk).filter(Risk.id == risk_id).first()
        
        if not risk:
            return {"success": False, "message": "风险记录不存在"}
        
        if risk.is_resolved:
            return {"success": False, "message": "该风险已被解决"}
        
        risk.is_resolved = True
        risk.resolved_at = datetime.utcnow()
        risk.resolved_by = resolved_by
        risk.resolution_notes = notes
        
        self.db.commit()
        
        return {
            "success": True,
            "risk_id": risk.id,
            "resolved_at": risk.resolved_at.strftime("%Y-%m-%d %H:%M:%S"),
            "resolved_by": resolved_by
        }
