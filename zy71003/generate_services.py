content = '''from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import uuid

from . import models, schemas
from .models import Slot, TemperatureSample, DisableRecord, RecheckRecord, DisposalReport, OperationLog


ERROR_CODES = {
    "MISSING_DATA": "缺材料",
    "MISSING_SEGMENT": "采样段缺失",
    "INVALID_STATUS": "状态不允许",
    "DUPLICATE_REQUEST": "重复请求",
    "NEEDS_REVIEW": "需要复核",
    "OVER_TEMPERATURE": "超温",
    "RAPID_RISE": "快速温升",
    "LARGE_TEMP_DIFF": "温差过大"
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


def check_temperature_window(temperatures: List[float], threshold: float, 
                             min_samples: int = 5, rapid_rise_threshold: float = 10.0,
                             temp_diff_threshold: float = 15.0) -> Tuple[bool, Dict[str, Any]]:
    stats = {
        "sample_count": len(temperatures),
        "missing_count": 0,
        "max_temperature": 0.0,
        "min_temperature": 0.0,
        "avg_temperature": 0.0,
        "max_temp_rise": 0.0,
        "anomaly_types": [],
        "error_code": None
    }

    if not temperatures:
        stats["error_code"] = "MISSING_DATA"
        return True, stats

    if len(temperatures) < min_samples:
        stats["missing_count"] = min_samples - len(temperatures)
        stats["error_code"] = "MISSING_SEGMENT"
        return True, stats

    temps = [t for t in temperatures if t is not None]
    stats["sample_count"] = len(temps)
    stats["missing_count"] = len(temperatures) - len(temps)

    if not temps:
        stats["error_code"] = "MISSING_DATA"
        return True, stats

    stats["max_temperature"] = max(temps)
    stats["min_temperature"] = min(temps)
    stats["avg_temperature"] = sum(temps) / len(temps)
    stats["temp_diff"] = stats["max_temperature"] - stats["min_temperature"]

    max_rise = 0.0
    for i in range(1, len(temps)):
        rise = temps[i] - temps[i-1]
        if rise > max_rise:
            max_rise = rise
    stats["max_temp_rise"] = max_rise

    is_anomaly = False

    if stats["max_temperature"] > threshold:
        is_anomaly = True
        stats["anomaly_types"].append("OVER_TEMPERATURE")

    if stats["max_temp_rise"] > rapid_rise_threshold:
        is_anomaly = True
        stats["anomaly_types"].append("RAPID_RISE")

    if stats["temp_diff"] > temp_diff_threshold:
        is_anomaly = True
        stats["anomaly_types"].append("LARGE_TEMP_DIFF")

    return is_anomaly, stats


def create_disable_record(db: Session, slot: Slot, battery_id: str, reason: str, 
                          operator: str = "system", evidence_chain: Optional[Dict] = None) -> DisableRecord:
    disable_record = DisableRecord(
        slot_id=slot.id,
        battery_id=battery_id,
        reason=reason,
        operator=operator,
        is_active=True
    )
    db.add(disable_record)
    db.flush()

    evidence_details = f"禁用原因: {reason}"
    if evidence_chain:
        evidence_details += f", 证据链: {evidence_chain}"
    
    log_operation(db, "disable_slot", slot.slot_number, battery_id,
                  operator=operator, details=evidence_details, result="success")

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
    
    is_anomaly, stats = check_temperature_window(
        request.temperatures, 
        request.threshold,
        min_samples=getattr(request, 'min_samples', 5),
        rapid_rise_threshold=getattr(request, 'rapid_rise_threshold', 10.0),
        temp_diff_threshold=getattr(request, 'temp_diff_threshold', 15.0)
    )

    if stats["error_code"] in ["MISSING_DATA", "MISSING_SEGMENT"]:
        log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                      business_no, details=f"数据缺失: {stats['error_code']}", result="failed",
                      error_code=stats["error_code"])
        return {
            "is_processed": False,
            "is_anomaly": True,
            "message": ERROR_CODES.get(stats["error_code"], "数据错误"),
            "error_code": stats["error_code"],
            "statistics": stats
        }
    
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
    
    disable_record = None
    if is_anomaly:
        if validate_slot_transition(slot.status, "disabled"):
            slot.status = "disabled"
            slot.battery_id = request.battery_id
            
            anomaly_reasons = [ERROR_CODES.get(t, t) for t in stats["anomaly_types"]]
            reason = "; ".join(anomaly_reasons)
            
            evidence_chain = {
                "business_no": business_no,
                "window_id": request.window_id,
                "statistics": stats,
                "detection_time": datetime.now().isoformat(),
                "anomaly_types": stats["anomaly_types"]
            }
            
            disable_record = create_disable_record(
                db, slot, request.battery_id, reason, 
                operator="system", evidence_chain=evidence_chain
            )
    
    db.commit()
    
    log_operation(db, "temperature_check", request.slot_number, request.battery_id,
                  business_no, details=f"温度窗口检测, 最高温: {stats['max_temperature']}, 异常: {is_anomaly}",
                  result="success")
    
    result = {
        "is_processed": True,
        "is_anomaly": is_anomaly,
        "max_temperature": stats["max_temperature"],
        "slot_status": slot.status,
        "message": "温度检测完成",
        "statistics": stats
    }
    
    if disable_record:
        result["disable_record_id"] = disable_record.id
    
    return result


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
            
            active_disable = db.query(DisableRecord).filter(
                and_(
                    DisableRecord.slot_id == slot.id,
                    DisableRecord.battery_id == request.battery_id,
                    DisableRecord.is_active == True
                )
            ).first()
            if active_disable:
                active_disable.is_active = False
                
            log_operation(db, "manual_release", request.slot_number, request.battery_id,
                          business_no, request.recheck_person,
                          details=f"人工放行, 复检结论: 正常, 备注: {request.remarks or '无'}",
                          result="success")
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


def submit_batch(db: Session, batch_data: Dict[str, Any]) -> Dict[str, Any]:
    business_no = batch_data.get("business_no")
    operator = batch_data.get("operator", "system")
    items = batch_data.get("items", [])
    
    if check_idempotent(db, business_no, "batch_submit"):
        return {
            "is_processed": True,
            "message": "批次已提交（幂等）",
            "error_code": "DUPLICATE_REQUEST",
            "success_count": 0,
            "failed_count": 0
        }
    
    success_count = 0
    failed_count = 0
    results = []
    
    for item in items:
        try:
            slot = get_or_create_slot(db, item["slot_number"])
            if slot.status == "available":
                slot.status = "occupied"
                slot.battery_id = item.get("battery_id")
                success_count += 1
                results.append({
                    "slot_number": item["slot_number"],
                    "battery_id": item.get("battery_id"),
                    "status": "success"
                })
            else:
                failed_count += 1
                results.append({
                    "slot_number": item["slot_number"],
                    "battery_id": item.get("battery_id"),
                    "status": "failed",
                    "reason": f"格口状态不允许: {slot.status}"
                })
        except Exception as e:
            failed_count += 1
            results.append({
                "slot_number": item.get("slot_number"),
                "status": "failed",
                "reason": str(e)
            })
    
    db.commit()
    
    log_operation(db, "batch_submit", business_no=business_no, operator=operator,
                  details=f"批次提交, 成功: {success_count}, 失败: {failed_count}",
                  result="success")
    
    return {
        "is_processed": True,
        "message": "批次提交完成",
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
    
    if status == "active":
        query = query.filter(DisableRecord.is_active == True)
    elif status == "inactive":
        query = query.filter(DisableRecord.is_active == False)
    
    if start_time:
        query = query.filter(DisableRecord.disable_time >= start_time)
    if end_time:
        query = query.filter(DisableRecord.disable_time <= end_time)
    
    total = query.count()
    records = query.order_by(desc(DisableRecord.disable_time)).offset(offset).limit(limit).all()
    
    result_list = []
    for record in records:
        slot = db.query(Slot).filter(Slot.id == record.slot_id).first()
        result_list.append({
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
        "items": result_list,
        "limit": limit,
        "offset": offset
    }


def get_anomaly_detail(db: Session, anomaly_id: int) -> Optional[Dict[str, Any]]:
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    if not disable_record:
        return None
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    
    temperature_samples = db.query(TemperatureSample).filter(
        and_(
            TemperatureSample.slot_id == disable_record.slot_id,
            TemperatureSample.battery_id == disable_record.battery_id
        )
    ).order_by(TemperatureSample.sample_time).all()
    
    recheck_records = db.query(RecheckRecord).filter(
        and_(
            RecheckRecord.slot_id == disable_record.slot_id,
            RecheckRecord.battery_id == disable_record.battery_id
        )
    ).order_by(RecheckRecord.recheck_time).all()
    
    operation_logs = db.query(OperationLog).filter(
        OperationLog.battery_id == disable_record.battery_id
    ).order_by(OperationLog.created_at).all()
    
    return {
        "anomaly_id": disable_record.id,
        "slot_number": slot.slot_number if slot else None,
        "slot_status": slot.status if slot else None,
        "battery_id": disable_record.battery_id,
        "reason": disable_record.reason,
        "operator": disable_record.operator,
        "disable_time": disable_record.disable_time,
        "is_active": disable_record.is_active,
        "temperature_samples": [
            {
                "temperature": s.temperature,
                "sample_time": s.sample_time,
                "window_id": s.window_id,
                "is_anomaly": s.is_anomaly
            } for s in temperature_samples
        ],
        "recheck_records": [
            {
                "recheck_person": r.recheck_person,
                "recheck_time": r.recheck_time,
                "conclusion": r.conclusion,
                "remarks": r.remarks
            } for r in recheck_records
        ],
        "operation_logs": [
            {
                "operation_type": l.operation_type,
                "operator": l.operator,
                "details": l.details,
                "result": l.result,
                "created_at": l.created_at
            } for l in operation_logs
        ]
    }


def correct_material(db: Session, correction_data: Dict[str, Any]) -> Dict[str, Any]:
    anomaly_id = correction_data.get("anomaly_id")
    operator = correction_data.get("operator", "system")
    new_temperatures = correction_data.get("temperatures")
    correction_reason = correction_data.get("reason", "")
    
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    if not disable_record:
        return {
            "is_processed": False,
            "message": "异常记录不存在",
            "error_code": "MISSING_DATA"
        }
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    if not slot:
        return {
            "is_processed": False,
            "message": "格口不存在",
            "error_code": "MISSING_DATA"
        }
    
    old_samples = db.query(TemperatureSample).filter(
        and_(
            TemperatureSample.slot_id == slot.id,
            TemperatureSample.battery_id == disable_record.battery_id
        )
    ).all()
    for sample in old_samples:
        db.delete(sample)
    
    if new_temperatures:
        for temp in new_temperatures:
            sample = TemperatureSample(
                slot_id=slot.id,
                battery_id=disable_record.battery_id,
                temperature=temp,
                window_id=f"corrected_{anomaly_id}",
                business_no=f"CORR{datetime.now().strftime('%Y%m%d%H%M%S')}",
                is_anomaly=False
            )
            db.add(sample)
    
    disable_record.is_active = False
    disable_record.reason = f"{disable_record.reason} | 已修正, 原因: {correction_reason}"
    
    if validate_slot_transition(slot.status, "available"):
        slot.status = "available"
        slot.battery_id = None
    
    db.commit()
    
    log_operation(db, "correct_material", slot.slot_number, disable_record.battery_id,
                  operator=operator,
                  details=f"材料修正, 异常ID: {anomaly_id}, 修正原因: {correction_reason}",
                  result="success")
    
    return {
        "is_processed": True,
        "message": "材料修正完成",
        "anomaly_id": anomaly_id,
        "slot_status": slot.status
    }


def confirm_conclusion(db: Session, conclusion_data: Dict[str, Any]) -> Dict[str, Any]:
    anomaly_id = conclusion_data.get("anomaly_id")
    operator = conclusion_data.get("operator")
    final_conclusion = conclusion_data.get("final_conclusion")
    remarks = conclusion_data.get("remarks", "")
    disposal_method = conclusion_data.get("disposal_method")
    
    disable_record = db.query(DisableRecord).filter(DisableRecord.id == anomaly_id).first()
    if not disable_record:
        return {
            "is_processed": False,
            "message": "异常记录不存在",
            "error_code": "MISSING_DATA"
        }
    
    slot = db.query(Slot).filter(Slot.id == disable_record.slot_id).first()
    if not slot:
        return {
            "is_processed": False,
            "message": "格口不存在",
            "error_code": "MISSING_DATA"
        }
    
    business_no = f"CONF{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    if final_conclusion == "正常":
        disable_record.is_active = False
        if validate_slot_transition(slot.status, "available"):
            slot.status = "available"
            slot.battery_id = None
    elif final_conclusion == "异常":
        if disposal_method:
            report = DisposalReport(
                report_no=f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}",
                battery_id=disable_record.battery_id,
                slot_number=slot.slot_number,
                anomaly_type=disable_record.reason,
                disposal_method=disposal_method,
                operator=operator,
                remarks=remarks,
                business_no=business_no
            )
            db.add(report)
    
    db.commit()
    
    log_operation(db, "confirm_conclusion", slot.slot_number, disable_record.battery_id,
                  business_no=business_no, operator=operator,
                  details=f"最终结论确认: {final_conclusion}, 处置方式: {disposal_method or '无'}, 备注: {remarks}",
                  result="success")
    
    return {
        "is_processed": True,
        "message": "最终结论已确认",
        "anomaly_id": anomaly_id,
        "final_conclusion": final_conclusion,
        "slot_status": slot.status,
        "business_no": business_no
    }
'''

with open('app/services.py', 'w') as f:
    f.write(content)

print(f"文件写入完成，共 {len(content.splitlines())} 行")
