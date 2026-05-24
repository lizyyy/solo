from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Tuple, Dict
from datetime import datetime
import uuid
import math

from . import models, schemas
from .models import Slot, TemperatureSample, DisableRecord, RecheckRecord, DisposalReport, OperationLog


ERROR_CODES = {
    "MISSING_DATA": "缺材料",
    "INVALID_STATUS": "状态不允许",
    "DUPLICATE_REQUEST": "重复请求",
    "NEEDS_REVIEW": "需要复核"
}


def check_idempotent(db: Session, business_no: str, operation_type: str) -> bool:
    existing = db.query(OperationLog).filter(
        and_(
            OperationLog.business_no == business_no,
            OperationLog.operation_type == operation_type,
            OperationLog.result == "success"
        )
    ).first()
    return existing is not None


def log_operation(db: Session, operation_type: str, slot_number: Optional[str] = None,
                  battery_id: Optional[str] = None, business_no: Optional[str] = None,
                  operator: Optional[str] = None, details: str = "", result: str = "success",
                  error_code: Optional[str] = None) -> OperationLog:
    log = OperationLog(
        operation_type=operation_type,
        slot_number=slot_number,
        battery_id=battery_id,
        business_no=business_no,
        operator=operator,
        details=details,
        result=result,
        error_code=error_code
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_or_create_slot(db: Session, slot_number: str) -> Slot:
    slot = db.query(Slot).filter(Slot.slot_number == slot_number).first()
    if not slot:
        slot = Slot(slot_number=slot_number, status="available")
        db.add(slot)
        db.commit()
        db.refresh(slot)
    return slot


def validate_slot_transition(current_status: str, target_status: str) -> bool:
    valid_transitions = {
        "available": ["occupied", "checking"],
        "occupied": ["available", "disabled", "checking"],
        "disabled": ["checking", "available"],
        "checking": ["available", "disabled", "occupied"]
    }
    return target_status in valid_transitions.get(current_status, [])


def check_temperature_window(temperatures: List[float], threshold: float) -> Tuple[bool, float]:
    if not temperatures:
        return False, 0.0
    max_temp = max(temperatures)
    is_anomaly = max_temp > threshold
    return is_anomaly, max_temp


def process_temperature_window(db: Session, request: schemas.TemperatureWindowRequest) -> dict:
    business_no = request.business_no
    
    if check_idempotent(db, business_no, "temperature_check"):
        log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                      business_no, details="重复请求", result="failed", error_code="DUPLICATE_REQUEST")
        return {
            "is_processed": True,
            "is_anomaly": False,
            "max_temperature": 0.0,
            "message": "请求已处理（幂等）",
            "error_code": "DUPLICATE_REQUEST"
        }
    
    slot = get_or_create_slot(db, request.slot_number)
    
    if slot.status not in ["occupied", "checking"]:
        log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                      business_no, details=f"格口状态不允许: {slot.status}", result="failed",
                      error_code="INVALID_STATUS")
        return {
            "is_processed": False,
            "is_anomaly": False,
            "max_temperature": 0.0,
            "message": f"格口状态不允许: {slot.status}",
            "error_code": "INVALID_STATUS"
        }
    
    is_anomaly, max_temp = check_temperature_window(request.temperatures, request.threshold)
    
    for temp in request.temperatures:
        sample = TemperatureSample(
            slot_id=slot.id,
            battery_id=request.battery_id,
            temperature=temp,
            window_id=request.window_id,
            business_no=business_no,
            is_anomaly=is_anomaly
        )
        db.add(sample)
    
    if is_anomaly:
        if validate_slot_transition(slot.status, "disabled"):
            slot.status = "disabled"
            slot.battery_id = request.battery_id
    
    db.commit()
    
    log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                  business_no, details=f"温度窗口检测, 最高温: {max_temp}, 异常: {is_anomaly}",
                  result="success")
    
    return {
        "is_processed": True,
        "is_anomaly": is_anomaly,
        "max_temperature": max_temp,
        "slot_status": slot.status,
        "message": "温度检测完成"
    }


def process_recheck(db: Session, request: schemas.RecheckRequest) -> dict:
    business_no = request.business_no
    
    if check_idempotent(db, business_no, "recheck"):
        log_operation(db, "recheck", request.slot_number, request.battery_id,
                      business_no, details="重复请求", result="failed", error_code="DUPLICATE_REQUEST")
        return {
            "is_processed": True,
            "message": "请求已处理（幂等）",
            "error_code": "DUPLICATE_REQUEST"
        }
    
    slot = get_or_create_slot(db, request.slot_number)
    
    if slot.status != "disabled":
        log_operation(db, "recheck", request.slot_number, request.battery_id,
                      business_no, details=f"格口状态不允许: {slot.status}", result="failed",
                      error_code="INVALID_STATUS")
        return {
            "is_processed": False,
            "message": f"格口状态不允许: {slot.status}",
            "error_code": "INVALID_STATUS"
        }
    
    recheck = RecheckRecord(
        slot_id=slot.id,
        battery_id=request.battery_id,
        recheck_person=request.recheck_person,
        conclusion=request.conclusion,
        remarks=request.remarks,
        business_no=business_no
    )
    db.add(recheck)
    
    if request.conclusion == "正常":
        if validate_slot_transition(slot.status, "available"):
            slot.status = "available"
            slot.battery_id = None
    elif request.conclusion == "异常":
        pass
    
    db.commit()
    
    log_operation(db, "recheck", request.slot_number, request.battery_id,
                  business_no, request.recheck_person,
                  details=f"复检完成, 结论: {request.conclusion}", result="success")
    
    return {
        "is_processed": True,
        "recheck_person": request.recheck_person,
        "conclusion": request.conclusion,
        "slot_status": slot.status,
        "message": "复检完成"
    }


def create_disposal_report(db: Session, report_data: schemas.DisposalReportCreate) -> DisposalReport:
    report_no = f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"
    
    report = DisposalReport(
        report_no=report_no,
        battery_id=report_data.battery_id,
        slot_number=report_data.slot_number,
        anomaly_type=report_data.anomaly_type,
        disposal_method=report_data.disposal_method,
        operator=report_data.operator,
        remarks=report_data.remarks,
        business_no=report_data.business_no
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    log_operation(db, "create_report", report_data.slot_number, report_data.battery_id,
                  report_data.business_no, report_data.operator,
                  details=f"生成处置报告: {report_no}", result="success")
    
    return report


def get_operation_logs(db: Session, business_no: Optional[str] = None,
                       slot_number: Optional[str] = None, limit: int = 100) -> List[OperationLog]:
    query = db.query(OperationLog)
    if business_no:
        query = query.filter(OperationLog.business_no == business_no)
    if slot_number:
        query = query.filter(OperationLog.slot_number == slot_number)
    return query.order_by(OperationLog.created_at.desc()).limit(limit).all()


def get_slot_status(db: Session, slot_number: str) -> Optional[Slot]:
    return db.query(Slot).filter(Slot.slot_number == slot_number).first()


def update_slot_status(db: Session, slot_number: str, status: str) -> Optional[Slot]:
    slot = get_slot_status(db, slot_number)
    if slot and validate_slot_transition(slot.status, status):
        slot.status = status
        db.commit()
        db.refresh(slot)
        log_operation(db, "status_update", slot_number, slot.battery_id,
                      operator="system", details=f"状态变更: {slot.status} -> {status}",
                      result="success")
    return slot


def export_disposal_report(db: Session, report_no: str) -> Optional[str]:
    report = db.query(DisposalReport).filter(DisposalReport.report_no == report_no).first()
    if not report:
        return None
    
    csv_content = f"""报告编号,{report.report_no}
电池编号,{report.battery_id}
格口编号,{report.slot_number}
异常类型,{report.anomaly_type}
处置方式,{report.disposal_method}
操作人,{report.operator}
报告时间,{report.report_time}
备注,{report.remarks or ''}
业务流水号,{report.business_no}
"""
    return csv_content
