import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import (
    SensorLog, WorkTicket, VentilationRule, RiskAnomaly, Cabin, AuditLog
)
from app.config import settings


class VOCConverter:
    @staticmethod
    def ppm_to_mg_m3(ppm: float, molar_mass: float = 100.0, temperature: float = 25.0) -> float:
        pressure = 101.325
        return (ppm * molar_mass * pressure) / (8.314 * (273.15 + temperature))
    
    @staticmethod
    def mg_m3_to_ppm(mg_m3: float, molar_mass: float = 100.0, temperature: float = 25.0) -> float:
        pressure = 101.325
        return (mg_m3 * 8.314 * (273.15 + temperature)) / (molar_mass * pressure)
    
    @staticmethod
    def to_ppm(value: float, unit: str, temperature: float = 25.0) -> float:
        if unit.lower() == "ppm":
            return value
        elif unit.lower() in ["mg/m3", "mg_m3"]:
            return VOCConverter.mg_m3_to_ppm(value, temperature=temperature)
        return value
    
    @staticmethod
    def to_mg_m3(value: float, unit: str, temperature: float = 25.0) -> float:
        if unit.lower() in ["mg/m3", "mg_m3"]:
            return value
        elif unit.lower() == "ppm":
            return VOCConverter.ppm_to_mg_m3(value, temperature=temperature)
        return value


class DetectionResult:
    def __init__(self):
        self.anomalies: List[Dict[str, Any]] = []
        self.total_checked = 0
        self.anomaly_count = 0
    
    def add_anomaly(self, anomaly_type: str, severity: str, **kwargs):
        anomaly = {
            "anomaly_type": anomaly_type,
            "severity": severity,
            "created_at": datetime.now(),
            "is_confirmed": False,
            **kwargs
        }
        self.anomalies.append(anomaly)
        self.anomaly_count += 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_checked": self.total_checked,
            "anomaly_count": self.anomaly_count,
            "anomalies": self.anomalies
        }


class VOCDetector:
    @staticmethod
    def detect(db: Session, start_time: datetime = None, end_time: datetime = None) -> DetectionResult:
        result = DetectionResult()
        
        query = db.query(SensorLog).filter(SensorLog.is_valid == True)
        
        if start_time:
            query = query.filter(SensorLog.timestamp >= start_time)
        if end_time:
            query = query.filter(SensorLog.timestamp <= end_time)
        
        sensor_logs = query.order_by(SensorLog.timestamp).all()
        result.total_checked = len(sensor_logs)
        
        for log in sensor_logs:
            temp = log.temperature or 25.0
            voc_ppm = VOCConverter.to_ppm(log.voc_value, log.voc_unit, temp)
            voc_mg_m3 = VOCConverter.to_mg_m3(log.voc_value, log.voc_unit, temp)
            
            threshold_ppm = VOCDetector._get_threshold_for_cabin(db, log.cabin_code, "ppm")
            threshold_mg_m3 = VOCDetector._get_threshold_for_cabin(db, log.cabin_code, "mg/m3")
            
            exceeds_ppm = voc_ppm > threshold_ppm
            exceeds_mg_m3 = voc_mg_m3 > threshold_mg_m3
            
            if exceeds_ppm or exceeds_mg_m3:
                severity = "high" if (voc_ppm > threshold_ppm * 2 or voc_mg_m3 > threshold_mg_m3 * 2) else "medium"
                
                result.add_anomaly(
                    anomaly_type="voc_exceed",
                    severity=severity,
                    cabin_code=log.cabin_code,
                    sensor_log_id=log.id,
                    sensor_id=log.sensor_id,
                    start_time=log.timestamp,
                    end_time=log.timestamp,
                    description=f"VOC浓度超限",
                    details=json.dumps({
                        "voc_value_original": log.voc_value,
                        "voc_unit_original": log.voc_unit,
                        "voc_value_ppm": round(voc_ppm, 2),
                        "voc_value_mg_m3": round(voc_mg_m3, 2),
                        "threshold_ppm": threshold_ppm,
                        "threshold_mg_m3": threshold_mg_m3,
                        "temperature": temp,
                        "exceeds_ppm": exceeds_ppm,
                        "exceeds_mg_m3": exceeds_mg_m3
                    }, ensure_ascii=False)
                )
        
        VOCDetector._create_audit_log(db, "detect_voc_exceed", result)
        return result
    
    @staticmethod
    def _get_threshold_for_cabin(db: Session, cabin_code: str, unit: str) -> float:
        rules = db.query(VentilationRule).filter(
            VentilationRule.is_active == True,
            (VentilationRule.cabin_code == cabin_code) | (VentilationRule.cabin_code == None)
        ).order_by(VentilationRule.priority.desc()).all()
        
        for rule in rules:
            if unit == "ppm" and rule.voc_threshold_ppm:
                return rule.voc_threshold_ppm
            if unit == "mg/m3" and rule.voc_threshold_mg_m3:
                return rule.voc_threshold_mg_m3
        
        return settings.VOC_STANDARD_PPM if unit == "ppm" else settings.VOC_STANDARD_MG_M3
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: DetectionResult):
        audit = AuditLog(
            operation=operation,
            resource_type="SensorLog",
            details=json.dumps({
                "total_checked": result.total_checked,
                "anomaly_count": result.anomaly_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class VentilationDetector:
    @staticmethod
    def detect(db: Session, start_time: datetime = None, end_time: datetime = None) -> DetectionResult:
        result = DetectionResult()
        
        query = db.query(SensorLog).filter(
            SensorLog.is_valid == True,
            SensorLog.air_changes_per_hour != None
        )
        
        if start_time:
            query = query.filter(SensorLog.timestamp >= start_time)
        if end_time:
            query = query.filter(SensorLog.timestamp <= end_time)
        
        sensor_logs = query.order_by(SensorLog.timestamp).all()
        result.total_checked = len(sensor_logs)
        
        for log in sensor_logs:
            min_ach = VentilationDetector._get_required_ach_for_cabin(db, log.cabin_code)
            current_ach = log.air_changes_per_hour
            
            if current_ach < min_ach:
                severity = "high" if current_ach < min_ach * 0.5 else "medium"
                
                result.add_anomaly(
                    anomaly_type="ventilation_insufficient",
                    severity=severity,
                    cabin_code=log.cabin_code,
                    sensor_log_id=log.id,
                    sensor_id=log.sensor_id,
                    start_time=log.timestamp,
                    end_time=log.timestamp,
                    description=f"排风不足 - 换气次数低于要求",
                    details=json.dumps({
                        "current_air_changes_per_hour": current_ach,
                        "required_air_changes_per_hour": min_ach,
                        "deficit_percentage": round((1 - current_ach / min_ach) * 100, 2)
                    }, ensure_ascii=False)
                )
        
        VentilationDetector._create_audit_log(db, "detect_ventilation", result)
        return result
    
    @staticmethod
    def _get_required_ach_for_cabin(db: Session, cabin_code: str) -> float:
        rules = db.query(VentilationRule).filter(
            VentilationRule.is_active == True,
            (VentilationRule.cabin_code == cabin_code) | (VentilationRule.cabin_code == None)
        ).order_by(VentilationRule.priority.desc()).all()
        
        for rule in rules:
            return rule.min_air_changes_per_hour
        
        return settings.VENTILATION_REQUIRED_CHANGES_PER_HOUR
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: DetectionResult):
        audit = AuditLog(
            operation=operation,
            resource_type="SensorLog",
            details=json.dumps({
                "total_checked": result.total_checked,
                "anomaly_count": result.anomaly_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class WorkTicketOverlapDetector:
    @staticmethod
    def detect(db: Session, start_time: datetime = None, end_time: datetime = None) -> DetectionResult:
        result = DetectionResult()
        
        query = db.query(WorkTicket)
        
        if start_time:
            query = query.filter(WorkTicket.end_time >= start_time)
        if end_time:
            query = query.filter(WorkTicket.start_time <= end_time)
        
        work_tickets = query.order_by(WorkTicket.cabin_code, WorkTicket.start_time).all()
        result.total_checked = len(work_tickets)
        
        tickets_by_cabin = defaultdict(list)
        for ticket in work_tickets:
            tickets_by_cabin[ticket.cabin_code].append(ticket)
        
        for cabin_code, tickets in tickets_by_cabin.items():
            tickets.sort(key=lambda t: t.start_time)
            
            for i in range(len(tickets)):
                for j in range(i + 1, len(tickets)):
                    ticket1 = tickets[i]
                    ticket2 = tickets[j]
                    
                    if WorkTicketOverlapDetector._check_overlap_midnight(ticket1, ticket2):
                        overlap_start = max(ticket1.start_time, ticket2.start_time)
                        overlap_end = min(ticket1.end_time, ticket2.end_time)
                        
                        overlap_duration = (overlap_end - overlap_start).total_seconds() / 60
                        
                        if overlap_duration > 0:
                            severity = "high" if overlap_duration > 60 else "medium"
                            
                            result.add_anomaly(
                                anomaly_type="work_ticket_overlap",
                                severity=severity,
                                cabin_code=cabin_code,
                                work_ticket_id=ticket1.id,
                                start_time=overlap_start,
                                end_time=overlap_end,
                                description=f"作业票时间重叠 - {ticket1.ticket_no} 与 {ticket2.ticket_no}",
                                details=json.dumps({
                                    "ticket1": {
                                        "ticket_no": ticket1.ticket_no,
                                        "start_time": ticket1.start_time.isoformat(),
                                        "end_time": ticket1.end_time.isoformat(),
                                        "operation_type": ticket1.operation_type
                                    },
                                    "ticket2": {
                                        "ticket_no": ticket2.ticket_no,
                                        "start_time": ticket2.start_time.isoformat(),
                                        "end_time": ticket2.end_time.isoformat(),
                                        "operation_type": ticket2.operation_type
                                    },
                                    "overlap_duration_minutes": round(overlap_duration, 2),
                                    "spans_midnight": WorkTicketOverlapDetector._spans_midnight(ticket1) or 
                                                     WorkTicketOverlapDetector._spans_midnight(ticket2)
                                }, ensure_ascii=False)
                            )
        
        WorkTicketOverlapDetector._create_audit_log(db, "detect_ticket_overlap", result)
        return result
    
    @staticmethod
    def _check_overlap_midnight(ticket1: WorkTicket, ticket2: WorkTicket) -> bool:
        t1_spans_midnight = WorkTicketOverlapDetector._spans_midnight(ticket1)
        t2_spans_midnight = WorkTicketOverlapDetector._spans_midnight(ticket2)
        
        if not t1_spans_midnight and not t2_spans_midnight:
            return ticket1.start_time < ticket2.end_time and ticket2.start_time < ticket1.end_time
        
        if t1_spans_midnight and t2_spans_midnight:
            return True
        
        if t1_spans_midnight:
            midnight = datetime.combine(ticket1.start_time.date() + timedelta(days=1), datetime.min.time())
            return (
                (ticket2.start_time < ticket1.end_time and ticket2.end_time > ticket1.start_time) or
                (ticket2.start_time < midnight and ticket2.end_time > ticket1.start_time)
            )
        
        if t2_spans_midnight:
            midnight = datetime.combine(ticket2.start_time.date() + timedelta(days=1), datetime.min.time())
            return (
                (ticket1.start_time < ticket2.end_time and ticket1.end_time > ticket2.start_time) or
                (ticket1.start_time < midnight and ticket1.end_time > ticket2.start_time)
            )
        
        return False
    
    @staticmethod
    def _spans_midnight(ticket: WorkTicket) -> bool:
        return ticket.end_time.date() > ticket.start_time.date()
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: DetectionResult):
        audit = AuditLog(
            operation=operation,
            resource_type="WorkTicket",
            details=json.dumps({
                "total_checked": result.total_checked,
                "anomaly_count": result.anomaly_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class SensorMissingDetector:
    @staticmethod
    def detect(db: Session, start_time: datetime = None, end_time: datetime = None) -> DetectionResult:
        result = DetectionResult()
        
        query = db.query(SensorLog).filter(SensorLog.is_valid == True)
        
        if start_time:
            query = query.filter(SensorLog.timestamp >= start_time)
        if end_time:
            query = query.filter(SensorLog.timestamp <= end_time)
        
        sensor_logs = query.order_by(SensorLog.sensor_id, SensorLog.timestamp).all()
        
        logs_by_sensor = defaultdict(list)
        for log in sensor_logs:
            logs_by_sensor[log.sensor_id].append(log)
        
        threshold_minutes = settings.SENSOR_MISS_THRESHOLD_MINUTES
        result.total_checked = len(sensor_logs)
        
        for sensor_id, logs in logs_by_sensor.items():
            if len(logs) < 2:
                continue
            
            logs.sort(key=lambda l: l.timestamp)
            
            for i in range(1, len(logs)):
                prev_log = logs[i - 1]
                curr_log = logs[i]
                
                gap_minutes = (curr_log.timestamp - prev_log.timestamp).total_seconds() / 60
                
                if gap_minutes > threshold_minutes:
                    severity = "high" if gap_minutes > threshold_minutes * 2 else "medium"
                    
                    result.add_anomaly(
                        anomaly_type="sensor_missing",
                        severity=severity,
                        cabin_code=prev_log.cabin_code,
                        sensor_log_id=prev_log.id,
                        sensor_id=sensor_id,
                        start_time=prev_log.timestamp,
                        end_time=curr_log.timestamp,
                        description=f"传感器数据缺采 - 间隔超过{threshold_minutes}分钟",
                        details=json.dumps({
                            "gap_minutes": round(gap_minutes, 2),
                            "threshold_minutes": threshold_minutes,
                            "last_valid_time": prev_log.timestamp.isoformat(),
                            "next_valid_time": curr_log.timestamp.isoformat()
                        }, ensure_ascii=False)
                    )
        
        SensorMissingDetector._create_audit_log(db, "detect_sensor_missing", result)
        return result
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: DetectionResult):
        audit = AuditLog(
            operation=operation,
            resource_type="SensorLog",
            details=json.dumps({
                "total_checked": result.total_checked,
                "anomaly_count": result.anomaly_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class RiskDetector:
    @staticmethod
    def run_all_checks(
        db: Session,
        start_time: datetime = None,
        end_time: datetime = None,
        clear_existing: bool = False
    ) -> Dict[str, Any]:
        if clear_existing:
            db.query(RiskAnomaly).filter(RiskAnomaly.is_confirmed == False).delete()
            db.commit()
        
        results = {}
        
        detectors = {
            "voc_exceed": VOCDetector.detect,
            "ventilation_insufficient": VentilationDetector.detect,
            "work_ticket_overlap": WorkTicketOverlapDetector.detect,
            "sensor_missing": SensorMissingDetector.detect
        }
        
        for anomaly_type, detector in detectors.items():
            result = detector(db, start_time, end_time)
            
            for anomaly_data in result.anomalies:
                existing = db.query(RiskAnomaly).filter(
                    RiskAnomaly.anomaly_type == anomaly_data["anomaly_type"],
                    RiskAnomaly.cabin_code == anomaly_data.get("cabin_code"),
                    RiskAnomaly.sensor_id == anomaly_data.get("sensor_id"),
                    RiskAnomaly.start_time == anomaly_data.get("start_time"),
                    RiskAnomaly.is_confirmed == False
                ).first()
                
                if not existing:
                    anomaly = RiskAnomaly(
                        anomaly_type=anomaly_data["anomaly_type"],
                        severity=anomaly_data["severity"],
                        cabin_code=anomaly_data.get("cabin_code"),
                        work_ticket_id=anomaly_data.get("work_ticket_id"),
                        sensor_log_id=anomaly_data.get("sensor_log_id"),
                        sensor_id=anomaly_data.get("sensor_id"),
                        start_time=anomaly_data["start_time"],
                        end_time=anomaly_data.get("end_time"),
                        description=anomaly_data.get("description"),
                        details=anomaly_data.get("details"),
                        is_confirmed=False,
                        created_at=datetime.now()
                    )
                    db.add(anomaly)
            
            db.commit()
            results[anomaly_type] = result.to_dict()
        
        total_anomalies = sum(r["anomaly_count"] for r in results.values())
        total_checked = sum(r["total_checked"] for r in results.values())
        
        return {
            "summary": {
                "total_checked": total_checked,
                "total_anomalies": total_anomalies,
                "check_time": datetime.now().isoformat()
            },
            "details": results
        }
