from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import uuid
import math
import json

from . import models, schemas
from .models import Slot, TemperatureSample, DisableRecord, RecheckRecord, DisposalReport, OperationLog


ERROR_CODES = {
    "MISSING_DATA": "缺材料",
    "MISSING_SEGMENT": "采样不足",
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


def check_temperature_window(temperatures: List[float], threshold: float = 50.0) -> Dict[str, Any]:
    sample_count = len(temperatures)
    missing_count = 0
    
    if sample_count == 0:
        return {
            "is_anomaly": False,
            "max_temperature": 0.0,
            "min_temperature": 0.0,
            "avg_temperature": 0.0,
            "temp_diff": 0.0,
            "max_temp_rise": 0.0,
            "anomaly_types": [],
            "sample_count": 0,
            "missing_count": 0,
            "error_code": "MISSING_DATA"
        }
    
    
    max_temperature = max(temperatures)
    min_temperature = min(temperatures)
    avg_temperature = sum(temperatures) / sample_count
    temp_diff = max_temperature - min_temperature
    
    max_temp_rise = 0.0
    for i in range(1, sample_count):
        rise = temperatures[i] - temperatures[i-1]
        if rise > max_temp_rise:
            max_temp_rise = rise
    
    anomaly_types = []
    
    if max_temperature > threshold:
        anomaly_types.append("超温")
    
    if max_temp_rise > 5:
        anomaly_types.append("快速温升")
    
    if temp_diff > 10:
        anomaly_types.append("温差过大")
    
    is_anomaly = len(anomaly_types) > 0
    
    return {
        "is_anomaly": is_anomaly,
        "max_temperature": max_temperature,
        "min_temperature": min_temperature,
        "avg_temperature": avg_temperature,
        "temp_diff": temp_diff,
        "max_temp_rise": max_temp_rise,
        "anomaly_types": anomaly_types,
        "sample_count": sample_count,
        "missing_count": 0,
        "error_code": None
    }


def create_disable_record(db: Session, slot: Slot, battery_id: str, reason: str, 
                          operator: str, evidence_chain: Optional[Dict[str, Any]] = None) -> DisableRecord:
    disable_record = DisableRecord(
        slot_id=slot.id,
        battery_id=battery_id,
        reason=reason,
        operator=operator,
        is_active=True
    )
    db.add(disable_record)
    db.flush()
    db.refresh(disable_record)
    
    evidence_str = json.dumps(evidence_chain, ensure_ascii=False) if evidence_chain else ""
    log_operation(
        db, "create_disable", slot.slot_number, battery_id,
        operator=operator,
        details=f"生成禁用记录, 原因: {reason}, 证据链: {evidence_str}",
        result="success"
    )
    
    return disable_record


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
    
    check_result = check_temperature_window(request.temperatures, request.threshold)
    
    if check_result["error_code"]:
        log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                      business_no, details=f"温度检测失败: {check_result['error_code']}", result="failed",
                      error_code=check_result["error_code"])
        return {
            "is_processed": False,
            "is_anomaly": False,
            "max_temperature": 0.0,
            "message": ERROR_CODES.get(check_result["error_code"], "检测失败"),
            "error_code": check_result["error_code"]
        }
    
    for temp in request.temperatures:
        sample = TemperatureSample(
            slot_id=slot.id,
            battery_id=request.battery_id,
            temperature=temp,
            window_id=request.window_id,
            business_no=business_no,
            is_anomaly=check_result["is_anomaly"]
        )
        db.add(sample)
    
    disable_record_id = None
    if check_result["is_anomaly"]:
        if validate_slot_transition(slot.status, "disabled"):
            slot.status = "disabled"
            slot.battery_id = request.battery_id
            
            anomaly_type_str = ",".join(check_result["anomaly_types"])
            reason = f"温度异常: {anomaly_type_str}"
            
            evidence_chain = {
                "statistics": {
                    "max_temperature": check_result["max_temperature"],
                    "min_temperature": check_result["min_temperature"],
                    "avg_temperature": check_result["avg_temperature"],
                    "temp_diff": check_result["temp_diff"],
                    "max_temp_rise": check_result["max_temp_rise"]
                },
                "temperatures": request.temperatures,
                "window_id": request.window_id,
                "threshold": request.threshold,
                "anomaly_types": check_result["anomaly_types"]
            }
            
            disable_record = create_disable_record(
                db, slot, request.battery_id, reason, 
                operator="system", evidence_chain=evidence_chain
            )
            disable_record_id = disable_record.id
    
    db.commit()
    
    log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                  business_no, details=f"温度窗口检测, 最高温: {check_result['max_temperature']}, 异常: {check_result['is_anomaly']}, 类型: {check_result['anomaly_types']}",
                  result="success")
    
    return {
        "is_processed": True,
        "is_anomaly": check_result["is_anomaly"],
        "max_temperature": check_result["max_temperature"],
        "slot_status": slot.status,
        "anomaly_types": check_result["anomaly_types"],
        "statistics": {
            "max_temperature": check_result["max_temperature"],
            "min_temperature": check_result["min_temperature"],
            "avg_temperature": check_result["avg_temperature"],
            "temp_diff": check_result["temp_diff"],
            "max_temp_rise": check_result["max_temp_rise"],
            "sample_count": check_result["sample_count"]
        },
        "disable_record_id": disable_record_id,
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
            disable_records = db.query(DisableRecord).filter(
                and_(DisableRecord.slot_id == slot.id, DisableRecord.is_active == True)
            ).all()
            for dr in disable_records:
                dr.is_active = False
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


def submit_batch(db: Session, batch_data: Dict[str, Any]) -> dict:
    business_no = batch_data.get("business_no")
    operator = batch_data.get("operator")
    items = batch_data.get("items", [])
    
    if check_idempotent(db, business_no, "batch_submit"):
        log_operation(db, "batch_submit", business_no=business_no, operator=operator,
                      details="重复请求", result="failed", error_code="DUPLICATE_REQUEST")
        return {
            "is_processed": True,
            "message": "请求已处理（幂等）",
            "business_no": business_no,
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "error_code": "DUPLICATE_REQUEST"
        }
    
    success_count = 0
    failed_count = 0
    results = []
    
    for item in items:
        slot_number = item.get("slot_number")
        battery_id = item.get("battery_id")
        
        try:
            slot = get_or_create_slot(db, slot_number)
            
            if validate_slot_transition(slot.status, "occupied"):
                slot.status = "occupied"
                slot.battery_id = battery_id
                success_count += 1
                results.append({
                    "slot_number": slot_number,
                    "battery_id": battery_id,
                    "status": "success",
                    "reason": None
                })
            else:
                failed_count += 1
                results.append({
                    "slot_number": slot_number,
                    "battery_id": battery_id,
                    "status": "failed",
                    "reason": f"状态变更不允许: {slot.status}"
                })
        except Exception as e:
            failed_count += 1
            results.append({
                "slot_number": slot_number,
                "battery_id": battery_id,
                "status": "failed",
                "reason": str(e)
            })
    
    db.commit()
    
    log_operation(db, "batch_submit", business_no=business_no, operator=operator,
                  details=f"批量提交完成, 成功: {success_count}, 失败: {failed_count}",
                  result="success")
    
    return {
        "is_processed": True,
        "message": "批量提交完成",
        "business_no": business_no,
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results
    }


def get_anomaly_list(db: Session, status: Optional[str] = None,
                     start_time: Optional[datetime] = None,
                     end_time: Optional[datetime] = None,
                     limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    query = db.query(DisableRecord)
    
    if status is not None:
        is_active = (status == "active")
        query = query.filter(DisableRecord.is_active == is_active)
    
    if start_time:
        query = query.filter(DisableRecord.disable_time >= start_time)
    
    if end_time:
        query = query.filter(DisableRecord.disable_time <= end_time)
    
    total = query.count()
    
    records = query.order_by(DisableRecord.disable_time.desc()).offset(offset).limit(limit).all()
    
    items = []
    for record in records:
        slot = db.query(Slot).filter(Slot.id == record.slot_id).first()
        items.append({
            "id": record.id,
            "slot_number": slot.slot_number if slot else None,
            "battery_id": record.battery_id,
            "reason": record.reason,
            "operator": record.operator,
            "disable_time": record.disable_time,
            "is_active": record.is_active
        })
    
    return {
        "total": total,
        "items": items,
        "limit": limit,
        "offset": offset
    }


def get_anomaly_detail(db: Session, anomaly_id: int) -> Dict[str, Any]:
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    
    if not disable_record:
        return {
            "error_code": "MISSING_DATA",
            "message": "异常记录不存在"
        }
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    
    temperature_samples = db.query(TemperatureSample).filter(
        TemperatureSample.slot_id == disable_record.slot_id,
        TemperatureSample.battery_id == disable_record.battery_id
    ).order_by(TemperatureSample.sample_time.desc()).limit(50).all()
    
    recheck_records = db.query(RecheckRecord).filter(
        RecheckRecord.slot_id == disable_record.slot_id,
        RecheckRecord.battery_id == disable_record.battery_id
    ).order_by(RecheckRecord.recheck_time.desc()).all()
    
    operation_logs = db.query(OperationLog).filter(
        or_(
            OperationLog.slot_number == slot.slot_number if slot else False,
            OperationLog.battery_id == disable_record.battery_id
        )
    ).order_by(OperationLog.created_at.desc()).limit(50).all()
    
    return {
        "id": disable_record.id,
        "battery_id": disable_record.battery_id,
        "slot_number": slot.slot_number if slot else None,
        "current_status": slot.status if slot else None,
        "reason": disable_record.reason,
        "operator": disable_record.operator,
        "disable_time": disable_record.disable_time,
        "is_active": disable_record.is_active,
        "temperature_samples": [
            {
                "temperature": sample.temperature,
                "sample_time": sample.sample_time,
                "window_id": sample.window_id,
                "is_anomaly": sample.is_anomaly
            }
            for sample in temperature_samples
        ],
        "recheck_records": [
            {
                "recheck_person": record.recheck_person,
                "recheck_time": record.recheck_time,
                "conclusion": record.conclusion,
                "remarks": record.remarks
            }
            for record in recheck_records
        ],
        "operation_logs": [
            {
                "operation_type": log.operation_type,
                "operator": log.operator,
                "details": log.details,
                "result": log.result,
                "created_at": log.created_at
            }
            for log in operation_logs
        ]
    }


def correct_material(db: Session, correction_data: Dict[str, Any]) -> Dict[str, Any]:
    anomaly_id = correction_data.get("anomaly_id")
    operator = correction_data.get("operator")
    temperatures = correction_data.get("temperatures", [])
    reason = correction_data.get("reason", "")
    
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    
    if not disable_record:
        return {
            "error_code": "MISSING_DATA",
            "message": "异常记录不存在"
        }
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    
    for temp in temperatures:
        sample = TemperatureSample(
            slot_id=disable_record.slot_id,
            battery_id=disable_record.battery_id,
            temperature=temp,
            window_id=f"corrected_{anomaly_id}",
            business_no=f"correction_{anomaly_id}",
            is_anomaly=False
        )
        db.add(sample)
    
    disable_record.is_active = False
    
    if slot and validate_slot_transition(slot.status, "available"):
        slot.status = "available"
        slot.battery_id = None
    
    db.commit()
    
    log_operation(db, "correct_material", slot.slot_number if slot else None,
                  disable_record.battery_id, operator=operator,
                  details=f"修正温度采样, 原因: {reason}, 修正点数: {len(temperatures)}",
                  result="success")
    
    return {
        "is_processed": True,
        "message": "修正完成",
        "anomaly_id": anomaly_id,
        "corrected_count": len(temperatures)
    }


def confirm_conclusion(db: Session, conclusion_data: Dict[str, Any]) -> Dict[str, Any]:
    anomaly_id = conclusion_data.get("anomaly_id")
    operator = conclusion_data.get("operator")
    final_conclusion = conclusion_data.get("final_conclusion")
    remarks = conclusion_data.get("remarks", "")
    disposal_method = conclusion_data.get("disposal_method", "")
    
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    
    if not disable_record:
        return {
            "error_code": "MISSING_DATA",
            "message": "异常记录不存在"
        }
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    
    disposal_report = None
    if final_conclusion == "异常":
        report_data = schemas.DisposalReportCreate(
            battery_id=disable_record.battery_id,
            slot_number=slot.slot_number if slot else "",
            anomaly_type=disable_record.reason,
            disposal_method=disposal_method,
            operator=operator,
            remarks=remarks,
            business_no=f"confirm_{anomaly_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )
        disposal_report = create_disposal_report(db, report_data)
    
    log_operation(db, "confirm_conclusion", slot.slot_number if slot else None,
                  disable_record.battery_id, operator=operator,
                  details=f"确认结论: {final_conclusion}, 处置方式: {disposal_method}, 备注: {remarks}",
                  result="success")
    
    result = {
        "is_processed": True,
        "message": "结论确认完成",
        "anomaly_id": anomaly_id,
        "final_conclusion": final_conclusion
    }
    
    if disposal_report:
        result["disposal_report_no"] = disposal_report.report_no
    
    return result
